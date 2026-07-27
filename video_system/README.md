# 動画制作システム — セットアップ手順

Claude Code に「動画を作って」と指示すると、台本作成 → 素材準備（AI生成/手持ち）→ テロップ・BGM編集 → 書き出し → 修正までを行うシステム。

## 必要なもの

| ツール | 用途 | インストール |
|---|---|---|
| ffmpeg / ffprobe | 動画のカット・合成・書き出し | Mac: `brew install ffmpeg` / Ubuntu: `apt-get install -y ffmpeg` |
| Python 3 | レンダリングスクリプト実行 | 大抵入っている |
| 日本語フォント | テロップ描画 | Ubuntu: `apt-get install -y fonts-noto-cjk`（Macはヒラギノを自動検出） |
| （任意）各種APIキー | AI素材生成 | `ai_generation_guide.md` 参照 |

## 使い方

1. Claude Code に「〇〇の動画を作りたい」と伝える
2. テーマ・尺・縦横などを答えると台本（`projects/<名前>/script.md`）ができる
3. 手持ち素材があれば `projects/<名前>/assets/` に入れる
4. Claude が `timeline.json` を作ってレンダリングする:
   ```bash
   python3 video_system/scripts/render_video.py video_system/projects/<名前>/timeline.json
   ```
5. できた動画（`projects/<名前>/output/final.mp4`）を確認して、修正指示を出す

## リモートセッション（Web版 Claude Code）での注意

- 手元のPCにある動画素材は直接読めないため、**素材をリポジトリにpushするか、ローカルのClaude Code CLIで作業する**
- 大きい動画素材を扱う場合はローカル利用を推奨
- `projects/*/output/` と動画・音声バイナリは `.gitignore` 対象（成果物はチャットで受け渡し）

## サンプルプロジェクト

`projects/sample_short/` に、素材を ffmpeg だけで自動生成して縦ショート動画を作るサンプルがある:

```bash
bash video_system/projects/sample_short/make_assets.sh   # デモ素材を生成
python3 video_system/scripts/render_video.py video_system/projects/sample_short/timeline.json
```
