#!/bin/bash
# 画像生成ツール 起動（Mac用）ダブルクリックで実行
cd "$(dirname "$0")"
bash scripts/start.sh
echo ""
read -r -p "Enterキーで閉じます..." _
