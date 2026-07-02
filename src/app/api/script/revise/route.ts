import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";

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

// 台本の修正指示を受けて「指示箇所だけ」差分パッチで修正する
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { script, revisionNote, aiApiKey, referenceAnalyses } = body;
  const aiModel = resolveAiModel(body.aiModel);

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
  if (!script || !revisionNote) return NextResponse.json({ error: "台本と修正指示が必要です" }, { status: 400 });

  const isAnthropic = aiApiKey.startsWith("sk-ant-");
  const referenceText = buildReferenceText(referenceAnalyses);

  const prompt = `あなたはプロのスピーチマーケター兼YouTube台本ライターです。
以下の【現在の台本】に対し、【修正指示】で挙げられた箇所「だけ」をピンポイントで直す**差分パッチ**を作成してください。

【最重要原則】
- 修正指示で明示された問題箇所だけを対象にする
- 指示に無い箇所は絶対に変更しない（言い換え・並び替え・改行調整も禁止）
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
- 修正が不要、または該当箇所が見つからない指摘は edits に含めない（無理に何かを変えない）
- edits は必要最小限の件数に絞る。1つのeditの範囲も必要な分だけに留め、広げすぎない
- 元ネタ基準値が与えられている場合、replace の該当要素は元ネタ以上にターゲットへ刺さる具体性にする（ただし対象の範囲内だけ）
${referenceText}
【修正指示】
${revisionNote}

【現在の台本】
${script}`;

  try {
    let text = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 16000, messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json(); return NextResponse.json({ error: e.error?.message || "API error" }, { status: res!.status }); }
      text = ((await res!.json()).content || []).filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text || "").join("");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 16000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message || "API error" }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.edits)) {
      return NextResponse.json({ error: "修正結果の解析に失敗しました。もう一度お試しください。" }, { status: 502 });
    }

    // 元台本に対してパッチを順番に適用（指示外は一切触らない）
    let result = script as string;
    const applied: string[] = [];
    const unmatched: string[] = [];
    for (const ed of parsed.edits) {
      const find = String(ed.find ?? "");
      const replace = String(ed.replace ?? "");
      const reason = (ed.reason ? String(ed.reason) : "").trim();
      if (!find) continue;
      const next = applyOneEdit(result, find, replace);
      if (next !== null) {
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
