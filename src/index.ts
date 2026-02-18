import { Command } from "commander";
import { lookupUser, collectAllUserTweets, searchRecentTweets } from "./api.js";
import { exportJson, exportCsv, printTweets } from "./export.js";
import { resolve } from "path";

const program = new Command();

program
  .name("x-collector")
  .description("X (Twitter) ポスト収集ツール — X API v2 使用")
  .version("1.0.0");

// ユーザーのポストを取得
program
  .command("user <username>")
  .description("指定ユーザーのポストを取得")
  .option("-n, --max <number>", "取得件数", "20")
  .option("--since <id>", "指定ID以降のポストを取得")
  .option("--start <date>", "開始日時 (ISO 8601: 2026-01-01T00:00:00Z)")
  .option("--end <date>", "終了日時 (ISO 8601)")
  .option("-o, --output <path>", "出力ファイルパス (.json or .csv)")
  .action(async (username: string, opts) => {
    try {
      console.log(`@${username.replace(/^@/, "")} のポストを取得中...`);

      const user = await lookupUser(username);
      console.log(`ユーザー: ${user.name} (@${user.username})`);
      if (user.public_metrics) {
        console.log(
          `フォロワー: ${user.public_metrics.followers_count} / ツイート数: ${user.public_metrics.tweet_count}`
        );
      }

      const tweets = await collectAllUserTweets(user.id, {
        max: parseInt(opts.max, 10),
        sinceId: opts.since,
        startTime: opts.start,
        endTime: opts.end,
      });

      if (opts.output) {
        const outPath = resolve(opts.output);
        if (outPath.endsWith(".csv")) {
          exportCsv(tweets, outPath);
        } else {
          exportJson(tweets, outPath);
        }
      } else {
        printTweets(tweets);
      }
    } catch (err: any) {
      console.error(`エラー: ${err.message}`);
      process.exit(1);
    }
  });

// キーワード検索
program
  .command("search <query>")
  .description("キーワードでポストを検索（直近7日間）")
  .option("-n, --max <number>", "取得件数", "20")
  .option("--start <date>", "開始日時 (ISO 8601)")
  .option("--end <date>", "終了日時 (ISO 8601)")
  .option("--lang <lang>", "言語フィルタ (ja, en など)")
  .option("--no-retweets", "リツイートを除外")
  .option("--min-likes <number>", "最低いいね数")
  .option("--min-retweets <number>", "最低リツイート数")
  .option("-o, --output <path>", "出力ファイルパス (.json or .csv)")
  .action(async (query: string, opts) => {
    try {
      // クエリを組み立て
      let fullQuery = query;
      if (opts.lang) fullQuery += ` lang:${opts.lang}`;
      if (opts.retweets === false) fullQuery += " -is:retweet";
      if (opts.minLikes) fullQuery += ` min_faves:${opts.minLikes}`;
      if (opts.minRetweets) fullQuery += ` min_retweets:${opts.minRetweets}`;

      console.log(`検索クエリ: "${fullQuery}"`);
      console.log("検索中...");

      const { tweets, users } = await searchRecentTweets({
        query: fullQuery,
        max: parseInt(opts.max, 10),
        startTime: opts.start,
        endTime: opts.end,
      });

      // ユーザー名をツイートに付加して表示
      const userMap = new Map(users.map((u) => [u.id, u]));

      if (opts.output) {
        const outPath = resolve(opts.output);
        if (outPath.endsWith(".csv")) {
          exportCsv(tweets, outPath);
        } else {
          exportJson(tweets, outPath);
        }
      } else {
        if (tweets.length === 0) {
          console.log("ポストが見つかりませんでした。");
          return;
        }

        console.log(`\n--- ${tweets.length}件のポスト ---\n`);
        for (const t of tweets) {
          const author = userMap.get(t.author_id);
          const m = t.public_metrics;
          const date = new Date(t.created_at).toLocaleString("ja-JP");
          const metrics = m
            ? `  RT:${m.retweet_count} いいね:${m.like_count} 返信:${m.reply_count} 引用:${m.quote_count}`
            : "";

          const name = author ? `${author.name} (@${author.username})` : t.author_id;
          console.log(`[${date}] ${name}`);
          console.log(t.text);
          console.log(metrics);
          console.log("---");
        }
      }
    } catch (err: any) {
      console.error(`エラー: ${err.message}`);
      process.exit(1);
    }
  });

// ユーザー情報の確認
program
  .command("info <username>")
  .description("ユーザーのプロフィール情報を表示")
  .action(async (username: string) => {
    try {
      const user = await lookupUser(username);
      console.log(`\n名前: ${user.name}`);
      console.log(`ユーザー名: @${user.username}`);
      if (user.description) console.log(`プロフィール: ${user.description}`);
      if (user.public_metrics) {
        const m = user.public_metrics;
        console.log(`フォロワー: ${m.followers_count}`);
        console.log(`フォロー中: ${m.following_count}`);
        console.log(`ツイート数: ${m.tweet_count}`);
      }
    } catch (err: any) {
      console.error(`エラー: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
