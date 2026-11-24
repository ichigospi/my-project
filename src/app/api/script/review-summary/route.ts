import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai-call";
import { parseAiSpec, geminiPreamble } from "@/lib/ai-model";
import { paraDiff, diffStats } from "@/lib/para-diff";
import { REVIEW_TAGS, type ReviewSummaryItem, type ReviewNextTime } from "@/lib/project-store";

// 修正ポイント: 提出原文と完成台本の差分（行番号つき）を読ませ、「根本的な直し」だけを行ごとにタグ付けし、
// 次回の改善ポイントを実例つきで返す。細かい直し（漢数字・誤字・語尾1つ）は扱わない。
// 学習（review-learn）はルール候補の抽出が目的。こちらはライターが読んで次回に活かすための解説が目的
export const maxDuration = 180;

interface Summary { items: ReviewSummaryItem[]; nextTime: ReviewNextTime[]; tagCounts: Record<string, number>; overall: string }

const str = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const normTag = (t: unknown): string => {
  const s = str(t, 20);
  const hit = REVIEW_TAGS.find((k) => s === k) || REVIEW_TAGS.find((k) => s.includes(k));
  return hit || "規範違反";
};

function parseSummary(raw: string, validRows: Set<number>): Summary | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as { items?: unknown[]; nextTime?: unknown[]; overall?: unknown };
    const items: ReviewSummaryItem[] = (Array.isArray(o.items) ? o.items : [])
      .map((x) => { const it = (x || {}) as Record<string, unknown>; return { row: Number(it.row), tag: normTag(it.tag), quote: str(it.quote, 60), note: str(it.note, 160) }; })
      .filter((it) => Number.isFinite(it.row) && validRows.has(it.row) && it.note)
      .slice(0, 15);
    const nextTime: ReviewNextTime[] = (Array.isArray(o.nextTime) ? o.nextTime : [])
      .map((x) => { const it = (x || {}) as Record<string, unknown>; return { tag: normTag(it.tag), rule: str(it.rule, 120), before: str(it.before, 120), after: str(it.after, 120), basis: str(it.basis, 120) }; })
      .filter((it) => it.rule)
      .slice(0, 6);
    const tagCounts: Record<string, number> = {};
    for (const it of items) tagCounts[it.tag] = (tagCounts[it.tag] || 0) + 1;
    return { items, nextTime, tagCounts, overall: str(o.overall, 100) };
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
      return NextResponse.json({ summary: { items: [], nextTime: [], tagCounts: {}, overall: "提出原文と完成台本に差分はありません" } as Summary });
    }
    // 変わった行だけを行番号つきで渡す。前後の文脈として、直前の一致行の末尾1文を添える
    const validRows = new Set<number>();
    const lastSentence = (s: string) => { const t = s.trim().split(/(?<=[。！？!?])/).filter(Boolean); return t.length ? t[t.length - 1].trim().slice(-60) : ""; };
    const blocks: string[] = [];
    rows.forEach((r, idx) => {
      if (r.kind === "same") return;
      const no = idx + 1;
      validRows.add(no);
      const prev = idx > 0 && rows[idx - 1].kind === "same" ? lastSentence(rows[idx - 1].right) : "";
      const head = `【行${no}: ${r.kind === "changed" ? "書き換え" : r.kind === "removed" ? "削除" : "追加"}】${prev ? `（直前: …${prev}）` : ""}`;
      if (r.kind === "changed") blocks.push(`${head}\n（前）${r.left.slice(0, 900)}\n（後）${r.right.slice(0, 900)}`);
      else if (r.kind === "removed") blocks.push(`${head}\n（前）${r.left.slice(0, 600)}`);
      else blocks.push(`${head}\n（後）${r.right.slice(0, 900)}`);
    });
    const diffText = blocks.join("\n\n").slice(0, 30000);
    const commentText = comments.filter((c) => c.comment).slice(0, 30).map((c) => `- 「${(c.original || "").slice(0, 60)}」→「${(c.changed || "").slice(0, 60)}」: ${c.comment}`).join("\n");

    const aiModel = typeof body.aiModel === "string" ? body.aiModel : undefined;
    const provider = parseAiSpec(aiModel).provider;
    const prompt = `${provider === "gemini" ? geminiPreamble("edit") + "\n\n" : ""}あなたはプロのタロット占い師兼スピリチュアルマーケターで、YouTube台本の添削者です。
ライターが提出した台本（前）を、オーナーが添削して完成台本（後）にしました。下はその差分（変わった行だけ。行番号は比較表の行）です。
ライターが「根本的に何を間違えていて、なぜそう直されたか」を理解し、次の台本で同じ指摘を受けないための解説を作ってください。

【取り上げるもの＝根本的な直しだけ】
- 構成: カードの役割どおりになっていない（1枚目で原因を言っている、3枚目が核になっていない、4枚目が現状診断になっている 等）
- 先食い: 後のカード・終盤で言うべきこと（原因・解決・未来・時期・未知数）を先に言っている
- 位置違い: 離脱防止・口コミ・対比・枠切迫・CTAなどが本来の場所に無い
- 意味が通らない: 何を言っているか分からない、因果が飛んでいる、比喩が伝わらない、抽象語の対象が無い
- 矛盾: 前後で食い違う（時期を言ってから数えるなと言う、良いカードと言いながら逆位置 等）
- 重複: 同じ主張・同じ要素の繰り返し
- 訴求が弱い: 言い当て・理想の未来・損失・仮想敵が薄い／平熱／刺さらない
- 橋渡し: カード間・終盤への繋ぎが無い、問いになっていない
- 絵柄が長い: 絵柄説明が長く、伝えることと紐付いていない
- 世界観: 守護天使様以外の存在・チャンネルに合わない語
- 規範違反: 無料鑑定で約束してはいけないこと、固定句の位置、冒頭で結末カード名、アドバイス複数 など台本ルールの根本
- 語り口: 堅い言い回し・AIっぽさ・説明口調。これは「全体の傾向」としてまとめて1件だけ（代表例を1つ）

【取り上げないもの】
- 漢数字→算用数字、誤字脱字、句読点、語尾1つの言い換え、言葉の微調整、段落の分割・結合
- 意味が同じで言い回しだけ変わった行

【書き方】
- items: 根本的な直しに当たる行だけ、最大12件。重要なものから。同じ理由の行が複数あれば代表の1〜2行にまとめる（他の行は書かない）
  - row: 行番号（数字）
  - tag: 上の分類名のどれか1つ（構成／先食い／位置違い／意味が通らない／矛盾／重複／訴求が弱い／橋渡し／絵柄が長い／世界観／規範違反／語り口）
  - quote: その行の実際の言葉を20字以内で引用
  - note: 「何が問題で→どう直した」を2文以内。一般論ではなく、この行の中身で言う（例: 「1枚目で「受け取りを止めている癖」まで言ってしまい、3枚目の核が無くなる。1枚目は現状と兆しだけに戻した」）
- nextTime: 次回の改善ポイントを3〜5個。件数が多い・影響が大きい分類から
  - tag: 分類名
  - rule: 守ること（「〜する」「〜しない」の形、1文）
  - before / after: この台本での実例（前→後。引用は各40字以内）
  - basis: 根拠になる構成ロジック・ルール（1文。例: 「原因は2枚目、常識破壊は3枚目。1枚目は現状と兆しまで」）
- overall: 今回の添削を一言で（40字以内。何が一番の問題だったか）
- 禁止: 抽象的な褒め言葉、原文の長い丸写し、細かい直しの列挙
${commentText ? `\n【オーナーのコメント（最優先で反映する。該当する行があれば必ず items に入れ、note はコメントの趣旨で書く）】\n${commentText}\n` : ""}
【差分（全${rows.length}行中、書き換え${stats.changed}・削除${stats.removed}・追加${stats.added}）】
${diffText}

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "items": [ { "row": 0, "tag": "", "quote": "", "note": "" } ], "nextTime": [ { "tag": "", "rule": "", "before": "", "after": "", "basis": "" } ], "overall": "" }`;

    const r = await callAi(aiApiKey, aiModel, prompt, { maxTokens: 6000, jsonMode: true });
    if (r.error) return NextResponse.json({ error: r.error }, { status: r.status && r.status >= 400 ? r.status : 500 });
    const summary = parseSummary(r.text, validRows);
    if (!summary) return NextResponse.json({ error: "AIの応答を読み取れませんでした。もう一度お試しください" }, { status: 500 });
    return NextResponse.json({ summary, stats });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "修正ポイントの作成に失敗しました" }, { status: 500 });
  }
}
