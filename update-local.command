#!/bin/bash
# 占いスピYTツール - ローカルツールの更新（Mac用）
# ダブルクリックで最新版に更新できます（git clone で導入した場合）

cd "$(dirname "$0")"

echo "================================"
echo "  ローカルツールを更新します"
echo "================================"
echo ""

if [ ! -d ".git" ]; then
    echo "❌ このフォルダはgit管理されていません（zipで導入した場合は更新できません）"
    echo "   管理者の方は、オーナーに最新のzipをもらって入れ替えてください"
    echo ""
    read -p "Enterキーで閉じます..."
    exit 1
fi

echo "📥 最新版を取得中..."
git pull
if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 更新に失敗しました。ネット接続を確認してもう一度実行してください"
    read -p "Enterキーで閉じます..."
    exit 1
fi

echo ""
echo "📦 パッケージを更新中..."
npm install

echo ""
echo "🎬 yt-dlp を更新中...（動画DL失敗の予防）"
if command -v brew &> /dev/null; then
    brew upgrade yt-dlp 2>/dev/null || true
elif command -v yt-dlp &> /dev/null; then
    yt-dlp -U 2>/dev/null || true
fi

echo ""
echo "✅ 更新完了！ start-local.command をダブルクリックして起動してください"
echo ""
read -p "Enterキーで閉じます..."
