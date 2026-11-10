#!/bin/bash
# NagarNetra - Seed Database (Bash)
set -e

cd "$(dirname "$0")/../.."

if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Seeding NagarNetra database..."
PYTHONPATH=. python3 -m backend.app.seed.seed_data
