@echo off
chcp 65001 > nul
title Stop LazyNoodle

echo ================================================
echo   Stop LazyNoodle Server
echo ================================================
echo.

tasklist /FI "IMAGENAME eq LazyNoodle.exe" 2>NUL | find /I /N "LazyNoodle.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Stopping server...
    taskkill /F /IM LazyNoodle.exe > nul 2>&1
    echo [INFO] Server stopped
) else (
    echo [INFO] Server is not running
)

echo.
pause