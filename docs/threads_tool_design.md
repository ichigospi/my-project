# Threads投稿作成ツール 設計書

目的: **競合分析 → オマージュ投稿の自動作成 → 反応計測** を1つのUIで回すこと。

**既存のXポストツール（`/x-post`）からは完全に独立させる。**
共有するのはログイン認証（next-auth / User.role）とインフラ（同じNext.jsアプリ・同じDB）だけで、
テーブル（すべて `Threads` プレフィックス）・画面（`/threads` 配下）・プロンプト・ナレッジ・ライブラリは一切共有しない。
Xツール側を変更してもThreads側に影響が出ない構造にする（逆も同様）。

---

## 0. 最初に共有すべき前提（外部APIの制約）

設計の形を決める制約が2つある。

### 0-1. Threads公式APIでできること / できないこと

| 項目 | 公式APIの可否 | 備考 |
|---|---|---|
| 自アカへの投稿（テキスト/画像/動画/カルーセル） | ✅ 可 | コンテナ作成→公開の2段階。約250投稿/24hの制限 |
| 自アカ投稿のインサイト（views, likes, replies, reposts, quotes） | ✅ 可 | `threads_manage_insights` |
| 自アカのフォロワー数・プロフィール | ✅ 可 | |
| 予約投稿 | ❌ ネイティブ機能なし | **自前スケジューラで実装**（後述） |
| キーワードで公開投稿を検索 | ✅ 可 | `threads_keyword_search`（審査必要） |
| **競合アカウントのタイムライン取得** | ⚠️ 制限あり | 任意ハンドル指定での投稿一覧・数値取得は公式には安定提供されていない |
| 競合投稿の表示回数（views） | ❌ 不可 | viewsは本人しか見えない。likes/replies/repostsは画面上の公開値のみ |

→ 競合ベンチマークは **「取得アダプタ」を差し替え可能な設計** にする（§5）。
手動貼り付けで今日から使え、後からスクレイパーやAPIを足しても画面側は変わらない。

### 0-2. Claude APIは画像・動画を生成できない → 画像はOpenAI（ChatGPT系API）と連携【決定】

Claude APIはテキスト生成・分析専用。画像は **OpenAI画像生成API（gpt-image-1）** を使う。

- フロー: 投稿本文からClaudeが画像プロンプトを自動作成 → gpt-image-1 で生成 → プレビュー → 気に入ったものをdraftに添付。
- 必要なもの: OpenAIのAPIキー（設定画面に登録）。コストは品質設定により1枚あたり数円〜30円程度の従量課金。
- 補助として、テキスト画像（名言・リスト系）はテンプレート合成（satori + sharp、費用ゼロ）も併設し、投稿タイプで使い分ける。
- **動画（Phase 3）**: テキスト画像+BGMのスライド動画をffmpegで合成する方式を推奨。生成AI動画（Veo等）は高コストなので最後。

---

## 1. 技術スタック（既存をそのまま使う）

| レイヤ | 採用 | 理由 |
|---|---|---|
| フレームワーク | Next.js 16 (App Router) + React 19 | 既存アプリに同居。`/threads` 配下に追加 |
| DB | Prisma + Turso (libsql) | **サーバー側DBが唯一の正** → 複数編集者の同期問題が構造的に起きない |
| 認証・権限 | next-auth + 既存 `User.role`（owner/admin/editor/viewer） | 管理者/編集者登録は既存の招待機能を流用 |
| AI（テキスト） | `@anthropic-ai/sdk`（導入済み） | 生成・分析・分類・壁打ちすべてClaude |
| AI（画像） | OpenAI API（gpt-image-1） | 投稿に合った画像生成。キーは設定画面で登録 |
| デプロイ | Railway | cron（予約投稿・計測）もRailwayのcronで叩く |

新規インフラ不要。**追加するのはページ・APIルート・Prismaモデルのみ。**

---

## 2. 画面構成

グローバルヘッダーに **アカウント切替セレクタ** を常設（選択中accountIdはURLクエリ or Cookieに保持。全ページ・全APIがaccountIdスコープで動く）。

