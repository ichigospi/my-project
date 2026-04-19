# 画像生成ツール

自分専用の高機能画像生成 Web アプリ。Next.js + RunPod Serverless ComfyUI(SDXL / Illustrious / Pony)。

## 概要

- 6W1H ボタン UI でタイピング最小化
- キャラ Lora 学習・絵柄管理・場所/ポーズ保存
- 差分出力・背景透過・モザイク除去・3D ポーズ指定
- NSFW 対応(Illustrious / Pony)

- 詳細仕様: [DESIGN.md](./DESIGN.md)
- **セッション引き継ぎ用**: [HANDOVER.md](./HANDOVER.md) ← 中断時はこれを新セッションに貼る

## ステータス

⚠️ **RunPod 動作確認完了 / Serverless化と実装着手前**

現在の進捗:
- ✅ 要件・設計確定
- ✅ DESIGN.md 初版
- ✅ RunPod アカウント作成・APIキー取得
- ✅ クレジットチャージ($10)
- ✅ Network Volume 作成(`image-gen-models` / 100GB / EU-RO-1 / ID: `xpsphpa6vo`)
- ✅ Pod で ComfyUI 起動確認(`runpod/comfyui:latest` テンプレ、RTX PRO 4500)
- ✅ Civicomfy 経由で WAI-illustrious-SDXL v16.0 を Network Volume に DL(6.46GB)
- ✅ `extra_model_paths.yaml` で Network Volume を ComfyUI から参照
- ✅ **テスト生成成功**(832x1216, 28steps, cfg 5.0, euler_ancestral, normal)
- ⬜ ComfyUI Serverless Endpoint デプロイ
- ⬜ Pony V6 / VAE / ControlNet / Upscaler 追加DL
- ⬜ Next.js プロジェクト初期化
- ⬜ Phase 1 実装

## 動作確認済み環境

- **ベースモデル**: WAI-illustrious-SDXL v16.0(Civitai ID: `827184`)
- **保存先**: `/runpod-volume/ComfyUI/checkpoints/waiIllustriousSDXL_v160.safetensors`
- **推奨生成パラメータ**:
  - Resolution: 832×1216
  - Steps: 28
  - CFG: 5.0
  - Sampler: `euler_ancestral`
  - Scheduler: `normal`

## 次セッションでやること

1. **Serverless Endpoint 作成**(Network Volume をマウント)
2. Endpoint ID を `.env.local` の `RUNPOD_ENDPOINT_ID` に記録
3. 追加モデル DL(Pony V6, ControlNet, Upscaler, IP-Adapter)
4. Next.js プロジェクト初期化(`image_generation_tool/` 直下)
5. Phase 1 実装開始

## ディレクトリ構成(予定)

```
image_generation_tool/
├─ DESIGN.md              ← 設計書(本体)
├─ README.md              ← このファイル
├─ .env.local             ← APIキー(gitignore 済み)
├─ docs/                  ← ユーザー向けマニュアル(未作成)
├─ prisma/                ← DBスキーマ(未作成)
├─ src/                   ← Next.js App(未作成)
├─ storage/               ← 生成画像・学習データ(未作成、gitignore)
└─ comfyui-workflows/     ← ComfyUI ワークフロー JSON(未作成)
```

## 環境変数

`.env.local`:

```
RUNPOD_API_KEY=...
RUNPOD_ENDPOINT_ID=...
RUNPOD_NETWORK_VOLUME_ID=...
CIVITAI_API_KEY=...
ANTHROPIC_API_KEY=...
```

## 親プロジェクトとの関係

このツールは `my-project/` 内のサブフォルダに配置されているが、**既存の Next.js アプリとは完全に独立**(独自の package.json / prisma / 起動コマンドを持つ予定)。リポジトリとブランチのみ共有。
