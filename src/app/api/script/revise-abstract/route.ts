import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// タロットの抽象ロジックをAIと壁打ちしながら修正するルート。
// カード（名前・正逆・正統な意味）は固定のまま、伝えること・流れ・テーマ等を指示に沿って調整する。
// 相談だけ（修正不要）の場合は abstractLogic を変えずに回答だけ返す。
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { abstractLogic, instruction, history, topic, analyses, aiApiKey } = body as {
      abstractLogic?: string;
      instruction?: string;
      history?: { role: "user" | "ai"; text: string }[];
      topic?: string;
      analyses?: {
        videoTitle?: string;
        views?: number;
        role?: "main" | "sub";
        transcript?: string;
        analysisResult?: { summary?: string; overallPattern?: string; hooks?: string[]; ctas?: string[]; appealPoints?: string[] } | null;
      }[];
      aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!abstractLogic?.trim()) return NextResponse.json({ error: "抽象ロジックがありません" }, { status: 400 });
    if (!instruction?.trim()) return NextResponse.json({ error: "指示を入力してください" }, { status: 400 });

    const historyText = (history || []).slice(-8).map((h) => `${h.role === "user" ? "ユーザー" : "AI"}: ${h.text}`).join("\n");

    // 元台本（参考動画）: 訴求・言い回しの出典として参照できるようにプロンプトへ同梱する
    const refText = (analyses || []).slice(0, 4).map((a, i) => {
      const roleLabel = a.role === "main" ? "【★メイン】" : a.role === "sub" ? "【サブ】" : "";
      const r = a.analysisResult;
      return `■ 元台本${i + 1}${roleLabel}「${a.videoTitle || "無題"}」（${a.views?.toLocaleString() || "?"}回再生）
パターン: ${r?.overallPattern || "不明"}
フック: ${r?.hooks?.join(" / ") || "不明"}
CTA: ${r?.ctas?.join(" / ") || "不明"}
訴求ポイント: ${r?.appealPoints?.join(" / ") || "不明"}
${a.transcript ? `台本（抜粋）:\n${a.transcript.slice(0, 5000)}` : ""}`;
    }).join("\n\n");

    const prompt = `あなたはプロのスピーチマーケター兼YouTube台本構成プロデューサーです。
タロット台本の【抽象ロジック】（カードリーディング設計）について、ユーザーと壁打ちしながら修正します。

【テーマ】${topic || "不明"}

【現在の抽象ロジック】
${abstractLogic}
${refText ? `\n【元台本（参考動画の分析と本文。訴求・言い回しの出典として参照する）】\n${refText}\n` : ""}${historyText ? `\n【これまでの壁打ち履歴】\n${historyText}\n` : ""}
【ユーザーの指示・相談】
${instruction}

【修正のルール（必達）】
- カード（枚数・順番・カード名・正位置/逆位置）は絶対に変更しない（サーバー抽選で確定済み）
- 各カードの「正統な意味」の行は一字一句変更しない（辞書からの転記のため）。「伝えること」「流れ」はその正統な意味の範囲内で調整する
- 冒頭の「メインテーマと主張」「中心メタファー」「一本線」と各カードの項目構成など、現在の形式・構造をそのまま維持する
- 中心メタファーは1つだけ。指示があって変える場合も、全体を新しいメタファー1本で統一する
- 「気づきを与えてファン化」等の汎用マーケ語だけの記述にしない
- 訴求・ロジックを変更・追加する場合は、上記【元台本】にあるものから選び、出典表記（元ネタ◯の△△より）を付ける。元台本に無い新規の訴求を発明しない
- 「元台本ではどう言ってる？」「元ネタのこの訴求は使える？」等の質問には、元台本の該当箇所を引用しながら答える
- 指示に関係ない箇所は変更しない
- 修正が不要な相談・質問の場合は、abstractLogic を現在のものと同一のまま返し、reply で回答する

【出力形式（このJSONのみ。前置き・後書き・コードブロック禁止）】
{"reply": "何をどう変えたか、または相談への回答（簡潔に。元台本からの引用を含む場合も5文程度まで。ユーザーへの返事として書く）", "abstractLogic": "修正後の抽象ロジック全文"}`;

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
          if (attempt === 2) return NextResponse.json({ error: "AIが混み合っています。少し待ってもう一度お試しください", retryable: true }, { status: res.status });
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
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 8000 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const cleaned = raw.replace(/^```(?:json)?\s*|```\s*$/g, "").trim();
    try {
      const parsed = JSON.parse(cleaned) as { reply?: string; abstractLogic?: string };
      if (!parsed.abstractLogic?.trim()) throw new Error("empty");
      return NextResponse.json({ reply: parsed.reply || "修正しました。", abstractLogic: parsed.abstractLogic.trim() });
    } catch {
      // JSON解析に失敗した場合: 全文が抽象ロジックらしければそれを採用、そうでなければエラー
      if (cleaned.includes("枚目") && cleaned.includes("伝えること")) {
        return NextResponse.json({ reply: "修正しました。", abstractLogic: cleaned });
      }
      return NextResponse.json({ error: `AI応答の解析に失敗しました: ${cleaned.slice(0, 120)}` }, { status: 500 });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "抽象ロジックの修正に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
