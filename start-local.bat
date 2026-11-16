@echo off
chcp 65001 >nul
title Fortune YT Tool - Local
cd /d "%~dp0"

echo ================================
echo   Fortune YT Tool Local
echo ================================
echo.

REM Node.js check
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER%

REM yt-dlp check
where yt-dlp >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] yt-dlp not found. Put yt-dlp.exe in C:\Windows
) else (
    echo [OK] yt-dlp
)

REM ffmpeg check
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARN] ffmpeg not found. Put ffmpeg.exe in C:\Windows
) else (
    echo [OK] ffmpeg
)

REM .env.local setup
if not exist ".env.local" (
    echo.
    echo ================================
    echo   Initial Setup
    echo ================================
    echo.
    set /p DB_URL="Database URL: "
    set /p DB_TOKEN="Database Token: "
    set /p AI_KEY="AI API Key: "
    echo TURSO_DATABASE_URL=%DB_URL%> .env.local
    echo TURSO_AUTH_TOKEN=%DB_TOKEN%>> .env.local
    echo ANTHROPIC_API_KEY=%AI_KEY%>> .env.local
    echo %AI_KEY%> .ai_api_key
    echo [OK] Saved to .env.local
    echo.
) else (
    echo [OK] .env.local found
)

REM npm install
REM Check node_modules\next instead of the folder itself:
REM an empty node_modules folder can come from zip extraction.
if not exist "node_modules\next" (
    echo Installing packages...
    call npm install
    echo.
)

REM Prisma generate
if not exist "src\generated" (
    echo Setting up database...
    call npx prisma generate
    echo.
)

echo.
echo Starting... The browser opens automatically when the server is ready.
echo (First start may take 1-3 minutes. Keep this window open.)
echo If the browser shows "cannot connect", wait for "Ready" below, then reload.
echo Close this window to stop.
echo ================================
echo.

REM Open the browser only after the server answers (first start can take minutes).
REM Checks ports 3000 -> 3001 -> 3002 (Next.js moves to the next port if one is busy).
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for($i=0;$i -lt 120;$i++){ foreach($p in 3000,3001,3002){ try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 ('http://localhost:'+$p+'/ocr') | Out-Null; Start-Process ('http://localhost:'+$p+'/ocr'); exit } catch {} }; Start-Sleep -Seconds 2 }"

call npm run dev
