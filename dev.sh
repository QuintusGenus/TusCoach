#!/bin/bash
# dev.sh — Start the full TusCoach dev environment
# Usage: ./dev.sh [--no-sim]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8000
EXPO_PORT=8081
DB_CONTAINER=tuscoach-db
REDIS_CONTAINER=tuscoach-redis
DB_VOLUME=tuscoach_postgres_data
DB_PORT=5433
DB_URL="postgresql://tuscoach:tuscoach123@localhost:${DB_PORT}/tuscoach"
OPEN_SIM=true
[[ "${1:-}" == "--no-sim" ]] && OPEN_SIM=false

die() { echo "ERROR: $*" >&2; exit 1; }
step() { echo ""; echo "▶ $*"; }

# ── 1. Docker ────────────────────────────────────────────────────────────────
step "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
  echo "  Docker not running — starting Docker Desktop..."
  open -a Docker
  for i in $(seq 1 30); do
    docker info > /dev/null 2>&1 && echo "  Docker ready." && break
    [[ $i -eq 30 ]] && die "Docker did not start within 60s"
    sleep 2
  done
fi

# ── 2. PostgreSQL ─────────────────────────────────────────────────────────────
step "Starting PostgreSQL..."
if ! docker ps -q -f name="^${DB_CONTAINER}$" | grep -q .; then
  if docker ps -aq -f name="^${DB_CONTAINER}$" | grep -q .; then
    # Container exists but stopped — try to start, recreate on failure
    if ! docker start "$DB_CONTAINER" 2>/dev/null; then
      echo "  Container unhealthy — recreating..."
      docker rm -f "$DB_CONTAINER" 2>/dev/null || true
      docker volume rm "$DB_VOLUME" 2>/dev/null || true
      docker run -d --name "$DB_CONTAINER" \
        -e POSTGRES_USER=tuscoach \
        -e POSTGRES_PASSWORD=tuscoach123 \
        -e POSTGRES_DB=tuscoach \
        -p "${DB_PORT}:5432" \
        -v "${DB_VOLUME}:/var/lib/postgresql/data" \
        postgres:16-alpine > /dev/null
    fi
  else
    echo "  Container missing — creating fresh..."
    docker run -d --name "$DB_CONTAINER" \
      -e POSTGRES_USER=tuscoach \
      -e POSTGRES_PASSWORD=tuscoach123 \
      -e POSTGRES_DB=tuscoach \
      -p "${DB_PORT}:5432" \
      -v "${DB_VOLUME}:/var/lib/postgresql/data" \
      postgres:16-alpine > /dev/null
  fi
fi

# Validate Postgres actually started (catches corrupted WAL)
for i in $(seq 1 15); do
  docker ps -q -f name="^${DB_CONTAINER}$" -f status=running | grep -q . && \
    pg_isready -h localhost -p "$DB_PORT" -U tuscoach -q && break
  if [[ $i -eq 5 ]]; then
    echo "  Postgres slow to start — checking logs..."
    if docker logs "$DB_CONTAINER" 2>&1 | grep -q "could not locate a valid checkpoint"; then
      echo "  Corrupted WAL detected — recreating volume..."
      docker rm -f "$DB_CONTAINER" 2>/dev/null || true
      docker volume rm "$DB_VOLUME" 2>/dev/null || true
      docker run -d --name "$DB_CONTAINER" \
        -e POSTGRES_USER=tuscoach \
        -e POSTGRES_PASSWORD=tuscoach123 \
        -e POSTGRES_DB=tuscoach \
        -p "${DB_PORT}:5432" \
        -v "${DB_VOLUME}:/var/lib/postgresql/data" \
        postgres:16-alpine > /dev/null
    fi
  fi
  [[ $i -eq 15 ]] && die "PostgreSQL did not become ready"
  sleep 1
done
echo "  PostgreSQL ready."

# ── 3. Redis ─────────────────────────────────────────────────────────────────
step "Starting Redis..."
if ! docker ps -q -f name="^${REDIS_CONTAINER}$" | grep -q .; then
  if docker ps -aq -f name="^${REDIS_CONTAINER}$" | grep -q .; then
    docker start "$REDIS_CONTAINER" > /dev/null
  else
    docker run -d --name "$REDIS_CONTAINER" \
      -p 6379:6379 \
      redis:7-alpine > /dev/null
  fi
fi
echo "  Redis ready."

# ── 4. Migrations ─────────────────────────────────────────────────────────────
step "Running Alembic migrations..."
(cd "$SCRIPT_DIR/backend" && \
  DATABASE_URL="$DB_URL" \
  "$SCRIPT_DIR/venv/bin/alembic" upgrade head 2>&1 | grep -E "Running upgrade|already up to date" || true)
echo "  Migrations done."

