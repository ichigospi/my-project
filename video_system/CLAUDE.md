# 動画制作システム — 全体方針

台本作成 → 素材準備（AI生成 / 手持ち素材）→ 編集（カット・テロップ・BGM）→ 書き出し → 修正、までを Claude Code で一気通貫で行うシステム。

## トリガー

ユーザーから以下の指示があった場合、本システムを使用する:

- 「動画を作って」「動画を編集して」
- 「台本を作って」（動画用の文脈の場合）
- 「テロップを入れて」「BGMを付けて」「字幕を付けて」
- 「この素材で動画にして」「ショート動画を作って」

## フォルダ構成

```
video_system/
├── CLAUDE.md                ← このファイル（全体方針・ワークフロー・AI指示）
├── README.md                ← セットアップ手順（ffmpeg・フォント）
├── script_template.md       ← 台本テンプレート
├── ai_generation_guide.md   ← AI素材生成ガイド（画像・映像・音声・BGM）
├── scripts/
│   └── render_video.py      ← timeline.json → 動画レンダリング（ffmpeg）
├── assets_library/          ← プロジェクト横断で使い回す素材置き場
│   ├── bgm/                 # BGM・効果音
│   ├── footage/             # 映像素材
│   ├── images/              # 画像素材（ロゴ等）
│   └── fonts/               # 追加フォント
└── projects/                ← 動画1本 = 1プロジェクトフォルダ
    └── <プロジェクト名>/
        ├── script.md        # 台本（script_template.md ベース）
        ├── timeline.json    # 編集指示書（レンダリングの入力）
        ├── assets/          # この動画専用の素材
        └── output/          # 書き出し先（gitには含めない）
```

## 制作ワークフロー（AI向け手順）

### STEP 1: 台本作成

1. ユーザーから動画のテーマ・目的・尺・縦横を聞く（不明点だけ質問する）
2. `script_template.md` をベースに `projects/<名前>/script.md` を作成する
3. X運用系の動画なら `../x_post_system/` の knowledge（フック・構成パターン・NG集）を、ローンチ関連なら `../custom_launch_system/launch_design.md` を参照してトーンを合わせる
4. シーン表には「使用素材」列を必ず入れ、素材が **手持ち / AI生成 / ffmpeg生成（単色背景・テキストのみ）** のどれかを明記する

### STEP 2: 素材準備

- **手持ち素材**: ユーザーに `projects/<名前>/assets/` へ配置してもらう（リモートセッションの場合はリポジトリへのアップロードを案内する）
- **AI生成素材**: `ai_generation_guide.md` の手順で生成する（APIキーが必要。未設定なら設定を案内する）
- **ffmpegで作れるもの**: タイトルカード（`type: color` + テロップ）、ズームする静止画などはAI不要なので優先的に使う
- 素材が揃ったら `ffprobe` で解像度・長さを確認してから timeline に組み込む

### STEP 3: timeline.json 作成

台本のシーン表を `timeline.json` に変換する。仕様は後述。

### STEP 4: レンダリング

```bash
python3 video_system/scripts/render_video.py video_system/projects/<名前>/timeline.json
```

- 完了時に長さ・サイズが表示される。X投稿用は **140秒以内・512MB以下** を守る
- エラーが出たら ffmpeg のエラーメッセージを読んで自力で修正する

### STEP 5: 確認・修正

1. 書き出した動画をユーザーに確認してもらう（リモートの場合は動画ファイルを送付する）
2. 修正指示（「テロップもっと大きく」「BGM小さく」「2シーン目カット」等）を受けたら `timeline.json` を編集して再レンダリングする
3. 確定したら `script.md` / `timeline.json` をコミットして再現可能な状態で残す（output/ の動画バイナリはコミットしない）

## timeline.json 仕様

```jsonc
{
  "output": "output/final.mp4",   // 出力先（timeline.json からの相対パス）
  "width": 1080,                  // 縦動画: 1080x1920 / 横: 1920x1080 / 正方形: 1080x1080
  "height": 1920,
  "fps": 30,
  "font": "auto",                 // "auto" で Noto Sans CJK 等を自動検出。パス指定も可

  "scenes": [
    {
      "type": "video",            // "video" | "image" | "color"
      "src": "assets/clip1.mp4",  // type=color の場合は不要
      "start": 2.0,               // 素材の切り出し開始秒（video のみ・省略可）
      "duration": 5.0,            // シーンの尺（video は省略すると素材の残り全部）
      "mute": false,              // 素材の音を消す
      "volume": 1.0,              // 素材の音量
      "fade_in": 0.5,             // 映像フェードイン秒数（省略可）
      "fade_out": 0.5,
      "telops": [
        {
          "text": "1行目\n2行目",         // 改行可
          "style": "title",              // "title"(中央大) | "caption"(下部・箱付き) | "note"(上部小)
          "start": 0.5, "end": 4.5,      // 表示時間（シーン内の秒。省略で常時表示）
          "fontsize": 60,                // 省略でスタイル既定値
          "color": "white",
          "x": "(w-text_w)/2", "y": "h-300"  // 省略でスタイル既定位置
        }
      ],
      "overlays": [                      // 画像の重ね置き（ロゴ・スタンプ等）
        {"src": "assets/logo.png", "scale": 0.25, "x": "W-w-40", "y": "40", "start": 0, "end": 5}
      ]
    },
    {
      "type": "color", "color": "black", "duration": 2.5,
      "telops": [{"text": "タイトルカード", "style": "title"}]
    },
    {
      "type": "image", "src": "assets/photo.png", "duration": 4.0,
      "zoom": true,                    // 静止画をゆっくりズーム(Ken Burns)。imageのみ有効
      "narration": {                   // シーン単位のナレーション音声(省略可)
        "src": "assets/voice_scene3.mp3", "volume": 1.0
      }
    }
  ],

  "bgm": {
    "src": "assets/bgm.mp3",      // assets_library/bgm/ からコピーしてもよい
    "volume": 0.15,               // ナレーションがあるなら 0.1〜0.2 推奨
    "fade_out": 2.0               // 終端フェードアウト秒数
  },
  "narration": {                  // 全編通しのナレーション音声（省略可）
    "src": "assets/voice.mp3", "volume": 1.0, "start": 0
  }
}
```

## AI向けルール

1. **1動画 = 1プロジェクトフォルダ**。`projects/` 直下に日本語 or 英語の分かりやすい名前で作る
2. 台本なしでいきなり編集だけ頼まれた場合（「この2本を繋いでテロップ入れて」等）は script.md を省略し、timeline.json だけ作ってよい
3. render_video.py で表現できない編集（トランジション xfade・倍速・ズームパン等）は、ffmpeg コマンドを直接組み立てて対応する。頻出したらスクリプトに機能追加する
4. テロップの文言は台本に忠実に。1画面に入れる文字数は縦動画で **1行13文字 × 3行以内** を目安にする
5. BGM・素材の**著作権に注意**。ユーザー提供素材以外を使う場合はフリー素材（DOVA-SYNDROME、甘茶の音楽工房、いらすとや等）かAI生成を使い、出典をscript.mdにメモする
6. X投稿用の完成尺は 140秒以内。超える場合はユーザーに分割 or カットを提案する
7. レンダリング後は必ず長さ・サイズを報告し、リモートセッションでは動画ファイルをユーザーに送付する

## 環境チェック

初回利用時に以下を確認し、無ければインストールする:

```bash
which ffmpeg || (apt-get update && apt-get install -y ffmpeg)   # Mac: brew install ffmpeg
fc-list | grep -qi "CJK" || apt-get install -y fonts-noto-cjk   # 日本語フォント
```
