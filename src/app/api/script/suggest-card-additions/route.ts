import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";
import { buildCardAdditionPrompt, parseCardAdditions } from "@/lib/card-additions";
import { countCardReveals, extractDrawnCards } from "@/lib/tarot-draw";

// 文字数不足（1,000字以上）のときの「カードを1枚追加する」候補を2〜4個返す。
// 骨組み（kind=skeleton）でも台本本文（kind=script）でも使える。選んだ候補の反映は画面側（差分パッチ）で行う。
export const maxDuration = 120;

function parseJSON(raw: string): Record<string, unknown> | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : raw).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ } }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, kind, targetChars, deficit, aiApiKey, referenceTranscripts } = body as {
      text: string; kind: "skeleton" | "script"; targetChars: number; deficit?: number; aiApiKey: string; referenceTranscripts?: string[];
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!text?.trim()) return NextResponse.json({ error: "骨組みまたは台本がありません" }, { status: 400 });

    // すでに使っているカード（候補から除外）
    const used = kind === "script"
      ? countCardReveals(text).cards
      : extractDrawnCards(text).map((c) => c.name);
    const current = kind === "script" ? text.replace(/\s/g, "").length : 0;
    const d = Number(deficit) > 0 ? Number(deficit) : Math.max(1000, (Number(targetChars) || 0) - current);
    const prompt = buildCardAdditionPrompt({
      text, kind, deficit: d, targetChars: Number(targetChars) || 0,
      transcripts: (referenceTranscripts || []).filter((t) => t && t.trim()).slice(0, 2),
      usedCards: used,
    });

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 4000, messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 4000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    const additions = parseCardAdditions(parsed, used);
    return NextResponse.json({ additions, usedCards: used, deficit: d });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "追加カードの提案に失敗しました" }, { status: 500 });
  }
}
