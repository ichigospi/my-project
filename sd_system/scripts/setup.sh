#!/bin/bash
# sd_system セットアップ本体（Mac Apple Silicon 向け。Linux でも動く）
#   1. ComfyUI を ~/ComfyUI に取得
#   2. Python 環境（venv）と PyTorch を用意
#   3. ComfyUI-Manager を追加
#   4. sd_system のワークフローを配置
#   5. モデル（Illustrious系チェックポイント）をダウンロード
#   6. 起動してブラウザを開く
# オプション: --no-models（モデルDLを飛ばす） --no-start（起動しない）

set -o pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

NO_MODELS=0; NO_START=0
for a in "$@"; do
    case "$a" in
        --no-models) NO_MODELS=1 ;;
        --no-start)  NO_START=1 ;;
    esac
done

echo "================================"
echo "  画像生成ツール（Stable Diffusion / Illustrious）"
echo "  初回セットアップ"
echo "================================"
echo ""
echo "設置先: $SD_HOME"
echo ""

# --- 0. 環境チェック -------------------------------------------------------
if [ "$OS_NAME" = "Darwin" ]; then
    if [ "$ARCH_NAME" != "arm64" ]; then
        warn "Intel Mac が検出されました。SDXL系モデルは非常に遅く、動作保証外です。"
        warn "続行はできますが、クラウドGPU（RunPod等）の利用を強くおすすめします。"
    else
        ok "Apple Silicon Mac ($(sysctl -n machdep.cpu.brand_string 2>/dev/null))"
    fi
    MEM=$(total_mem_gb)
    if [ "$MEM" -le 8 ]; then
        warn "メモリ ${MEM}GB: SDXL系（Illustrious）はかなり厳しいです。生成が遅い/落ちる場合は小さいサイズで試してください。"
    else
        ok "メモリ ${MEM}GB"
    fi
    # Xcode コマンドラインツール（git が含まれる）
    if ! xcode-select -p >/dev/null 2>&1; then
        warn "開発者ツール（git）が未インストールです。インストール画面を開きます。"
        xcode-select --install 2>/dev/null
        echo ""
        echo "  表示されたダイアログで「インストール」を押し、完了したら"
        echo "  このファイル（setup-sd.command）をもう一度ダブルクリックしてください。"
        pause_and_exit 1
    fi
fi

if ! command -v git >/dev/null 2>&1; then
    fail "git が見つかりません。"
    [ "$OS_NAME" = "Darwin" ] && echo "   ターミナルで xcode-select --install を実行してください。"
    pause_and_exit 1
fi
ok "git $(git --version | awk '{print $3}')"

# --- 1. ComfyUI 取得 -------------------------------------------------------
if [ -d "$SD_HOME/.git" ]; then
    ok "ComfyUI は既に取得済み（$SD_HOME）"
else
    say "📥 ComfyUI をダウンロード中..."
    mkdir -p "$(dirname "$SD_HOME")"
    if ! git clone --depth 1 "$COMFY_REPO" "$SD_HOME"; then
        fail "ComfyUI のダウンロードに失敗しました（ネット接続を確認してください）"
        pause_and_exit 1
    fi
    ok "ComfyUI を取得しました"
fi

# --- 2. Python 環境 --------------------------------------------------------
if [ -x "$(venv_python)" ]; then
    ok "Python 環境は既に作成済み（$("$(venv_python)" --version)）"
else
    say "🐍 Python 環境を作成中..."
    PY="$(find_python || true)"
    if [ -n "$PY" ]; then
        "$PY" -m venv "$SD_HOME/venv" || PY=""
    fi
    if [ -z "$PY" ]; then
        # 3.10 以上の Python が無い → uv で 3.12 を取得（管理者権限不要）
        if ensure_uv; then
            say "🐍 Python 3.12 を取得中（数分かかります）..."
            uv venv --python 3.12 "$SD_HOME/venv" || { fail "Python 環境の作成に失敗しました"; pause_and_exit 1; }
        else
            fail "Python 3.10 以上が見つからず、uv の取得にも失敗しました。"
            echo "   https://www.python.org/downloads/ から Python 3.12 をインストール後、再実行してください。"
            pause_and_exit 1
        fi
    fi
    ok "Python 環境: $("$(venv_python)" --version)"
fi

PYV="$(venv_python)"
PIP=("$PYV" -m pip)
if ! "$PYV" -m pip --version >/dev/null 2>&1; then
    # uv で作った venv には pip が無いので入れる
    "$PYV" -m ensurepip --upgrade >/dev/null 2>&1 || true
    if ! "$PYV" -m pip --version >/dev/null 2>&1; then
        ensure_uv && PIP=(uv pip --python "$PYV")
    fi
