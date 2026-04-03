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
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Invite_token_key" ON "Invite"("token")`,
];

for (const sql of sqls) {
  await client.execute(sql);
  console.log("OK:", sql.substring(0, 60));
}
console.log("Migration complete!");
