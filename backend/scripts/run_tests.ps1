# NagarNetra - Run Backend Unit & Integration Tests (Windows PowerShell)
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $scriptDir "..\..")

if (Test-Path ".\venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
}

$env:PYTHONPATH = "."
Write-Host "Running pytest on backend/tests..." -ForegroundColor Cyan
pytest backend/tests -v
