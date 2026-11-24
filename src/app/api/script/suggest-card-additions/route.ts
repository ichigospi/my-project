import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai-call";
import { normalizeAiModel } from "@/lib/ai-model";
import { buildCardAdditionPrompt, parseCardAdditions, buildContentAdditionPrompt, parseContentAdditions } from "@/lib/card-additions";
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
    const { text, kind, mode, targetChars, deficit, aiApiKey, referenceTranscripts, referenceStructure } = body as {
      text: string; kind: "skeleton" | "script"; mode?: "card" | "content"; targetChars: number; deficit?: number; aiApiKey: string;
      referenceTranscripts?: string[]; referenceStructure?: string;
    };
    const aiModel = normalizeAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!text?.trim()) return NextResponse.json({ error: "骨組みまたは台本がありません" }, { status: 400 });

    // すでに使っているカード（候補から除外）
    const used = kind === "script"
      ? countCardReveals(text).cards
      : extractDrawnCards(text).map((c) => c.name);
    const current = kind === "script" ? text.replace(/\s/g, "").length : 0;
    const d = Number(deficit) > 0 ? Number(deficit) : Math.max(mode === "content" ? 300 : 1000, (Number(targetChars) || 0) - current);
    const transcripts = (referenceTranscripts || []).filter((t) => t && t.trim()).slice(0, 2);
    // mode=content: カードは増やさず、元ネタにあってこの骨組み／台本に無い要素を既存セクションに足す候補
    const prompt = mode === "content"
      ? buildContentAdditionPrompt({ text, kind, deficit: d, targetChars: Number(targetChars) || 0, transcripts, referenceStructure })
      : buildCardAdditionPrompt({ text, kind, deficit: d, targetChars: Number(targetChars) || 0, transcripts, usedCards: used });

    const r = await callAi(aiApiKey, aiModel, prompt, { maxTokens: 4000, jsonMode: true });
    if (r.error) return NextResponse.json({ error: r.error, ...(r.retryable ? { retryable: true } : {}) }, { status: r.status || 500 });
    const raw = r.text;

    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    if (mode === "content") {
      return NextResponse.json({ contentAdditions: parseContentAdditions(parsed), deficit: d });
    }
    const additions = parseCardAdditions(parsed, used);
    return NextResponse.json({ additions, usedCards: used, deficit: d });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "追加カードの提案に失敗しました" }, { status: 500 });
  }
}