| パス | 画面 | 主な内容 |
|---|---|---|
| `/threads` | ダッシュボード | 今日の予約投稿、直近7日の成績サマリ、競合ホット投稿 |
| `/threads/accounts` | アカウント管理 | 自アカ登録、**コンセプト・投稿ロジック・口調・ターゲット**の登録（生成時に必ず注入） |
| `/threads/knowledge` | ノウハウ | 投稿ルール・教材・メモの登録（生成プロンプトに注入） |
| `/threads/competitors` | ベンチマーク | 競合アカウント登録、投稿の取り込み |
| `/threads/research` | 競合投稿リサーチ | 伸びてる投稿の検索・ソート、**企画タイプ別の自動分類**表示 |
| `/threads/library` | ライブラリ | **フック / 企画 / CTA** の登録・タグ・呼び出し |
| `/threads/create` | オマージュ作成 | 参考A/B選択 → 生成 → 壁打ちチャット（本ツールの中心画面） |
| `/threads/posts` | 投稿管理 | 依頼どおりの項目を持つテーブル（§4） |
| `/threads/analytics` | アナリティクス | 自アカ推移、投稿別成績、企画タイプ×成績のクロス分析 |
| `/threads/settings` | 設定 | APIトークン、計測タイミング、既定モデル等 |

### `/threads/create` のレイアウト（3ペイン）

```
┌──────────────┬──────────────────┬──────────────┐
│ 参考投稿A     │  生成結果（編集可） │ AI壁打ちチャット │
│ 参考投稿B     │  類似度チェック表示  │ 「フック弱い」   │
│ ─────────    │  [再生成] [保存]   │ 「Bの型に寄せて」 │
│ フック差替 ▼  │  画像プレビュー     │ …            │
│ CTA差替  ▼  │                  │              │
│ 企画選択  ▼  │                  │              │
└──────────────┴──────────────────┴──────────────┘
```

---

## 3. データモデル（Prisma追加分）

既存Xツールは genre（2種）スコープだったが、Threadsは**アカウント数が可変**なので全テーブルを `accountId` スコープにするのが最大の設計差分。

