@echo off
chcp 65001 > nul
title LazyNoodle - 停止服务

echo ================================================
echo   停止 LazyNoodle 服务
echo ================================================
echo.

:: 查找并结束 LazyNoodle 进程
tasklist /FI "IMAGENAME eq LazyNoodle.exe" 2>NUL | find /I /N "LazyNoodle.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo 正在停止服务...
    taskkill /F /IM LazyNoodle.exe > nul 2>&1
    echo [信息] 服务已停止
) else (
    echo [信息] 服务未运行
)

echo.
pause
