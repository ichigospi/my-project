#!/bin/bash
# 占いスピYTツール - ローカル台本読み取りツール起動（Mac用）
# ダブルクリックで起動できます

cd "$(dirname "$0")"

echo "================================"
echo "  占いスピYTツール ローカル版"
echo "  台本読み取りツール"
echo "================================"
echo ""

# Node.jsチェック
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません"
    echo ""
    echo "以下の手順でインストールしてください："
    echo "1. https://nodejs.org を開く"
    echo "2. LTS版をダウンロードしてインストール"
    echo ""
    echo "インストール後、このファイルをもう一度ダブルクリックしてください"
    echo ""
    read -p "Enterキーで閉じます..."
    exit 1
fi

echo "✅ Node.js $(node -v) 検出"

# 依存関係インストール（初回 or 更新時）
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "📦 パッケージをインストール中..."
    npm install
    echo ""
fi

# Prisma生成
if [ ! -d "src/generated" ]; then
    echo "🔧 データベース設定中..."
    npx prisma generate
    echo ""
fi

echo "🚀 台本読み取りツールを起動中..."
echo ""
echo "ブラウザで以下を開いてください："
echo "  → http://localhost:3000/ocr"
echo ""
echo "停止するには Ctrl+C を押してください"
echo "================================"
echo ""

# 2秒後にブラウザを自動で開く
(sleep 3 && open "http://localhost:3000/ocr") &

npm run dev
