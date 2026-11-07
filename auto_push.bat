@echo off
if "%~1"=="" (
    echo Usage: auto_push.bat "commit message"
    exit /b 1
)
git add .
git commit -m "%~1" || exit /b 1
git pull origin main --rebase || exit /b 1
git push origin main || exit /b 1
