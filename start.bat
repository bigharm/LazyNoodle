@echo off
cd /d "%~dp0"

echo Starting backend server...
start "Backend" cmd /k "uvicorn backend.api:app --host 127.0.0.1 --port 8000 --reload"

echo Waiting for server...
timeout /t 3 /nobreak > nul

echo Opening Chrome...
start chrome http://127.0.0.1:8000

echo Done!