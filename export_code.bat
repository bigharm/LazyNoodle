@echo off
chcp 65001 > nul
title LazyNoodle Packer

echo ================================================
echo   LazyNoodle - Packing Tool
echo ================================================
echo.

:: Clean old files
echo [1/3] Cleaning old files...
if exist "dist" rmdir /s /q dist
if exist "build" rmdir /s /q build

echo [2/3] Checking spec file...
if not exist "LazyNoodle.spec" (
    echo [ERROR] LazyNoodle.spec not found
    pause
    exit /b 1
)

echo [3/3] Packing (about 3-5 minutes)...
pyinstaller LazyNoodle.spec --clean --noconfirm

echo.
echo ================================================
echo   Packing Complete!
echo   Output: dist\
echo ================================================
echo.
pause