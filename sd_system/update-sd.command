#!/bin/bash
# 画像生成ツール 更新（Mac用）ダブルクリックで実行
cd "$(dirname "$0")"
bash scripts/update.sh
echo ""
read -r -p "Enterキーで閉じます..." _
