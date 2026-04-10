@echo off
chcp 65001 >nul
title 占いスピYTツール - ローカル台本読み取り

echo ================================
echo   占いスピYTツール ローカル版
echo   台本読み取りツール
echo ================================
echo.

cd /d "%~dp0"

REM Node.jsチェック
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.jsがインストールされていません
    echo.
    echo 以下の手順でインストールしてください：
    echo 1. https://nodejs.org を開く
    echo 2. LTS版をダウンロードしてインストール
    echo.
    echo インストール後、このファイルをもう一度ダブルクリックしてください
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
echo ✅ Node.js %NODE_VER% 検出

REM yt-dlpチェック
where yt-dlp >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  yt-dlpがインストールされていません
    echo.
    echo 以下の手順でインストールしてください：
    echo   1. https://github.com/yt-dlp/yt-dlp/releases から最新版をダウンロード
    echo   2. yt-dlp.exe をPATHの通ったフォルダに配置
    echo   または: pip install yt-dlp
    echo.
) else (
    echo ✅ yt-dlp 検出
)

REM ffmpegチェック
where ffmpeg >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠️  ffmpegがインストールされていません
    echo.
    echo 以下の手順でインストールしてください：
    echo   1. https://ffmpeg.org/download.html からダウンロード
    echo   2. binフォルダをPATHに追加
    echo   または: winget install ffmpeg
    echo.
) else (
    echo ✅ ffmpeg 検出
)

REM .env.local チェック・作成
if not exist ".env.local" (
    echo.
    echo ================================
    echo   初回セットアップ
    echo   データベースとAPIキーを設定します
    echo ================================
    echo.
    set /p DB_URL="データベースURL (TURSO_DATABASE_URL): "
    set /p DB_TOKEN="データベーストークン (TURSO_AUTH_TOKEN): "
    set /p AI_KEY="AI APIキー (ANTHROPIC_API_KEY): "
    echo.
    echo 設定を .env.local に保存中...
    (
        echo TURSO_DATABASE_URL=%DB_URL%
        echo TURSO_AUTH_TOKEN=%DB_TOKEN%
        echo ANTHROPIC_API_KEY=%AI_KEY%
    ) > .env.local
    echo %AI_KEY%> .ai_api_key
    echo ✅ 設定を保存しました
    echo.
) else (
    echo ✅ .env.local 検出
)

REM 依存関係インストール
if not exist "node_modules" (
    echo 📦 パッケージをインストール中...
    call npm install
    echo.
)

REM Prisma生成
if not exist "src\generated" (
    echo 🔧 データベース設定中...
    call npx prisma generate
    echo.
)

echo 🚀 台本読み取りツールを起動中...
echo.
echo ブラウザで以下を開いてください：
echo   → http://localhost:3000/ocr
echo.
echo 停止するには このウィンドウを閉じてください
echo ================================
echo.

REM 3秒後にブラウザを自動で開く
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000/ocr"

call npm run dev
