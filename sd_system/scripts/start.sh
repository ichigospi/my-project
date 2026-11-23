#!/bin/bash
# ComfyUI を起動してブラウザを開く
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

PYV="$(venv_python)"
if [ ! -x "$PYV" ] || [ ! -f "$SD_HOME/main.py" ]; then
    fail "セットアップがまだです。先に setup-sd.command をダブルクリックしてください。"
    pause_and_exit 1
fi

# 二重起動防止（同じポートで既に動いていればブラウザだけ開く）
if curl -s -o /dev/null -m 2 "http://127.0.0.1:${SD_PORT}/system_stats"; then
    ok "ComfyUI は既に起動しています → ブラウザを開きます"
    command -v open >/dev/null 2>&1 && open "http://127.0.0.1:${SD_PORT}"
    exit 0
fi

# ワークフロー更新（モデル名を実在ファイルに合わせる）
"$PYV" -I "$SD_SCRIPTS_DIR/install_workflows.py" "$SD_HOME" "$SD_SYSTEM_DIR/workflows" 2>/dev/null

if [ "$OS_NAME" = "Darwin" ]; then
    export PYTORCH_ENABLE_MPS_FALLBACK=1
fi

mapfile -t FLAGS < <(comfy_flags)

echo "================================"
echo "  画像生成ツール 起動中..."
echo "================================"
echo ""
echo "準備ができたらブラウザが自動で開きます（初回は1〜2分）"
echo "開かない場合: http://127.0.0.1:${SD_PORT} をブラウザで開いてください"
echo ""
echo "使い方: 左側メニューの「Workflows」→ sd_system → 01_basic_txt2img を開いて「Run」"
echo "生成画像: $SD_HOME/output/sd_system/"
echo ""
echo "停止するには Ctrl+C を押すか、この画面を閉じてください"
echo "================================"
echo ""

(
  for _ in $(seq 1 240); do
    if curl -s -o /dev/null -m 2 "http://127.0.0.1:${SD_PORT}/system_stats"; then
        echo ""; ok "起動を確認 → http://127.0.0.1:${SD_PORT} を開きます"
        command -v open >/dev/null 2>&1 && open "http://127.0.0.1:${SD_PORT}"
        exit 0
    fi
    sleep 1
  done
  echo ""; warn "4分待っても起動しませんでした。この画面のエラー表示を確認してください"
) &

cd "$SD_HOME" && exec "$PYV" main.py "${FLAGS[@]}"
