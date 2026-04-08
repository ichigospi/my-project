# カスタムローンチシステム — 全体方針

ローンチコンテンツ（SNS投稿42本・コラム3本・セールスレター・LINE配信11通）を一括生成するシステム。

## フォルダ構成

```
custom_launch_system/
├── CLAUDE.md              ← このファイル（全体方針・共通ルール・AI指示）
├── README.md              ← セットアップ手順
├── generate_launch.py     ← プロンプト生成スクリプト（他AIツール向け）
├── launch_design.md       ← ★ローンチ設計書（心臓部）
├── launch_templates.md    ← スケジュール・構造テンプレート・完成例
├── example_launch_posts.md ← 投稿のお手本
├── reference_columns.md   ← コラム実例集（詳細版）
├── reference_sales_letters.md ← レター実例集（詳細版）
├── reference_line_messages.md ← LINE配信実例集（詳細版）
└── logs/                  ← 生成済みコンテンツ・作業ログの保存先
```

## 2フォルダ連携の仕組み

- **キャラ（誰が書くか）** = `../custom_post_system/character_profile.json`
- **商品・教育・フェーズ設計（何をどう売るか）** = `launch_design.md`

## 共通ルール

1. 全コンテンツは `launch_design.md` の設計に準拠すること
2. 口調・口癖・温度は `../custom_post_system/character_profile.json` に従う
3. テンプレ禁止 — 同じ構文の繰り返しをしない
4. 刷り込みKWを自然に含める（1投稿にメインKW最低1つ）
5. 同じKWを3投稿連続で使わない
6. フェーズの教育段階に沿った内容にする
7. 生成物は `logs/` に保存する

## AI向けルール（Claude Code用）

### コンテンツ生成の基本動作

1. **設計書の参照**: コンテンツ生成時は必ず `launch_design.md` を最初に読む
2. **キャラ参照**: `../custom_post_system/character_profile.json` が存在する場合は口調・口癖・温度を参照する。存在しない場合はユーザーに確認する
3. **テンプレート参照**: `launch_templates.md` のスケジュール・構造に従う
4. **実例参照**: 該当する `reference_*.md` や `example_*.md` のトーン・構造を参考にする
5. **出力先**: 生成物は `logs/` フォルダに `output_[種類].md` として保存する

### コンテンツ種類と参照ファイル

| コンテンツ | 参照ファイル | 出力ファイル |
|---|---|---|
| ローンチ投稿（全42本+企画3本） | `launch_design.md` + `launch_templates.md` + `example_launch_posts.md` | `logs/output_posts.md` or Phase別に分割 |
| コラム3本 | `launch_design.md` + `launch_templates.md`（コラム連鎖テンプレート） + `reference_columns.md` | `logs/output_columns.md` |
| セールスレター | `launch_design.md` + `launch_templates.md`（レターテンプレート） + `reference_sales_letters.md` | `logs/output_sales_letter.md` |
| LINE配信11通 | `launch_design.md` + `launch_templates.md`（LINE配信テンプレート） + `reference_line_messages.md` | `logs/output_line_messages.md` |

### 並列生成（Agent活用）

「全部作って」「並列で作って」と指示された場合、以下の6バッチに分割してAgent（サブエージェント）で並列生成する:

1. Phase 1 投稿（Day 1-5 / 15本）
2. Phase 2 投稿（Day 6-10 / 15本）
3. Phase 3 投稿（Day 11-14 / 12本 + 企画3本）
4. コラム3本（企画投稿付き）
5. セールスレター
6. LINE配信11通

### 設計書の作成支援

「設計書を作りたい」「launch_design.md を埋めたい」と指示された場合:
1. `launch_design.md` を読み込む
2. ユーザーに商品情報を質問しながら `[YOUR_xxx]` プレースホルダーを埋めていく
3. わからない項目は具体例を示して質問する
4. 全て埋まったら `launch_design.md` を上書き保存する

### 生成後の品質チェック

生成後、`launch_design.md` 内のチェックリストに基づいて以下を確認:
- 課題解決ロジックの7段階のどこに位置する投稿か明確か
- 刷り込みキーワードが自然に含まれているか
- 該当フェーズの目的に沿っているか
- 口調・温度感が character_profile.json と一致しているか
- Phase 1-2で商品を直接売っていないか
- コラムの連鎖構造（末尾フック）が機能しているか

### コンプライアンス

生成するすべてのコンテンツで以下を遵守:
- 個人の体験談には免責表示を付記する
- 「全員」「必ず」「確実に」等の断定表現を避ける
- 精神的・身体的改善を断定しない（薬機法）
- 他社否定をしない（自社の姿勢強調に留める）
- 「波動」「ヒーリング」等の独自用語には定義注釈を入れる
- 詳細は各 `reference_*.md` 内のコンプライアンスガイドを参照
