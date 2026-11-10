#!/bin/bash
# NagarNetra - Run Development Backend Server (Bash / Linux / macOS)
set -e

cd "$(dirname "$0")/../.."

if [ ! -d "venv" ]; then
    echo "Creating python virtual environment..."
    python3 -m venv venv || python -m venv venv
fi

source venv/bin/activate
pip install -r backend/requirements.txt

echo "Starting NagarNetra FastAPI server on http://localhost:8000..."
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
