# Production Deployment — Single VPS

Step-by-step runbook for deploying TusCoach on a single Ubuntu VPS behind
Nginx with TLS via Let's Encrypt.

**Target architecture:**

```
Internet
  │
  ▼
┌──────────┐
│  Nginx   │  :443 (TLS) → proxy_pass 127.0.0.1:8000
└──────────┘
  │
  ▼
┌──────────────────────────────────────┐  docker network
│  api  │  celery_worker  │ celery_beat│
│       └─────────────────┘            │
│  db (postgres:16)    redis (7)       │
└──────────────────────────────────────┘
```

---

## 0. Domain setup checklist

- [ ] Register a domain (e.g. `api.tuscoach.com`)
- [ ] Create an **A record** pointing to the VPS public IP
- [ ] Wait for DNS propagation (`dig +short api.tuscoach.com`)
- [ ] If using a subdomain for the mobile app (e.g. `app.tuscoach.com`), add
      that record too

---

## 1. Provision the VPS

Any Ubuntu 22.04+ (or Debian 12+) VPS with at least **1 vCPU / 2 GB RAM**.

```bash
# SSH in as root (or a sudo user)
ssh root@YOUR_SERVER_IP
```

### 1.1 Create a deploy user

```bash
adduser tuscoach
usermod -aG sudo tuscoach
su - tuscoach
```

### 1.2 Install Docker

```bash
# Official Docker install (one-liner)
curl -fsSL https://get.docker.com | sh

# Let the deploy user run docker without sudo
sudo usermod -aG docker $USER
newgrp docker
```

### 1.3 Install Nginx & Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 2. Firewall (minimal rules)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP  (Certbot challenge + redirect)
sudo ufw allow 443/tcp     # HTTPS (API traffic)
sudo ufw enable
sudo ufw status
```

> **Note:** Ports 5432 (Postgres) and 6379 (Redis) are intentionally NOT
> exposed. They are only reachable inside the Docker network.

---

## 3. Clone & configure

```bash
cd /home/tuscoach
git clone https://github.com/YOUR_ORG/TusCoach.git
cd TusCoach
```

### 3.1 Create the production `.env`

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```ini
ENV=prod

# Generate a strong secret — do NOT reuse the dev placeholder
JWT_SECRET=<paste output of: openssl rand -hex 32>

# Postgres credentials (also used by docker-compose.prod.yml)
POSTGRES_USER=tuscoach
POSTGRES_PASSWORD=<strong random password>
POSTGRES_DB=tuscoach

# These are overridden by docker-compose.prod.yml at runtime,
# but set them so the app can validate they're not dev defaults.
DATABASE_URL=postgresql://tuscoach:<same password>@db:5432/tuscoach
REDIS_URL=redis://redis:6379/0

# CORS — set to your production domain(s)
ALLOWED_ORIGINS=["https://api.tuscoach.com"]

# Push notifications
EXPO_ACCESS_TOKEN=<your expo token if needed>
```

> **Reminder:** `backend/.env` is in `.gitignore` — it stays on the server
> only.

---

## 4. Build & start

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Verify:

```bash
docker compose ps                    # All 5 services should be Up / healthy
curl -s http://127.0.0.1:8000/health | python3 -m json.tool
```

---

## 5. Run database migrations

```bash
docker compose exec api alembic upgrade head
```

### 5.1 Create the first user (optional)

```bash
docker compose exec api python create_test_user.py
```

---

## 6. Nginx reverse proxy

### 6.1 Create the site config

```bash
sudo tee /etc/nginx/sites-available/tuscoach <<'EOF'
server {
    listen 80;
    server_name api.tuscoach.com;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   X-Request-ID      $request_id;
        proxy_read_timeout 60s;
    }
}
EOF
```

### 6.2 Enable & test

```bash
sudo ln -sf /etc/nginx/sites-available/tuscoach /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 Obtain TLS certificate

```bash
sudo certbot --nginx -d api.tuscoach.com
```

Certbot will:
1. Prove domain ownership via the HTTP-01 challenge
2. Install the certificate into the Nginx config
3. Add an automatic HTTP → HTTPS redirect
4. Set up a systemd timer for auto-renewal

Verify renewal works:

```bash
sudo certbot renew --dry-run
```

---

## 7. Log locations

