import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 元ネタ台本から「本質」（骨組み・台本に必ず反映すべき要素）を抽出する。
// 構成を決める段階で大きく表示し、骨組み/台本生成プロンプトに必達で注入するための材料。
export const maxDuration = 120;

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTube台本のプロ構成作家です。
伸びている元ネタ台本（書き起こし）から、「この台本が刺さった本質」を抽出してください。
表面的な構成（何枚目に何のカード）ではなく、視聴者の心を動かした「中身」を、元ネタの言い回しをできるだけ残して抜き出します。

抽出の観点（元ネタに無い項目は空文字/空配列にする。捏造しない）:
1. coreProblems: 視聴者の悩みの本質。元ネタが名指しした悩みを、言い回しごと（例:「頑張っているのにお金の流れだけが変わらない」「何を選べばいいか分からない」「何度やっても同じところへ戻る」「今さら遅いのでは」）。最大6個
2. targetCallout: ターゲットの名指し（「特に〜と感じている方に見てほしい」の中身）
3. affirmReframe: 肯定のリフレーム（例:「止まっていたのは運から外れていたからではなく、歯車が噛み合う位置まで進んでいた途中だった」）
4. agendaHook: 冒頭の予告の切り口（例:「入り口は仕事なのか、人との縁なのか、過去に一度諦めたことなのか」）
5. causeAxis: 流れが止まっていた原因・常識破壊の軸（例:「与える側だった→受け取り下手」「絶対失敗してはいけないという慎重さ」）
6. advice: 具体行動（例:「声をかけられたら断らずまず聞く」「親切を一度受け取る」）。最大4個
7. idealFuture: 理想の未来の具体（例:「過去に諦めたことが今の自分に合う形で戻ってくる」「評価されにくかったことが認められる」）。最大5個
8. selfAffirmClose: 自己肯定の締め（例:「あなたは自分が思う以上に人の役に立ってきた。使ってきた時間や力は消えない」）
9. keyMessage: 最重要メッセージ・締めの結論（例:「止まっていたのは力不足ではなく、持っていた力を自分の豊かさのために使ってこなかっただけ」）
10. commentCta: コメントCTAの語とロジック（例:「"残します"と書く＝自分のための目印」）
11. heavyCtaUnknowns: 重CTAで「個別でないと視えない」とした未知数（例:「どの経験が金運に繋がるか」「誰との縁から開くか」「受け取りを止めている一番の原因」）。最大4個
12. mustKeep: 上記を踏まえ「骨組みに必ず反映すべき要素」を優先順に短文で。最大7個

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{
  "coreProblems": ["..."],
  "targetCallout": "...",
  "affirmReframe": "...",
  "agendaHook": "...",
  "causeAxis": "...",
  "advice": ["..."],
  "idealFuture": ["..."],
  "selfAffirmClose": "...",
  "keyMessage": "...",
  "commentCta": "...",
  "heavyCtaUnknowns": ["..."],
  "mustKeep": ["..."]
}`;

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

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, max) as string[] : []);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, videoTitle, aiApiKey } = body as { transcript?: string; videoTitle?: string; aiApiKey: string };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!transcript || transcript.replace(/\s/g, "").length < 200) {
      return NextResponse.json({ error: "元ネタの書き起こしが短すぎます" }, { status: 400 });
    }

    const userPrompt = `${SYSTEM_PROMPT}

【元ネタ台本】「${videoTitle || "無題"}」
${transcript.slice(0, 24000)}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 3000, messages: [{ role: "user", content: userPrompt }], ...anthropicExtraBody(aiModel) }),
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: userPrompt }], max_tokens: 3000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    return NextResponse.json({
      essence: {
        coreProblems: arr(parsed.coreProblems, 6),
        targetCallout: str(parsed.targetCallout),
        affirmReframe: str(parsed.affirmReframe),
        agendaHook: str(parsed.agendaHook),
        causeAxis: str(parsed.causeAxis),
        advice: arr(parsed.advice, 4),
        idealFuture: arr(parsed.idealFuture, 5),
        selfAffirmClose: str(parsed.selfAffirmClose),
        keyMessage: str(parsed.keyMessage),
        commentCta: str(parsed.commentCta),
        heavyCtaUnknowns: arr(parsed.heavyCtaUnknowns, 4),
        mustKeep: arr(parsed.mustKeep, 7),
        extractedAt: new Date().toISOString(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "本質の抽出に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
