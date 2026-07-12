# 占いビジネス管理（biz-app）

KPI管理とボトルネック早期特定のためのダッシュボード。YTツールとは独立したアプリ（別URL・別DB・別ログイン）。

## 機能（Phase 1）

- **ダッシュボード**: 売上・リストイン（媒体別）・無料/有料鑑定・アップセルのKPIカード、ファネルビュー（段階別移行率と前期間比、最も悪化した段階=ボトルネック候補をハイライト）
- **売上内訳**: カテゴリ別（有料鑑定/アップセル/講座/リピート/ローンチ）・アカウント別・月次推移・明細
- **実績入力**: 日次実績（媒体別リストイン、無料鑑定申込/送付）と売上の手入力 + 履歴・削除
- **設定**: アカウント（恋愛・金運など運用単位）とメンバー（オーナー/管理者/編集者/閲覧者）の管理
- **認証**: localhost では認証スキップ。デプロイ先では初回アクセス時にオーナー登録（/setup）

## ローカル開発

```bash
cd biz-app
npm install
npx prisma db push      # prisma/dev.db を作成
npm run db:seed         # サンプルデータ投入（任意）
npm run dev
```

## Railwayへのデプロイ（YTツールとは別サービス）

1. Railwayのプロジェクトで「New Service」→ このGitHubリポジトリを選択
2. Service Settings → **Root Directory を `biz-app` に設定**
3. 環境変数を設定:
   - `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`: 本番DB（Turso）。YTツールとは**別のデータベース**を作ること
   - `NEXTAUTH_SECRET`: ランダムな長い文字列（`openssl rand -base64 32` などで生成）
   - `NEXTAUTH_URL`: デプロイ後のURL
4. 初回デプロイ後、`npx prisma db push` をTurso向けに一度実行してテーブルを作成
5. デプロイ先URLにアクセス → /setup でオーナーアカウントを作成

## 今後のフェーズ

- Phase 2: テンプレ管理（鑑定文・エバー配信・リピーター定期・ローンチ配信のライブラリ、バージョン別成績、ABテスト比較）
- Phase 3: UTAGE webhook受信（リストイン・経路の自動記録）、BASE API連携（売上の自動計上）
- Phase 4: ローンチ振り返りページ、AI分析（レポート蓄積・フィードバックループ）

スキーマ（Template/TemplateVersion/Launch/AiReport/Contact）はPhase 2以降の分も定義済み。
