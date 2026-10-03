import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 分析済みの元台本（同ジャンル・再生数上位）から、ジャンル固有の勝ち筋を抽出する。
// 結果は編集可能な「ジャンルナレッジ」として保存され、生成時に参考情報として注入される。
export const maxDuration = 300;

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTubeで収益を最大化してきたプロのダイレクトレスポンスマーケターです。
与えられた「同ジャンルの伸びている元台本」を横断分析し、このジャンル固有の勝ち筋を抽出してください。

【鉄則】
- 「どのジャンルの動画にも言える一般論」（例:「共感が大事」「冒頭で掴む」）は書かない。
  このジャンルの実例から読み取れる具体的な傾向・型・言い回しだけを書く
- 各項目は実例ベースで書き、可能なら（出典動画の短縮タイトル）を添える
- 文脈崩れを防ぐため、比喩は「候補リスト」として列挙する（使うのは1本につき1つだけ、という前提）
- 【世界観の中立化（必達）】元台本には様々なチャンネルの世界観（龍神・白蛇・神社・祝詞などの神道系／守護天使などの西洋スピ系 等）が混ざっている。
  特定の世界観に固有の存在・用語はそのまま書かず、訴求の「構造」として世界観中立な形に抽象化すること
  （例:「白蛇様の神氣を受け取ると金運が巡る」→「高次の存在からエネルギーを受け取ることで金運が巡る、という訴求の型」）。
  中立化できない世界観依存のネタは抽出しない。メタファー候補も中立な表現（扉・流れ・光 等）か、構造として書く

【出力形式（このマークダウンのみ。前置き・後書き禁止）】
## 刺さっている悩み・訴求（頻出順）
- …

## フックの型
- …

## CTA・口コミの型
- …

## 理想の未来の見せ方
- …

## 中心メタファー候補（1本につき1つだけ使う）
- 「◯◯」: どんなテーマのときに効くか1行

## 語彙・言い回しの傾向
- …`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { genre, analyses, aiApiKey } = body as {
      genre?: string;
      analyses?: { videoTitle?: string; views?: number; transcript?: string; analysisResult?: { summary?: string; overallPattern?: string; hooks?: string[]; ctas?: string[] } | null }[];
      aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!analyses || analyses.length === 0) return NextResponse.json({ error: "このジャンルの分析済み台本がありません" }, { status: 400 });

    const refText = analyses.slice(0, 10).map((a, i) => `■ 元台本${i + 1}「${a.videoTitle || "無題"}」（${a.views?.toLocaleString() || "?"}回再生）
パターン: ${a.analysisResult?.overallPattern || "不明"}
フック: ${a.analysisResult?.hooks?.join(" / ") || "不明"}
CTA: ${a.analysisResult?.ctas?.join(" / ") || "不明"}
${a.transcript ? `台本（抜粋）:\n${a.transcript.slice(0, 4000)}` : ""}`).join("\n\n");

    const userPrompt = `${SYSTEM_PROMPT}

【対象ジャンル】${genre || "不明"}

【同ジャンルの元台本（再生数上位）】
${refText}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 6000, messages: [{ role: "user", content: userPrompt }], ...anthropicExtraBody(aiModel) }),
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: userPrompt }], max_tokens: 6000 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const knowledge = raw.replace(/^```(?:markdown)?\s*|```\s*$/g, "").trim();
    if (!knowledge) return NextResponse.json({ error: "抽出結果が空でした" }, { status: 500 });
    return NextResponse.json({ knowledge });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ジャンルナレッジの抽出に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
