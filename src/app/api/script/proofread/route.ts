import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 日本語校閲: 構成・訴求は見ず、「日本語として正確か／声に出して自然か」だけを一文ずつ厳密に見る。
// 品質チェック（構成・ルール向け）では拾えない、助詞・係り受け・不自然な言い回しの崩れを拾う専用パス。
export const maxDuration = 180;

const SYSTEM_PROMPT = `あなたはプロの日本語校閲者です。YouTubeの占い動画のナレーション台本（女性占い師が視聴者に語りかける話し言葉）を、
「日本語として正確か」「声に出して読んで自然か」だけの観点で、一文ずつ厳密に校閲してください。

やること:
- 全文を最初から最後まで一文ずつ読む（飛ばさない）。
- 次に該当する文を漏れなく全部挙げる:
  (a) 文法・助詞・活用の誤り、主語と述語のねじれ、係り受けの崩れ
  (b) 日本語として言わない言い回し・不自然なコロケーション・造語的表現
  (c) 文の途中で意味が途切れる／指示語（それ・その・これ）が何を指すか分からない
  (d) 近接した位置での同じ語句・言い回しの重複（くどさ）
  (e) 話し言葉として不自然（書き言葉・硬い表現・録画を後から解説しているような言い方）
  (f) 「——」や「……」の直後の繋がりが文として成立していない箇所
  (g) 読み物として一読で意味が取れない文（修飾が2段以上重なる長文、比喩を2つ以上重ねた文）
  (h) スピリチュアルっぽく聞こえるだけで中身が無い抽象表現（例:「流れと波長がかちっと合う」「噛み合う位置まで進んでいた途中」「心の澱みが払われる」）。
      何が・どうなるのかが具体の出来事・行動で言えていないものは必ず挙げ、具体に言い換えた修正案を出す
- マーケティングや構成の良し悪し、訴求の強弱については一切コメントしない。日本語だけを見る。
- 問題のない文は挙げない。ただし甘くしない。少しでも引っかかる文は挙げる。多くなって構わない。
- original は台本の該当文を一字一句そのまま引用する（置換に使うため。改変・要約・省略禁止。1文〜2文の範囲で）。
- fix はそのまま差し替えられる完成文にする（原文と同じ範囲を置き換える文）。

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{
  "items": [
    { "original": "原文をそのまま", "issue": "問題点を短く", "fix": "差し替え用の完成文", "level": "broken" | "unnatural" }
  ],
  "counts": { "broken": 0, "unnatural": 0 }
}
level は、意味が取れない・文法が壊れている＝"broken"、通じるが変＝"unnatural"。`;

function parseJSON(raw: string): Record<string, unknown> | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : raw).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, aiApiKey, previousSummary } = body as { script?: string; aiApiKey: string; previousSummary?: string };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!script || script.trim().length < 50) return NextResponse.json({ error: "台本がありません" }, { status: 400 });

    const diffBlock = previousSummary ? `

【前回の校閲結果（これは修正後の再校閲です。差分モードで校閲すること）】
${previousSummary}
差分モードの原則:
1. 前回挙げた指摘のうち、原文が台本に無くなっているものは「修正済み」とみなす（蒸し返さない）
2. 前回挙げなかった文は、「崩壊（意味が取れない・文法が壊れている）」レベルの明確な問題のみ新規に挙げる。好み・言い回しの微調整レベルの新規指摘は出さない
3. 前回の指摘で原文がまだ残っているものは、そのまま再掲してよい` : "";

    const userPrompt = `${SYSTEM_PROMPT}${diffBlock}

【校閲対象の台本】
${script}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 8000, messages: [{ role: "user", content: userPrompt }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r2) => setTimeout(r2, 4000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res!.status }); }
      const data = await res!.json();
      recordUsage({ model: data.model || aiModel, usage: data.usage });
      raw = ((data.content || []) as { type?: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text || "").join("");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: userPrompt }], max_tokens: 8000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    const itemsRaw = Array.isArray(parsed.items) ? parsed.items : [];
    const items = itemsRaw
      .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
      .map((it) => ({
        original: String(it.original ?? ""),
        issue: String(it.issue ?? ""),
        fix: String(it.fix ?? ""),
        level: it.level === "broken" ? "broken" : "unnatural",
        // 置換に使えるか（原文が台本に一字一句存在するか）
        found: !!it.original && script.includes(String(it.original)),
      }))
      .filter((it) => it.original && it.fix);
    const counts = {
      broken: items.filter((i) => i.level === "broken").length,
      unnatural: items.filter((i) => i.level === "unnatural").length,
    };
    return NextResponse.json({ items, counts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "日本語校閲に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