| Source | How to view |
|---|---|
| API (uvicorn + app) | `docker compose logs -f api` |
| Celery worker | `docker compose logs -f celery_worker` |
| Celery beat | `docker compose logs -f celery_beat` |
| PostgreSQL | `docker compose logs -f db` |
| Redis | `docker compose logs -f redis` |
| Nginx access | `sudo tail -f /var/log/nginx/access.log` |
| Nginx errors | `sudo tail -f /var/log/nginx/error.log` |
| Certbot renewal | `sudo journalctl -u certbot.timer` |

To stream all application logs at once:

```bash
docker compose logs -f api celery_worker celery_beat
```

> **Tip:** The API emits structured JSON logs in `ENV=prod` (via the
> `RequestLoggingMiddleware`). Each line includes `request_id`, `user_id`,
> `method`, `path`, `status_code`, and `latency_ms`.

---

## 8. Postgres backup strategy

### 8.1 Daily automated backup

Create the backup script:

```bash
sudo mkdir -p /opt/tuscoach/backups

sudo tee /opt/tuscoach/backup.sh <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/opt/tuscoach/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="tuscoach_${TIMESTAMP}.sql.gz"
RETAIN_DAYS=14

# Dump via the running container
docker compose -f /home/tuscoach/TusCoach/docker-compose.yml \
               -f /home/tuscoach/TusCoach/docker-compose.prod.yml \
               exec -T db pg_dump -U tuscoach tuscoach \
    | gzip > "${BACKUP_DIR}/${FILENAME}"

# Prune backups older than RETAIN_DAYS
find "${BACKUP_DIR}" -name "tuscoach_*.sql.gz" -mtime +${RETAIN_DAYS} -delete

echo "[$(date)] Backup complete: ${FILENAME} ($(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1))"
SCRIPT

sudo chmod +x /opt/tuscoach/backup.sh
```

### 8.2 Schedule via cron (daily at 03:00)

```bash
sudo crontab -e
```

Add:

```
0 3 * * * /opt/tuscoach/backup.sh >> /var/log/tuscoach-backup.log 2>&1
```

### 8.3 Verify backups

```bash
# List backups
ls -lh /opt/tuscoach/backups/

# Test that the latest dump is valid (does not actually import)
gunzip -t /opt/tuscoach/backups/tuscoach_*.sql.gz
```

### 8.4 Off-site copy (recommended)

Add an rsync/scp step at the end of `backup.sh`, or sync the directory to
object storage:

```bash
# Example: copy to S3-compatible storage
# aws s3 cp "${BACKUP_DIR}/${FILENAME}" s3://tuscoach-backups/
```

---

## 9. Restore procedure

### 9.1 Restore to the same server

```bash
# 1. Stop the API and workers (keep db running)
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
    stop api celery_worker celery_beat

# 2. Drop and recreate the database
docker compose exec db psql -U tuscoach -c "DROP DATABASE tuscoach;"
docker compose exec db psql -U tuscoach -c "CREATE DATABASE tuscoach;"

# 3. Restore the dump
gunzip -c /opt/tuscoach/backups/tuscoach_YYYYMMDD_HHMMSS.sql.gz \
    | docker compose exec -T db psql -U tuscoach tuscoach

# 4. Restart everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 9.2 Restore to a fresh server

1. Provision the server following sections 1–6 above.
2. Copy the backup file to the new server.
3. Start only `db`: `docker compose up -d db`
4. Run the restore (step 3 above).
5. Start remaining services: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d`

---

## 10. Updating the application

```bash
cd /home/tuscoach/TusCoach
git pull origin main

# Rebuild and restart (zero-downtime for workers, brief restart for API)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Run any new migrations
docker compose exec api alembic upgrade head
```

---

## 11. Quick health checks

```bash
# API health (returns DB + Redis status)
curl -s https://api.tuscoach.com/health | python3 -m json.tool

# TLS certificate expiry
echo | openssl s_client -servername api.tuscoach.com \
    -connect api.tuscoach.com:443 2>/dev/null \
    | openssl x509 -noout -dates

# Disk usage (backups + Docker volumes)
df -h /
sudo du -sh /opt/tuscoach/backups/
docker system df
```

---

## Reference: file layout on the server

```
/home/tuscoach/TusCoach/
├── backend/
│   ├── .env                  # Production secrets (NOT in git)
│   ├── Dockerfile
│   └── ...
├── docker-compose.yml        # Base services
├── docker-compose.prod.yml   # Production overrides
└── ...

/opt/tuscoach/
├── backup.sh                 # Daily pg_dump script
└── backups/
    ├── tuscoach_20260208_030000.sql.gz
    └── ...

/etc/nginx/sites-available/
└── tuscoach                  # Nginx vhost (managed by Certbot)
```
