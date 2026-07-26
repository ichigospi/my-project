-- CreateTable
CREATE TABLE "ReplyPolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL,
    "situation" TEXT NOT NULL DEFAULT '',
    "guideline" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReplyExample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL DEFAULT 'general',
    "customerMessage" TEXT NOT NULL,
    "replyMessage" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReplyDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerMessage" TEXT NOT NULL,
    "context" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "isEscalation" BOOLEAN NOT NULL DEFAULT false,
    "escalationReason" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT '',
    "reasoning" TEXT NOT NULL DEFAULT '',
    "usedPolicyIds" TEXT NOT NULL DEFAULT '[]',
    "usedExampleIds" TEXT NOT NULL DEFAULT '[]',
    "draft" TEXT NOT NULL DEFAULT '',
    "finalReply" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ReplyPolicy_category_idx" ON "ReplyPolicy"("category");

-- CreateIndex
CREATE INDEX "ReplyExample_category_idx" ON "ReplyExample"("category");

-- CreateIndex
CREATE INDEX "ReplyDraft_status_idx" ON "ReplyDraft"("status");

-- CreateIndex
CREATE INDEX "ReplyDraft_customerName_idx" ON "ReplyDraft"("customerName");
