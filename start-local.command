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

# yt-dlpチェック
if ! command -v yt-dlp &> /dev/null; then
    echo "⚠️  yt-dlpがインストールされていません"
    echo ""
    echo "以下のコマンドでインストールしてください："
    echo "  brew install yt-dlp"
    echo ""
else
    echo "✅ yt-dlp 検出"
fi

# ffmpegチェック
if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️  ffmpegがインストールされていません"
    echo ""
    echo "以下のコマンドでインストールしてください："
    echo "  brew install ffmpeg"
    echo ""
else
    echo "✅ ffmpeg 検出"
fi

# .env.local チェック・作成
if [ ! -f ".env.local" ]; then
    echo ""
    echo "================================"
    echo "  初回セットアップ"
    echo "  データベースとAPIキーを設定します"
    echo "================================"
    echo ""
    read -p "データベースURL (TURSO_DATABASE_URL): " DB_URL
    read -p "データベーストークン (TURSO_AUTH_TOKEN): " DB_TOKEN
    read -p "AI APIキー (ANTHROPIC_API_KEY): " AI_KEY
    # 入力値の浄化（前後の空白・不可視文字・誤って含めたキー名を自動除去）
    DB_URL=$(printf '%s' "$DB_URL" | LC_ALL=C tr -cd '\40-\176' | sed -e 's/^ *//' -e 's/ *$//' -e 's/^TURSO_DATABASE_URL=//')
    DB_TOKEN=$(printf '%s' "$DB_TOKEN" | LC_ALL=C tr -cd '\40-\176' | sed -e 's/^ *//' -e 's/ *$//' -e 's/^TURSO_AUTH_TOKEN=//')
    AI_KEY=$(printf '%s' "$AI_KEY" | LC_ALL=C tr -cd '\40-\176' | sed -e 's/^ *//' -e 's/ *$//' -e 's/^ANTHROPIC_API_KEY=//')
    echo ""
    echo "設定を .env.local に保存中..."
    cat > .env.local <<ENVEOF
TURSO_DATABASE_URL=${DB_URL}
TURSO_AUTH_TOKEN=${DB_TOKEN}
ANTHROPIC_API_KEY=${AI_KEY}
ENVEOF
    echo "${AI_KEY}" > .ai_api_key
    echo "✅ 設定を保存しました"
    echo ""
else
    echo "✅ .env.local 検出"
fi

# .env.local の自動検査・自動修復（コピペ事故対策: 不可視文字・改行コード・キー名の重複を除去）
if [ -f ".env.local" ]; then
    LC_ALL=C tr -cd '\11\12\15\40-\176' < .env.local | tr -d '\r' \
      | sed -e 's/^TURSO_DATABASE_URL=TURSO_DATABASE_URL=/TURSO_DATABASE_URL=/' \
            -e 's/^TURSO_AUTH_TOKEN=TURSO_AUTH_TOKEN=/TURSO_AUTH_TOKEN=/' \
            -e 's/^ANTHROPIC_API_KEY=ANTHROPIC_API_KEY=/ANTHROPIC_API_KEY=/' \
            -e 's/[[:space:]]*$//' > .env.local.tmp && mv .env.local.tmp .env.local
    DB_URL_CHECK=$(grep '^TURSO_DATABASE_URL=' .env.local | head -1 | cut -d= -f2-)
    if printf '%s' "$DB_URL_CHECK" | grep -Eq '^libsql://[A-Za-z0-9.-]+$'; then
        echo "✅ 設定ファイルの検査OK"
    else
        echo ""
        echo "❌ データベースURLの形式が正しくありません"
        echo "   現在の値: $DB_URL_CHECK"
        echo "   正しい形式: libsql://で始まり、英数字・ドット・ハイフンのみ"
        echo ""
        echo "   対処: オーナーから正しい値（または .env.local ファイルそのもの）を"
        echo "   受け取り、fortune-yt-tool フォルダ内の .env.local を差し替えてください"
        echo ""
        read -p "Enterキーで閉じます..."
        exit 1
    fi
fi

# 以前のツールサーバーの自動掃除（二重起動・ポートずれ防止。他アプリは触らない）
for pid in $(lsof -ti tcp:3000 -ti tcp:3001 -ti tcp:3002 2>/dev/null); do
    SRV_CWD=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
    if [ "$SRV_CWD" = "$(pwd)" ]; then
        kill -9 "$pid" 2>/dev/null && echo "🧹 以前のツールサーバー(PID:$pid)を停止しました"
    fi
done

# 依存関係インストール（初回 or 更新時。zip展開で空のnode_modulesが出来ることがあるため中身で判定）
if [ ! -d "node_modules/next" ] || [ "package.json" -nt "node_modules/.package-lock.json" ]; then
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

# 3秒後にブラウザを自動で開く
(sleep 3 && open "http://localhost:3000/ocr") &

npm run dev
