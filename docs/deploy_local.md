# Local Deployment with Docker

## Prerequisites

- Docker Engine 20+ and Docker Compose v2
- The repository cloned locally

## 1. Create your `.env` file

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` if you need to change defaults. The compose file overrides
`DATABASE_URL` and `REDIS_URL` to point at the container hostnames (`db` and
`redis`) automatically — you do **not** need to change those two values.

> **Important:** Never commit `backend/.env`. It is already in `.gitignore`.

## 2. Build

```bash
docker compose build
```

## 3. Start all services

```bash
docker compose up -d
```

This starts five services:

| Service          | Container              | Port  | Description            |
|------------------|------------------------|-------|------------------------|
| `db`             | tuscoach-db            | 5433  | PostgreSQL 16          |
| `redis`          | tuscoach-redis         | 6379  | Redis 7                |
| `api`            | tuscoach-api           | 8000  | FastAPI (uvicorn)      |
| `celery_worker`  | tuscoach-celery-worker | —     | Celery task worker     |
| `celery_beat`    | tuscoach-celery-beat   | —     | Celery periodic beat   |

Check status:

```bash
docker compose ps
docker compose logs api         # API logs
docker compose logs celery_worker  # Worker logs
```

## 4. Run database migrations

```bash
docker compose exec api alembic upgrade head
```

Alembic reads `DATABASE_URL` from the environment, so it automatically connects
to the `db` container.

## 5. Create an initial user (optional)

```bash
docker compose exec api python create_test_user.py
```

This creates `mobile@test.com` / `test123` with a student profile.

## 6. Verify

```bash
# Health check
curl http://localhost:8000/health

# API docs
open http://localhost:8000/docs
```

## Common commands

```bash
# Stop everything (preserves data volumes)
docker compose down

# Stop and delete data volumes (fresh start)
docker compose down -v

# Rebuild after requirements.txt or Dockerfile change
docker compose build --no-cache

# Run tests inside the container
docker compose exec api python -m pytest tests/ -v

# Create a new Alembic migration
docker compose exec api alembic revision --autogenerate -m "describe change"

# View real-time logs
docker compose logs -f api celery_worker
```

## Connecting from the host

The database is exposed on `localhost:5433` and Redis on `localhost:6379`, so
you can still use local tools (pgcli, redis-cli, etc.) or run the mobile app
against `http://localhost:8000` without any changes.
