-- AlterTable
ALTER TABLE "ReplyPolicy" ADD COLUMN "stage" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ReplyExample" ADD COLUMN "stage" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "ReplyDraft" ADD COLUMN "stage" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "ReplyScenario" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stage" TEXT NOT NULL DEFAULT 'other',
    "category" TEXT NOT NULL DEFAULT 'general',
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "explanation" TEXT NOT NULL DEFAULT '',
    "exampleMessage" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ReplyScenario_stage_idx" ON "ReplyScenario"("stage");
