@echo off
title Stop Interactive Novel System

echo ================================================
echo   Stop Interactive Novel System
echo ================================================
echo.

set PID=
for /f "tokens=5" %%a in ('netstat -aon ^| find ":8000" ^| find "LISTENING"') do (
    set PID=%%a
)

if defined PID (
    echo Found process PID: %PID%
    echo Stopping...
    taskkill /PID %PID% /F > nul 2>&1
    echo [INFO] Server stopped
) else (
    echo [INFO] No running server found
)

echo.
pause