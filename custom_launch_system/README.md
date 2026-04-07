# カスタムローンチシステム（Claude Code版）

商品ローンチに必要な全コンテンツ（SNS投稿42本・コラム3本・セールスレター・LINE配信11通）をClaude Codeで一括生成するシステムです。

## 前提条件

**custom_post_system のセットアップが完了していること。** このシステムは custom_post_system の `character_profile.json`（口調・口癖・温度・世界観）を参照して動作します。

## フォルダ構成

```
custom_launch_system/
├── CLAUDE.md               ← AI用ルール（Claude Codeが自動読み込み）
├── README.md               ← このファイル
├── generate_launch.py      ← プロンプト生成スクリプト（他AIツール向け）
├── launch_design.md        ← ★あなたが埋める（心臓部）
├── launch_templates.md     ← スケジュール・構造テンプレート・完成例
├── example_launch_posts.md ← 投稿のお手本
├── reference_columns.md    ← コラム実例集（詳細版）
├── reference_sales_letters.md ← レター実例集（詳細版）
├── reference_line_messages.md ← LINE配信実例集（詳細版）
└── logs/                   ← 生成済みコンテンツの保存先
```

## セットアップ手順

### STEP 1: ローンチ設計書を作る（15〜20分）★心臓部★

Claude Codeで以下のように指示してください:

```
私は[ジャンル]のアカウントで、[商品名]を[価格]で売りたいです。
launch_design.md のローンチ設計書を埋めるのを手伝ってください。
わからない項目は質問してください。
```

AIが質問しながら一緒に埋めてくれます。

### 完成！コンテンツを生成する

設計書が完成したら、指示するだけです:

```
launch_design.md に基づいて、14日分のローンチ投稿を全部作って
```

```
launch_design.md に基づいて、コラム3本を作って（企画投稿もセットで）
```

```
launch_design.md に基づいて、セールスレターを作って
```

```
launch_design.md に基づいて、LINE配信メッセージを全11通作って
```

### 全部一気に作る場合

```
launch_design.md に基づいて、ローンチコンテンツを全部作って
```

Claude Codeが自動的に以下を並列生成します:
- Phase 1 投稿（Day 1-5 / 15本）
- Phase 2 投稿（Day 6-10 / 15本）
- Phase 3 投稿（Day 11-14 / 12本 + 企画3本）
- コラム3本（企画投稿付き）
- セールスレター
- LINE配信11通

### 生成後の出力先

| ファイル | 内容 |
|---|---|
| `logs/output_posts_phase1.md` | Phase 1 投稿（Day 1-5 / 15本） |
| `logs/output_posts_phase2.md` | Phase 2 投稿（Day 6-10 / 15本） |
| `logs/output_posts_phase3.md` | Phase 3 投稿（Day 11-14 / 12本） |
| `logs/output_columns.md` | コラム3本＋企画投稿 |
| `logs/output_sales_letter.md` | セールスレター |
| `logs/output_line_messages.md` | LINE配信メッセージ11通 |

## Cursorとの違い

| | Cursor | Claude Code |
|---|---|---|
| AI指示ファイル | `.cursorrules` | `CLAUDE.md`（自動読み込み） |
| ファイル参照 | `@file` で手動指定 | CLAUDE.mdのルールで自動参照 |
| 並列生成 | 複数チャット or Agent | サブエージェントで自動並列 |
| プロンプト生成 | `generate_launch.py` 必須 | 不要（直接指示でOK） |

## generate_launch.py の使い方（他AIツール向け）

Claude Code以外（ChatGPT等）で生成したい場合のみ使用:

```bash
python generate_launch.py all       # 全コンテンツのプロンプトを一括生成
python generate_launch.py --parallel # 6バッチ分のプロンプトを並列生成
python generate_launch.py posts     # 投稿プロンプトだけ
python generate_launch.py columns   # コラムプロンプトだけ
python generate_launch.py letter    # セールスレタープロンプトだけ
python generate_launch.py line      # LINE配信プロンプトだけ
```

## こんな指示ができる

| やりたいこと | 指示の例 |
|---|---|
| 一括生成 | 「launch_design.md に基づいて全部作って」 |
| フェーズ指定 | 「Phase 1（Day 1-5）の投稿だけ作って」 |
| 日別 | 「Day 4の投稿3本＋コラム①企画投稿を作って」 |
| コラム | 「コラム3本を連鎖構造で作って」 |
| レター | 「セールスレターを作って」 |
| LINE一括 | 「LINE配信を全11通作って」 |
| 調整 | 「Day 6の投稿、もっと常識破壊を強くして」 |
| リライト | （投稿を貼って）「これをもっと温度3で書き直して」 |

## FAQ

**Q: ポストシステムがないと使えない？**
→ はい。`character_profile.json` を参照します。先にポストシステムを完成させてください。

**Q: 商品が変わったらどうする？**
→ `launch_design.md` の商品情報を書き換えるだけです。

**Q: 14日以外の期間にもできる？**
→ 「7日間ローンチに変更して」と指示すれば調整してくれます。
