# RunPod Serverless ComfyUI Worker + IP-Adapter Face (SDXL)
#
# Base image:
#   runpod/worker-comfyui:5.8.5-base-cuda12.8.1
#     - ComfyUI が /comfyui にインストール済み
#     - Network Volume は /runpod-volume にマウントされる想定
#
# 追加インストール:
#   - ComfyUI_IPAdapter_plus (cubiq/ComfyUI_IPAdapter_plus):
#       IPAdapterUnifiedLoader / IPAdapterFaceID 等のノード群
#   - insightface + onnxruntime-gpu:
#       顔検出 + ArcFace 埋め込み（buffalo_l モデルを使用）
#
# モデルファイル自体は Network Volume 上に配置済みである想定:
#   /runpod-volume/models/ipadapter/ip-adapter-plus-face_sdxl_vit-h.safetensors
#   /runpod-volume/models/clip_vision/CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors
#   /runpod-volume/models/insightface/models/buffalo_l/*.onnx

FROM runpod/worker-comfyui:5.8.5-base-cuda12.8.1

# insightface の wheel が無い環境で source build するためのツールチェーン
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential \
      python3-dev \
    && rm -rf /var/lib/apt/lists/*

# ComfyUI_IPAdapter_plus カスタムノード
RUN set -eux; \
    cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/cubiq/ComfyUI_IPAdapter_plus.git

# InsightFace（顔検出 + 顔埋め込み）
RUN pip install --no-cache-dir \
      insightface \
      onnxruntime-gpu

# worker-comfyui 標準の extra_model_paths.yaml に ipadapter / insightface を追加
RUN cat > /comfyui/extra_model_paths.yaml <<'YAML'
runpod-worker-comfy:
  base_path: /runpod-volume/
  checkpoints: models/checkpoints/
  clip: models/clip/
  clip_vision: models/clip_vision/
  configs: models/configs/
  controlnet: models/controlnet/
  diffusers: models/diffusers/
  embeddings: models/embeddings/
  loras: models/loras/
  style_models: models/style_models/
  upscale_models: models/upscale_models/
  vae: models/vae/
  ipadapter: models/ipadapter/
  insightface: models/insightface/
YAML

# ランタイムで /runpod-volume 配下のモデル群を /comfyui/models/ に symlink。
# worker-comfyui 側が独自に extra_model_paths.yaml を書き換えるケースや、
# カスタムノードが folder_paths 経由ではなく /comfyui/models 直叩きする
# ケースにも対応できる（yaml 単独だと読まれないケースでこけていた）。
RUN cat > /usr/local/bin/link-extra-models.sh <<'SH'
#!/bin/bash
set -e
mkdir -p /comfyui/models
for d in ipadapter insightface clip_vision; do
  src="/runpod-volume/models/$d"
  dst="/comfyui/models/$d"
  if [ -d "$src" ]; then
    # 既存があって symlink 先が違う場合も貼り直す
    if [ -L "$dst" ] || [ ! -e "$dst" ]; then
      ln -sfn "$src" "$dst"
      echo "[link-extra-models] Linked $dst -> $src"
    else
      echo "[link-extra-models] $dst already exists (not a symlink), skipping"
    fi
  else
    echo "[link-extra-models] $src not found, skipping"
  fi
done
SH
RUN chmod +x /usr/local/bin/link-extra-models.sh

# 既存イメージの CMD は /start.sh を呼んでいる前提（worker-comfyui 5.x 標準）。
# 先に symlink を貼ってから本来の start.sh を exec する。
CMD ["/bin/bash", "-lc", "/usr/local/bin/link-extra-models.sh && exec /start.sh"]

# 起動時に読み込ませたいノード情報を一度 import して warm-up（失敗しても起動は続ける）
RUN python -c "import insightface; print('insightface ok', insightface.__version__)" || true

# イメージメタデータ
LABEL org.opencontainers.image.title="image-gen-tool worker-comfyui (ipadapter)"
LABEL org.opencontainers.image.description="RunPod Serverless ComfyUI with IPAdapter Plus Face for SDXL/Illustrious"
LABEL org.opencontainers.image.source="https://github.com/ichigospi/my-project"