# ── 5. Clear ports ────────────────────────────────────────────────────────────
step "Clearing ports ${BACKEND_PORT} and ${EXPO_PORT}..."
lsof -ti:"$BACKEND_PORT" | xargs kill -9 2>/dev/null || true
lsof -ti:"$EXPO_PORT"    | xargs kill -9 2>/dev/null || true

# ── 6. Backend ────────────────────────────────────────────────────────────────
step "Starting backend (port ${BACKEND_PORT})..."
(cd "$SCRIPT_DIR/backend" && \
  DATABASE_URL="$DB_URL" \
  "$SCRIPT_DIR/venv/bin/uvicorn" app.main:app \
    --host 0.0.0.0 --port "$BACKEND_PORT" --reload \
  > "$SCRIPT_DIR/.backend.log" 2>&1) &
BACKEND_PID=$!

for i in $(seq 1 20); do
  curl -sf "http://localhost:${BACKEND_PORT}/health" > /dev/null 2>&1 && \
    echo "  Backend ready (PID ${BACKEND_PID})." && break
  [[ $i -eq 20 ]] && { echo "  Backend log tail:"; tail -20 "$SCRIPT_DIR/.backend.log"; die "Backend did not start"; }
  sleep 1
done

# ── 7. iOS Simulator ──────────────────────────────────────────────────────────
if $OPEN_SIM; then
  step "Booting iOS Simulator..."
  SIM_UDID=$(xcrun simctl list devices available -j 2>/dev/null | \
    python3 -c "
import sys, json
devs = json.load(sys.stdin)['devices']
for rt, lst in devs.items():
    if 'iOS' not in rt: continue
    for d in lst:
        if 'iPhone' in d['name'] and d['isAvailable']:
            print(d['udid']); exit()
" 2>/dev/null || true)
  if [[ -z "$SIM_UDID" ]]; then
    echo "  No available iPhone simulator found — skipping sim launch."
    OPEN_SIM=false
  else
    xcrun simctl boot "$SIM_UDID" 2>/dev/null || true
    open -a Simulator
  fi
fi

# ── 8. Celery Worker & Beat ──────────────────────────────────────────────────
step "Starting Celery worker + beat (AI workflows)..."
(cd "$SCRIPT_DIR/backend" && \
  DATABASE_URL="$DB_URL" \
  "$SCRIPT_DIR/venv/bin/celery" -A app.core.celery_app worker \
    --loglevel=warning --concurrency=2 \
  > "$SCRIPT_DIR/.celery-worker.log" 2>&1) &
CELERY_WORKER_PID=$!

(cd "$SCRIPT_DIR/backend" && \
  DATABASE_URL="$DB_URL" \
  "$SCRIPT_DIR/venv/bin/celery" -A app.core.celery_app beat \
    --loglevel=warning \
  > "$SCRIPT_DIR/.celery-beat.log" 2>&1) &
CELERY_BEAT_PID=$!
echo "  Celery worker PID ${CELERY_WORKER_PID}, beat PID ${CELERY_BEAT_PID}."

# ── 9. Metro / Expo ───────────────────────────────────────────────────────────
step "Starting Metro bundler (port ${EXPO_PORT})..."
HOST_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")

(cd "$SCRIPT_DIR/mobile" && \
  printf 'n\n' | npx expo start \
  > "$SCRIPT_DIR/.metro.log" 2>&1) &
EXPO_PID=$!

for i in $(seq 1 30); do
  curl -sf "http://localhost:${EXPO_PORT}/status" 2>/dev/null | grep -q "packager-status:running" && \
    echo "  Metro ready (PID ${EXPO_PID})." && break
  [[ $i -eq 30 ]] && { echo "  Metro log tail:"; tail -20 "$SCRIPT_DIR/.metro.log"; die "Metro did not start"; }
  sleep 1
done

# Open in simulator using LAN IP so the device can reach the host
if $OPEN_SIM && [[ -n "$SIM_UDID" ]]; then
  xcrun simctl openurl "$SIM_UDID" "exp://${HOST_IP}:${EXPO_PORT}" 2>/dev/null || true
  echo "  Opened exp://${HOST_IP}:${EXPO_PORT} on simulator."
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        TusCoach dev environment ready        ║"
echo "╠══════════════════════════════════════════════╣"
printf "║  Backend   http://localhost:%-17s║\n" "${BACKEND_PORT}"
printf "║  Metro     http://localhost:%-17s║\n" "${EXPO_PORT}"
printf "║  DB        %-34s║\n" "localhost:${DB_PORT}/tuscoach"
printf "║  Expo URL  exp://%-28s║\n" "${HOST_IP}:${EXPO_PORT}"
printf "║  Celery    worker + beat%-21s║\n" ""
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Logs: .backend.log  .celery-worker.log  .celery-beat.log  .metro.log"
echo "Press Ctrl+C to stop all services."

trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $CELERY_WORKER_PID $CELERY_BEAT_PID $EXPO_PID 2>/dev/null; exit 0" INT TERM
wait
