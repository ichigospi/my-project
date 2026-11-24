import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai-call";
import { parseAiSpec, geminiPreamble } from "@/lib/ai-model";
import { paraDiff, diffStats } from "@/lib/para-diff";

// 修正ポイント: 提出原文と完成台本の段落差分を読ませ、「どこを・何から何に・なぜ直したか」と「次回の改善ポイント」を短くまとめる。
// 学習（review-learn）はルール候補の抽出が目的。こちらはライターが読んで次回に活かすための要約が目的
export const maxDuration = 180;

interface Summary {
  changes: { where: string; before: string; after: string; point: string }[];
  nextTime: string[];
  overall: string;
}

function parseSummary(raw: string): Summary | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Partial<Summary>;
    const str = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
    return {
      changes: Array.isArray(o.changes) ? o.changes.filter((c) => c && (c.after || c.before)).slice(0, 20).map((c) => ({ where: str(c.where, 30), before: str(c.before, 120), after: str(c.after, 120), point: str(c.point, 120) })) : [],
      nextTime: Array.isArray(o.nextTime) ? o.nextTime.map((s) => str(s, 120)).filter(Boolean).slice(0, 8) : [],
      overall: str(o.overall, 120),
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
    if (!submitted.trim() || !reviewed.trim()) return NextResponse.json({ error: "提出原文と完成台本の両方が必要です" }, { status: 400 });
    const comments = Array.isArray(body.comments) ? (body.comments as { original?: string; changed?: string; comment?: string }[]) : [];

    const rows = paraDiff(submitted, reviewed);
    const stats = diffStats(rows);
    if (stats.changed + stats.removed + stats.added === 0) {
      return NextResponse.json({ summary: { changes: [], nextTime: [], overall: "提出原文と完成台本に差分はありません" } as Summary });
    }
    // 変わった段落だけを、前後の位置が分かる形で渡す（全文は渡さない）
    let idx = 0;
    const diffText = rows.map((r) => {
      idx++;
      if (r.kind === "same") return null;
      if (r.kind === "changed") return `【${idx}: 書き換え】\n（前）${r.left}\n（後）${r.right}`;
      if (r.kind === "removed") return `【${idx}: 削除】\n（前）${r.left}`;
      return `【${idx}: 追加】\n（後）${r.right}`;
    }).filter(Boolean).join("\n\n").slice(0, 24000);
    const commentText = comments.filter((c) => c.comment).slice(0, 30).map((c) => `- 「${(c.original || "").slice(0, 60)}」→「${(c.changed || "").slice(0, 60)}」: ${c.comment}`).join("\n");

    const aiModel = typeof body.aiModel === "string" ? body.aiModel : undefined;
    const provider = parseAiSpec(aiModel).provider;
    const prompt = `${provider === "gemini" ? geminiPreamble("edit") + "\n\n" : ""}あなたはプロのタロット占い師兼スピリチュアルマーケターで、YouTube台本の添削者です。
ライターが提出した台本（前）を、オーナーが添削して完成台本（後）にしました。下はその差分（変わった段落だけ。段落番号は台本内の位置。全${rows.length}段落中、書き換え${stats.changed}・削除${stats.removed}・追加${stats.added}）です。
ライターが「どこを・なぜ直されたか」を一目で理解し、次の台本で同じ指摘を受けないための要約を作ってください。

【書き方】
- changes: 直した箇所を意味のまとまりでグループ化して最大12件。同じ理由の修正は1件にまとめる（例: 語尾の堅さを全体で砕けた話し言葉に）
  - where: 台本の位置（例: 冒頭／1枚目／3枚目の絵柄説明／アドバイス／終盤CTA／全体）
  - before: 元の書き方の要点（引用は20字以内に収め、要点を自分の言葉で）
  - after: 直した後の要点
  - point: なぜ直したか・狙い（1行。「〜だから〜にした」の形）
- nextTime: 次回の改善ポイントを3〜6個。具体的な行動の形（「〜する」「〜しない」）で、優先度の高い順。changes と重複する説明はまとめる
- overall: 添削全体の一言（40字以内）
- 禁止: 抽象的な褒め言葉、原文の長い丸写し、箇条書き内のさらなる箇条書き
${commentText ? `\n【オーナーのコメント（優先して反映する）】\n${commentText}\n` : ""}
【差分】
${diffText}

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "changes": [ { "where": "", "before": "", "after": "", "point": "" } ], "nextTime": [ "" ], "overall": "" }`;

    const r = await callAi(aiApiKey, aiModel, prompt, { maxTokens: 6000, jsonMode: true });
    if (r.error) return NextResponse.json({ error: r.error }, { status: r.status && r.status >= 400 ? r.status : 500 });
    const summary = parseSummary(r.text);
    if (!summary) return NextResponse.json({ error: "AIの応答を読み取れませんでした。もう一度お試しください" }, { status: 500 });
    return NextResponse.json({ summary, stats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "修正ポイントの作成に失敗しました" }, { status: 500 });
  }
}
