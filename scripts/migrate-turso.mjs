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

console.log("Migration complete!");
