#!/bin/bash
# ComfyUI / ComfyUI-Manager / 依存パッケージを更新
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"
PYV="$(venv_python)"
[ -x "$PYV" ] || { fail "セットアップがまだです（setup-sd.command を先に実行）"; pause_and_exit 1; }

echo "🔄 ComfyUI を更新中..."
git -C "$SD_HOME" pull --ff-only || warn "ComfyUI の更新に失敗（起動には影響しません）"
MGR="$SD_HOME/custom_nodes/ComfyUI-Manager"
[ -d "$MGR/.git" ] && { git -C "$MGR" pull --ff-only || true; }

PIP=("$PYV" -m pip)
"$PYV" -m pip --version >/dev/null 2>&1 || { ensure_uv && PIP=(uv pip --python "$PYV"); }
"${PIP[@]}" install -q -r "$SD_HOME/requirements.txt" && ok "依存パッケージ更新完了"
"$PYV" -I "$SD_SCRIPTS_DIR/install_workflows.py" "$SD_HOME" "$SD_SYSTEM_DIR/workflows"
ok "更新完了"
