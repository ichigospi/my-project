import { NextRequest, NextResponse } from "next/server";
import { worldviewPromptBlock } from "@/lib/worldview";
import { normalizeAiModel } from "@/lib/ai-model";
import { countCardReveals } from "@/lib/tarot-draw";
import { blacklistPromptBlock } from "@/lib/qc-blacklist";
import { callAi } from "@/lib/ai-call";
import { loadCustomBans } from "@/lib/custom-bans";
import { splitParagraphs, numberedParagraphs, parseParagraphEdits, applyParagraphEdits, summarizeApply } from "@/lib/paragraph-edit";

// 全文を書き直させると指示外の箇所まで改変されるため、
// 「該当箇所だけの find→replace パッチ」をモデルに出させ、サーバ側で元台本に適用する。
// これにより修正指示の無い箇所は元のまま（バイト単位で不変）を構造的に保証する。
export const maxDuration = 300;

interface RefAnalysis {
  videoTitle?: string;
  analysisResult?: {
    structure?: { name: string; timeRange: string; purpose: string }[];
    ctas?: string[];
    idealFuture?: string;
    worstFuture?: string;
    retentionTactics?: string[];
    worldview?: string;
  } | null;
}

interface Edit { find?: string; replace?: string; reason?: string }

// 元ネタ分析を「修正時に超えるべき基準値」として整形する
function buildReferenceText(referenceAnalyses: RefAnalysis[]): string {
  if (!referenceAnalyses || referenceAnalyses.length === 0) return "";

  const blocks = referenceAnalyses.map((a, i) => {
    const r = a.analysisResult;
    if (!r) return "";
    return `■ 元ネタ${i + 1}「${a.videoTitle || "無題"}」
・構成: ${r.structure?.map((s) => `${s.name}(${s.timeRange})`).join(" → ") || "不明"}
・理想の未来: ${r.idealFuture || "不明"}
・最悪の未来: ${r.worstFuture || "不明"}
・CTA: ${r.ctas?.join(" / ") || "不明"}
・視聴維持の仕掛け: ${r.retentionTactics?.join(" / ") || "不明"}
・世界観の演出: ${r.worldview || "不明"}`;
  }).filter(Boolean);

  if (blocks.length === 0) return "";

  return `
【元ネタ分析（修正時の基準値。これと同等以下にしないこと）】
${blocks.join("\n\n")}
`;
}

// 置換後に「同じ文が続けて2回」が新しく生まれていないか（元の文を残したまま直した文を足す誤りの検出）
function adjacentDuplicateSentences(text: string): Set<string> {
  const sents = text.replace(/\s+/g, "").split(/(?<=[。！？!?])/).map((s) => s.trim()).filter(Boolean);
  const out = new Set<string>();
  for (let i = 1; i < sents.length; i++) if (sents[i].length >= 12 && sents[i] === sents[i - 1]) out.add(sents[i]);
  return out;
}
function introducesDuplicate(before: string, after: string): string | null {
  const prev = adjacentDuplicateSentences(before);
  for (const s of adjacentDuplicateSentences(after)) if (!prev.has(s)) return s;
  return null;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// モデル出力からJSONを安全に取り出す（```json```フェンスや前後の説明文に耐える）
function extractJson(text: string): { edits?: Edit[] } | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : text).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ }
  }
  return null;
}

// 1件のfind→replaceを台本に適用する。まず厳密一致、ダメなら空白(改行)の揺れを吸収して最初の1箇所だけ置換。
// 適用できなければ null を返す（＝指示外を巻き込まないため、無理な置換はしない）。
function applyOneEdit(script: string, find: string, replace: string): string | null {
  if (find && script.includes(find)) {
    return script.replace(find, replace);
  }
  const tokens = find.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return null;
  try {
    const re = new RegExp(tokens.join("\\s*"));
    const m = script.match(re);
    if (m && m[0]) return script.replace(m[0], replace);
  } catch { /* 不正な正規表現になった場合は諦める */ }
  return null;
}


// 日本時間の今日の日付（時期訴求の基準日として全プロンプトに注入する）
function jstToday(): string {
  return new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });
}

