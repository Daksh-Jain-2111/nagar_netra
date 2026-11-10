# NagarNetra - Run Development Backend Server (Windows PowerShell)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..\..")

if (-not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    python -m venv venv
}

Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& ".\venv\Scripts\Activate.ps1"

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
pip install -r backend/requirements.txt

Write-Host "Starting NagarNetra FastAPI server on http://localhost:8000..." -ForegroundColor Green
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
