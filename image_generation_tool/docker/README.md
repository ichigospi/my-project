# ComfyUI worker with IP-Adapter Face (Docker)

RunPod Serverless 用のカスタム ComfyUI ワーカーイメージ。
`runpod/worker-comfyui:latest` に `ComfyUI_IPAdapter_plus` と
`insightface` を追加したもの。

Lora と併用して「顔の一貫性」を大幅に上げるのが目的。

## ビルド方針: GitHub Actions

Mac で Docker Desktop が使えない（macOS バージョン非対応）ため、
GitHub Actions 上で build + Docker Hub push する。
ワークフロー定義: `.github/workflows/build-worker.yml`

### 初回セットアップ

#### 1. Docker Hub で Personal Access Token 作成

1. https://hub.docker.com/settings/personal-access-tokens にアクセス
2. **「Generate new access token」**
3. Description: `github-actions`（任意）
4. Permissions: **Read, Write, Delete**
5. 生成されたトークンをコピー（**1 度しか見えない**）

#### 2. GitHub リポジトリに Secrets を追加

https://github.com/ichigospi/my-project/settings/secrets/actions

「New repository secret」で 2 つ追加:

| Name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | 自分の Docker Hub ユーザー名（例: `ichigospi`） |
| `DOCKERHUB_TOKEN` | 上で作った Personal Access Token |

### ビルドを実行する

#### 方法 A: 手動トリガー（推奨）

1. https://github.com/ichigospi/my-project/actions
2. 左サイドバーで **「Build ComfyUI IP-Adapter worker」**
3. 右上の **「Run workflow」** ボタン → ブランチ選択 → Run
4. 5〜15 分で完了、ログ見守り可能

#### 方法 B: Dockerfile を更新して push

Dockerfile を変更してコミット・push すれば自動で build が走る。

### 完了するとどうなる

Docker Hub に以下の 2 つのタグで push される:
- `YOUR_USERNAME/image-gen-worker:ipadapter` （最新を指す）
- `YOUR_USERNAME/image-gen-worker:ipadapter-<commit-sha>` （固定版）

Serverless endpoint 作成時にこのイメージ URL を指定する。

## Serverless Endpoint の作成

1. https://www.runpod.io/console/serverless
2. **「+ New Endpoint」**
3. **Custom Docker Image** タブ（テンプレではない方）
4. **Container Image**: `docker.io/YOUR_USERNAME/image-gen-worker:ipadapter`
5. **Network Volume**: `image-gen-models`（必須）
6. **GPU**: 24GB VRAM 以上（RTX 4090 / RTX 5090 / RTX PRO 4500 等）
7. **Container disk**: 15GB（モデルは Network Volume 側なので小さめで OK）
8. **Active workers**: 0 / **Max workers**: 1 / **Flash Boot**: ON

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

## 既存の Serverless Endpoint を残す設計

新 IP-Adapter 対応 endpoint は**別 endpoint として作成**する想定。
ツール側は「顔参照画像があるとき」だけ新 endpoint に振り分け、
通常生成は既存 endpoint を使う。
