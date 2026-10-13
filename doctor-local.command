#!/bin/bash
# 占いスピYTツール - ローカル環境の一発診断（Mac用）
# ダブルクリックで、必要なものが揃っているか・何が問題かをすべて表示します

cd "$(dirname "$0")"
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

echo "================================"
echo "  ローカル環境診断"
echo "================================"
echo ""

OK=0; NG=0

# Node.js
if command -v node >/dev/null 2>&1; then
    echo "✅ Node.js $(node -v)"; OK=$((OK+1))
else
    echo "❌ Node.js 未インストール"
    echo "   → https://nodejs.org からLTS版をインストール"
    NG=$((NG+1))
fi

# yt-dlp
if command -v yt-dlp >/dev/null 2>&1; then
    echo "✅ yt-dlp $(yt-dlp --version 2>/dev/null)"; OK=$((OK+1))
else
    echo "❌ yt-dlp 未インストール"
    echo "   → ターミナルで以下の2行を実行（完成品を直接配置。数十秒で終わります）:"
    echo "     curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos -o /opt/homebrew/bin/yt-dlp"
    echo "     chmod +x /opt/homebrew/bin/yt-dlp"
    NG=$((NG+1))
fi

# ffmpeg
if command -v ffmpeg >/dev/null 2>&1; then
    echo "✅ ffmpeg"; OK=$((OK+1))
else
    echo "❌ ffmpeg 未インストール → brew install ffmpeg"
    NG=$((NG+1))
fi

# .env.local
echo ""
if [ -f ".env.local" ]; then
    DB_URL_CHECK=$(grep '^TURSO_DATABASE_URL=' .env.local | head -1 | cut -d= -f2-)
    TOKEN_CHECK=$(grep '^TURSO_AUTH_TOKEN=' .env.local | head -1 | cut -d= -f2-)
    KEY_CHECK=$(grep '^ANTHROPIC_API_KEY=' .env.local | head -1 | cut -d= -f2-)
    if printf '%s' "$DB_URL_CHECK" | grep -Eq '^libsql://[A-Za-z0-9.-]+$'; then
        echo "✅ データベースURL 形式OK（$DB_URL_CHECK）"; OK=$((OK+1))
    else
        echo "❌ データベースURLの形式が不正: $DB_URL_CHECK"
        echo "   → オーナーから .env.local ファイルをもらって差し替えるのが確実です"
        NG=$((NG+1))
    fi
    if [ -n "$TOKEN_CHECK" ]; then echo "✅ データベーストークン 設定あり（${#TOKEN_CHECK}文字）"; OK=$((OK+1)); else echo "❌ データベーストークン 未設定"; NG=$((NG+1)); fi
    case "$KEY_CHECK" in
        sk-ant-*) echo "✅ AI APIキー 形式OK"; OK=$((OK+1));;
        "") echo "❌ AI APIキー 未設定"; NG=$((NG+1));;
        *) echo "⚠️  AI APIキーが sk-ant- で始まっていません（要確認）"; NG=$((NG+1));;
    esac
else
    echo "❌ .env.local がありません（start-local.command の初回起動で作成されます）"
    NG=$((NG+1))
fi

# ポート状況
echo ""
echo "---- ポート使用状況 ----"
RUNNING_URL=""
for p in 3000 3001 3002; do
    PIDS=$(lsof -ti tcp:$p 2>/dev/null | head -1)
    if [ -z "$PIDS" ]; then
        echo "  $p: 空き"
    else
        SRV_CWD=$(lsof -a -p "$PIDS" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)
        CMD_NAME=$(ps -p "$PIDS" -o comm= 2>/dev/null)
        if [ "$SRV_CWD" = "$(pwd)" ]; then
            echo "  $p: ✅ このツールのサーバーが稼働中 → http://localhost:$p/ocr"
            RUNNING_URL="http://localhost:$p/ocr"
        else
            echo "  $p: 別のアプリが使用中（$CMD_NAME）- このポートでは開かないでください"
        fi
    fi
done

echo ""
echo "================================"
if [ "$NG" -eq 0 ]; then
    if [ -n "$RUNNING_URL" ]; then
        echo "🎉 すべてOKです。ブラウザで $RUNNING_URL を開いてください"
    else
        echo "🎉 環境はすべてOKです。start-local.command で起動してください"
        echo "   （起動画面に表示される Local: のURLに /ocr を付けて開きます）"
    fi
else
    echo "⚠️  ${NG}件の問題があります。上の❌の指示に従って解消してください"
fi
echo "================================"
echo ""
read -p "Enterキーで閉じます..."
