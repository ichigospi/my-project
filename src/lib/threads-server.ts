// Threadsツールのサーバー側共通処理（APIルートから使う）
import { prisma } from "@/lib/prisma";
import {
  buildAccountKnowledgeContext,
  type RefPostInput,
} from "@/lib/threads-prompts";

// アカウント情報 + 注入対象ノウハウからナレッジコンテキストを構築
export async function loadAccountKnowledgeContext(accountId: string): Promise<string | null> {
  const account = await prisma.threadsAccount.findUnique({ where: { id: accountId } });
  if (!account) return null;
  const knowledge = await prisma.threadsKnowledge.findMany({
    where: { OR: [{ accountId }, { accountId: null }], isInjected: true },
    orderBy: { updatedAt: "desc" },
    select: { type: true, title: true, content: true },
  });
  return buildAccountKnowledgeContext(account, knowledge);
}

// 競合投稿 → 参考投稿スナップショット（draftに保存する形）
export interface RefSnapshot extends RefPostInput {
  postId: string;
  postUrl: string;
  postedAt: string | null;
  collectedAt: string;
}

export async function buildRefSnapshot(postId: string): Promise<RefSnapshot | null> {
  const post = await prisma.threadsCompetitorPost.findUnique({
    where: { id: postId },
    include: { competitor: { select: { handle: true } } },
  });
  if (!post) return null;
  return {
    postId: post.id,
    authorHandle: post.competitor.handle,
    content: post.content,
    likes: post.likes,
    replies: post.replies,
    reposts: post.reposts,
    views: post.views,
    planType: post.planType,
    hookType: post.hookType,
    structureJson: post.structureJson,
    postUrl: post.postUrl,
    postedAt: post.postedAt ? post.postedAt.toISOString() : null,
    collectedAt: post.collectedAt.toISOString(),
  };
}

export function parseRefSnapshot(json: string): RefSnapshot | null {
  try {
    const obj = JSON.parse(json || "{}") as RefSnapshot;
    return obj && obj.content ? obj : null;
  } catch {
    return null;
  }
}
