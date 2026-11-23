#!/bin/bash
# sd_system 共通設定（setup.sh / start.sh / update.sh から読み込まれる）

# ComfyUI の設置場所（リポジトリの外。環境変数 SD_HOME で変更可）
SD_HOME="${SD_HOME:-$HOME/ComfyUI}"
# APIキーなどの保存先（リポジトリの外）
SD_CONFIG_DIR="${SD_CONFIG_DIR:-$HOME/.sd_system}"
# ComfyUI の待ち受けポート
SD_PORT="${SD_PORT:-8188}"
# このスクリプト群の場所（sd_system/scripts）と sd_system 本体
SD_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SD_SYSTEM_DIR="$(cd "$SD_SCRIPTS_DIR/.." && pwd)"

COMFY_REPO="https://github.com/comfyanonymous/ComfyUI.git"
MANAGER_REPO="https://github.com/Comfy-Org/ComfyUI-Manager.git"

OS_NAME="$(uname -s)"
ARCH_NAME="$(uname -m)"

say()  { echo "$@"; }
ok()   { echo "✅ $*"; }
warn() { echo "⚠️  $*"; }
fail() { echo "❌ $*"; }

pause_and_exit() {
    echo ""
    read -r -p "Enterキーで閉じます..." _
    exit "${1:-1}"
}

# 3.10 以上の python3 を探す（見つかればパスを出力）
find_python() {
    local cand
    for cand in python3.13 python3.12 python3.11 python3.10 python3; do
        if command -v "$cand" >/dev/null 2>&1; then
            if "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3,10) else 1)' 2>/dev/null; then
                command -v "$cand"
                return 0
            fi
        fi
    done
    return 1
}

# uv（Python 管理ツール）を用意する。管理者パスワード不要で ~/.local/bin に入る
ensure_uv() {
    if command -v uv >/dev/null 2>&1; then return 0; fi
    for p in "$HOME/.local/bin/uv" "$HOME/.cargo/bin/uv"; do
        if [ -x "$p" ]; then export PATH="$(dirname "$p"):$PATH"; return 0; fi
    done
    say "📦 Python 管理ツール uv をインストール中..."
    if curl -LsSf https://astral.sh/uv/install.sh | sh >/dev/null 2>&1; then
        export PATH="$HOME/.local/bin:$HOME/.cargo/bin:$PATH"
        command -v uv >/dev/null 2>&1 && return 0
    fi
    return 1
}

venv_python() { echo "$SD_HOME/venv/bin/python"; }

# メモリ量(GB)
total_mem_gb() {
    if [ "$OS_NAME" = "Darwin" ]; then
        echo $(( $(sysctl -n hw.memsize) / 1024 / 1024 / 1024 ))
    else
        awk '/MemTotal/ {printf "%d", $2/1024/1024}' /proc/meminfo
    fi
}

# 起動フラグ（環境に応じて）
comfy_flags() {
    local flags=("--listen" "127.0.0.1" "--port" "$SD_PORT")
    if [ "$OS_NAME" = "Darwin" ]; then
        local mem; mem=$(total_mem_gb)
        if [ "$mem" -le 8 ]; then flags+=("--lowvram"); fi
    elif ! command -v nvidia-smi >/dev/null 2>&1; then
        flags+=("--cpu")
    fi
    if [ -n "$SD_EXTRA_FLAGS" ]; then
        # shellcheck disable=SC2206
        flags+=($SD_EXTRA_FLAGS)
    fi
    printf '%s\n' "${flags[@]}"
}
