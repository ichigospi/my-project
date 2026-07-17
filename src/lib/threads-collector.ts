// スクレイパーによる収集・計測の中核ロジック（手動実行APIとスケジューラの両方から使う）
import { prisma } from "@/lib/prisma";
import { callThreadsAI, extractJson } from "@/lib/threads-ai";
import { CLASSIFY_SYSTEM, buildClassifyInstruction, type ClassifyResult } from "@/lib/threads-prompts";
import {
  extractPostCode,
  runThreadsScrapeWithFallback,
  type NormalizedScrapedPost,
} from "@/lib/threads-scraper";

export interface CollectSummary {
  handles: number;
  itemsReturned: number;
  created: number;
  classified: number;
  errors: string[];
  log?: string[]; // スクレイパーの試行ログ（デバッグ用）
}

export interface MetricsSummary {
  handles: number;
  itemsReturned: number;
  updated: number;
  errors: string[];
}

async function getScraperSettings() {
  const s = await prisma.threadsToolSettings.findFirst();
  if (!s?.apifyToken) return null;
  return s;
}

// 動いたActorを設定に保存（次回からフォールバック探索をスキップ）
async function rememberWorkingActor(settingsId: string, currentActorId: string, actorUsed: string | null) {
  if (actorUsed && actorUsed !== currentActorId) {
    await prisma.threadsToolSettings.update({ where: { id: settingsId }, data: { apifyActorId: actorUsed } });
  }
}

// ===== 競合の自動収集 =====