fi

# --- 3. PyTorch + ComfyUI 依存パッケージ ---------------------------------------
if "$PYV" -c 'import torch, torchvision' 2>/dev/null; then
    ok "PyTorch $("$PYV" -c 'import torch;print(torch.__version__)') 導入済み"
else
    say "📦 PyTorch をインストール中（2〜3GB、数分かかります）..."
    "${PIP[@]}" install --upgrade pip >/dev/null 2>&1 || true
    if [ "$OS_NAME" = "Darwin" ]; then
        "${PIP[@]}" install torch torchvision torchaudio
    elif command -v nvidia-smi >/dev/null 2>&1; then
        "${PIP[@]}" install torch torchvision torchaudio
    else
        "${PIP[@]}" install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu \
          || "${PIP[@]}" install torch torchvision torchaudio
    fi
    "$PYV" -c 'import torch' || { fail "PyTorch の導入に失敗しました"; pause_and_exit 1; }
    ok "PyTorch 導入完了"
fi

say "📦 ComfyUI の依存パッケージを確認中..."
"${PIP[@]}" install -q -r "$SD_HOME/requirements.txt" || { fail "依存パッケージの導入に失敗しました"; pause_and_exit 1; }
ok "依存パッケージ OK"

if [ "$OS_NAME" = "Darwin" ]; then
    if "$PYV" -c 'import torch,sys; sys.exit(0 if torch.backends.mps.is_available() else 1)'; then
        ok "GPU（Metal/MPS）が使えます"
    else
        warn "GPU（MPS）が検出できませんでした。CPU生成になり、非常に遅くなります。"
    fi
fi

# --- 4. ComfyUI-Manager（ノード追加を画面から行える拡張） ----------------------
MGR="$SD_HOME/custom_nodes/ComfyUI-Manager"
if [ -d "$MGR/.git" ]; then
    ok "ComfyUI-Manager 導入済み"
else
    say "📥 ComfyUI-Manager を追加中..."
    if git clone --depth 1 "$MANAGER_REPO" "$MGR"; then
        [ -f "$MGR/requirements.txt" ] && "${PIP[@]}" install -q -r "$MGR/requirements.txt"
        ok "ComfyUI-Manager 追加完了"
    else
        warn "ComfyUI-Manager の追加に失敗（無くても生成はできます）"
    fi
fi

# --- 5. ワークフロー配置 -----------------------------------------------------
"$PYV" -I "$SD_SCRIPTS_DIR/install_workflows.py" "$SD_HOME" "$SD_SYSTEM_DIR/workflows" || warn "ワークフローの配置に失敗"

# --- 6. Civitai APIキー（任意） ---------------------------------------------
mkdir -p "$SD_CONFIG_DIR"
KEYFILE="$SD_CONFIG_DIR/civitai_api_key"
if [ ! -s "$KEYFILE" ] && [ "$NO_MODELS" = 0 ] && [ -t 0 ]; then
    echo ""
    echo "--------------------------------"
    echo "  Civitai APIキー（任意）"
    echo "--------------------------------"
    echo "通常は不要です。空のまま Enter を押してください。"
    echo "（Civitai からのDLが「ログインが必要」で失敗したときだけ使います。"
    echo "  取り方: https://civitai.com で無料登録 → 右上アイコン → Account Settings"
    echo "          → 下の方の「API Keys」→ Add API key → 表示された文字列をコピー）"
    echo ""
    read -r -p "Civitai APIキー: " CKEY
    CKEY=$(printf '%s' "$CKEY" | LC_ALL=C tr -cd '\40-\176' | sed -e 's/^ *//' -e 's/ *$//')
    if [ -n "$CKEY" ]; then
        printf '%s\n' "$CKEY" > "$KEYFILE"; chmod 600 "$KEYFILE"
        ok "APIキーを保存しました（$KEYFILE）"
    fi
fi

# --- 7. モデルDL -------------------------------------------------------------
if [ "$NO_MODELS" = 0 ]; then
    "$PYV" -I "$SD_SCRIPTS_DIR/download_models.py" --default --sd-home "$SD_HOME" --config-dir "$SD_CONFIG_DIR" \
        || warn "モデルのダウンロードで問題がありました（download-models.command で再試行できます）"
fi

# ワークフローのモデル名を実在ファイルに合わせる
"$PYV" -I "$SD_SCRIPTS_DIR/install_workflows.py" "$SD_HOME" "$SD_SYSTEM_DIR/workflows" >/dev/null 2>&1 || true

echo ""
echo "================================"
ok "セットアップ完了"
echo "================================"
echo ""
if [ "$NO_START" = 0 ]; then
    exec bash "$SD_SCRIPTS_DIR/start.sh"
fi
