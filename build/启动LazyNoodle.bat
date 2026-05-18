@echo off
chcp 65001 > nul
title LazyNoodle - Lazy Noodle

echo ================================================
echo   LazyNoodle - Lazy Noodle
echo   AI-powered narrative game
echo ================================================
echo.

:: Check .env file
if not exist .env (
    echo [WARNING] .env file not found
    echo.
    echo Please copy .env.example to .env
    echo Then add your DeepSeek API Key
    echo.
    pause
    exit /b 1
)

echo [INFO] Starting server...
echo [INFO] Please wait...
echo.

start /b LazyNoodle.exe

timeout /t 4 /nobreak > nul
start http://127.0.0.1:8000

echo.
echo [INFO] Server started
echo [INFO] Game URL: http://127.0.0.1:8000
echo.
echo Press any key to exit (server will keep running)
pause > nul