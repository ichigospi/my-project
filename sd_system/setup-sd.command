#!/bin/bash
# 画像生成ツール（Stable Diffusion / Illustrious）初回セットアップ（Mac用）
# ダブルクリックで実行できます。2回目以降は start-sd.command を使ってください
cd "$(dirname "$0")"
bash scripts/setup.sh
echo ""
read -r -p "Enterキーで閉じます..." _
