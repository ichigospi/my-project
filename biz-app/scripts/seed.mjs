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

const DAYS = 120;
const SWITCH_DAY = 60; // 鑑定文をv1→v2に切り替えた日（変更前後比較のサンプル用）

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

// ===== テンプレ（鑑定文 v1/v2 + リピーター定期 v1） =====
const templates = [];
for (const a of accounts) {
  const readingTplId = nextId("tpl");
  const readingV1 = nextId("ver");
  const readingV2 = nextId("ver");
  const repeatTplId = nextId("tpl");
  const repeatV1 = nextId("ver");

  await db.execute({
    sql: "INSERT INTO Template (id, accountId, type, name, archived, createdAt) VALUES (?, ?, 'reading', ?, 0, datetime('now', ?))",
    args: [readingTplId, a.id, `${a.name}基本鑑定文`, `-${DAYS} days`],
  });
  await db.execute({
    sql: `INSERT INTO TemplateVersion (id, templateId, label, content, abGroup, activeFrom, activeTo, createdAt)
          VALUES (?, ?, 'v1', ?, NULL, datetime('now', ?), datetime('now', ?), datetime('now', ?))`,
    args: [
      readingV1,
      readingTplId,
      `【${a.name}鑑定文 v1】\nこの度は無料鑑定にお申し込みいただきありがとうございます。\nあなたの${a.name === "恋愛" ? "恋愛運" : "金運"}を拝見しました…（サンプル本文）`,
      `-${DAYS} days`,
      `-${SWITCH_DAY} days`,
      `-${DAYS} days`,
    ],
  });
  await db.execute({
    sql: `INSERT INTO TemplateVersion (id, templateId, label, content, abGroup, activeFrom, activeTo, createdAt)
          VALUES (?, ?, 'v2', ?, NULL, datetime('now', ?), NULL, datetime('now', ?))`,
    args: [
      readingV2,
      readingTplId,
      `【${a.name}鑑定文 v2】\n〇〇さま、お待たせいたしました。\nあなただけの${a.name === "恋愛" ? "ご縁の流れ" : "豊かさの流れ"}を深く読み解きました…（サンプル本文・アップセル導線を強化した版）`,
      `-${SWITCH_DAY} days`,
      `-${SWITCH_DAY} days`,
    ],
  });

  await db.execute({
    sql: "INSERT INTO Template (id, accountId, type, name, archived, createdAt) VALUES (?, ?, 'repeat', ?, 0, datetime('now', ?))",
    args: [repeatTplId, a.id, `${a.name}リピーター月初配信`, `-${DAYS} days`],
  });
  await db.execute({
    sql: `INSERT INTO TemplateVersion (id, templateId, label, content, abGroup, activeFrom, activeTo, createdAt)
          VALUES (?, ?, 'v1', ?, NULL, datetime('now', ?), NULL, datetime('now', ?))`,
    args: [
      repeatV1,
      repeatTplId,
      `【月初のご挨拶】\n今月の${a.name === "恋愛" ? "恋愛運勢" : "金運の流れ"}をお届けします…（サンプル本文）`,
      `-${DAYS} days`,
      `-${DAYS} days`,
    ],
  });

  templates.push({ accountId: a.id, readingV1, readingV2, repeatV1 });
}

// ===== 日次実績 + 売上 =====
const SOURCES = ["threads", "insta", "x", "youtube"];
const today = new Date();

const eventRows = []; // [id, accountId, stage, source, count, occurredOn, templateVersionId]
const saleRows = []; // [id, accountId, category, productName, amount, quantity, occurredOn, templateVersionId]

