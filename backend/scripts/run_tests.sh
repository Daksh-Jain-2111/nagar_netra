#!/bin/bash
# NagarNetra - Run Backend Unit & Integration Tests (Bash)
set -e

cd "$(dirname "$0")/../.."

if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Running pytest on backend/tests..."
PYTHONPATH=. pytest backend/tests -v
