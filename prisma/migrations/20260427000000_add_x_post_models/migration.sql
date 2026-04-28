-- CreateTable
CREATE TABLE "XAccountInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "accountName" TEXT NOT NULL DEFAULT '',
    "handle" TEXT NOT NULL DEFAULT '',
    "concept" TEXT NOT NULL DEFAULT '',
    "target" TEXT NOT NULL DEFAULT '',
    "followerImage" TEXT NOT NULL DEFAULT '',
    "usp" TEXT NOT NULL DEFAULT '',
    "character" TEXT NOT NULL DEFAULT '',
    "divinationStyle" TEXT NOT NULL DEFAULT '',
    "pronoun" TEXT NOT NULL DEFAULT '',
    "sentenceEnd" TEXT NOT NULL DEFAULT '',
    "temperature" TEXT NOT NULL DEFAULT '',
    "emojiUsage" TEXT NOT NULL DEFAULT '',
    "lineBreakRule" TEXT NOT NULL DEFAULT '',
    "mainKeywords" TEXT NOT NULL DEFAULT '[]',
    "subKeywords" TEXT NOT NULL DEFAULT '[]',
    "ngExpressions" TEXT NOT NULL DEFAULT '',
    "mainProduct" TEXT NOT NULL DEFAULT '',
    "lpUrl" TEXT NOT NULL DEFAULT '',
    "storyBeforeState" TEXT NOT NULL DEFAULT '{}',
    "storyTurningPoint" TEXT NOT NULL DEFAULT '{}',
    "storyEpisodes" TEXT NOT NULL DEFAULT '[]',
    "storyExtremeActs" TEXT NOT NULL DEFAULT '[]',
    "storyNgBehaviors" TEXT NOT NULL DEFAULT '[]',
    "storyAfterState" TEXT NOT NULL DEFAULT '{}',
    "storyCommonGround" TEXT NOT NULL DEFAULT '[]',
    "storyPhrases" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL DEFAULT '',
    "postUrl" TEXT NOT NULL DEFAULT '',
    "likes" INTEGER NOT NULL DEFAULT 0,
    "retweets" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "postedAt" DATETIME,
    "structureType" TEXT NOT NULL DEFAULT '',
    "hookAnalysis" TEXT NOT NULL DEFAULT '',
    "bodyAnalysis" TEXT NOT NULL DEFAULT '',
    "closingAnalysis" TEXT NOT NULL DEFAULT '',
    "usedWords" TEXT NOT NULL DEFAULT '[]',
    "applicationHint" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XCompetitor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitorId" TEXT NOT NULL,
    "postId" TEXT NOT NULL DEFAULT '',
    "postUrl" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "retweets" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "postedAt" DATETIME,
    "collectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isQuoteRt" BOOLEAN NOT NULL DEFAULT false,
    "quotedPostUrl" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "XPost_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "XCompetitor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XPostAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "postIds" TEXT NOT NULL DEFAULT '[]',
    "result" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "customInstruction" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XPostTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "structure" TEXT NOT NULL DEFAULT '{}',
    "skeleton" TEXT NOT NULL,
    "placeholders" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XSequencePattern" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL DEFAULT 'any',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "pattern" TEXT NOT NULL,
    "example" TEXT NOT NULL DEFAULT '',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XFolder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'blue',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XFolderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "folderId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "XFolder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "XGeneratedPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "instruction" TEXT NOT NULL DEFAULT '',
    "educationType" TEXT NOT NULL DEFAULT '',
    "logicType" TEXT NOT NULL DEFAULT '',
    "output" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "sourceTemplateId" TEXT,
    "sourceAnalysisId" TEXT,
    "sequencePatternId" TEXT,
    "dailyPlanId" TEXT,
    "slotIndex" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XDailyPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "slots" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "genre" TEXT NOT NULL,
    "postsPerDay" INTEGER NOT NULL DEFAULT 5,
    "educationConfig" TEXT NOT NULL DEFAULT '{}',
    "sequenceConfig" TEXT NOT NULL DEFAULT '{}',
    "spiceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "defaultModel" TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
    "xApiBearerToken" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "XAccountInfo_genre_key" ON "XAccountInfo"("genre");

-- CreateIndex
CREATE INDEX "XKnowledge_genre_idx" ON "XKnowledge"("genre");

-- CreateIndex
CREATE INDEX "XKnowledge_type_idx" ON "XKnowledge"("type");

-- CreateIndex
CREATE UNIQUE INDEX "XCompetitor_genre_handle_key" ON "XCompetitor"("genre", "handle");

-- CreateIndex
CREATE INDEX "XPost_competitorId_idx" ON "XPost"("competitorId");

-- CreateIndex
CREATE INDEX "XPostAnalysis_genre_idx" ON "XPostAnalysis"("genre");

-- CreateIndex
CREATE INDEX "XPostTemplate_genre_idx" ON "XPostTemplate"("genre");

-- CreateIndex
CREATE INDEX "XSequencePattern_genre_idx" ON "XSequencePattern"("genre");

-- CreateIndex
CREATE INDEX "XFolder_genre_idx" ON "XFolder"("genre");

-- CreateIndex
CREATE UNIQUE INDEX "XFolderItem_folderId_itemType_itemId_key" ON "XFolderItem"("folderId", "itemType", "itemId");

-- CreateIndex
CREATE INDEX "XGeneratedPost_genre_idx" ON "XGeneratedPost"("genre");

-- CreateIndex
CREATE INDEX "XGeneratedPost_createdAt_idx" ON "XGeneratedPost"("createdAt");

-- CreateIndex
CREATE INDEX "XDailyPlan_date_idx" ON "XDailyPlan"("date");

-- CreateIndex
CREATE UNIQUE INDEX "XDailyPlan_genre_date_key" ON "XDailyPlan"("genre", "date");

-- CreateIndex
CREATE UNIQUE INDEX "XSettings_genre_key" ON "XSettings"("genre");
