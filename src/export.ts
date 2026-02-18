import { writeFileSync, mkdirSync } from "fs";
import { dirname } from "path";
import type { Tweet } from "./types.js";

export function exportJson(tweets: Tweet[], path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(tweets, null, 2), "utf-8");
  console.log(`${tweets.length}件のポストを ${path} に保存しました（JSON）`);
}

export function exportCsv(tweets: Tweet[], path: string): void {
  mkdirSync(dirname(path), { recursive: true });

  const header = "id,created_at,text,retweets,replies,likes,quotes";
  const rows = tweets.map((t) => {
    const m = t.public_metrics;
    const text = `"${t.text.replace(/"/g, '""').replace(/\n/g, " ")}"`;
    return [
      t.id,
      t.created_at,
      text,
      m?.retweet_count ?? 0,
      m?.reply_count ?? 0,
      m?.like_count ?? 0,
      m?.quote_count ?? 0,
    ].join(",");
  });

  writeFileSync(path, [header, ...rows].join("\n"), "utf-8");
  console.log(`${tweets.length}件のポストを ${path} に保存しました（CSV）`);
}

export function printTweets(tweets: Tweet[]): void {
  if (tweets.length === 0) {
    console.log("ポストが見つかりませんでした。");
    return;
  }

  console.log(`\n--- ${tweets.length}件のポスト ---\n`);

  for (const t of tweets) {
    const m = t.public_metrics;
    const date = new Date(t.created_at).toLocaleString("ja-JP");
    const metrics = m
      ? `  RT:${m.retweet_count} いいね:${m.like_count} 返信:${m.reply_count} 引用:${m.quote_count}`
      : "";

    console.log(`[${date}] (${t.id})`);
    console.log(t.text);
    console.log(metrics);
    console.log("---");
  }
}
