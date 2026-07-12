// サンプルデータ投入スクリプト（開発用）
// 使い方: npm run db:seed  ※ prisma/dev.db に直接INSERTする
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.TURSO_DATABASE_URL || "file:prisma/dev.db" });

// 再現可能な乱数（毎回同じサンプルデータになる）
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

let idCounter = 0;
const nextId = (prefix) => `seed_${prefix}_${++idCounter}`;

const existing = await db.execute("SELECT COUNT(*) as c FROM Account");
if (Number(existing.rows[0].c) > 0) {
  console.log("既にデータがあるためシードをスキップしました");
  process.exit(0);
}

const accounts = [
  { id: nextId("acc"), name: "恋愛", color: "#ec4899", sortOrder: 1 },
  { id: nextId("acc"), name: "金運", color: "#f59e0b", sortOrder: 2 },
];

for (const a of accounts) {
  await db.execute({
    sql: "INSERT INTO Account (id, name, color, sortOrder, archived, createdAt) VALUES (?, ?, ?, ?, 0, datetime('now'))",
    args: [a.id, a.name, a.color, a.sortOrder],
  });
}

const SOURCES = ["threads", "insta", "x", "youtube"];
const DAYS = 120;
const today = new Date();

const eventRows = [];
const saleRows = [];

for (const account of accounts) {
  // 恋愛の方がリスト規模が大きめ、金運は単価が高め
  const scale = account.name === "恋愛" ? 1.0 : 0.6;
  const priceScale = account.name === "恋愛" ? 1.0 : 1.4;

  for (let i = DAYS; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = fmt(d);

    let listIn = 0;
    for (const source of SOURCES) {
      const base = { threads: 2, insta: 5, x: 6, youtube: 3 }[source];
      const n = Math.max(0, Math.round(base * scale + randInt(-2, 3)));
      if (n > 0) {
        listIn += n;
        eventRows.push([nextId("ev"), account.id, "list_in", source, n, date]);
      }
    }

    const freeApply = Math.round(listIn * (0.82 + rand() * 0.12));
    if (freeApply > 0) eventRows.push([nextId("ev"), account.id, "free_apply", null, freeApply, date]);
    const freeSent = Math.max(0, freeApply - randInt(0, 2));
    if (freeSent > 0) eventRows.push([nextId("ev"), account.id, "free_sent", null, freeSent, date]);

    // 有料鑑定: 無料鑑定の約10%
    const paidCount = Math.round(freeApply * (0.07 + rand() * 0.06));
    if (paidCount > 0) {
      const unit = Math.round((45000 + randInt(-8, 15) * 1000) * priceScale);
      saleRows.push([nextId("sl"), account.id, "paid_reading", "個別鑑定", unit * paidCount, paidCount, date]);

      // アップセル: 有料鑑定の約35%
      const upsellCount = Math.round(paidCount * (0.25 + rand() * 0.2));
      if (upsellCount > 0) {
        const upUnit = Math.round((14000 + randInt(-3, 5) * 500) * priceScale);
        saleRows.push([nextId("sl"), account.id, "upsell", "継続サポート", upUnit * upsellCount, upsellCount, date]);
      }
    }

    // 講座: たまに売れる
    if (rand() < 0.05 * scale) {
      saleRows.push([nextId("sl"), account.id, "course", "オンライン講座", Math.round(198000 * priceScale), 1, date]);
    }
    // リピート: 定期メッセージからの売上
    if (rand() < 0.12 * scale) {
      saleRows.push([nextId("sl"), account.id, "repeat", "リピート鑑定", Math.round(20000 * priceScale), 1, date]);
    }
  }
}

for (const [id, accountId, stage, source, count, date] of eventRows) {
  await db.execute({
    sql: `INSERT INTO FunnelEvent (id, accountId, stage, source, count, occurredOn, note, ingestedVia, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, '', 'csv', datetime('now'))`,
    args: [id, accountId, stage, source, count, date],
  });
}

for (const [id, accountId, category, productName, amount, quantity, date] of saleRows) {
  await db.execute({
    sql: `INSERT INTO Sale (id, accountId, category, productName, amount, quantity, occurredOn, note, ingestedVia, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, '', 'csv', datetime('now'))`,
    args: [id, accountId, category, productName, amount, quantity, date],
  });
}

console.log(`シード完了: アカウント${accounts.length}件 / イベント${eventRows.length}件 / 売上${saleRows.length}件`);
