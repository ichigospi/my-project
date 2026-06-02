# NSFW 画像 → プロンプト自動生成ツール

画像をドラッグ&ドロップすると、**Danbooru タグ**形式のプロンプトを自動生成する独立ツールです。
Stable Diffusion / Illustrious / Pony / NoobAI / NAI 系モデルの「参考画像から再現プロンプトを逆算する」用途を想定しています。

- 画像認識は [SmilingWolf](https://huggingface.co/SmilingWolf) 氏の **WD14 タガー（ONNX）** を使用
- Danbooru で学習されているため **NSFW タグも出力**します
- **すべてローカルで処理**され、画像が外部に送信されることはありません（クラウド Vision API は NSFW を拒否するため不採用）

## セットアップ

```bash
cd nsfw_tagger
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

> GPU を使う場合は `onnxruntime` の代わりに `onnxruntime-gpu` を入れてください。

## 使い方

```bash
python app.py
```

起動後、表示される `http://127.0.0.1:7860` をブラウザで開き、画像をドロップするとプロンプトが生成されます。
（初回はモデル（数百MB）を HuggingFace から自動ダウンロードします）

### 画面でできること

| 項目 | 説明 |
|---|---|
| モデル選択 | EVA02 Large（高精度）〜 ViT（軽量）から選択 |
| 一般タグのしきい値 | 既定 0.35。下げるとタグが増える |
| キャラタグのしきい値 | 既定 0.85。既存キャラの判定用 |
| アンダースコア→空白 | `long_hair` → `long hair` |
| 括弧のエスケープ | `\( \)` SD 系プロンプトで推奨 |
| rating タグを含める | `general/sensitive/questionable/explicit` を先頭に付与 |

生成されたプロンプトはコピーボタンでそのままコピーできます。

## モデルについて

| 表示名 | HuggingFace repo | 特徴 |
|---|---|---|
| WD EVA02 Large v3 | `SmilingWolf/wd-eva02-large-tagger-v3` | 最高精度・やや重い |
| WD ViT Large v3 | `SmilingWolf/wd-vit-large-tagger-v3` | 高精度 |
| WD SwinV2 v3 | `SmilingWolf/wd-swinv2-tagger-v3` | バランス型 |
| WD ViT v3 | `SmilingWolf/wd-vit-tagger-v3` | 最軽量 |

## ファイル構成

```
nsfw_tagger/
├── app.py            # Gradio Web UI（ドラッグ&ドロップ）
├── tagger.py         # WD14 ONNX タガーの推論コア
├── requirements.txt
├── .gitignore
└── README.md
```

## 利用上の注意

- 本ツールは**創作・成人向けコンテンツ制作の補助**を目的としています。
- **実在の人物の同意なき利用、および未成年を対象とした生成・利用は固く禁止します。**
- 出力タグは自動推論であり、不正確な場合があります。最終的な内容は利用者の責任で確認してください。
