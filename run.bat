@echo off
title Swift Studio Launcher
echo ========================================================
echo           MEMULAI SWIFT STUDIO (AI SHORTS)
echo ========================================================
echo.

echo [1/2] Menjalankan Backend FastAPI di port 8000...
start "Swift Studio - Backend" cmd /k "cd /d %~dp0backend && .venv\Scripts\uvicorn.exe main:app --reload --port 8000"

echo [2/2] Menjalankan Frontend Next.js di port 3000...
start "Swift Studio - Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Menunggu server backend dan frontend siap...
timeout /t 5 /nobreak > nul

echo Membuka Swift Studio di browser...
start http://localhost:3000

echo.
echo ========================================================
echo Swift Studio sedang berjalan!
echo - Antarmuka Web : http://localhost:3000
echo - Backend API   : http://localhost:8000
echo - API Docs      : http://localhost:8000/docs
echo ========================================================
pause
