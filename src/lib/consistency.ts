// 整合編集: 生成直後の台本を全文読ませ、重複・矛盾・場所違い・AIっぽさ「だけ」を段落単位で直す1パス。
// 返すのは差し替える段落の番号と新しい文だけ。指定の無い段落は変わらない。字数は維持させ、減りすぎる差し替えは適用しない。
import { callAi } from "@/lib/ai-call";
import { splitParagraphs, numberedParagraphs, parseParagraphEdits, applyParagraphEdits, summarizeApply, type ApplyResult } from "@/lib/paragraph-edit";
import { blacklistPromptBlock } from "@/lib/qc-blacklist";

export interface ConsistencyContext {
  backbone?: { theme?: string; metaphor?: string; promise?: string } | null;
  cards?: { name: string; orientation: string }[];
  techniqueBrief?: string;
}

const ALLOWED_REASONS = ["重複", "矛盾", "場所違い", "AIっぽさ", "文脈"];
const norm = (s: string) => s.replace(/\s+/g, "").replace(/[「」『』、。！？!?…・]/g, "");

export function buildConsistencyPrompt(script: string, ctx?: ConsistencyContext): string {
  const paras = splitParagraphs(script);
  const b = ctx?.backbone;
  return `あなたはプロのタロット占い師で、YouTube台本の編集者です。次の台本を全文読み、下の4種類の問題「だけ」を段落単位で直してください。それ以外は一切触りません。

【直してよい4種類】
1. 重複: 同じ内容・同じ主張・同じ要素（未知数、口コミ、時期、言い当て、CTA、比喩）が2回以上出ている → 後の方を削るか、別の役割の文に書き換える。文が丸ごと2回並んでいる場合は片方を消す
2. 矛盾: 前の段落と食い違う（良いカードが続いたと言うが直前は逆位置、時期を言ってから「日にちを数えるな」、視え切らないと言った直後に言い切る、など） → 前後に合う形に直す
3. 場所違い: 中盤の離脱防止がカードをめくった後に出ている、先のカードの内容を先に言っている、終盤の要素が本編に出ている、対比の比喩が本編に出ている → 本来の場所に合う文に直す（移動はできないので、ここでは役割に合う文へ書き換え、必要なら本来の場所の段落に足す）
4. AIっぽさ: 語尾の連続、「それにね」「でもね」の連発、説明口調、箇条書き的な列挙、同じ主張の言い換え反復、動詞に「何を」が無い、倒置（「〜、と。」） → 喋る言葉に直す。意味・情報・テーマ語は変えない

【触らないもの】
- 問題の無い段落（1文字も変えない）
- カード名・向き・枚数・順番、背骨（主張・中心メタファー・冒頭の約束）、固定句、決め台詞
- 段落の字数（直した段落も元の字数の±20%に収める。全体の字数を減らさない）
${b ? `\n【背骨】主張: ${b.theme || "—"}／中心メタファー: ${b.metaphor || "—"}／冒頭の約束: ${b.promise || "—"}` : ""}${ctx?.cards?.length ? `\n【カード】${ctx.cards.map((c, i) => `${i + 1}枚目 ${c.name}（${c.orientation}）`).join("、")}` : ""}
${ctx?.techniqueBrief ? `\n${ctx.techniqueBrief.slice(0, 3000)}\n` : ""}
${blacklistPromptBlock()}

【台本（段落番号つき。全${paras.length}段落）】
${numberedParagraphs(paras)}

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止。直す段落が無ければ edits を空配列に）:
{ "edits": [ { "index": 段落番号, "reason": "重複／矛盾／場所違い／AIっぽさ のどれか＋短い説明", "text": "差し替え後の段落全文（削除は空文字。削除は丸ごと重複のときだけ）" } ] }`;
}

export async function runConsistencyPass(aiApiKey: string, aiModel: string | undefined, script: string, ctx?: ConsistencyContext): Promise<{ result: ApplyResult; summary: string; error?: string }> {
  const r = await callAi(aiApiKey, aiModel, buildConsistencyPrompt(script, ctx), { maxTokens: 12000 });
  if (r.error) return { result: { script, applied: [], rejected: [] }, summary: "", error: r.error };
  const edits = parseParagraphEdits(r.text);
  const paras = splitParagraphs(script);
  // 理由が4種類のどれでもない差し替えは捨てる。削除（空文字）は、その段落の文の大半が他の段落にもあるときだけ許す
  const filtered = edits.filter((e) => {
    const reason = e.reason || "";
    if (!ALLOWED_REASONS.some((k) => reason.includes(k))) return false;
    if (e.text.trim() === "") {
      if (!reason.includes("重複")) return false;
      const p = paras[e.index - 1] || "";
      const sents = p.split(/(?<=[。！？!?])/).map(norm).filter((s) => s.length >= 10);
      const others = norm(paras.filter((_, i) => i !== e.index - 1).join(""));
      const dup = sents.filter((s) => others.includes(s)).length;
      return sents.length > 0 && dup / sents.length >= 0.6;
    }
    return true;
  });
  const result = applyParagraphEdits(script, filtered, { minKeepRatio: 0.7, allowDelete: true, minTotalRatio: 0.95 });
  return { result, summary: summarizeApply(result) };
}
