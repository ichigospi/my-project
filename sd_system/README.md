# 画像生成ツール（Stable Diffusion / Illustrious系）セットアップ案内

MacBook（Apple Silicon）上で、ComfyUI + Illustrious系モデル（WAI-illustrious など）を使って
イラスト（NSFW含む）を生成するための環境です。**ダブルクリックで導入が完了**するように作ってあります。

## 必要なもの

| 項目 | 目安 |
|---|---|
| Mac | Apple Silicon（M1〜M4）。**メモリ16GB以上推奨**。8GBは動くが遅く不安定 |
| 空き容量 | **約20GB**（ComfyUI+PyTorch 約5GB、モデル1個 約7GB、生成画像） |
| ネット | 初回に合計10GB以上ダウンロード。Wi-Fiで30分〜1時間ほど |
| その他 | 不要（Pythonなどは自動で入る。管理者パスワードも基本不要） |

生成時間の目安（M2 / 16GB、832×1216、28 Steps）: 1枚あたり約1.5〜3分。M1 8GB だと5分以上。
Intel Mac・Windows は対象外（Windows は別途相談）。

## 初回セットアップ（1回だけ）

1. Finder で `sd_system` フォルダを開く
2. **`setup-sd.command` をダブルクリック**
   - 「開発元を確認できないため開けません」と出たら: 右クリック →「開く」。
     それでも開けない場合はシステム設定 → プライバシーとセキュリティ → 下部の「このまま開く」
   - 「開発者ツールをインストールしますか」のダイアログが出たら「インストール」→ 終わったらもう一度ダブルクリック
3. 黒い画面（ターミナル）が進みます。途中で **Civitai APIキー** を聞かれたら、**何も入れずに Enter**（通常は不要）
4. モデル（約7GB）のダウンロードが終わると、自動でブラウザに ComfyUI が開きます

インストール先は `~/ComfyUI`（ホームフォルダ直下）。このリポジトリの外なので git には入りません。

## 2回目以降

- **起動**: `start-sd.command` をダブルクリック → ブラウザが開く
- **終了**: 黒い画面で `Ctrl + C`、または黒い画面を閉じる
- **更新**: `update-sd.command`
- **モデル追加**: `download-models.command` → 番号を選ぶ

## 使い方（最初の1枚）

1. 初回は「Templates」という大きなウィンドウが出るので、右上の × で閉じる
2. **左端の「Workflows」アイコン** をクリック
3. `sd_system` フォルダ → **`01_basic_txt2img`** を開く
4. 画面の構成（番号つきの箱）
   - ① モデル読み込み: 使うモデルを選ぶ（最初は入っているもの1つ）
   - ② プロンプト: 描きたいもの（英語タグ、カンマ区切り）
   - ③ ネガティブ: 避けたいもの
   - ④ 画像サイズ: 832×1216（縦）が基本
   - ⑤ 生成: Steps 28 / CFG 5.5 / Seed
   - ⑦ 保存: `~/ComfyUI/output/sd_system/` に PNG が保存される
5. 上部の **「Run」ボタン** を押す → 1〜3分待つ
6. 画像は ⑦ の箱に表示され、`~/ComfyUI/output/sd_system/` に保存されている

プロンプトは `prompts/templates.md` のものをコピペすればOK。書き方の詳細は `prompts/prompt_guide.md`。
AI（Claude）に「○○な画像のプロンプトを作って」と頼めば、この形式で出します。

### ワークフロー3種

| ファイル | 用途 |
|---|---|
| `01_basic_txt2img` | 基本。まずこれ |
| `02_hires_fix` | 高画質化（1.5倍に拡大して描き直す）。良い絵が出たら同じプロンプト＋Seedで |
| `03_lora` | LoRA（追加学習データ）を使う。`~/ComfyUI/models/loras/` に入れてから |

ワークフローを編集したら「別名で保存」すること（`sd_system` フォルダ内は起動時に上書きされる）。

## モデルについて

| モデル | 特徴 | 入手 |
|---|---|---|
| **WAI-illustrious-SDXL v17**（既定） | NSFW特化・最人気・崩れにくい。まずこれ | Civitai（自動DL） |
| Illustrious XL v2.0（公式） | 素直で万能。NSFWはWAIより弱い | Hugging Face（自動DL） |
| NoobAI-XL v1.1 | キャラ・絵師タグに強い。**商用不可** | Hugging Face（自動DL） |
| WAI-Mature-illustrious v3 | 大人の女性の体型が得意 | Civitai（自動DL） |

