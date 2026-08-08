// Tursoにスキーマをマイグレーションするスクリプト
// 使い方: TURSO_DATABASE_URL=xxx TURSO_AUTH_TOKEN=xxx node scripts/migrate-turso.mjs

import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const sqls = [
  `CREATE TABLE IF NOT EXISTS "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "hashedPassword" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'editor', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, "invitedById" TEXT, CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "Invite" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT NOT NULL, "role" TEXT NOT NULL DEFAULT 'editor', "token" TEXT NOT NULL, "usedAt" DATETIME, "expiresAt" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdById" TEXT NOT NULL, CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "AppSetting" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "ScriptAnalysis" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "videoId" TEXT NOT NULL, "videoUrl" TEXT NOT NULL, "videoTitle" TEXT NOT NULL, "channelName" TEXT NOT NULL, "thumbnailUrl" TEXT NOT NULL DEFAULT '', "views" INTEGER NOT NULL DEFAULT 0, "transcript" TEXT NOT NULL, "analysisResult" TEXT, "category" TEXT NOT NULL DEFAULT 'other', "tags" TEXT NOT NULL DEFAULT '[]', "score" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ScriptAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS "ScriptProposal" ("id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "sourceAnalysisIds" TEXT NOT NULL DEFAULT '[]', "style" TEXT NOT NULL DEFAULT 'healing', "topic" TEXT NOT NULL DEFAULT '', "proposal" TEXT, "generatedScript" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ScriptProposal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Invite_token_key" ON "Invite"("token")`,
  `CREATE INDEX IF NOT EXISTS "ScriptAnalysis_userId_idx" ON "ScriptAnalysis"("userId")`,
  `CREATE INDEX IF NOT EXISTS "ScriptProposal_userId_idx" ON "ScriptProposal"("userId")`,
  `CREATE TABLE IF NOT EXISTS "LaunchExample" ("id" TEXT NOT NULL PRIMARY KEY, "type" TEXT NOT NULL, "title" TEXT NOT NULL DEFAULT '', "content" TEXT NOT NULL, "note" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "LaunchExample_type_idx" ON "LaunchExample"("type")`,
  `CREATE TABLE IF NOT EXISTS "SalesRecord" ("id" TEXT NOT NULL PRIMARY KEY, "date" TEXT NOT NULL, "description" TEXT NOT NULL, "amount" INTEGER NOT NULL, "balance" INTEGER NOT NULL, "category" TEXT NOT NULL DEFAULT 'other', "note" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "SalesRecord_date_idx" ON "SalesRecord"("date")`,

  // ===== Xポストツール =====
  `CREATE TABLE IF NOT EXISTS "XAccountInfo" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "accountName" TEXT NOT NULL DEFAULT '', "handle" TEXT NOT NULL DEFAULT '', "concept" TEXT NOT NULL DEFAULT '', "target" TEXT NOT NULL DEFAULT '', "followerImage" TEXT NOT NULL DEFAULT '', "usp" TEXT NOT NULL DEFAULT '', "character" TEXT NOT NULL DEFAULT '', "divinationStyle" TEXT NOT NULL DEFAULT '', "pronoun" TEXT NOT NULL DEFAULT '', "sentenceEnd" TEXT NOT NULL DEFAULT '', "temperature" TEXT NOT NULL DEFAULT '', "emojiUsage" TEXT NOT NULL DEFAULT '', "lineBreakRule" TEXT NOT NULL DEFAULT '', "mainKeywords" TEXT NOT NULL DEFAULT '[]', "subKeywords" TEXT NOT NULL DEFAULT '[]', "ngExpressions" TEXT NOT NULL DEFAULT '', "mainProduct" TEXT NOT NULL DEFAULT '', "lpUrl" TEXT NOT NULL DEFAULT '', "storyBeforeState" TEXT NOT NULL DEFAULT '{}', "storyTurningPoint" TEXT NOT NULL DEFAULT '{}', "storyEpisodes" TEXT NOT NULL DEFAULT '[]', "storyExtremeActs" TEXT NOT NULL DEFAULT '[]', "storyNgBehaviors" TEXT NOT NULL DEFAULT '[]', "storyAfterState" TEXT NOT NULL DEFAULT '{}', "storyCommonGround" TEXT NOT NULL DEFAULT '[]', "storyPhrases" TEXT NOT NULL DEFAULT '[]', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "XAccountInfo_genre_key" ON "XAccountInfo"("genre")`,

  `CREATE TABLE IF NOT EXISTS "XKnowledge" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "type" TEXT NOT NULL, "title" TEXT NOT NULL DEFAULT '', "content" TEXT NOT NULL, "authorHandle" TEXT NOT NULL DEFAULT '', "postUrl" TEXT NOT NULL DEFAULT '', "likes" INTEGER NOT NULL DEFAULT 0, "retweets" INTEGER NOT NULL DEFAULT 0, "impressions" INTEGER NOT NULL DEFAULT 0, "postedAt" DATETIME, "structureType" TEXT NOT NULL DEFAULT '', "hookAnalysis" TEXT NOT NULL DEFAULT '', "bodyAnalysis" TEXT NOT NULL DEFAULT '', "closingAnalysis" TEXT NOT NULL DEFAULT '', "usedWords" TEXT NOT NULL DEFAULT '[]', "applicationHint" TEXT NOT NULL DEFAULT '', "tags" TEXT NOT NULL DEFAULT '[]', "source" TEXT NOT NULL DEFAULT '', "note" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "XKnowledge_genre_idx" ON "XKnowledge"("genre")`,
  `CREATE INDEX IF NOT EXISTS "XKnowledge_type_idx" ON "XKnowledge"("type")`,

  `CREATE TABLE IF NOT EXISTS "XCompetitor" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "handle" TEXT NOT NULL, "name" TEXT NOT NULL DEFAULT '', "note" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "XCompetitor_genre_handle_key" ON "XCompetitor"("genre", "handle")`,

  `CREATE TABLE IF NOT EXISTS "XPost" ("id" TEXT NOT NULL PRIMARY KEY, "competitorId" TEXT NOT NULL, "postId" TEXT NOT NULL DEFAULT '', "postUrl" TEXT NOT NULL DEFAULT '', "content" TEXT NOT NULL, "likes" INTEGER NOT NULL DEFAULT 0, "retweets" INTEGER NOT NULL DEFAULT 0, "replies" INTEGER NOT NULL DEFAULT 0, "impressions" INTEGER NOT NULL DEFAULT 0, "postedAt" DATETIME, "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "isQuoteRt" BOOLEAN NOT NULL DEFAULT false, "quotedPostUrl" TEXT NOT NULL DEFAULT '', CONSTRAINT "XPost_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "XCompetitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "XPost_competitorId_idx" ON "XPost"("competitorId")`,

  `CREATE TABLE IF NOT EXISTS "XPostAnalysis" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "postIds" TEXT NOT NULL DEFAULT '[]', "result" TEXT, "summary" TEXT NOT NULL DEFAULT '', "customInstruction" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "XPostAnalysis_genre_idx" ON "XPostAnalysis"("genre")`,

  `CREATE TABLE IF NOT EXISTS "XPostTemplate" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "name" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT, "structure" TEXT NOT NULL DEFAULT '{}', "skeleton" TEXT NOT NULL, "placeholders" TEXT NOT NULL DEFAULT '[]', "notes" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "XPostTemplate_genre_idx" ON "XPostTemplate"("genre")`,

  `CREATE TABLE IF NOT EXISTS "XSequencePattern" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL DEFAULT 'any', "name" TEXT NOT NULL, "description" TEXT NOT NULL DEFAULT '', "pattern" TEXT NOT NULL, "example" TEXT NOT NULL DEFAULT '', "isBuiltIn" BOOLEAN NOT NULL DEFAULT false, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "XSequencePattern_genre_idx" ON "XSequencePattern"("genre")`,

  `CREATE TABLE IF NOT EXISTS "XFolder" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "name" TEXT NOT NULL, "color" TEXT NOT NULL DEFAULT 'blue', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "XFolder_genre_idx" ON "XFolder"("genre")`,

  `CREATE TABLE IF NOT EXISTS "XFolderItem" ("id" TEXT NOT NULL PRIMARY KEY, "folderId" TEXT NOT NULL, "itemType" TEXT NOT NULL, "itemId" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "XFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "XFolder" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "XFolderItem_folderId_itemType_itemId_key" ON "XFolderItem"("folderId", "itemType", "itemId")`,

  `CREATE TABLE IF NOT EXISTS "XGeneratedPost" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "topic" TEXT NOT NULL DEFAULT '', "instruction" TEXT NOT NULL DEFAULT '', "educationType" TEXT NOT NULL DEFAULT '', "logicType" TEXT NOT NULL DEFAULT '', "output" TEXT NOT NULL, "metadata" TEXT NOT NULL DEFAULT '{}', "sourceTemplateId" TEXT, "sourceAnalysisId" TEXT, "sequencePatternId" TEXT, "dailyPlanId" TEXT, "slotIndex" INTEGER, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "XGeneratedPost_genre_idx" ON "XGeneratedPost"("genre")`,
  `CREATE INDEX IF NOT EXISTS "XGeneratedPost_createdAt_idx" ON "XGeneratedPost"("createdAt")`,

  `CREATE TABLE IF NOT EXISTS "XDailyPlan" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "date" TEXT NOT NULL, "slots" TEXT NOT NULL, "notes" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'draft', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "XDailyPlan_date_idx" ON "XDailyPlan"("date")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "XDailyPlan_genre_date_key" ON "XDailyPlan"("genre", "date")`,

  `CREATE TABLE IF NOT EXISTS "XSettings" ("id" TEXT NOT NULL PRIMARY KEY, "genre" TEXT NOT NULL, "postsPerDay" INTEGER NOT NULL DEFAULT 5, "educationConfig" TEXT NOT NULL DEFAULT '{}', "sequenceConfig" TEXT NOT NULL DEFAULT '{}', "spiceEnabled" BOOLEAN NOT NULL DEFAULT true, "defaultModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6', "xApiBearerToken" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "XSettings_genre_key" ON "XSettings"("genre")`,

  // ===== Threadsポストツール（Xツールとは完全独立） =====
  `CREATE TABLE IF NOT EXISTS "ThreadsAccount" ("id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "handle" TEXT NOT NULL, "concept" TEXT NOT NULL DEFAULT '', "logic" TEXT NOT NULL DEFAULT '', "target" TEXT NOT NULL DEFAULT '', "tone" TEXT NOT NULL DEFAULT '{}', "isActive" BOOLEAN NOT NULL DEFAULT true, "sortOrder" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ThreadsAccount_handle_key" ON "ThreadsAccount"("handle")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsKnowledge" ("id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT, "type" TEXT NOT NULL, "title" TEXT NOT NULL DEFAULT '', "content" TEXT NOT NULL, "tags" TEXT NOT NULL DEFAULT '[]', "isInjected" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "ThreadsKnowledge_accountId_type_idx" ON "ThreadsKnowledge"("accountId", "type")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsCompetitor" ("id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "handle" TEXT NOT NULL, "name" TEXT NOT NULL DEFAULT '', "note" TEXT NOT NULL DEFAULT '', "priority" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ThreadsCompetitor_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThreadsAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ThreadsCompetitor_accountId_handle_key" ON "ThreadsCompetitor"("accountId", "handle")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsCompetitorPost" ("id" TEXT NOT NULL PRIMARY KEY, "competitorId" TEXT NOT NULL, "postUrl" TEXT NOT NULL DEFAULT '', "content" TEXT NOT NULL, "mediaUrls" TEXT NOT NULL DEFAULT '[]', "likes" INTEGER NOT NULL DEFAULT 0, "replies" INTEGER NOT NULL DEFAULT 0, "reposts" INTEGER NOT NULL DEFAULT 0, "quotes" INTEGER NOT NULL DEFAULT 0, "views" INTEGER NOT NULL DEFAULT 0, "followerCountAt" INTEGER NOT NULL DEFAULT 0, "postedAt" DATETIME, "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "source" TEXT NOT NULL DEFAULT 'manual', "planType" TEXT NOT NULL DEFAULT '', "hookType" TEXT NOT NULL DEFAULT '', "structureJson" TEXT NOT NULL DEFAULT '{}', "isHot" BOOLEAN NOT NULL DEFAULT false, CONSTRAINT "ThreadsCompetitorPost_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "ThreadsCompetitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "ThreadsCompetitorPost_competitorId_idx" ON "ThreadsCompetitorPost"("competitorId")`,
  `CREATE INDEX IF NOT EXISTS "ThreadsCompetitorPost_planType_idx" ON "ThreadsCompetitorPost"("planType")`,
  `CREATE INDEX IF NOT EXISTS "ThreadsCompetitorPost_isHot_idx" ON "ThreadsCompetitorPost"("isHot")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsLibraryItem" ("id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT, "type" TEXT NOT NULL, "title" TEXT NOT NULL, "content" TEXT NOT NULL, "sourcePostId" TEXT, "tags" TEXT NOT NULL DEFAULT '[]', "strength" INTEGER NOT NULL DEFAULT 3, "useCount" INTEGER NOT NULL DEFAULT 0, "note" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "ThreadsLibraryItem_accountId_type_idx" ON "ThreadsLibraryItem"("accountId", "type")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsPostDraft" ("id" TEXT NOT NULL PRIMARY KEY, "accountId" TEXT NOT NULL, "refAPostId" TEXT, "refASnapshot" TEXT NOT NULL DEFAULT '{}', "refBPostId" TEXT, "refBSnapshot" TEXT NOT NULL DEFAULT '{}', "content" TEXT NOT NULL DEFAULT '', "generationMeta" TEXT NOT NULL DEFAULT '{}', "mediaUrls" TEXT NOT NULL DEFAULT '[]', "status" TEXT NOT NULL DEFAULT 'draft', "approvedById" TEXT, "scheduledAt" DATETIME, "publishedAt" DATETIME, "postUrl" TEXT NOT NULL DEFAULT '', "views" INTEGER NOT NULL DEFAULT 0, "likes" INTEGER NOT NULL DEFAULT 0, "replies" INTEGER NOT NULL DEFAULT 0, "reposts" INTEGER NOT NULL DEFAULT 0, "quotes" INTEGER NOT NULL DEFAULT 0, "metricsUpdatedAt" DATETIME, "insight" TEXT NOT NULL DEFAULT '', "ownerComment" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ThreadsPostDraft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ThreadsAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "ThreadsPostDraft_accountId_status_idx" ON "ThreadsPostDraft"("accountId", "status")`,
  `CREATE INDEX IF NOT EXISTS "ThreadsPostDraft_scheduledAt_idx" ON "ThreadsPostDraft"("scheduledAt")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsChatMessage" ("id" TEXT NOT NULL PRIMARY KEY, "draftId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "ThreadsChatMessage_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ThreadsPostDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "ThreadsChatMessage_draftId_idx" ON "ThreadsChatMessage"("draftId")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsMetricSnapshot" ("id" TEXT NOT NULL PRIMARY KEY, "draftId" TEXT NOT NULL, "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "views" INTEGER NOT NULL DEFAULT 0, "likes" INTEGER NOT NULL DEFAULT 0, "replies" INTEGER NOT NULL DEFAULT 0, "reposts" INTEGER NOT NULL DEFAULT 0, "quotes" INTEGER NOT NULL DEFAULT 0, CONSTRAINT "ThreadsMetricSnapshot_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ThreadsPostDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "ThreadsMetricSnapshot_draftId_idx" ON "ThreadsMetricSnapshot"("draftId")`,

  `CREATE TABLE IF NOT EXISTS "ThreadsToolSettings" ("id" TEXT NOT NULL PRIMARY KEY, "apifyToken" TEXT NOT NULL DEFAULT '', "apifyActorId" TEXT NOT NULL DEFAULT '', "openaiApiKey" TEXT NOT NULL DEFAULT '', "scraperEnabled" BOOLEAN NOT NULL DEFAULT false, "metricsTiming" TEXT NOT NULL DEFAULT '[1,24,72,168]', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,

  // ===== 顧客対応ツール（返信第二脳）=====
  `CREATE TABLE IF NOT EXISTS "ReplyPolicy" ("id" TEXT NOT NULL PRIMARY KEY, "category" TEXT NOT NULL DEFAULT 'general', "title" TEXT NOT NULL, "situation" TEXT NOT NULL DEFAULT '', "guideline" TEXT NOT NULL, "priority" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true, "source" TEXT NOT NULL DEFAULT 'manual', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "ReplyPolicy_category_idx" ON "ReplyPolicy"("category")`,
  `CREATE TABLE IF NOT EXISTS "ReplyExample" ("id" TEXT NOT NULL PRIMARY KEY, "category" TEXT NOT NULL DEFAULT 'general', "customerMessage" TEXT NOT NULL, "replyMessage" TEXT NOT NULL, "note" TEXT NOT NULL DEFAULT '', "source" TEXT NOT NULL DEFAULT 'manual', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "ReplyExample_category_idx" ON "ReplyExample"("category")`,
  `CREATE TABLE IF NOT EXISTS "ReplyDraft" ("id" TEXT NOT NULL PRIMARY KEY, "customerName" TEXT NOT NULL DEFAULT '', "customerMessage" TEXT NOT NULL, "context" TEXT NOT NULL DEFAULT '', "category" TEXT NOT NULL DEFAULT 'general', "isEscalation" BOOLEAN NOT NULL DEFAULT false, "escalationReason" TEXT NOT NULL DEFAULT '', "confidence" TEXT NOT NULL DEFAULT '', "reasoning" TEXT NOT NULL DEFAULT '', "usedPolicyIds" TEXT NOT NULL DEFAULT '[]', "usedExampleIds" TEXT NOT NULL DEFAULT '[]', "draft" TEXT NOT NULL DEFAULT '', "finalReply" TEXT NOT NULL DEFAULT '', "status" TEXT NOT NULL DEFAULT 'draft', "createdByName" TEXT NOT NULL DEFAULT '', "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "ReplyDraft_status_idx" ON "ReplyDraft"("status")`,
  `CREATE INDEX IF NOT EXISTS "ReplyDraft_customerName_idx" ON "ReplyDraft"("customerName")`,
  `CREATE TABLE IF NOT EXISTS "ReplyScenario" ("id" TEXT NOT NULL PRIMARY KEY, "stage" TEXT NOT NULL DEFAULT 'other', "category" TEXT NOT NULL DEFAULT 'general', "title" TEXT NOT NULL, "detail" TEXT NOT NULL DEFAULT '', "explanation" TEXT NOT NULL DEFAULT '', "exampleMessage" TEXT NOT NULL, "source" TEXT NOT NULL DEFAULT 'manual', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS "ReplyScenario_stage_idx" ON "ReplyScenario"("stage")`,
];

for (const sql of sqls) {
  await client.execute(sql);
  console.log("OK:", sql.substring(0, 60));
}

// 後付けの ALTER TABLE — 失敗しても継続（既に追加済みなら "duplicate column" エラーが出るので無視）
const alters = [
  `ALTER TABLE "XCompetitor" ADD COLUMN "isSelf" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "ThreadsToolSettings" ADD COLUMN "lastCollectAt" DATETIME`,
  `ALTER TABLE "ThreadsToolSettings" ADD COLUMN "lastMetricsAt" DATETIME`,
  `ALTER TABLE "ThreadsToolSettings" ADD COLUMN "collectLimit" INTEGER NOT NULL DEFAULT 25`,
  `ALTER TABLE "ThreadsToolSettings" ADD COLUMN "includeReplies" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "ThreadsCompetitor" ADD COLUMN "collectLimit" INTEGER`,
  `ALTER TABLE "ReplyPolicy" ADD COLUMN "stage" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "ReplyExample" ADD COLUMN "stage" TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE "ReplyDraft" ADD COLUMN "stage" TEXT NOT NULL DEFAULT ''`,
];
for (const sql of alters) {
  try {
    await client.execute(sql);
    console.log("ALTER OK:", sql.substring(0, 60));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate column|already exists/i.test(msg)) {
      console.log("ALTER skip (already applied):", sql.substring(0, 60));
    } else {
      throw e;
    }
  }
}

// ===== 教育ナレッジ（ファン化の型）のseed =====
// 全アカウント共通(accountId=null) / type="teaching" / isInjected=true で生成プロンプトに自動注入。
// 安定IDで INSERT OR IGNORE のため、再デプロイでも重複せず、UIでの編集も上書きしない。
const teachingSeeds = [
  {
    id: "threads-teach-01-problem",
    title: "①問題提起＋原因の提示",
    content: `【目的】今の問題点を自覚させ、今すぐ行動する必要性を刷り込む。こちらに都合の良い原因を提示し、解決策（商品）へ繋げやすくする。
【例】
・今、こんな悩みはありませんか？
・今お金が無い人、このまま放置するとヤバいです
・復縁がうまくいく人、一生ブロックされたままの人
・あなたが貧乏なのはあなたのせいではない。原因は豊かさの氣を受け取る器に邪気が入り込んでいるから
【効果】「これ自分のことかも」と自分事化／現状維持への危機感／過去の失敗に説明がつく納得感／続きを見る理由／後の解決策が必要になる
【ポイント】人は利益を得るより損失回避の欲求が遥かに強い（プロスペクト理論）。問題提起が無いと興味づけ自体が難しい。バズ投稿に埋め込むだけでなく単体ポストも重要。うまくいってる人との差分を意識させる訴求も有効。ただし本人を責めず、責任を仮想敵（国・時代・業界の常識等）になすりつけるとファン化に繋がる。緊急性＝「今動かないといけない理由」を必ず伝える。原因は「商品を買う理由・アカウントを追う理由」に繋がるものにする。
【参考ポスト】https://www.threads.com/@enbo_kien/post/DbftYEdEjcR`,
  },
  {
    id: "threads-teach-02-breakcommon",
    title: "②常識破壊と解決策",
    content: `【目的】基本は問題提起＋原因の後で提示。界隈や日本人一般の常識を破壊し、独自の解決策を示して唯一無二の教祖になる。
【例】
・あなたが好転しなかったのは過去世から付きまとう厄を祓えていなかったから。一般の占い師は表層しか見ないが、私は過去世まで遡って見る
・一般的な引き寄せはアファメーションで無理やり自分を変えるが逆効果。ありのままの姿こそ最も引き寄せが実現しやすい
【型（必ずここまで持っていく）】一般常識 → 「でも実は違う」 → なぜ違うのか → 新しい考え方 → その考え方で見ると現実がどう変わるか
（例：開運＝運が来るのを待つ → 違う → 運は自分で生み出すもの → だから“待つ開運”ではなく“創る開運”）
【効果】既存の価値観に疑問／「この人は他と違う」印象／過去の失敗が能力不足でなかったと再解釈／独自理論への興味／このアカウントを見る理由
【ポイント】常識を否定して終わらない。独自用語を作る（「器」「巡り」「結び」「創造開運」等、一言で世界観を表す言葉を何度も別角度から使い定着させる）。競合批判は「〇〇はダメ」ではなく「一般的な占いでは表層しか見ない」「世間ではこう言われている」など広い常識・方法論を仮想敵にする方が安全かつ強い。
【参考ポスト】https://www.threads.com/share/DNU9T3BJa/ , https://www.threads.com/share/K_lkVWDpq/`,
  },
  {
    id: "threads-teach-03-trust",
    title: "③興味づけ＋信頼獲得（口コミ）",
    content: `【目的】口コミを通して「この人は本物だ」「本当に変われるかも」という希望を抱かせる。
【例】
・鑑定後に突然〇〇万円の臨時収入が入った
・投稿を見て実践した方からこんな報告が届きました
・大きく現実が動いた人にはある共通点があります
・「今までは何をしても変わらなかったのに初めて感覚が変わりました」
【効果】社会的証明／読者の成功イメージが具体化／商品・鑑定への心理的抵抗が下がる／理論への信頼／「自分も次の成功者になれるかも」
【ポイント】口コミで自分の教育内容を証明する（教育→実例→「やっぱりこの考え方は正しい」の流れ）。「〇〇万円入りました！」だけでは弱い。どういう状態→何を知った/実践→何が変わった→どんな結果、まで見せる。購入者の口コミは「受ける前の悩み／なぜ申し込んだか／他との違い／直後の変化／その後／受けてなかったらどうなっていたか」から2〜4要素を混ぜる。口調・文章量・絵文字・改行を毎回変え「作られた口コミ感」を消す。
【参考ポスト】https://www.threads.com/share/DNM1IrjYA/`,
  },
  {
    id: "threads-teach-04-story",
    title: "④過去のストーリーと信念",
    content: `【目的】過去の経験を見せて信頼を得る。そこから生まれた信念を出して共感とファン化に繋げる。
【例】
・私も昔はお金のことで毎日不安でした
・私が占いを始めたきっかけ
・以前の私は人の幸せを素直に喜べませんでした
・何千人と見てきて今だからこそ伝えたいことがあります
【型】昔の自分 → 問題・失敗 → ある気づき → 考え方が変わる → 結果が変わる → だから今それを伝えている
（例：昔はお金を追いかけていた → 追うほど苦しくなった → 豊かさは巡らせるものと気づいた → だから今は“巡り”を大切にしている）
【効果】完璧な先生でなく「自分と同じ経験をした人」になる／説得力／価値観への共感／人物そのものにファンがつく／「この人から買いたい」
【ポイント】過去の体験が現在の教えの根拠になっていること。独自概念（例：「巡り」）自体にも説得力がつく。ストーリーの主役を自分だけにしない。最終的に「私もそうだった → だからあなたにもできる」と読者へ戻して終える。自慢話でなく読者に希望を渡す過去語りにする。
【参考ポスト】https://www.threads.com/share/GkxsSNs7S/`,
  },
  {
    id: "threads-teach-05-chosen",
    title: "⑤選ばれたあなただからこそできる",
    content: `【目的】読者のセルフイメージを書き換え「私は変われる側の人間だ」と思わせ、行動率・購入率を上げる。
【例】
・この投稿をここまで読んだあなたへ
・なぜかこの言葉が気になった人は今が転換期なのかもしれません
・普通なら流す投稿を、あなたはここまで読んでいる。それだけでも感覚が鋭い証拠です
・「何か変えたい」と思ってここに来た時点で、もう最初の一歩は始まっています
【型（読者自身の行動を根拠に特別扱い）】この投稿を読んだ → 普通なら流す → でもあなたは止まった → だから感覚が鋭い
【効果】「自分にも可能性がある」／アカウントとの関係に意味／次の行動を正当化しやすい／世界観への没入／所属意識
【ポイント】単なる「あなたは特別」より、行動を根拠にする方が強い。アイデンティティ形成でもある（「あなたは感謝できる人／行動できる人／受け取れる人」と繰り返すと読者がその人物像に合わせ行動し始める）。買ってと言う前に「私は行動する人間だ」という自己認識を育てる。ただし多用すると胡散臭くなる。節目・重要投稿・企画前などここぞで使う。
【参考ポスト】https://www.threads.com/share/DweRlhbMd/ , https://www.threads.com/share/GVAo21KB0/`,
  },
  {
    id: "threads-teach-06-authority",
    title: "⑥権威性とポジショニング",
    content: `【目的】「この人から学ぶ理由」を作り、価格でなく“誰から学ぶか”で選ばれる状態を作る。高単価商品を自然に受け入れてもらう土台。
【例】
・これまで5,000人以上を鑑定してきました
・富裕層や経営者からも相談を受けています
・10年以上この世界を見てきて気づいたことがあります
・相談者には必ず共通点があります
【効果】発信内容に説得力／価格より信頼で選ばれる／独自理論が受け入れられやすい／高単価の成約率が上がる
【ポイント】実績を並べるより「経験があるから見えていること」を伝える投稿が強い。「5,000人鑑定しました」でなく「5,000人見てきて分かったのは、お金が入る人は〇〇という共通点がある」と実績→気づきへ繋げ教育にもする。権威は「凄い人」になるためでなく「この人の話を聞く理由」を作るために使う。
【参考ポスト】https://www.threads.com/share/DcJ7TIwy4/`,
  },
  {
    id: "threads-teach-07-gratitude",
    title: "⑦感謝の教育",
    content: `【目的】商品購入時の顧客姿勢を教育しておき、既読スルーを防ぐ。
【例】
・感謝できる人ほど豊かさは巡る
・人の幸せを喜べる人に運は集まる
・今あるものを見る人ほど現実は変わる
・不足ではなく、今ある豊かさを見る
【型】感謝 → 器が大きい人 → 豊かな人 → 運が巡る人
【効果】ファンの質が上がる／成果報告が増える／コミュニティが荒れにくい／世界観への共感が深まる
【ポイント】感謝を教えているようで、実は人格を教育している。理想の人格を何度も見せることで読者が「そういう人になりたい」と思う。感謝そのものでなく“理想の人格を定義する”投稿。
【参考ポスト】https://www.threads.com/share/HoiPXQ3ob/`,
  },
  {
    id: "threads-teach-08-invest",
    title: "⑧投資・変化の教育",
    content: `【目的】「変わりたいなら行動や投資は当たり前」という価値観を作り、自己投資・商品購入への抵抗を下げる。
【例】
・一番危険なのは変わらないこと
・行動した人から人生は動き出す
・自己投資は未来への投資
・現状維持は一番楽。でも現状維持を選んできた結果が今。
【効果】購入への抵抗が減る／行動率が上がる／本気の読者が残る
【ポイント】「行動する人／しない人」の違いを何度も教育すると、読者は「私は行動する側でいたい」と思う。結果、購入が「売られた」でなく「自分で選んだ」感覚になる。口コミも商品PRでなく行動教育として使う（「動く人→変わる」「待つ人→変わらない」の因果を販売前に何度も見せてから募集を出すと、購入が“自分らしい選択”になる）。
【参考ポスト】https://www.threads.com/share/GggcMafdQ/`,
  },
  {
    id: "threads-teach-09-give",
    title: "⑨GIVE（循環）の教育",
    content: `【目的】「先に与える人ほど豊かになれる」という価値観を教育し、購入・自己投資・行動への抵抗を下げる。祝福のリプを増やしファンを強化。
【例】
・愛されたいなら先に愛を与えること
・お金が欲しいなら先に価値を与えること
・人の幸せを喜べる人ほど豊かさは巡る
・与える人ほど受け取れる器は大きくなる
【型】与える → 巡る → 受け取れる
【効果】自己投資への抵抗が下がる／「払う」でなく「循環させる」認識／購入後の行動量が増え成果・口コミが出やすい／「豊かな人＝与える人」のブランドが定着
【ポイント】「与える人だから結果が出る」という成功法則として教育する。自己投資や購入も「失う」でなく「未来への循環」として受け入れられる。
【参考ポスト】https://www.threads.com/share/FJ33RW-DA/ , https://www.threads.com/share/E0BmbXplv/ , https://www.threads.com/share/BlJUu6Fn_b/`,
  },
  {
    id: "threads-teach-10-enclose",
    title: "⑩囲い込みの教育",
    content: `【目的】「このコミュニティの一員になりたい」と思わせ帰属意識を生む。「外側」と「内側」を明確に区別し、愛着・ファン化・継続率・購入率を高める。
【例】
・この考え方が理解できる人だけ読んでください
・本気で人生を変えたい人だけついてきてください
・行動する人だけが、この世界を受け取れます
・私の発信は万人向けではありません
【効果】熱量の高いファンが増える／アンチや温度感の低い読者が離れる／一体感／「この人だから買う」／購入が「仲間になる」意味を持つ
【ポイント】内側に入れる人は生き、外側にいる人は死ぬ、くらいのイメージを作れると強い。内側にいる人はこういう人たちでこんな結果を得ている、これからも内側の人の幸せを叶えていく、という実績＋信念を出す。
【参考ポスト】https://www.threads.com/share/HO4TNwG6q/ , https://www.threads.com/share/H54Nectla/`,
  },
  {
    id: "threads-teach-11-timeline",
    title: "⑪タイムラインを遡る教育",
    content: `【目的】「この人の発信は過去から順番に読む価値がある」と認識させ、タイムライン全体を教材化。教育量を増やし世界観理解・ファン化・商品理解を一気に深める。
【例】
・初めての方は固定投稿から読んでください
・この話は昨日の投稿が前提です
・「器」については以前詳しく解説しています
・このシリーズは①から読むのがおすすめです
・過去投稿を読めば私の考え方はすべて繋がります
【効果】過去投稿の閲覧数が増える／教育スピードが上がる／世界観への没入／フォロー率・滞在時間の向上／販売までの教育を短期間で完了
【ポイント】主張に一貫性があること。遡ることで教育の全体像がインプットできる状態にしておく。
【参考ポスト】https://www.threads.com/share/HxHKt19Pa/`,
  },
];

for (const s of teachingSeeds) {
  try {
    await client.execute({
      sql: `INSERT OR IGNORE INTO "ThreadsKnowledge" ("id","accountId","type","title","content","tags","isInjected","createdAt","updatedAt") VALUES (?, NULL, 'teaching', ?, ?, '["教育","ファン化"]', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      args: [s.id, s.title, s.content],
    });
    console.log("SEED OK:", s.title);
  } catch (e) {
    console.log("SEED skip:", s.title, e instanceof Error ? e.message : String(e));
  }
}

console.log("Migration complete!");