// accountId指定でそのアカウントの全競合、competitorId指定で1競合だけ収集
export async function collectCompetitorPosts(opts?: { accountId?: string; competitorId?: string }): Promise<CollectSummary> {
  const summary: CollectSummary = { handles: 0, itemsReturned: 0, created: 0, classified: 0, errors: [] };
  const settings = await getScraperSettings();
  if (!settings) {
    summary.errors.push("Apifyトークンが未登録です（設定画面で登録してください）");
    return summary;
  }

  const where = opts?.competitorId
    ? { id: opts.competitorId }
    : opts?.accountId
      ? { accountId: opts.accountId }
      : { account: { isActive: true } };
  const competitors = await prisma.threadsCompetitor.findMany({
    where,
    include: { posts: { select: { postUrl: true, content: true, likes: true } } },
  });
  if (competitors.length === 0) {
    summary.errors.push("対象の競合が見つかりません");
    return summary;
  }

  // ハンドル重複を除いて一括収集
  const handleMap = new Map<string, typeof competitors>();
  for (const c of competitors) {
    const list = handleMap.get(c.handle) ?? [];
    list.push(c);
    handleMap.set(c.handle, list);
  }
  const handles = Array.from(handleMap.keys());
  summary.handles = handles.length;

  // 収集件数: 競合ごとの設定があればその最大値、なければ全体設定を使う
  // （スクレイパーは全ハンドル共通の件数指定のため、対象競合の最大値を採用）
  const perCompetitorLimits = competitors.map((c) => c.collectLimit).filter((n): n is number => typeof n === "number");
  const effectiveLimit = perCompetitorLimits.length > 0 ? Math.max(...perCompetitorLimits, settings.collectLimit) : settings.collectLimit;

  const run = await runThreadsScrapeWithFallback(
    settings.apifyToken,
    settings.apifyActorId || null,
    handles,
    effectiveLimit,
    settings.includeReplies,
  );
  summary.log = run.log;
  if (run.error) {
    summary.errors.push(run.error);
    return summary;
  }
  await rememberWorkingActor(settings.id, settings.apifyActorId, run.actorUsed);
  const items = run.items;
  summary.itemsReturned = items.length;

  // ハンドルごとに振り分け → 重複排除して登録
  const createdPosts: { id: string; content: string; competitorId: string }[] = [];
  for (const item of items) {
    const targets = item.authorHandle ? handleMap.get(item.authorHandle) : undefined;
    if (!targets) continue; // どの競合の投稿か特定できないものはスキップ
    for (const competitor of targets) {
      const dup = competitor.posts.some((p) => {
        if (item.postUrl && p.postUrl) {
          const a = extractPostCode(item.postUrl);
          const b = extractPostCode(p.postUrl);
          if (a && b) return a === b;
        }
        return p.content.slice(0, 60) === item.content.slice(0, 60);
      });
      if (dup) continue;
      const post = await prisma.threadsCompetitorPost.create({
        data: {
          competitorId: competitor.id,
          postUrl: item.postUrl,
          content: item.content,
          likes: item.likes,
          replies: item.replies,
          reposts: item.reposts,
          quotes: item.quotes,
          views: item.views,
          postedAt: item.postedAt,
          source: "scraper",
        },
      });
      createdPosts.push({ id: post.id, content: post.content, competitorId: competitor.id });
      summary.created++;
    }
  }

  // 伸び判定（競合ごとに中央値の2倍・最低50いいね）
  const touchedCompetitorIds = Array.from(new Set(createdPosts.map((p) => p.competitorId)));
  for (const competitorId of touchedCompetitorIds) {
    const likesList = (
      await prisma.threadsCompetitorPost.findMany({ where: { competitorId }, select: { likes: true } })
    )
      .map((p) => p.likes)
      .sort((a, b) => a - b);
    const median = likesList.length > 0 ? likesList[Math.floor(likesList.length / 2)] : 0;
    const threshold = Math.max(50, median * 2);
    await prisma.threadsCompetitorPost.updateMany({
      where: { competitorId, isHot: false, likes: { gte: threshold } },
      data: { isHot: true },
    });
  }

  // 新規投稿の自動分類（サーバーのAnthropicキーがある場合のみ、20件ずつ）
  const anthropicKey = process.env.ANTHROPIC_API_KEY || "";
  if (anthropicKey && createdPosts.length > 0) {
    for (let i = 0; i < createdPosts.length; i += 20) {
      const batch = createdPosts.slice(i, i + 20);
      try {
        const res = await callThreadsAI(anthropicKey, {
          systemPrompt: CLASSIFY_SYSTEM,
          userInstruction: buildClassifyInstruction(batch),
          maxTokens: 8192,
        });
        const results = extractJson<ClassifyResult[]>(res.text);
        if (!results) continue;
        for (const r of results) {
          const target = batch[r.index];
          if (!target) continue;
          await prisma.threadsCompetitorPost.update({
            where: { id: target.id },
            data: {
              planType: r.planType ?? "",
              hookType: r.hookType ?? "",
              structureJson: JSON.stringify({ ...r.structure, whyItWorks: r.whyItWorks }),
            },
          });
          summary.classified++;
        }
      } catch (e) {
        summary.errors.push(`分類エラー: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return summary;
}

// ===== 自投稿の自動計測 =====

// 計測が必要なdraftか（publishedAt + 計測タイミングのいずれかを跨いでいるか）
function needsMetricsUpdate(publishedAt: Date, metricsUpdatedAt: Date | null, timingsHours: number[], now: Date): boolean {
  for (const t of timingsHours) {
    const checkpoint = new Date(publishedAt.getTime() + t * 3600 * 1000);
    if (checkpoint <= now && (!metricsUpdatedAt || metricsUpdatedAt < checkpoint)) return true;
  }
  return false;
}

export async function collectOwnMetrics(): Promise<MetricsSummary> {
  const summary: MetricsSummary = { handles: 0, itemsReturned: 0, updated: 0, errors: [] };
  const settings = await getScraperSettings();
  if (!settings) {
    summary.errors.push("Apifyトークンが未登録です");
    return summary;
  }
  let timings: number[] = [1, 24, 72, 168];
  try {
    const parsed = JSON.parse(settings.metricsTiming) as number[];
    if (Array.isArray(parsed) && parsed.length > 0) timings = parsed;
  } catch {
    // 既定を使用
  }

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
  const drafts = await prisma.threadsPostDraft.findMany({
    where: {
      status: "published",
      postUrl: { not: "" },
      publishedAt: { gte: since },
      account: { isActive: true },
    },
    select: {
      id: true,
      postUrl: true,
      publishedAt: true,
      metricsUpdatedAt: true,
      views: true,
      likes: true,
      replies: true,
      reposts: true,
      quotes: true,
      account: { select: { handle: true } },
    },
  });
  const targets = drafts.filter(
    (d) => d.publishedAt && needsMetricsUpdate(d.publishedAt, d.metricsUpdatedAt, timings, now),
  );
  if (targets.length === 0) return summary;

  // 対象draftのアカウントハンドルをまとめてスクレイプ
  const handles = Array.from(new Set(targets.map((d) => d.account.handle)));
  summary.handles = handles.length;
  const run = await runThreadsScrapeWithFallback(settings.apifyToken, settings.apifyActorId || null, handles, 50);
  if (run.error) {
    summary.errors.push(run.error);
    return summary;
  }
  await rememberWorkingActor(settings.id, settings.apifyActorId, run.actorUsed);
  const items = run.items;
  summary.itemsReturned = items.length;

  // 投稿コードで突合
  const byCode = new Map<string, NormalizedScrapedPost>();
  for (const item of items) {
    const code = item.postUrl ? extractPostCode(item.postUrl) : null;
    if (code) byCode.set(code, item);
  }
  for (const draft of targets) {
    const code = extractPostCode(draft.postUrl);
    const item = code ? byCode.get(code) : undefined;
    if (!item) continue;
    // viewsは公開値でないため触らない（手動入力を維持）
    await prisma.threadsPostDraft.update({
      where: { id: draft.id },
      data: {
        likes: item.likes,
        replies: item.replies,
        reposts: item.reposts,
        quotes: item.quotes,
        metricsUpdatedAt: now,
      },
    });
    await prisma.threadsMetricSnapshot.create({
      data: {
        draftId: draft.id,
        views: draft.views,
        likes: item.likes,
        replies: item.replies,
        reposts: item.reposts,
        quotes: item.quotes,
      },
    });
    summary.updated++;
  }
  return summary;
}