追加は `download-models.command`。一覧の編集は `scripts/models.txt`。
Civitai で自分で見つけたモデル/LoRAは、ダウンロードして `~/ComfyUI/models/checkpoints/`（モデル）や
`~/ComfyUI/models/loras/`（LoRA）に入れ、ComfyUI 画面で `R` キー（更新）を押せば選べます。
**ベースモデルが「Illustrious」または「NoobAI」のものだけ**使えます（Pony / SD1.5 / Flux 用は不可）。

## 守ること

- 登場人物は **成人のみ**。未成年に見える性的画像は絶対に作らない（ネガティブに `loli, shota, child` を常時入れる）
- **実在の人物**（芸能人・知人・VTuberの中の人など）の顔・名前は使わない
- **公開・販売するなら性器部分にモザイク**（日本の刑法175条）。個人で楽しむ範囲は自由
- 各モデルのライセンスを守る（NoobAI は商用不可、WAI/Illustrious は Fair AI Public License）
- 投稿先（X・Pixiv・FANZA・Fantia 等）の規約を確認

## 困ったとき

| 症状 | 対処 |
|---|---|
| `setup-sd.command` が開けない | 右クリック→開く。またはシステム設定→プライバシーとセキュリティ→「このまま開く」 |
| ダウンロードが途中で止まった | もう一度 `setup-sd.command`（続きから再開します） |
| 「ログインが必要」でモデルDLに失敗 | Civitai で無料登録 → Account Settings → API Keys で発行 → ターミナルで `mkdir -p ~/.sd_system && echo キー文字列 > ~/.sd_system/civitai_api_key` → `download-models.command` を再実行（AIに頼めば手順を出します） |
| ブラウザが開かない | 自分で http://127.0.0.1:8188 を開く |
| 「Run」を押しても何も起きない / 赤い枠 | ① のモデル名が存在しない → ① の箱をクリックして入っているモデルを選び直す |
| メモリ不足で落ちる | ④ のサイズを 768×1024 に下げる。他のアプリを閉じる |
| 遅すぎる | 仕様です（Mac は NVIDIA GPU の 5〜10 倍遅い）。Steps を 20 に。本格運用ならクラウドGPU（RunPod 等）を検討 |
| 画像が真っ黒/ノイズ | `update-sd.command` で更新 → 再起動。それでも駄目なら黒い画面のエラーを AI に貼る |
| 手が崩れる・顔が幼い | `prompts/prompt_guide.md` の「よくある崩れと対処」 |

黒い画面（ターミナル）の最後の20行をコピーして AI に貼ると、原因を特定できます。

## 別の選択肢

- **Draw Things**（Mac App Store・無料）: Apple Silicon に最適化されたアプリ。ComfyUI より速く軽い。
  Illustrious系モデル（.safetensors）も読み込める。ComfyUI が重すぎる場合の乗り換え先
- **クラウドGPU**（RunPod / Vast.ai）: 時間課金（約50〜100円/時）で NVIDIA GPU を借りる。1枚10秒以下。大量生成向け

## フォルダ構成

```
sd_system/
├── README.md                ← この案内
├── CLAUDE.md                ← AI向け指示（プロンプト生成ルール等）
├── setup-sd.command         ← 初回セットアップ（ダブルクリック）
├── start-sd.command         ← 起動
├── update-sd.command        ← 更新
├── download-models.command  ← モデル追加
├── scripts/
│   ├── common.sh            # 共通設定（設置先 ~/ComfyUI 等）
│   ├── setup.sh / start.sh / update.sh
│   ├── models.txt           # モデル一覧（ここに追記すると DL メニューに出る）
│   ├── download_models.py   # ダウンローダー（再開対応）
│   └── install_workflows.py # ワークフローを ComfyUI に配置
├── workflows/
│   ├── build_workflows.py   # ワークフロー生成スクリプト
│   ├── 01_basic_txt2img.json / 02_hires_fix.json / 03_lora.json
│   └── *_api.json           # API形式（自動生成・検証用）
├── prompts/
│   ├── prompt_guide.md      # タグの書き方・パラメータ・崩れ対処
│   └── templates.md         # コピペで使えるプロンプト集
└── logs/                    # 作ったプロンプトの記録
```
