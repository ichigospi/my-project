import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// FB動画の文字起こし（スクショ画像 or テキスト）から、指示を分類抽出する。
// スクショはClaude Visionで読み取りと抽出を1リクエストで行う。
export const maxDuration = 300;

const PROMPT = `あなたは占い・スピリチュアル系YouTube運営チームのアシスタントです。
オーナーが台本添削のフィードバック動画（Loom）で話した内容の文字起こしが与えられます。
（スクリーンショット画像の場合は、まず画像内の文字起こしテキストを正確に読み取ってから作業してください。
音声認識の誤字・変換ミスは文脈から本来の意図に補正して解釈すること）

発言の中から「指示・要望・改善点」をすべて抽出し、次の3種類に分類してください:

1. "ツール修正" — 台本作成ツール自体の機能・仕組み・プロンプトへの要望
   （例:「この品質チェック、毎回◯◯を見逃すから直したい」「ここにボタンが欲しい」）
2. "台本ルール" — 今後のすべての台本に恒久的に効かせたい執筆ルール・パターンの指摘
   （例:「CTAの前には必ず◯◯を入れるようにして」「この言い回しは今後禁止」）
   ※台本ルールには category も付ける: 全体構成/選民フック/導入の離脱防止/問題提起/悩みの深掘りと共感/仮想敵批判と常識破壊/解決策アドバイス/理想の未来/LINE登録CTA/チャンネル登録・高評価・コメント訴求/口コミ/その他
3. "台本修正" — 今回のこの台本に対する個別の修正指示
   （例:「冒頭のこの一文は削って」「この口コミは宝くじの事例に差し替え」）

【抽出のルール】
- contentは「そのまま実行できる指示文」に整形する（曖昧な感想は指示に翻訳。単なる感想・雑談は抽出しない）
- quoteには根拠となった発言部分を短く引用する（解釈が正しいか確認できるように）
- 同じ内容の重複は1つにまとめる
- 指示が1つも無ければ空配列でよい

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{
  "items": [
    { "type": "ツール修正|台本ルール|台本修正", "content": "整形した指示文", "quote": "元の発言の引用", "category": "台本ルールの場合のみ" }
  ]
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transcript, images, aiApiKey } = body as { transcript?: string; images?: string[]; aiApiKey: string };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!transcript?.trim() && (!images || images.length === 0)) {
      return NextResponse.json({ error: "文字起こしのスクショまたはテキストが必要です" }, { status: 400 });
    }

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";

    if (isAnthropic) {
      const content: ({ type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "text"; text: string })[] = [];
      for (const img of images || []) {
        const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
        const mediaType = img.match(/^data:(image\/\w+);/)?.[1] || "image/png";
        content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } });
      }
      content.push({ type: "text", text: `${PROMPT}${transcript?.trim() ? `\n\n【文字起こしテキスト】\n${transcript.slice(0, 20000)}` : ""}` });

      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 6000, messages: [{ role: "user", content }], ...anthropicExtraBody(aiModel) }),
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
      // OpenAI: 画像はdata URLのままcontentに渡す
      const content: ({ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string })[] = [];
      for (const img of images || []) content.push({ type: "image_url", image_url: { url: img } });
      content.push({ type: "text", text: `${PROMPT}${transcript?.trim() ? `\n\n【文字起こしテキスト】\n${transcript.slice(0, 20000)}` : ""}` });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content }], max_tokens: 6000 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      console.error("[extract-instructions] parse failed. raw head:", raw.slice(0, 300));
      return NextResponse.json({ error: `AI応答の解析に失敗しました（応答先頭: ${raw.slice(0, 120) || "空"}…）` }, { status: 500 });
    }
    return NextResponse.json({ items: parsed.items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "指示の抽出に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
