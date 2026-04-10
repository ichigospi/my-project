@AGENTS.md

# ローンチツール（チャット版）

`custom_launch_system/` にローンチコンテンツ一括生成システムがあります。
ユーザーから「ローンチ」「設計書」「投稿を作って」「コラムを作って」「セールスレターを作って」「LINE配信を作って」等の指示があった場合は、このシステムを使ってください。

## 使い方

詳細なルールは `@custom_launch_system/CLAUDE.md` を参照。

### 設計書を作る

ユーザーに商品情報を質問しながら `custom_launch_system/launch_design.md` の `[YOUR_xxx]` を埋めていく。

```
例: 「設計書を作りたい。占いのアカウントで神社選定鑑定を7,980円で売りたいです」
```

### コンテンツを生成する

設計書が完成したら、以下を参照して生成する:

| コンテンツ | 参照ファイル | 出力先 |
|---|---|---|
| 投稿42本+企画3本 | `launch_design.md` + `launch_templates.md` + `example_launch_posts.md` | `logs/output_posts.md` |
| コラム3本 | `launch_design.md` + `launch_templates.md` + `reference_columns.md` | `logs/output_columns.md` |
| セールスレター | `launch_design.md` + `launch_templates.md` + `reference_sales_letters.md` | `logs/output_sales_letter.md` |
| LINE配信11通 | `launch_design.md` + `launch_templates.md` + `reference_line_messages.md` | `logs/output_line_messages.md` |

### 実例集に追加する

「この投稿良かったから覚えて」「実例に追加して」と言われたら、該当する `reference_*.md` や `example_*.md` に追記する。