```prisma
// 自アカウント（切替単位）
model ThreadsAccount {
  id              String   @id @default(cuid())
  name            String                    // 表示名
  handle          String   @unique
  // Threads API接続（Phase 2）
  threadsUserId   String   @default("")
  accessToken     String   @default("")     // 暗号化して保存
  tokenExpiresAt  DateTime?
  // 投稿の土台（生成時に必ず注入）
  concept         String   @default("")     // コンセプト
  logic           String   @default("")     // 投稿ロジック（勝ちパターンの言語化）
  target          String   @default("")
  tone            String   @default("{}")   // 口調JSON: 一人称/語尾/絵文字/改行
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  competitors ThreadsCompetitor[]
  drafts      ThreadsPostDraft[]
}

// ノウハウ・投稿ルール（accountId=null は全アカ共通）
model ThreadsKnowledge {
  id        String   @id @default(cuid())
  accountId String?
  type      String                        // "rule" | "knowhow" | "teaching" | "memo"
  title     String   @default("")
  content   String
  tags      String   @default("[]")
  isInjected Boolean @default(true)       // 生成プロンプトへ自動注入するか
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([accountId, type])
}

// 競合アカウント
model ThreadsCompetitor {
  id        String   @id @default(cuid())
  accountId String                        // どの自アカのベンチマークか
  handle    String
  name      String   @default("")
  note      String   @default("")
  priority  Int      @default(0)          // 重点ベンチマーク順
  account   ThreadsAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  posts     ThreadsCompetitorPost[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([accountId, handle])
}

// 収集した競合投稿
model ThreadsCompetitorPost {
  id            String   @id @default(cuid())
  competitorId  String
  postUrl       String   @default("")
  content       String
  mediaUrls     String   @default("[]")
  likes         Int      @default(0)
  replies       Int      @default(0)
  reposts       Int      @default(0)
  quotes        Int      @default(0)
  views         Int      @default(0)      // 手動入力用（公開値は取れないため）
  followerCountAt Int    @default(0)      // 収集時の競合フォロワー数（伸び率算出用）
  postedAt      DateTime?
  collectedAt   DateTime @default(now())
  source        String   @default("manual") // "manual" | "keyword_api" | "scraper"
  // AI自動分類（§6）
  planType      String   @default("")     // 企画タイプ
  hookType      String   @default("")
  structureJson String   @default("{}")   // フック/展開/締めの構造分解
  isHot         Boolean  @default(false)  // 伸び判定
  competitor    ThreadsCompetitor @relation(fields: [competitorId], references: [id], onDelete: Cascade)
  @@index([competitorId])
  @@index([planType])
  @@index([isHot])
}

// フック・企画・CTAライブラリ（typeで統一管理）
model ThreadsLibraryItem {
  id           String   @id @default(cuid())
  accountId    String?                    // null=共通
  type         String                     // "hook" | "plan" | "cta"
  title        String
  content      String                     // フック文/企画骨子/CTA文
  sourcePostId String?                    // 抽出元の競合投稿
  tags         String   @default("[]")
  strength     Int      @default(3)       // 1-5 主観評価
  useCount     Int      @default(0)
  note         String   @default("")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@index([accountId, type])
}

// 投稿管理の中核（依頼の項目を全て持つ）
model ThreadsPostDraft {
  id            String   @id @default(cuid())
  accountId     String
  // ── 参考投稿A/B（スナップショット保存：元が消えても残す）
  refAPostId    String?
  refASnapshot  String   @default("{}")   // {content, url, postedAt, likes, replies, views...}
  refBPostId    String?
  refBSnapshot  String   @default("{}")
  // ── 生成
  content       String   @default("")     // オマージュ投稿案（手動編集可）
  generationMeta String  @default("{}")   // 使用フック/CTA/企画ID、合成モード、モデル、類似度スコア
  mediaUrls     String   @default("[]")
  // ── 運用
  status        String   @default("draft") // draft|approved|scheduled|published|rejected
  approvedById  String?                   // 投稿可否チェックした人
  scheduledAt   DateTime?                 // 投稿予定日時
  publishedAt   DateTime?
  threadsPostId String   @default("")     // 公開後のID（計測キー）
  // ── 計測（cronが自動更新）
  views         Int      @default(0)
  likes         Int      @default(0)
  replies       Int      @default(0)
  reposts       Int      @default(0)
  quotes        Int      @default(0)
  metricsUpdatedAt DateTime?
  // ── 振り返り
  insight       String   @default("")     // 考察
  ownerComment  String   @default("")     // オーナーコメント
  account       ThreadsAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
  chats         ThreadsChatMessage[]
  snapshots     ThreadsMetricSnapshot[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  @@index([accountId, status])
  @@index([scheduledAt])
}

// 壁打ちチャット（投稿案ごと）
model ThreadsChatMessage {
  id        String   @id @default(cuid())
  draftId   String
  role      String                        // "user" | "assistant"
  content   String
  draft     ThreadsPostDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
  @@index([draftId])
}

// 計測の時系列スナップショット（1h/24h/72h/7d後の伸び方を見る）
model ThreadsMetricSnapshot {
  id         String   @id @default(cuid())
  draftId    String
  capturedAt DateTime @default(now())
  views      Int @default(0)
  likes      Int @default(0)
  replies    Int @default(0)
  reposts    Int @default(0)
  quotes     Int @default(0)
  draft      ThreadsPostDraft @relation(fields: [draftId], references: [id], onDelete: Cascade)
  @@index([draftId])
}

model ThreadsSettings {
  id            String @id @default(cuid())
  defaultModel  String @default("claude-sonnet-5")
  metricsTiming String @default("[1,24,72,168]") // 計測タイミング(時間)
  publishMode   String @default("manual")        // "manual" | "auto"
  updatedAt     DateTime @updatedAt
}
```

---

## 4. 投稿管理ページ（`/threads/posts`）

依頼された項目とテーブル列の対応:

| 依頼項目 | 実装 | 入力 |
|---|---|---|
| 参考投稿A / B | `refASnapshot` / `refBSnapshot`（内容・URL） | 作成時に自動 |
| A/Bの投稿日時・表示回数・いいね・コメント数 | スナップショットJSON内 | 収集時の値を**自動転記**（viewsのみ手動補完可） |
| オマージュ投稿案 | `content` | 自動生成 or 手動、後から編集可 |
| 投稿可否のチェック | `status` + `approvedById` | チェックボックス（誰が承認したか記録） |
| 投稿予定日時 | `scheduledAt` | 日時ピッカー |
| 考察 | `insight` | 手動（+「AI考察を下書き」ボタン） |
| オーナーコメント | `ownerComment` | 手動 |
| （自投稿の実績） | views/likes/replies等 | **cronで自動入力** |

UI: フィルタ（ステータス/期間/企画タイプ）、行クリックで詳細ドロワー（壁打ちチャット・計測グラフ・参考投稿比較を表示）。セル単位のインライン編集。

---

## 5. 競合ベンチマーク: 取得アダプタ設計

画面・DBは共通で、投稿の入り口だけ3段構えにする。

