# PowerShell script to start Python embedding service locally on Windows

Write-Host "🚀 Starting Python Embedding Service..." -ForegroundColor Green

# Change to Python directory
Set-Location $PSScriptRoot

# Check if Python is installed
if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Python is not installed or not in PATH!" -ForegroundColor Red
    Write-Host "Please install Python 3 from https://www.python.org/" -ForegroundColor Yellow
    exit 1
}

# Check if virtual environment exists, create if not
if (-not (Test-Path "venv")) {
    Write-Host "Creating Python virtual environment..." -ForegroundColor Yellow
    python -m venv venv
}

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& "$PSScriptRoot\venv\Scripts\Activate.ps1"

# Install dependencies if needed
if (-not (Test-Path "venv\Lib\site-packages\sentence_transformers")) {
    Write-Host "Installing Python dependencies (this may take a few minutes on first run)..." -ForegroundColor Yellow
    pip install -r requirements.txt
}

# Start the service
Write-Host "✅ Starting embedding service on http://localhost:5000..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
python embedding_service.py

