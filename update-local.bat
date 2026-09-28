@echo off
chcp 65001 >nul
title Fortune YT Tool - Update
cd /d "%~dp0"

echo ================================
echo   Update Local Tool
echo ================================
echo.

if not exist ".git" (
    echo [INFO] This folder is not managed by git (installed from zip).
    echo        Ask the owner for a new zip and replace the folder.
    echo        Keep your .env.local file when replacing.
    echo.
    pause
    exit /b 0
)

echo Pulling latest version...
git pull
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Update failed. Check your internet connection and retry.
    pause
    exit /b 1
)

echo.
echo Updating packages...
call npm install

echo.
echo Updating yt-dlp...
winget upgrade yt-dlp.yt-dlp >nul 2>nul
where yt-dlp >nul 2>nul && yt-dlp -U >nul 2>nul

echo.
echo [OK] Update complete! Double-click start-local.bat to start.
echo.
pause