```
ThreadsCompetitorPost ←─ importPost(input): 共通インターフェース
        ├─ ① 手動貼り付け（Phase 1）: 本文+数値をフォーム/一括貼り付け。
        │    貼り付けテキストをClaudeがパースして各フィールドに自動振り分け
        ├─ ② 外部スクレイパー（Phase 2・採用決定）: Apify等のActorを
        │    設定画面から接続。日次cronで競合の新着+公開数値を自動取り込み
        └─ ③ キーワード検索API（Phase 2〜3・補助）: threads_keyword_search で
             ジャンルKWの伸び投稿を定期収集 → 競合ハンドルと突合
```

### スクレイパー利用時の自アカ保護ルール（BAN回避の大前提）

スクレイパーは**運用アカウントと完全に切り離して使う**。この分離を守る限り、
収集はスクレイパー業者側のインフラ・アカウントで行われるため、自分の運用アカウントに紐づくBANリスクは実質発生しない。

1. **運用アカウントのログイン情報・Cookie・セッションを絶対にスクレイパーへ渡さない**（自アカのログイン状態で収集する設定は使わない）。
2. 収集対象は公開投稿のみ。取得データはこのツール内部での分析用にとどめる（再配布しない）。
3. スクレイパー側のアカウント/プロキシが弾かれるリスクは業者側が負う。業者選定はThreads対応実績のあるActor（Apify等）から選ぶ。
4. 万一に備え、スクレイパー接続は設定画面でON/OFFでき、止めても手動貼り付けで運用が継続できる構造にしておく（§5のアダプタ設計そのもの）。

「伸びてる」判定: `likes / 収集時フォロワー数` のエンゲージ率 + 同一競合の中央値との比較で `isHot` を自動フラグ。

---

## 6. AI機能（すべてClaude API・サーバー側で実行）

| 機能 | 入力 | 出力 |
|---|---|---|
| **① 構造分解** | 競合投稿1本 | フック/展開/締め/改行リズム/CTAをJSONで抽出（収集時に自動実行、`structureJson`へ） |
| **② 企画分類** | 競合投稿 | 企画タイプ（あるある共感/ノウハウ列挙/問いかけ/ストーリー/権威実績/リスト型…）を自動タグ付け |
| **③ オマージュ生成** | 参考A(+B) + 差替指定 + アカウント情報 | 投稿案N件（§6-1） |
| **④ 壁打ちチャット** | 投稿案 + 参考投稿 + 会話履歴 | 修正案。「この案で確定」でdraftに反映 |
| **⑤ 類似度チェック** | 生成案 vs 参考A/B | 文単位の一致率。**高すぎる（完コピ）警告**と言い換え提案 |
| **⑥ AI考察下書き** | 実績数値 + 参考投稿の数値 + 過去の自投稿成績 | 考察のたたき台 |

### 6-1. オマージュ生成プロンプトの構成

```
[システム] アカウントのコンセプト / 投稿ロジック / 口調ルール
         + ThreadsKnowledge(isInjected=true) のルール・ノウハウ
[ユーザー] 参考投稿A（本文+構造分解JSON）
         参考投稿B（あれば）
         合成モード: "single_homage"（Aの型を踏襲）
                   | "hybrid"（Aの本文骨格 × Bのフック 等、部位指定）
                   | "hook_swap"（ライブラリのフックに差し替え）
         差替指定: フックID / CTAID / 企画ID（ライブラリから選択）
         指示: 「構造・リズム・言い回しの型は参考投稿に忠実に。
               固有名詞・数字・体験部分だけ自アカ文脈に置換。
               ただし文の丸写しは禁止（類似度チェックで弾く）」
[出力] 投稿案3件 + 各案の「どこをAから、どこをBから取ったか」の対応表
```

「オリジナル要素を排除しつつ完コピは避ける」という運用要件を、**型は保存・表現は言い換え**としてプロンプトと類似度チェックの2段で担保する。

---

## 7. 予約投稿・自動計測（cron）

Railwayのcronで2本のエンドポイントを叩く（要 `CRON_SECRET` ヘッダ認証）。

1. **`POST /api/threads/cron/publish`（5分毎）**
   `status=scheduled && scheduledAt <= now` のdraftをThreads Publishing APIで公開 → `threadsPostId` 保存、status=published。失敗はリトライ+ダッシュボードに警告表示。
   公開されるのは「投稿可否チェック済み（approved）→予約確定（scheduled）」を通過したdraftのみ。加えて設定画面に**全アカウント一括の自動公開停止スイッチ**を置き、誤爆時に即止められるようにする。
