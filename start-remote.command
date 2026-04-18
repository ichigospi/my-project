#!/bin/bash
# 占いスピYTツール - リモート公開版（管理者がブラウザからアクセス可能）
# ダブルクリックで起動できます

cd "$(dirname "$0")"

echo "================================"
echo "  占いスピYTツール リモート公開版"
echo "  管理者がブラウザからアクセス可能"
echo "================================"
echo ""

# Node.jsチェック
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません"
    echo "https://nodejs.org からインストールしてください"
    read -p "Enterキーで閉じます..."
    exit 1
fi
echo "✅ Node.js $(node -v)"

# ngrokチェック・インストール
if ! command -v ngrok &> /dev/null; then
    echo ""
    echo "📦 ngrokをインストール中..."
    if command -v brew &> /dev/null; then
        brew install ngrok
    else
        echo "❌ Homebrewが必要です。先にインストールしてください："
        echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
        echo "  その後: brew install ngrok"
        read -p "Enterキーで閉じます..."
        exit 1
    fi
fi
echo "✅ ngrok 検出"

# ngrok認証チェック
if ! ngrok config check &> /dev/null; then
    echo ""
    echo "================================"
    echo "  ngrok初回セットアップ"
    echo "================================"
    echo ""
    echo "1. https://dashboard.ngrok.com/signup でアカウント作成（無料）"
    echo "2. https://dashboard.ngrok.com/get-started/your-authtoken でトークンをコピー"
    echo ""
    read -p "ngrokのAuthTokenを貼り付け: " NGROK_TOKEN
    ngrok config add-authtoken "$NGROK_TOKEN"
    echo "✅ ngrok認証完了"
    echo ""
fi

# .env.localチェック
if [ ! -f ".env.local" ]; then
    echo ""
    echo "================================"
    echo "  データベース設定"
    echo "================================"
    echo ""
    read -p "データベースURL: " DB_URL
    read -p "データベーストークン: " DB_TOKEN
    read -p "AI APIキー: " AI_KEY
    cat > .env.local <<ENVEOF
TURSO_DATABASE_URL=${DB_URL}
TURSO_AUTH_TOKEN=${DB_TOKEN}
ANTHROPIC_API_KEY=${AI_KEY}
ENVEOF
    echo "${AI_KEY}" > .ai_api_key
    echo "✅ 設定保存完了"
    echo ""
else
    echo "✅ .env.local 検出"
fi

# 依存関係
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "📦 パッケージインストール中..."
    npm install
fi

if [ ! -d "src/generated" ]; then
    echo "🔧 Prisma設定中..."
    npx prisma generate
fi

echo ""
echo "🚀 サーバー起動中..."
echo ""

# Next.jsをバックグラウンドで起動
npm run dev &
NPM_PID=$!

# サーバー起動を待つ
sleep 5

# ngrokでトンネル開始
echo ""
echo "🌐 外部公開中..."
echo ""
ngrok http 3000 --log=stdout &
NGROK_PID=$!

# ngrokのURLを取得して表示
sleep 3
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "================================"
echo "  管理者に以下のURLを共有してください："
echo ""
echo "  → ${NGROK_URL}/ocr"
echo ""
echo "  このウィンドウを閉じると停止します"
echo "================================"
echo ""

# 終了時にクリーンアップ
trap "kill $NPM_PID $NGROK_PID 2>/dev/null" EXIT

wait $NPM_PID
