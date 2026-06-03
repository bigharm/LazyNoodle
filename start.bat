@echo off
cd /d "%~dp0"

echo Starting backend server...
start "Backend" cmd /k "uvicorn backend.api:app --host 0.0.0.0 --port 8000 --reload"

echo Waiting for server...
timeout /t 3 /nobreak > nul

echo Opening Chrome...
start chrome http://127.0.0.1:8000

echo Done!
echo.
echo 手机访问请使用电脑的局域网IP，例如: http://192.168.x.x:8000