2. **`POST /api/threads/cron/metrics`（1時間毎）**
   published投稿のうち計測タイミング（既定: 投稿後1h/24h/72h/7日）に達したものをInsights APIで取得 → draft本体を最新値に更新 + `ThreadsMetricSnapshot` に時系列追加。

Phase 1（API未接続の間）は「手動で投稿→URL貼り付け→数値手動入力」でも同じテーブルが回るようにしておく。

---

## 8. 権限・同時編集・パフォーマンス

### 権限（既存User.roleを流用）
| 操作 | viewer | editor | admin/owner |
|---|---|---|---|
| 閲覧 | ✅ | ✅ | ✅ |
| 競合収集・ライブラリ・投稿案作成・壁打ち | | ✅ | ✅ |
| 投稿可否チェック・予約確定 | | ✅ | ✅ |
| アカウント接続（トークン）・メンバー招待・削除系 | | | ✅ |

### 同時編集で消えない設計
- 正はサーバーDB（Turso）のみ。ローカルstateは表示キャッシュ。
- **フィールド単位PATCH**: 考察とオーナーコメントを別人が同時に書いても衝突しない。
- 同一フィールド衝突は `updatedAt` の楽観ロック（送信時にbase値を添付、ズレたら409→最新を提示してマージ）。
- 一覧はSWRで15〜30秒ポーリング + 操作後即時revalidate。リアルタイムWebSocketは不要（この人数・頻度ならポーリングで十分軽い）。

### 軽さ（画面遷移）
- 一覧APIは必要カラムのみ `select`（本文は先頭120字のプレビュー、詳細はドロワーで遅延取得）。
- ページネーション必須（50件/頁）+ 上記スキーマのindex。
- App RouterのRSCで初期HTMLを出し、`next/link` prefetchで遷移体感ゼロに。
- AI生成はストリーミング応答（体感待ち時間の短縮）。重いバッチ（分類・収集）は非同期ジョブにしてUIをブロックしない。

---

## 9. 実装フェーズ

| Phase | 内容 | 価値 |
|---|---|---|
| **1: 手動運用MVP** | アカウント/ノウハウ登録、競合手動取り込み（貼り付けAIパース）、リサーチ画面+自動分類、ライブラリ、オマージュ生成+類似度チェック+壁打ち、投稿管理テーブル（数値手動） | **今日から運用が回る。** ツールの核（生成品質）を先に磨ける |
| **2: 自動化** | Threads OAuth、予約自動投稿cron、インサイト自動計測cron、**有料スクレイパー接続（競合自動収集）**、**OpenAI画像生成**、アナリティクス画面 | 「自動入力」「反応計測」「自動収集」が完成 |
| **3: 拡張** | キーワード検索API収集、スライド動画生成、企画×成績のクロス分析 | 運用の完全自動化に接近 |

---

## 10. 決定事項と Metaアプリの進め方

### 決定事項（オーナー確認済み）

1. Xポストツールとは**完全独立**（冒頭の方針どおり）。
2. 公開の最終トリガーは**cronによる自動公開**（approved→scheduledの二段チェック+一括停止スイッチで誤爆を防ぐ）。
3. 競合自動収集は**有料スクレイパーを採用**（§5の自アカ保護ルールを厳守）。
4. 画像生成は**OpenAI API（gpt-image-1）と連携**。

### Metaデベロッパーアプリの進め方

- **アプリは1つでよい。** OAuthで各運用アカウントがそれぞれアプリを承認し、アカウントごとに個別のアクセストークンが発行される仕組み。運用アカウントが増えても接続操作を繰り返すだけでアプリの追加登録は不要。
- **審査（App Review）もアプリ単位で1回。** さらに、接続するのが自分たちの運用アカウントだけなら、各アカウントをアプリの「Threadsテスター」として追加することで、基本スコープ（投稿・インサイト）は本審査なしの開発モードでも運用できる可能性が高い。審査が必須になるのは keyword_search 等の上位権限を使う段階。
- **クリーンな環境で登録する。** Metaは端末・IP・支払い情報・関連アカウントでリスク判定するため、開発者登録とアプリ作成は、過去にBAN歴のあるアカウント・端末・回線と紐づかない、利用歴が長く健全なMetaアカウントで行う。可能ならビジネス認証まで済ませると審査・凍結耐性が上がる。
