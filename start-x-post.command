#!/bin/bash
# Xポストツール - 開発サーバ起動（Mac用）
# ダブルクリックで:
# 1. 正しいブランチに切り替え
# 2. 最新コードを取得
# 3. パッケージ更新
# 4. dev サーバ起動
# 5. ブラウザで /x-post を開く

set -e
cd "$(dirname "$0")"

BRANCH="claude/x-post-creator-tool-SIPo4"

echo "================================"
echo "  Xポストツール 開発サーバ起動"
echo "================================"
echo ""

# Node.jsチェック
if ! command -v node &> /dev/null; then
    echo "❌ Node.jsがインストールされていません"
    echo ""
    echo "https://nodejs.org から LTS版 をインストールしてください"
    read -p "Enterキーで閉じます..."
    exit 1
fi

echo "✅ Node.js $(node -v) 検出"
echo ""

# Git ステータス確認（未保存変更があれば警告）
if ! git diff --quiet HEAD 2>/dev/null; then
    echo "⚠️  未コミットの変更があります"
    git status --short
    echo ""
    read -p "そのまま続けますか？（変更が失われる可能性があります） [y/N]: " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "中断しました"
        read -p "Enterキーで閉じます..."
        exit 1
    fi
fi

# 正しいブランチに切り替え
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "🔀 ブランチを切り替えます: $CURRENT_BRANCH → $BRANCH"
    git checkout "$BRANCH" || {
        echo "❌ ブランチ切り替え失敗"
        read -p "Enterキーで閉じます..."
        exit 1
    }
    echo ""
fi

# 最新を取得
echo "⬇️  最新コードを取得中..."
git pull origin "$BRANCH" || {
    echo "⚠️  git pull に失敗しました（オフライン or 認証エラー）"
    echo "   ローカルのコードでそのまま起動します"
}
echo ""

# .env.local チェック
if [ ! -f ".env.local" ]; then
    echo "================================"
    echo "  初回セットアップ"
    echo "================================"
    read -p "TURSO_DATABASE_URL: " DB_URL
    read -p "TURSO_AUTH_TOKEN: " DB_TOKEN
    cat > .env.local <<EOF
TURSO_DATABASE_URL=${DB_URL}
TURSO_AUTH_TOKEN=${DB_TOKEN}
EOF
    echo "✅ .env.local を保存"
    echo ""
fi

# 依存関係インストール（package.json が更新されてたら）
if [ ! -d "node_modules" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
    echo "📦 パッケージをインストール中..."
    npm install
    echo ""
else
    echo "✅ パッケージ最新"
fi

# Prisma生成
if [ ! -d "src/generated" ] || [ "prisma/schema.prisma" -nt "src/generated/prisma/index.js" ]; then
    echo "🔧 Prisma クライアント生成中..."
    npx prisma generate
    echo ""
fi

echo "🚀 dev サーバを起動します..."
echo ""
echo "  → http://localhost:3000/x-post"
echo ""
echo "止めるには Ctrl+C"
echo "================================"
echo ""

# 5秒後にブラウザを開く
(sleep 5 && open "http://localhost:3000/x-post") &

npm run dev
