#!/bin/bash
# 占いスピYTツール - リモート公開版（管理者がブラウザからアクセス可能）
# Cloudflare Quick Tunnel を使用（無料・サインアップ不要）
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

# cloudflaredチェック・インストール（brew不要、直接バイナリを取得）
CLOUDFLARED_BIN="$(command -v cloudflared 2>/dev/null)"
if [ -z "$CLOUDFLARED_BIN" ]; then
    # ローカルにキャッシュした cloudflared を再利用
    if [ -x "./.bin/cloudflared" ]; then
        CLOUDFLARED_BIN="$(pwd)/.bin/cloudflared"
    else
        echo ""
        echo "📦 cloudflared を取得中..."
        ARCH="$(uname -m)"
        case "$ARCH" in
            arm64)  CF_ASSET="cloudflared-darwin-arm64.tgz" ;;
            x86_64) CF_ASSET="cloudflared-darwin-amd64.tgz" ;;
            *)
                echo "❌ 未対応のCPUアーキテクチャ: $ARCH"
                read -p "Enterキーで閉じます..."
                exit 1
                ;;
        esac
        mkdir -p ./.bin
        if curl -fL --progress-bar \
            -o "./.bin/cloudflared.tgz" \
            "https://github.com/cloudflare/cloudflared/releases/latest/download/$CF_ASSET"; then
            tar -xzf "./.bin/cloudflared.tgz" -C "./.bin/"
            rm -f "./.bin/cloudflared.tgz"
            chmod +x "./.bin/cloudflared"
            CLOUDFLARED_BIN="$(pwd)/.bin/cloudflared"
            echo "✅ cloudflared インストール完了"
        else
            echo "❌ cloudflared のダウンロードに失敗しました"
            read -p "Enterキーで閉じます..."
            exit 1
        fi
    fi
fi
echo "✅ cloudflared 検出: $CLOUDFLARED_BIN"

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

# サーバー起動を待つ（http://localhost:3000 が応答するまで最大30秒）
echo "⏳ サーバーの起動を待機中..."
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -qE "^(200|3..|4..)$"; then
        break
    fi
    sleep 1
done

# Cloudflare Quick Tunnel 開始（ログを一時ファイルに）
echo ""
echo "🌐 外部公開中..."
echo ""
TUNNEL_LOG="$(mktemp -t cloudflared-XXXXXX.log)"
"$CLOUDFLARED_BIN" tunnel --no-autoupdate --url http://localhost:3000 > "$TUNNEL_LOG" 2>&1 &
TUNNEL_PID=$!

# 公開URLが出るまで最大30秒待つ
TUNNEL_URL=""
for i in $(seq 1 30); do
    TUNNEL_URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$TUNNEL_LOG" | head -1)"
    if [ -n "$TUNNEL_URL" ]; then
        break
    fi
    sleep 1
done

echo ""
echo "================================"
if [ -n "$TUNNEL_URL" ]; then
    echo "  管理者に以下のURLを共有してください："
    echo ""
    echo "  → ${TUNNEL_URL}/ocr"
    echo ""
else
    echo "  ⚠️  公開URLの取得に失敗しました"
    echo "  下記ログで 'trycloudflare.com' を含む行を探してください："
    echo "  $TUNNEL_LOG"
    echo ""
fi
echo "  このウィンドウを閉じると停止します"
echo "================================"
echo ""

# 終了時にクリーンアップ
trap "kill $NPM_PID $TUNNEL_PID 2>/dev/null; rm -f '$TUNNEL_LOG'" EXIT

wait $NPM_PID
