#!/bin/bash
# モデル追加ダウンロード（Mac用）ダブルクリックで実行。番号を選ぶだけ
cd "$(dirname "$0")"
source scripts/common.sh
PYV="$(venv_python)"
[ -x "$PYV" ] || PYV="$(find_python || echo python3)"
"$PYV" -I scripts/download_models.py --menu --sd-home "$SD_HOME" --config-dir "$SD_CONFIG_DIR"
echo ""
read -r -p "Enterキーで閉じます..." _
