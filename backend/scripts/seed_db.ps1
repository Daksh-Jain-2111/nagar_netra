# NagarNetra - Seed Database (Windows PowerShell)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..\..")

if (Test-Path ".\venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
}

$env:PYTHONPATH = "."
Write-Host "Seeding NagarNetra database..." -ForegroundColor Cyan
python -m backend.app.seed.seed_data
