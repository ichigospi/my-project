import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 元ネタ台本・骨組みを読み取り、今後の台本作成に再利用できる「勝ちパターン」を
// プロマーケター視点（売上最大化）で提案する。
// 提案はライターが編集して添削部屋へ送り、オーナーが確認してルール化する。
export const maxDuration = 300;

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTubeで収益を最大化してきたプロのダイレクトレスポンスマーケターです。
与えられた元ネタ台本（競合の伸びている動画）と骨組みを分析し、このチャンネルが今後の台本で再利用できる
「パターン」を提案してください。

【提案してほしいパターンの種類】
- フック: 冒頭で掴む新パターン
- CTA: 成約に繋がるCTAの新パターン
- 視聴維持: 最後まで見る理由づけの新パターン
- 売上アドバイス: 売上に直結しそうな改善アドバイス
- 理想の未来: 欲求喚起に効く理想の未来の見せ方・事例パターン
- 悩み深掘り: 悩みの深掘り・共感の事例パターン
- 常識破壊: 仮想敵批判・常識破壊のパターン
- 構成: リーディング/台本の構成パターン

【提案の基準（重要）】
- 「売上最大化」の観点で効果があると judged できるものだけを提案する（面白いだけ・雑学的なものは不要）
- 既存ルール（与えられた場合）と重複する内容は提案しない。新しい気づきだけ
- contentは「そのまま台本ルールとして注入できる」具体的な指示文で書く（抽象論禁止。例・型・言い回しの雛形を含める）
- reasonは「なぜ売上に効くのか」を心理学・マーケティングの原理で1〜2文で説明
- 提案は質重視で3〜7個。無理に数を出さない

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{
  "suggestions": [
    { "category": "フック|CTA|視聴維持|売上アドバイス|理想の未来|悩み深掘り|常識破壊|構成|その他",
      "title": "短いパターン名",
      "content": "ルールとしてそのまま使える具体的な指示文（例・雛形入り）",
      "reason": "売上に効く理由（1〜2文）" }
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
    const { analyses, skeleton, style, genre, rulesText, aiApiKey } = body as {
      analyses?: { videoTitle?: string; views?: number; transcript?: string; analysisResult?: { summary?: string; overallPattern?: string } | null }[];
      skeleton?: string;
      style?: string;
      genre?: string;
      rulesText?: string;
      aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });

    const refText = (analyses || [])
      .slice(0, 3)
      .map((a, i) => `■ 元ネタ${i + 1}「${a.videoTitle || "無題"}」（${a.views?.toLocaleString() || "?"}回再生）
パターン: ${a.analysisResult?.overallPattern || "不明"}
概要: ${a.analysisResult?.summary || "不明"}
${a.transcript ? `台本（抜粋）:\n${a.transcript.slice(0, 6000)}` : ""}`)
      .join("\n\n");

    const userPrompt = `${SYSTEM_PROMPT}

【スタイル/ジャンル】${style || "不明"} / ${genre || "不明"}

【既存ルール（これと重複する提案はしない）】
${(rulesText || "").slice(0, 5000) || "（なし）"}

【現在の骨組み】
${(skeleton || "").slice(0, 3000) || "（未生成）"}

【元ネタ台本の分析】
${refText || "（元ネタなし）"}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 4000, messages: [{ role: "user", content: userPrompt }], ...anthropicExtraBody(aiModel) }),
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: userPrompt }], max_tokens: 4000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed || !Array.isArray(parsed.suggestions)) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    return NextResponse.json({ suggestions: parsed.suggestions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "追加ルール提案に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
