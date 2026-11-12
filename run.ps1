# Script untuk menjalankan Swift Studio di PowerShell
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          MEMULAI SWIFT STUDIO (AI SHORTS)              " -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "`n[1/2] Menjalankan Backend FastAPI di port 8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend'; .\.venv\Scripts\uvicorn.exe main:app --reload --port 8000"

Write-Host "[2/2] Menjalankan Frontend Next.js di port 3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\frontend'; npm run dev"

Write-Host "`nMenunggu server siap dalam 5 detik..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "Membuka Swift Studio di browser (http://localhost:3000)..." -ForegroundColor Cyan
Start-Process "http://localhost:3000"

Write-Host "`nSwift Studio telah aktif!" -ForegroundColor Green
Write-Host "- Frontend Web : http://localhost:3000"
Write-Host "- Backend API  : http://localhost:8000"
Write-Host "- API Docs     : http://localhost:8000/docs"
