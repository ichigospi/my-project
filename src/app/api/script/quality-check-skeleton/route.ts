import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";

// 骨組み(構成)を構成ルール遵守・元台本ズレの観点で評価する。
// 出力は台本品質チェックと同じ QualityCheckResult 形（categories/overallScore/topPriority）で返し、
// フロントの信号機UIをそのまま再利用する。
export const maxDuration = 300;

interface RefAnalysis {
  videoTitle?: string;
  channelName?: string;
  views?: number;
  analysisResult?: {
    summary?: string;
    structure?: { name: string; timeRange: string; purpose: string }[];
    hooks?: string[];
    ctas?: string[];
    growthFactors?: string[];
    appealPoints?: string[];
    overallPattern?: string;
    idealFuture?: string;
    worstFuture?: string;
    retentionTactics?: string[];
    worldview?: string;
  } | null;
}

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTubeの台本構成を評価するプロの構成プロデューサーです。
与えられた「台本の骨組み（構成案）」を、台本ルール(構成ルール)と参考元動画の分析に照らして厳しく評価します。
最終ゴールは「この骨組みで台本を書けば、構成ルールを守りつつ元ネタの上位互換になるか」を判定すること。
必ず指定されたJSON形式のみで回答してください。JSON以外のテキスト（説明文・マークダウン・コードブロック記法）は一切出力しないでください。

【評価観点 / 4カテゴリ】

A. 構成ルール遵守
   下記【台本ルール】で定められた構成（例：【前半】オープニング→【中盤】→【終盤】の区切り、冒頭は選民フックから、カードを5枚順に引く、コメントCTAは1回のみ、等）を骨組みが守れているか。
   - ルールで必須の構成パートが欠けている → fail
   - 順番や役割がルールとズレている → warn
   - 守れている → pass

B. 元台本からのズレ
   参考元動画の構成（順番・役割・尺配分）と訴求要素を骨組みがトレースできているか。元ネタから乖離していないか、勝手に組み替えていないか。上位互換（各要素を一段具体化）になっているか。
   - 元ネタの主要構成・訴求から大きく乖離 → fail
   - 一部の要素が抜け/弱い → warn
   - トレース＋上位互換できている → pass

C. 必須要素の有無
   チャンネル固有の必須要素（無料鑑定/LINE誘導の導線、放置リスクの警告、選民フック冒頭、コメントCTAは序盤1回 等、ルールで要求された要素）が骨組みに専用セクションとして組み込まれているか。
   - 必須要素が欠落 → fail / 弱い → warn / 揃っている → pass

D. 尺・文字数配分の妥当性
   各セクションの尺・文字数配分が目標（目安6,500〜7,500文字 / 推定尺）に対して妥当か。前半が長すぎて本編が遅れる、終盤CTAが薄い等の偏りがないか。
   - 大きな偏り → fail / やや偏り → warn / 妥当 → pass

【出力JSON形式（厳守）】
{
  "overallScore": 0〜10の数値,
  "topPriority": "最優先で直すべき骨組みの問題点を1〜2文で。無ければ『大きな問題なし』",
  "categories": [
    {
      "name": "A. 構成ルール遵守",
      "passed": true/false,
      "items": [
        { "name": "短い項目名", "status": "pass|warn|fail", "comment": "具体的な指摘", "suggestion": "骨組みのどこをどう直すか（pass時は空文字でよい）" }
      ]
    }
  ]
}
各カテゴリ(A〜D)を必ず1つずつ含めること。`;

function buildReferenceText(refs: RefAnalysis[]): string {
  if (!refs || refs.length === 0) return "（参考元なし。元台本ズレの評価はスキップし、構成ルール遵守を中心に評価）";
  return refs.map((a, i) => {
    const r = a.analysisResult;
    return `■ 参考元${i + 1}「${a.videoTitle || "無題"}」(${a.channelName || ""} / ${a.views?.toLocaleString() || "?"}回)
・構成: ${r?.structure?.map((s) => `${s.name}(${s.timeRange})→${s.purpose || ""}`).join(" / ") || "不明"}
・理想の未来: ${r?.idealFuture || r?.appealPoints?.join(" / ") || "不明"}
・最悪の未来: ${r?.worstFuture || "不明"}
・フック: ${r?.hooks?.join(" / ") || "不明"}
・CTA: ${r?.ctas?.join(" / ") || "不明"}
・視聴維持: ${r?.retentionTactics?.join(" / ") || "不明"}
・伸び要因: ${r?.growthFactors?.join(" / ") || "不明"}
・パターン: ${r?.overallPattern || "不明"}`;
  }).join("\n\n");
}

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
    const { skeleton, referenceAnalyses, rulesText, style, aiApiKey } = body as {
      skeleton: string;
      referenceAnalyses?: RefAnalysis[];
      rulesText?: string;
      style?: string;
      aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!skeleton?.trim()) return NextResponse.json({ error: "骨組みがありません" }, { status: 400 });

    const styleLabel = style === "healing" ? "ヒーリング系" : style === "tarot" ? "タロット系（リーディング進行型）" : "教育系";

    const userPrompt = `${SYSTEM_PROMPT}

【スタイル】${styleLabel}

【台本ルール（この構成を守れているか＝観点A・Cの基準）】
${rulesText || "（ルール指定なし。一般的な構成の妥当性で評価）"}

【参考元動画の分析（この構成・訴求からズレていないか＝観点Bの基準）】
${buildReferenceText(referenceAnalyses || [])}

【評価対象：台本の骨組み（構成案）】
${skeleton}`;

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
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res!.status }); }
      raw = ((await res!.json()).content || []).filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text || "").join("");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: userPrompt }], max_tokens: 8000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      raw = (await res.json()).choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "骨組みの品質チェックに失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
