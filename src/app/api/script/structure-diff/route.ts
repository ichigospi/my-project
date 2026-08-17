import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 主軸元ネタの構成が「いつものテンプレ構成」と大きく乖離しているかを判定する軽量チェック。
// 乖離が大きい場合、骨組みページでユーザーに「元ネタ準拠で作るか」をポップアップで確認する。
export const maxDuration = 60;

const SYSTEM_PROMPT = `あなたはYouTube台本の構成を比較するプロの構成プロデューサーです。
「いつものテンプレ構成（カテゴリ別ルール）」と「元ネタ動画の実際の構成」を比較し、
テンプレのまま作ると元ネタの構成トレースが大きく崩れるかどうかを判定してください。

判定基準:
- divergent=true: 進行の型が根本的に違う場合のみ。
  （例: セクションの流れ・順番が全く別物／テンプレはカードを5枚順に引く型だが元ネタはカードを引かない／
  テンプレはヒーリング1本型だが元ネタは解説メイン＋短いワーク型、等）
- divergent=false: 細部の違い（セクション名の言い回し、尺配分の多少のズレ、要素の追加1〜2個）しかない場合。
  迷ったら false にする（テンプレで問題なく作れるなら false）

必ず次のJSONのみで回答すること（説明文・コードブロック記法は禁止）:
{
  "divergent": true/false,
  "differences": ["違いの要点を短く（最大4個）", "..."],
  "summary": "1〜2文の結論（どちらで作るのがおすすめかも一言）"
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
    const { mainAnalysis, categoryRules, style, aiApiKey } = body as {
      mainAnalysis?: {
        videoTitle?: string;
        analysisResult?: {
          structure?: { name: string; timeRange: string; purpose: string }[];
          overallPattern?: string;
          summary?: string;
        } | null;
      };
      categoryRules?: string;
      style?: string;
      aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    const r = mainAnalysis?.analysisResult;
    if (!r?.structure?.length && !r?.overallPattern) {
      // 比較材料が無ければ「乖離なし」として従来動作に落とす
      return NextResponse.json({ divergent: false, differences: [], summary: "元ネタの構成分析が無いため比較をスキップ" });
    }

    const userPrompt = `${SYSTEM_PROMPT}

【スタイル】${style === "healing" ? "ヒーリング系" : style === "tarot" ? "タロット系" : "教育系"}

【いつものテンプレ構成（カテゴリ別ルール）】
${(categoryRules || "").slice(0, 6000) || "（指定なし）"}

【主軸元ネタの実際の構成】「${mainAnalysis?.videoTitle || "無題"}」
構成: ${r?.structure?.map((s, i) => `${i + 1}. ${s.name}（${s.timeRange}）— ${s.purpose || ""}`).join(" / ") || "不明"}
パターン: ${r?.overallPattern || "不明"}
概要: ${r?.summary || "不明"}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";

    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 1200, messages: [{ role: "user", content: userPrompt }], ...anthropicExtraBody(aiModel) }),
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: userPrompt }], max_tokens: 1200, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    return NextResponse.json({
      divergent: !!parsed.divergent,
      differences: Array.isArray(parsed.differences) ? parsed.differences.slice(0, 4) : [],
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "構成差分チェックに失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
