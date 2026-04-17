# 画像生成ツール

自分専用の高機能画像生成 Web アプリ。Next.js + RunPod Serverless ComfyUI(SDXL / Illustrious / Pony)。

## 概要

- 6W1H ボタン UI でタイピング最小化
- キャラ Lora 学習・絵柄管理・場所/ポーズ保存
- 差分出力・背景透過・モザイク除去・3D ポーズ指定
- NSFW 対応(Illustrious / Pony)

詳細仕様は [DESIGN.md](./DESIGN.md) を参照。

## ステータス

⚠️ **設計フェーズ完了 / 実装着手前**

現在の進捗:
- ✅ 要件・設計確定
- ✅ DESIGN.md 初版
- ✅ RunPod アカウント作成・APIキー取得
- ⬜ クレジットチャージ
- ⬜ Network Volume 作成
- ⬜ ComfyUI Serverless Endpoint デプロイ
- ⬜ Next.js プロジェクト初期化
- ⬜ Phase 1 実装

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
