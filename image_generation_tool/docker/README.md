# ComfyUI worker with IP-Adapter Face (Docker)

RunPod Serverless 用のカスタム ComfyUI ワーカーイメージ。
`runpod/worker-comfyui:latest` に `ComfyUI_IPAdapter_plus` と
`insightface` を追加したもの。

Lora と併用して「顔の一貫性」を大幅に上げるのが目的。

## ビルド & push 手順（Mac / Docker Desktop）

### 前提
- Docker Desktop が起動している（メニューバーの 🐳 が Running）
- Docker Hub アカウント作成済み
- Docker Hub で Personal Access Token を作成済み
  - https://hub.docker.com/settings/personal-access-tokens
  - Permissions: **Read, Write, Delete**

### 1. Docker Hub にログイン

Mac ターミナルで:

```bash
docker login -u YOUR_DOCKERHUB_USERNAME
```

パスワード聞かれたら **Access Token を貼る**（通常のパスワードではなく）。
`Login Succeeded` と出れば OK。

### 2. イメージ build（Apple Silicon → amd64 で出力）

RunPod は **linux/amd64** を要求するので、Apple Silicon Mac は
クロスビルドが必要。`buildx` を使う:

```bash
cd ~/Documents/my-project/image_generation_tool/docker

# buildx で amd64 向けにビルド + push を一発
docker buildx build \
  --platform linux/amd64 \
  --tag YOUR_DOCKERHUB_USERNAME/image-gen-worker:ipadapter \
  --push \
  .
```

所要 10〜20 分（ベース image の pull + 拡張インストール + push）。
`YOUR_DOCKERHUB_USERNAME` は自分のユーザー名に置換。

### 3. Serverless Endpoint を作成（RunPod Console）

- https://www.runpod.io/console/serverless
- Endpoint の Docker Image URL に
  `docker.io/YOUR_DOCKERHUB_USERNAME/image-gen-worker:ipadapter`
- Network Volume: **image-gen-models**（必須）
- GPU: 24GB VRAM 以上
- Container disk: 15GB（モデルは Network Volume 側なので小さめで OK）

### 4. 動作確認

Requests タブから test workflow を投げて、IPAdapter ノードで
エラーが出ないか確認。ログで `IPAdapterUnifiedLoader` が認識
されていれば成功。

## 既存の Serverless Endpoint を残す設計

新 IP-Adapter 対応 endpoint は**別 endpoint として作成**する想定。
ツール側は「顔参照画像があるとき」だけ新 endpoint に振り分け、
通常生成は既存 endpoint を使う。

## モデル配置（Network Volume 側、既に配置済み）

```
/workspace/models/ipadapter/
  └ ip-adapter-plus-face_sdxl_vit-h.safetensors

/workspace/models/clip_vision/
  └ CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors

/workspace/models/insightface/models/buffalo_l/
  ├ 1k3d68.onnx
  ├ 2d106det.onnx
  ├ det_10g.onnx
  ├ genderage.onnx
  └ w600k_r50.onnx
```

Serverless では `/runpod-volume/` にマウントされる点に注意。
`extra_model_paths.yaml` で自動解決される想定。
