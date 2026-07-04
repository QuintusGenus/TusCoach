#!/bin/bash
# dev.sh — Start the full TusCoach dev environment
# Usage: ./dev.sh

set -e

BACKEND_PORT=8000
EXPO_PORT=8081

echo "=== TusCoach Dev Environment ==="

# 1. Ensure PostgreSQL container is running
echo "Starting PostgreSQL..."
docker start tuscoach-postgres 2>/dev/null || true
docker start tuscoach-redis 2>/dev/null || true
sleep 1

# 2. Kill stale processes on required ports
echo "Clearing ports $BACKEND_PORT and $EXPO_PORT..."
lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null || true
lsof -ti:$EXPO_PORT | xargs kill -9 2>/dev/null || true
sleep 1

# 3. Start backend
echo "Starting backend on port $BACKEND_PORT..."
cd backend
../venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $BACKEND_PORT --reload &
BACKEND_PID=$!
cd ..

# Wait for backend to be ready
echo "Waiting for backend..."
for i in $(seq 1 15); do
  if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1; then
    echo "Backend ready!"
    break
  fi
  sleep 1
done

# 4. Start Expo with iOS simulator
echo "Starting Expo + iOS Simulator..."
cd mobile
npx expo start --ios &
EXPO_PID=$!
cd ..

echo ""
echo "=== All services running ==="
echo "  Backend:  http://localhost:$BACKEND_PORT (PID $BACKEND_PID)"
echo "  Expo:     http://localhost:$EXPO_PORT (PID $EXPO_PID)"
echo ""
echo "Press Ctrl+C to stop all services."

# Trap Ctrl+C to clean up both processes
trap "echo 'Stopping...'; kill $BACKEND_PID $EXPO_PID 2>/dev/null; exit 0" INT TERM

# Wait for either process to exit
wait
