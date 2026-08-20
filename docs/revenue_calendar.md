# 収益カレンダーツール（単体）

日々の売上をカレンダーに記録し、累計・期間別で集計する単体ツール。
他ツールのサイドバーは出さず、`/revenue` だけで完結するフルスクリーンUI。

## 画面

| URL | 内容 |
|---|---|
| `/revenue` | 月カレンダー。日付タップで入力シートが開き、収入/支出を記録・編集・削除。月の収入/支出/合計と当月の記録一覧も表示 |
| `/revenue/stats` | 累計売上（全期間）と、期間を絞った集計。プリセット（今月/先月/過去30日/今年/全期間）＋カスタム日付指定、月別の推移、項目別の内訳 |

## 使い方

1. `/revenue` を開く（スマホはホーム画面に追加するとアプリのように使える）
2. カレンダーの日付をタップ → 金額・項目名（クイック選択あり）・カテゴリ・メモを入れて「記録する」
3. 記録済みの行をタップすると編集モード、ゴミ箱アイコンで削除
4. 上部タブの「集計」で累計・期間別の数字を確認

## データ構造

`RevenueEntry`（`prisma/schema.prisma`）

| カラム | 内容 |
|---|---|
| `date` | YYYY-MM-DD |
| `type` | `income`（収入） / `expense`（支出） |
| `amount` | 常に正の整数。符号は `type` で判定 |
| `label` | 項目名（例: 売上、報酬） |
| `category` | カテゴリ（任意） |
| `memo` | メモ（任意） |

## API

`/api/revenue`

- `GET` … `?year=2026&month=8`（月指定）/ `?from=2026-01-01&to=2026-03-31`（期間指定）/ パラメータなしで全期間
- `POST` … `{ date, type, amount, label, category, memo }`（`amount` は全角数字・カンマ・「円」付きでも可）
- `PUT` … `{ id, ...更新したい項目 }`
- `DELETE` … `{ id }`

## セットアップ

本番（Turso）にテーブルを作る場合:

```bash
TURSO_DATABASE_URL=xxx TURSO_AUTH_TOKEN=xxx npm run migrate:turso
```

ローカルは `prisma/dev.db`（`npm run dev` の前に `npx prisma generate`）。

## メモ

- 本番ドメインではログインが必要（`/sales` のように未ログインで開けるようにしたい場合は、`src/middleware.ts` と `src/components/AuthGuard.tsx` の `PUBLIC_PATHS` に `/revenue` と `/api/revenue` を追加する）
- 日付・金額のフォーマットと集計ロジックは `src/lib/revenue.ts` に集約
