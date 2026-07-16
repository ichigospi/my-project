import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 分割出力の1パート(部分台本)を、パート向けの観点で軽量評価する。
// 全体前提の「文字数5000」「終盤CTAの有無」では誤減点しないよう、part k/N を伝える。
// 出力は QualityCheckResult 形（categories/overallScore/topPriority）でフロントUIを再利用。
export const maxDuration = 300;

interface RefAnalysis {
  videoTitle?: string;
  analysisResult?: {
    structure?: { name: string; timeRange: string; purpose: string }[];
    hooks?: string[];
    ctas?: string[];
    idealFuture?: string;
    worstFuture?: string;
    retentionTactics?: string[];
    overallPattern?: string;
  } | null;
  transcript?: string;
}

function buildReferenceText(refs: RefAnalysis[]): string {
  if (!refs || refs.length === 0) return "（参考元なし。元台本ズレの評価はスキップ）";
  return refs.map((a, i) => `■ 参考元${i + 1}「${a.videoTitle || "無題"}」
・構成: ${a.analysisResult?.structure?.map((s) => `${s.name}(${s.timeRange})`).join(" / ") || "不明"}
・訴求: 理想=${a.analysisResult?.idealFuture || "?"} / 最悪=${a.analysisResult?.worstFuture || "?"}
・フック: ${a.analysisResult?.hooks?.join(" / ") || "?"} / CTA: ${a.analysisResult?.ctas?.join(" / ") || "?"}`).join("\n");
}

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
    const { segmentScript, partIndex, partTotal, previousScript, referenceAnalyses, rulesText, style, aiApiKey } = body as {
      segmentScript: string;
      partIndex: number;
      partTotal: number;
      previousScript?: string;
      referenceAnalyses?: RefAnalysis[];
      rulesText?: string;
      style?: string;
      aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!segmentScript?.trim()) return NextResponse.json({ error: "パートの台本がありません" }, { status: 400 });

    const isFirst = partIndex === 0;
    const isLast = partIndex === partTotal - 1;
    const styleLabel = style === "healing" ? "ヒーリング系" : style === "tarot" ? "タロット系" : "教育系";

    const prompt = `あなたは占い・スピリチュアル系YouTube台本を評価するプロのマーケターです。
これは台本を全${partTotal}分割で出力した、その第${partIndex + 1}回目（${partIndex + 1}/${partTotal}）のパートです。
**重要：これは台本の一部分（パート）なので、台本全体に求められる「総文字数」「冒頭から終盤まで揃っているか」では評価しないこと。** このパートが担う役割の範囲内で評価してください。
${isFirst ? "・このパートは冒頭部です。選民フック（おめでとう/選ばれた）から始まっているかを見る。" : "・このパートは続きの部分です。前パートからの繋ぎが自然か、冒頭挨拶・自己紹介・選民フックを不要に再導入していないかを見る。終盤でなければ無理にクロージングしていなくてよい。"}
${isLast ? "・このパートは最終部です。終盤クロージング・無料鑑定への重CTA・締めまで書けているかを見る。" : "・このパートは途中の部分です。ここでクロージングや締めの挨拶を書いていたら逆にNG（最終パートで書くべき）。"}

必ず指定のJSON形式のみで回答してください（説明文・マークダウン・コードブロック記法は出力しない）。

【評価観点 / 4カテゴリ】
A. 構成ルール遵守 … 下記【台本ルール】の構成・口調・書式・CTAルールに沿っているか（このパートの範囲で）。予祝コメントの例文があれば「叶いました/受け取りました」型の完了形か（願望形「〜しますように/〜したい」は予祝にならないためfail）。
B. 元台本からのズレ … 参考元の該当範囲の構成・訴求・具体性を継承し上位互換になっているか。ヒーリングパートがあれば誘導の流れ・情景展開が元ネタをトレースしているか。フレーズ単位のパクリ（金額・比喩・疑問形の中身・体験談セリフのコピー）が無いか。タイトルの具体テーマ（宝くじ等）にこのパートの内容・口コミ・事例が紐づいているか（金運一般等に薄まっていないか／別テーマの事例が混ざっていないか）。
C. 表現品質 … 不自然な日本語・奇妙な体感表現（「お腹が締め付けられる」等）・共感を得にくい訴求・語尾の単調な連続・冗長な水増しが無いか。同じ単語・フレーズを短い間隔で2〜3回連呼していないか（ヒーリングパートも対象。語尾の繰り返しは許容だが単語の連呼はNG）。
D. 繋ぎ・整合性 … 前パートからの繋ぎが自然で、内容の重複・自己紹介の再導入・内部矛盾が無いか。

各観点で問題が重大なら fail、軽微なら warn、問題なければ pass。

【出力JSON形式（厳守）】
{
  "overallScore": 0〜10の数値,
  "topPriority": "このパートで最優先に直すべき点を1〜2文で。無ければ『大きな問題なし』",
  "categories": [
    { "name": "A. 構成ルール遵守", "passed": true/false, "items": [ { "name": "短い項目名", "status": "pass|warn|fail", "comment": "具体的指摘", "suggestion": "どう直すか（pass時は空文字）" } ] }
  ]
}
A〜Dの4カテゴリを必ず含めること。

【スタイル】${styleLabel}

【台本ルール（観点A・Cの基準）】
${rulesText || "（指定なし）"}

【参考元分析（観点Bの基準）】
${buildReferenceText(referenceAnalyses || [])}
${previousScript ? `\n【前パートまでの台本（観点Dの繋ぎ評価用。重複・再導入が無いか確認）】\n${previousScript.slice(-1500)}` : ""}

【評価対象：第${partIndex + 1}パートの台本】
${segmentScript}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";

    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 8000, messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(aiModel) }),
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 8000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "パートの品質チェックに失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
