@echo off
chcp 65001 > nul
title LazyNoodle - 懒得面

echo ================================================
echo   🍜 LazyNoodle - 懒得面
echo   AI驱动的自由叙事游戏
echo ================================================
echo.

:: 检查 .env 文件
if not exist .env (
    echo [提示] 首次运行，请先配置 API Key
    echo.
    echo 1. 复制 .env.example 为 .env
    echo 2. 用记事本打开 .env，填入你的 DeepSeek API Key
    echo 3. 保存后重新运行此脚本
    echo.
    echo 注意：使用 DeepSeek 时不要开启代理/VPN
    echo.
    pause
    exit /b 1
)

echo [信息] 正在启动服务器...
echo [信息] 首次启动较慢，请耐心等待...
echo [信息] 浏览器将自动打开 http://127.0.0.1:8000
echo [信息] 关闭此窗口可停止服务器
echo.

start /b LazyNoodle.exe

:: 等待服务器启动
timeout /t 4 /nobreak > nul

:: 打开浏览器
start http://127.0.0.1:8000

echo.
echo [信息] 服务器已启动
echo [信息] 游戏地址: http://127.0.0.1:8000
echo.
echo 按任意键退出此窗口（不会关闭服务器）
pause > nul
