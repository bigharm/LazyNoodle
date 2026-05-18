@echo off
set OUTPUT_FILE=all_code.txt

:: 清空输出文件
type nul > %OUTPUT_FILE%

echo =============================================================================== >> %OUTPUT_FILE%
echo Interactive Novel System - All Source Code >> %OUTPUT_FILE%
echo Generated: %date% %time% >> %OUTPUT_FILE%
echo =============================================================================== >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%

:: Python 文件（排除 worlds 和 __pycache__）
echo [PYTHON FILES] >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%
for /r %%f in (*.py) do (
    echo %%f | findstr /i "worlds\\" > nul
    if errorlevel 1 (
        echo %%f | findstr /i "__pycache__\\" > nul
        if errorlevel 1 (
            echo =============================================================================== >> %OUTPUT_FILE%
            echo FILE: %%f >> %OUTPUT_FILE%
            echo =============================================================================== >> %OUTPUT_FILE%
            echo. >> %OUTPUT_FILE%
            type "%%f" >> %OUTPUT_FILE%
            echo. >> %OUTPUT_FILE%
            echo. >> %OUTPUT_FILE%
        )
    )
)

:: JavaScript 文件（排除 worlds）
echo [JAVASCRIPT FILES] >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%
for /r %%f in (*.js) do (
    echo %%f | findstr /i "worlds\\" > nul
    if errorlevel 1 (
        echo =============================================================================== >> %OUTPUT_FILE%
        echo FILE: %%f >> %OUTPUT_FILE%
        echo =============================================================================== >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        type "%%f" >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
    )
)

:: HTML 文件（排除 worlds）
echo [HTML FILES] >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%
for /r %%f in (*.html) do (
    echo %%f | findstr /i "worlds\\" > nul
    if errorlevel 1 (
        echo =============================================================================== >> %OUTPUT_FILE%
        echo FILE: %%f >> %OUTPUT_FILE%
        echo =============================================================================== >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        type "%%f" >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
    )
)

:: CSS 文件（排除 worlds）
echo [CSS FILES] >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%
for /r %%f in (*.css) do (
    echo %%f | findstr /i "worlds\\" > nul
    if errorlevel 1 (
        echo =============================================================================== >> %OUTPUT_FILE%
        echo FILE: %%f >> %OUTPUT_FILE%
        echo =============================================================================== >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        type "%%f" >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
    )
)

:: TXT 文件（只取 prompts 目录）
echo [PROMPTS TXT FILES] >> %OUTPUT_FILE%
echo. >> %OUTPUT_FILE%
if exist "prompts\*.txt" (
    for %%f in (prompts\*.txt) do (
        echo =============================================================================== >> %OUTPUT_FILE%
        echo FILE: %%f >> %OUTPUT_FILE%
        echo =============================================================================== >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        type "%%f" >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
        echo. >> %OUTPUT_FILE%
    )
)

echo Done! Output saved to %OUTPUT_FILE%
echo Excluded: worlds folder and __pycache__
pause