for (const account of accounts) {
  const tpl = templates.find((t) => t.accountId === account.id);
  // 恋愛の方がリスト規模が大きめ、金運は単価が高め
  const scale = account.name === "恋愛" ? 1.0 : 0.6;
  const priceScale = account.name === "恋愛" ? 1.0 : 1.4;

  for (let i = DAYS; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const date = fmt(d);
    const isV2 = i < SWITCH_DAY;
    const readingVersion = isV2 ? tpl.readingV2 : tpl.readingV1;

    let listIn = 0;
    for (const source of SOURCES) {
      const base = { threads: 2, insta: 5, x: 6, youtube: 3 }[source];
      const n = Math.max(0, Math.round(base * scale + randInt(-2, 3)));
      if (n > 0) {
        listIn += n;
        eventRows.push([nextId("ev"), account.id, "list_in", source, n, date, null]);
      }
    }

    const freeApply = Math.round(listIn * (0.82 + rand() * 0.12));
    if (freeApply > 0) eventRows.push([nextId("ev"), account.id, "free_apply", null, freeApply, date, null]);
    const freeSent = Math.max(0, freeApply - randInt(0, 2));
    if (freeSent > 0) eventRows.push([nextId("ev"), account.id, "free_sent", null, freeSent, date, readingVersion]);

    // 有料鑑定: 無料鑑定の約10%
    const paidCount = Math.round(freeApply * (0.07 + rand() * 0.06));
    if (paidCount > 0) {
      const unit = Math.round((45000 + randInt(-8, 15) * 1000) * priceScale);
      saleRows.push([nextId("sl"), account.id, "paid_reading", "個別鑑定", unit * paidCount, paidCount, date, readingVersion]);

      // アップセル: v2の鑑定文の方が成約しやすい（変更前後比較のサンプル）
      const upsellRate = isV2 ? 0.35 + rand() * 0.15 : 0.18 + rand() * 0.12;
      const upsellCount = Math.round(paidCount * upsellRate);
      if (upsellCount > 0) {
        const upUnit = Math.round((14000 + randInt(-3, 5) * 500) * priceScale);
        saleRows.push([nextId("sl"), account.id, "upsell", "継続サポート", upUnit * upsellCount, upsellCount, date, readingVersion]);
      }
    }

    // 講座: たまに売れる
    if (rand() < 0.05 * scale) {
      saleRows.push([nextId("sl"), account.id, "course", "オンライン講座", Math.round(198000 * priceScale), 1, date, null]);
    }
    // リピート: 定期メッセージからの売上（テンプレに紐付け）
    if (rand() < 0.12 * scale) {
      saleRows.push([nextId("sl"), account.id, "repeat", "リピート鑑定", Math.round(20000 * priceScale), 1, date, tpl.repeatV1]);
    }
    // 月初はリピーター定期配信を記録
    if (d.getDate() === 1) {
      eventRows.push([nextId("ev"), account.id, "template_sent", null, 1, date, tpl.repeatV1]);
    }
  }
}

// ===== ローンチ（振り返りサンプル: 45〜31日前に開催、講座売上を紐付け）=====
for (const account of accounts) {
  const scale = account.name === "恋愛" ? 1.0 : 0.6;
  const priceScale = account.name === "恋愛" ? 1.0 : 1.4;
  const launchId = nextId("ln");
  const start = new Date(today);
  start.setDate(start.getDate() - 45);
  const end = new Date(today);
  end.setDate(end.getDate() - 31);

  await db.execute({
    sql: `INSERT INTO Launch (id, accountId, name, productName, startOn, endOn, goalAmount, memo, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      launchId,
      account.id,
      `${account.name}講座ローンチ`,
      `${account.name}実践講座`,
      fmt(start),
      fmt(end),
      Math.round(800000 * scale),
      "サンプルローンチ（シード投入）",
    ],
  });

  const launchSalesCount = Math.round(6 * scale) + 2;
  for (let i = 0; i < launchSalesCount; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + randInt(7, 13));
    saleRows.push([nextId("sl"), account.id, "launch", `${account.name}実践講座`, Math.round(98000 * priceScale), 1, fmt(d), null, launchId]);
  }
}

for (const [id, accountId, stage, source, count, date, templateVersionId] of eventRows) {
  await db.execute({
    sql: `INSERT INTO FunnelEvent (id, accountId, stage, source, count, occurredOn, templateVersionId, note, ingestedVia, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, '', 'csv', datetime('now'))`,
    args: [id, accountId, stage, source, count, date, templateVersionId],
  });
}

for (const [id, accountId, category, productName, amount, quantity, date, templateVersionId, launchId] of saleRows) {
  await db.execute({
    sql: `INSERT INTO Sale (id, accountId, category, productName, amount, quantity, occurredOn, templateVersionId, launchId, note, ingestedVia, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'csv', datetime('now'))`,
    args: [id, accountId, category, productName, amount, quantity, date, templateVersionId, launchId ?? null],
  });
}

console.log(
  `シード完了: アカウント${accounts.length}件 / テンプレ${templates.length * 2}件 / イベント${eventRows.length}件 / 売上${saleRows.length}件`
);
