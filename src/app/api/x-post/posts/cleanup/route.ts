// 取得済みポストのクリーンアップ
// - 完全一致の重複（content が同じ）を統合（より情報量が多い方を残す）
// - インプレッションが0のポストを削除（オプション）
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface PostRow {
  id: string;
  postId: string;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  postedAt: Date | null;
}

// データの「充実度」スコア（高い方を残す）
function richness(p: PostRow): number {
  const hasImp = p.impressions > 0 ? 1_000_000 : 0;
  const hasDate = p.postedAt ? 100_000 : 0;
  const hasPostId = p.postId ? 10_000 : 0;
  return hasImp + hasDate + hasPostId + p.impressions + p.likes * 10 + p.retweets;
}

// POST /api/x-post/posts/cleanup
// Body: { competitorId, removeDuplicates?, removeZeroImpressions?, dryRun? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      competitorId,
      removeDuplicates = false,
      removeZeroImpressions = false,
      dryRun = false,
    } = body as {
      competitorId?: string;
      removeDuplicates?: boolean;
      removeZeroImpressions?: boolean;
      dryRun?: boolean;
    };

    if (!competitorId) {
      return NextResponse.json({ error: "competitorId は必須" }, { status: 400 });
    }
    if (!removeDuplicates && !removeZeroImpressions) {
      return NextResponse.json({ error: "クリーンアップ対象が指定されていません" }, { status: 400 });
    }

    const competitor = await prisma.xCompetitor.findUnique({ where: { id: competitorId } });
    if (!competitor) {
      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 404 });
    }

    const all = await prisma.xPost.findMany({
      where: { competitorId },
      select: {
        id: true,
        postId: true,
        content: true,
        likes: true,
        retweets: true,
        replies: true,
        impressions: true,
        postedAt: true,
      },
    });

    const toDelete = new Set<string>();

    // 1) 重複処理: 同じ content を持つ複数のポストから「最も充実したもの」だけ残す
    let duplicatesFound = 0;
    if (removeDuplicates) {
      const byContent = new Map<string, PostRow[]>();
      for (const p of all) {
        const key = p.content.trim();
        if (!key) continue;
        const arr = byContent.get(key) ?? [];
        arr.push(p);
        byContent.set(key, arr);
      }
      for (const arr of byContent.values()) {
        if (arr.length < 2) continue;
        // 残すのは richness が最大のもの。同点なら先頭。
        let bestIdx = 0;
        let bestScore = richness(arr[0]);
        for (let i = 1; i < arr.length; i++) {
          const s = richness(arr[i]);
          if (s > bestScore) {
            bestIdx = i;
            bestScore = s;
          }
        }
        for (let i = 0; i < arr.length; i++) {
          if (i !== bestIdx) {
            toDelete.add(arr[i].id);
            duplicatesFound++;
          }
        }
      }
    }

    // 2) インプ0削除（重複処理で残ったもののうち）
    let zeroImpFound = 0;
    if (removeZeroImpressions) {
      for (const p of all) {
        if (toDelete.has(p.id)) continue;
        if (p.impressions === 0) {
          toDelete.add(p.id);
          zeroImpFound++;
        }
      }
    }

    const ids = Array.from(toDelete);
    let deleted = 0;
    if (!dryRun && ids.length > 0) {
      const result = await prisma.xPost.deleteMany({ where: { id: { in: ids } } });
      deleted = result.count;
    }

    return NextResponse.json({
      total: all.length,
      duplicatesFound,
      zeroImpFound,
      totalToDelete: ids.length,
      deleted,
      remaining: all.length - (dryRun ? 0 : deleted),
      dryRun,
    });
  } catch (e) {
    console.error("POST /api/x-post/posts/cleanup", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
