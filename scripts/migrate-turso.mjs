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
];

for (const sql of sqls) {
  await client.execute(sql);
  console.log("OK:", sql.substring(0, 60));
}
console.log("Migration complete!");
