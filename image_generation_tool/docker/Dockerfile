# RunPod Serverless ComfyUI Worker + IP-Adapter Face (SDXL)
#
# Base image:
#   runpod/worker-comfyui:latest
#     - ComfyUI が /comfyui にインストール済み
#     - Network Volume は /runpod-volume にマウントされる想定
#     - モデルパスは extra_model_paths.yaml で /runpod-volume/models/* を参照
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

FROM runpod/worker-comfyui:latest

# ComfyUI_IPAdapter_plus カスタムノード
# (requirements.txt はなくても動作する・この拡張は ComfyUI と insightface に依存)
RUN set -eux; \
    cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/cubiq/ComfyUI_IPAdapter_plus.git

# InsightFace（顔検出 + 顔埋め込み）
# onnxruntime-gpu は CUDA GPU で推論を高速化
RUN pip install --no-cache-dir \
      insightface==0.7.3 \
      onnxruntime-gpu==1.24.4

# 起動時に読み込ませたいノード情報を一度 import して warm-up（失敗しても起動は続ける）
RUN python -c "import insightface; print('insightface ok', insightface.__version__)" || true

# イメージメタデータ
LABEL org.opencontainers.image.title="image-gen-tool worker-comfyui (ipadapter)"
LABEL org.opencontainers.image.description="RunPod Serverless ComfyUI with IPAdapter Plus Face for SDXL/Illustrious"
LABEL org.opencontainers.image.source="https://github.com/ichigospi/my-project"
