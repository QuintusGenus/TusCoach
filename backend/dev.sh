#!/bin/bash
# backend/dev.sh

PORT=8000
echo "Stopping any process on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

echo "Starting Uvicorn server..."
../venv/bin/uvicorn app.main:app --host 0.0.0.0 --port $PORT --reload