// 台本の修正指示を受けて「指示箇所だけ」差分パッチで修正する
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { script, revisionNote, aiApiKey, referenceAnalyses } = body;
  const aiModel = normalizeAiModel(body.aiModel);

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
  if (!script || !revisionNote) return NextResponse.json({ error: "台本と修正指示が必要です" }, { status: 400 });

  const referenceText = buildReferenceText(referenceAnalyses);
  const customBans = await loadCustomBans().catch(() => []);

  // 段落書き直しモード（タロット）: 指摘に該当する段落を丸ごと書き直して差し替える。find→replace の継ぎ足しをしない
  if (body.mode === "paragraph") {
    const paras = splitParagraphs(String(script));
    const prompt = `あなたはプロのタロット占い師で、YouTube台本の校閲者です。次の台本に対する【修正指示】を、該当する段落を丸ごと書き直す形で反映してください。

【守ること】
- 指示に該当する段落だけを書き直す。該当しない段落は返さない（返さなければ1文字も変わらない）
- 書き直す段落は、指摘の箇所だけでなく段落全体を自然な一続きの語りとして書き直す（文の継ぎ足し・差し込みはしない。元の文を残したまま直した文を足さない）
- 段落の字数は元の±20%。情報・テーマ語・カード名・向き・固定句・決め台詞は変えない
- 「（N箇所）」「全部直す」の指摘は、該当する段落を全部書き直す
- 「該当:」に引用された文が入っている段落を探して直す。該当の文がもう台本に無い指摘は、すでに直っているので無視する（別の段落を無理に直さない）
- カードの削除・統合・追加は禁止。番号の不整合は番号を振り直す
- 直した段落に、下の禁止表現・漢数字を入れない
${worldviewPromptBlock()}
${referenceText}
${blacklistPromptBlock(customBans)}

【現在日時】今日は${jstToday()}（日本時間）。

【修正指示】
${revisionNote}

【台本（段落番号つき。全${paras.length}段落）】
${numberedParagraphs(paras)}

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "edits": [ { "index": 段落番号, "reason": "何をどう直したか（短く）", "text": "書き直した段落の全文" } ] }`;
    const r = await callAi(aiApiKey, aiModel, prompt, { maxTokens: 12000 });
    if (r.error) return NextResponse.json({ error: r.error, ...(r.retryable ? { retryable: true } : {}) }, { status: r.status || 500 });
    const edits = parseParagraphEdits(r.text);
    if (edits.length === 0 && !/"edits"\s*:\s*\[\s*\]/.test(r.text)) {
      return NextResponse.json({ error: "修正結果の解析に失敗しました。もう一度お試しください。" }, { status: 502 });
    }
    // カード追加ガード: 明示の指示が無い限り、新しいカードが増える差し替えは落とす
    const allowCardAdd = /【カードを1枚追加】/.test(String(revisionNote || ""));
    const baseCards = new Set(countCardReveals(String(script)).cards);
    const safeEdits = edits.filter((e) => allowCardAdd || countCardReveals(e.text).cards.every((c) => baseCards.has(c)));
    const result = applyParagraphEdits(String(script), safeEdits, { minKeepRatio: 0.6, allowDelete: false, minTotalRatio: 0.93 });
    let summary = summarizeApply(result);
    if (safeEdits.length < edits.length) summary += `\n⚠ 骨組みに無いカードを足す差し替え${edits.length - safeEdits.length}件は適用しませんでした`;
    return NextResponse.json({ script: `${result.script}\n\n---修正箇所---\n${summary}`, applied: result.applied.length, unmatched: result.rejected.length, changes: result.applied.map((a) => ({ index: a.index, reason: a.reason, before: a.before, after: a.after })) });
  }

  const prompt = `あなたはプロのスピーチマーケター兼YouTube台本ライターです。
以下の【現在の台本】に対し、【修正指示】で挙げられた箇所「だけ」をピンポイントで直す**差分パッチ**を作成してください。
${worldviewPromptBlock()}

【最重要原則】
- 修正指示で明示された問題箇所だけを対象にする
- 指示に無い箇所は絶対に変更しない（言い換え・並び替え・改行調整も禁止）
- カードの削除・統合は禁止。開示しているカードの枚数は現在の台本のまま維持する。「番号の不整合」「枚数の不一致」の指摘は番号を振り直して直し、カードを消して数を合わせない。
  カードが流れに合わないという指摘は、そのカードの正統な意味の範囲で本文を直すか、直せなければ edits に入れず reason に差し替え候補（カード名・向き・理由）を書くだけにする
- 既に良い部分・フレーズ・構成はそのまま温存する。全文の書き直しは絶対にしない

【出力形式：JSONのみ】
次の形式のJSONだけを出力する（前後に説明文やマークダウンの装飾を付けない）：
{
  "edits": [
    {
      "find": "現在の台本から、修正対象の箇所を一字一句そのままコピーした文字列",
      "replace": "その箇所だけを修正指示に沿って直した後の文字列",
      "reason": "何をなぜ直したかの短い説明"
    }
  ]
}

【find / replace の厳守事項】
- find は必ず【現在の台本】に実在する連続した文字列を、改行・記号・句読点・助詞まで含めて正確にコピーする（要約・省略・言い換えは厳禁。1文字でも違うと適用できず無視されます）
- find は前後を一意に特定できる十分な長さ（最低でも1文）にする。短すぎて複数箇所に一致しうる文字列は避ける
- replace は find と同じ範囲を置き換えた後の文字列。直すべき部分だけを変え、それ以外の語句は find からそのまま残す
- 文章を「追加」したい場合は、挿入位置の直前か直後にある既存の一文を find にし、replace に「その一文＋追加する文」を入れる
- 指摘の「該当:」に挙がっている文は、台本の同じ文をそのまま find にする（「…」は省略記号なので find には入れない）
- 「（N箇所）」「全部直す」とある指摘は、挙がっている全部の文を直す（1つ直して残りを放置すると同じ不合格が繰り返される）。文ごとに別の edit にする
- 直した文を replace に入れるとき、find の元の文を残したまま新しい文を足さない（同じ文が2回並ぶ）。差し替えは「元の文→直した文」だけ
- 修正が不要、または該当箇所が見つからない指摘は edits に含めない（無理に何かを変えない）
- edits は必要最小限の件数に絞る。1つのeditの範囲も必要な分だけに留め、広げすぎない
- 元ネタ基準値が与えられている場合、replace の該当要素は元ネタ以上にターゲットへ刺さる具体性にする（ただし対象の範囲内だけ）
${referenceText}
【現在日時】今日は${jstToday()}（日本時間）。時期の訴求を書く場合は今日を基点にし、過ぎた月を未来の予言として書かないこと。

${blacklistPromptBlock(customBans)}
※ replace の文にも上記の禁止表現・漢数字を入れない（直した結果がまた不合格になる）

【修正指示】
${revisionNote}

【現在の台本】
${script}`;

  try {
    const r0 = await callAi(aiApiKey, aiModel, prompt, { maxTokens: 16000, jsonMode: true });
    if (r0.error) return NextResponse.json({ error: r0.error, ...(r0.retryable ? { retryable: true } : {}) }, { status: r0.status || 500 });
    const text = r0.text;

    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.edits)) {
      return NextResponse.json({ error: "修正結果の解析に失敗しました。もう一度お試しください。" }, { status: 502 });
    }

    // 元台本に対してパッチを順番に適用（指示外は一切触らない）
    let result = script as string;
    const applied: string[] = [];
    const unmatched: string[] = [];
    // 【カードの追加禁止ガード】明示的な「カードを1枚追加」の指示が無い限り、修正で新しいカードが本文に増える編集は適用しない
    const allowCardAdd = /【カードを1枚追加】/.test(String(revisionNote || ""));
    const baseCards = new Set(countCardReveals(script as string).cards);
    for (const ed of parsed.edits) {
      const find = String(ed.find ?? "");
      const replace = String(ed.replace ?? "");
      const reason = (ed.reason ? String(ed.reason) : "").trim();
      if (!find) continue;
      const next = applyOneEdit(result, find, replace);
      if (next !== null) {
        const dup = introducesDuplicate(result, next);
        if (dup) {
          unmatched.push(`・[不適用] ${reason || "修正"}（元の文を残したまま直した文を足す内容で、同じ文が2回並ぶため適用しませんでした: 「${dup.slice(0, 40)}…」）`);
          continue;
        }
        if (!allowCardAdd) {
          const added = countCardReveals(next).cards.filter((c) => !baseCards.has(c));
          if (added.length > 0) {
            unmatched.push(`・[不適用] ${reason || "修正"}（骨組みに無いカード「${added.join("・")}」を追加する内容のため適用しませんでした。カードを足すときは「追加カードの提案」から行ってください）`);
            continue;
          }
        }
        result = next;
        applied.push(`・${reason || "修正を適用"}`);
      } else {
        const label = reason || (find.length > 24 ? find.slice(0, 24) + "…" : find);
        unmatched.push(`・[未適用] ${label}（該当箇所が見つからず自動適用できませんでした）`);
      }
    }

    let summary = applied.length > 0 ? applied.join("\n") : "（適用できる修正がありませんでした）";
    if (unmatched.length > 0) {
      summary += `\n\n⚠ 以下は自動適用できませんでした。指示文を具体的にするか、手動で修正してください:\n${unmatched.join("\n")}`;
    }

    // 既存クライアントの分割仕様（"---修正箇所---"）に合わせて返す
    return NextResponse.json({ script: `${result}\n\n---修正箇所---\n${summary}`, applied: applied.length, unmatched: unmatched.length });
  } catch {
    return NextResponse.json({ error: "修正に失敗しました" }, { status: 500 });
  }
}
