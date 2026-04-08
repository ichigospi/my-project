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
