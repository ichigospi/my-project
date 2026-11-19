import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai-call";
import { splitParagraphs } from "@/lib/paragraph-edit";
import { addBanCandidates, loadBanCandidates } from "@/lib/custom-bans";
import { bankKey } from "@/lib/tarot-draw";
import { prisma } from "@/lib/prisma";
import type { DrawnTechnique } from "@/lib/project-store";

// 添削から学ぶ: 提出台本と添削後台本の差分を読み、
//  1) 書き直しの型（ルール候補）  2) 消された言い回し（禁止表現の候補）  3) 抽選した型が添削で残ったか（型の有効性）
// を取り出す。文体サンプルは合格台本そのものを生成時に使うので、ここでは扱わない
export const maxDuration = 180;

interface Learned {
  rewritePatterns: { category: string; title: string; content: string; reason: string }[];
  bannedPhrases: { phrase: string; reason: string }[];
  techniques: { index: number; verdict: "kept" | "removed" | "changed"; note: string }[];
}

const usageKey = (channelId: string) => `bank_usage_${(channelId || "default").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60)}`;

function parseLearned(raw: string): Learned | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Partial<Learned>;
    return {
      rewritePatterns: Array.isArray(o.rewritePatterns) ? o.rewritePatterns.filter((p) => p && p.title && p.content).map((p) => ({ category: String(p.category || "その他"), title: String(p.title).slice(0, 60), content: String(p.content).slice(0, 400), reason: String(p.reason || "").slice(0, 200) })) : [],
      bannedPhrases: Array.isArray(o.bannedPhrases) ? o.bannedPhrases.filter((b) => b && b.phrase).map((b) => ({ phrase: String(b.phrase).slice(0, 40), reason: String(b.reason || "").slice(0, 120) })) : [],
      techniques: Array.isArray(o.techniques) ? o.techniques.filter((t) => t && Number.isFinite(Number(t.index))).map((t) => ({ index: Number(t.index), verdict: t.verdict === "removed" ? "removed" : t.verdict === "changed" ? "changed" : "kept", note: String(t.note || "").slice(0, 120) })) : [],
    };
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aiApiKey = String(body.aiApiKey || "");
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    const submitted = String(body.submitted || "");
    const reviewed = String(body.reviewed || "");
    if (!submitted.trim() || !reviewed.trim()) return NextResponse.json({ error: "提出台本と添削後台本の両方が必要です" }, { status: 400 });
    const techniques = Array.isArray(body.techniques) ? (body.techniques as DrawnTechnique[]) : [];
    const channelId = String(body.channelId || "");
    const projectId = String(body.projectId || "");
    const comments = Array.isArray(body.comments) ? (body.comments as { original?: string; changed?: string; comment?: string }[]) : [];

    // 段落単位の差分（機械）: 消えた段落・足された段落。同じ段落は渡さない
    const before = splitParagraphs(submitted);
    const after = splitParagraphs(reviewed);
    const norm = (s: string) => s.replace(/\s+/g, "");
    const afterSet = new Set(after.map(norm));
    const beforeSet = new Set(before.map(norm));
    const removed = before.filter((p) => !afterSet.has(norm(p)));
    const added = after.filter((p) => !beforeSet.has(norm(p)));
    if (removed.length === 0 && added.length === 0) return NextResponse.json({ learned: { rewritePatterns: [], bannedPhrases: [], techniques: [] }, note: "差分がありません" });

    const techText = techniques.length ? techniques.map((tq, i) => `[${i}] ${tq.label}「${tq.short}」: ${(tq.intent || tq.item).replace(/\s+/g, " ").slice(0, 160)}`).join("\n") : "（型の記録なし）";
    const commentText = comments.filter((c) => c.comment).slice(0, 30).map((c) => `- 「${(c.original || "").slice(0, 60)}」→「${(c.changed || "").slice(0, 60)}」: ${c.comment}`).join("\n");

    const prompt = `あなたはプロのタロット占い師兼スピリチュアルマーケターで、台本添削の分析者です。
ライターが提出した台本をオーナーが添削しました。「消えた段落」と「足された段落」（＋オーナーのコメント）から、次の3つを取り出してください。

1. rewritePatterns（書き直しの型）: オーナーがどういう文をどう直したかを「狙い」として一般化したもの。今後の台本に使えるルール文にする。文面の丸写しではなく「◯◯は△△にする」の形。2〜6件。category は 全体構成／選民フック／導入の離脱防止／問題提起／悩みの深掘りと共感／仮想敵批判と常識破壊／解決策アドバイス／理想の未来／LINE登録CTA／チャンネル登録・高評価・コメント訴求／口コミ／その他 のどれか
2. bannedPhrases（消された言い回し）: オーナーが消した・言い換えた言い回しのうち、今後も使わない方がよい「短い定型句」（4〜20字）。固有名詞やテーマ語は含めない。0〜8件
3. techniques（型の有効性）: 下の【抽選した型】それぞれについて、添削後の台本に残っているか（kept）、消されたか（removed）、大きく書き換えられたか（changed）を判定。note は短く

【消えた段落（提出時にあって添削後に無い）】
${removed.map((p, i) => `(${i + 1}) ${p.slice(0, 600)}`).join("\n\n").slice(0, 9000) || "（なし）"}

【足された段落（添削後にだけある。書き直し後の文を含む）】
${added.map((p, i) => `(${i + 1}) ${p.slice(0, 600)}`).join("\n\n").slice(0, 9000) || "（なし）"}
${commentText ? `\n【オーナーのコメント】\n${commentText}\n` : ""}
【抽選した型】
${techText}

【添削後の台本（型の有無を確認するため）】
${reviewed.slice(0, 12000)}

必ずJSONのみで回答:
{ "rewritePatterns": [ { "category": "...", "title": "...", "content": "...", "reason": "..." } ],
  "bannedPhrases": [ { "phrase": "...", "reason": "..." } ],
  "techniques": [ { "index": 0, "verdict": "kept|removed|changed", "note": "..." } ] }`;

    const r = await callAi(aiApiKey, body.aiModel, prompt, { maxTokens: 6000 });
    if (r.error) return NextResponse.json({ error: r.error, ...(r.retryable ? { retryable: true } : {}) }, { status: r.status || 500 });
    const learned = parseLearned(r.text);
    if (!learned) return NextResponse.json({ error: "分析結果の解析に失敗しました" }, { status: 502 });

    // 禁止表現の候補を加算（2回以上で登録を提案）
    let candidates = await loadBanCandidates();
    if (learned.bannedPhrases.length && projectId) candidates = await addBanCandidates(learned.bannedPhrases, projectId);

    // 型の有効性をチャンネルの使用記録に加算（ローテーションの重みに使う）
    if (techniques.length && learned.techniques.length) {
      try {
        const key = usageKey(channelId);
        const row = await prisma.appSetting.findUnique({ where: { key } });
        const usage = (row?.value ? JSON.parse(row.value) : {}) as { banks?: Record<string, Record<string, number>>; patterns?: Record<string, number>; kept?: Record<string, Record<string, number>>; removed?: Record<string, Record<string, number>> };
        usage.kept = usage.kept || {}; usage.removed = usage.removed || {};
        for (const v of learned.techniques) {
          const tq = techniques[v.index]; if (!tq) continue;
          const bucket = v.verdict === "removed" ? usage.removed : usage.kept;
          const bank = bucket[tq.bankId] || (bucket[tq.bankId] = {});
          bank[bankKey(tq.item)] = (bank[bankKey(tq.item)] || 0) + 1;
        }
        const value = JSON.stringify(usage);
        await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
      } catch { /* 記録できなくても学習結果は返す */ }
    }

    return NextResponse.json({
      learned,
      candidates: candidates.filter((c) => learned.bannedPhrases.some((b) => b.phrase.replace(/\s+/g, "") === c.phrase) || c.count >= 2).slice(0, 30),
      diff: { removed: removed.length, added: added.length },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "添削の分析に失敗しました" }, { status: 500 });
  }
}
