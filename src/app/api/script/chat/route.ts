import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai-call";
import { normalizeAiModel } from "@/lib/ai-model";

// 台本制作の壁打ちチャット。生成台本・骨組み・元台本(書き起こし)を文脈に持ち、
// 「ここ元台本ではどうだった？」「ヒーリングまでの文字数は？」等の質問に答える。
export const maxDuration = 300;

interface ChatMessage { role: "user" | "assistant"; content: string }

interface RefAnalysis {
  videoTitle?: string;
  channelName?: string;
  views?: number;
  transcript?: string;
  analysisResult?: { summary?: string; overallPattern?: string } | null;
}

// AIは文字数を正確に数えられないため、本文に《n字》マーカーを250字ごとに挿入して渡す。
// 250字≈音声1分が目安なので、位置・尺の質問にマーカー参照で正確に答えられる。
function annotateWithOffsets(text: string, interval = 250): string {
  if (!text) return "";
  const out: string[] = [];
  for (let i = 0; i < text.length; i += interval) {
    if (i > 0) out.push(`《ここまで約${i}字/約${Math.round((i / 250) * 10) / 10}分》`);
    out.push(text.slice(i, i + interval));
  }
  out.push(`《全体${text.length}字/約${Math.round((text.length / 250) * 10) / 10}分》`);
  return out.join("");
}

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTube台本の制作パートナーです。
台本制作者と1対1で壁打ちをします。与えられた資料（生成台本・骨組み・元ネタ台本の書き起こし・チャンネルルール）を正確に参照して答えてください。

【答え方】
- 質問に直接答える。前置き・質問の復唱は不要。簡潔に、ただし根拠（該当箇所の短い引用）を添える
- 文字数・位置・尺の質問には、本文に挿入された《ここまで約n字/約n分》マーカーを根拠に答える（250字≈音声1分）。マーカーの間は按分で概算し「約」を付ける
- 「元台本ではどうだったか」には、該当箇所を短く引用して、構造・言い回し・順番・分量を説明する
- 比較を求められたら「元台本」と「生成台本」を並べて違いを明確にする
- 資料に無いことは「資料からは分からない」と言い、推測する場合は推測と明示する
- 改善案を求められたら、チャンネルルール（下記）とトレース原則（同じ効果を持つ訴求・例えを別の言い方にする。別の話への差し替えはしない）に沿って具体案を出す
- マークダウンの見出しは使わず、短い段落と箇条書きで読みやすく`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, script, skeleton, title, style, rulesText, referenceAnalyses, aiApiKey } = body as {
      messages: ChatMessage[];
      script?: string;
      skeleton?: string;
      title?: string;
      style?: string;
      rulesText?: string;
      referenceAnalyses?: RefAnalysis[];
      aiApiKey: string;
    };
    const aiModel = normalizeAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "メッセージがありません" }, { status: 400 });
    }

    const refsText = (referenceAnalyses || [])
      .filter((a) => a.transcript || a.analysisResult)
      .map((a, i) => `■ 元台本${i + 1}「${a.videoTitle || "無題"}」（${a.channelName || ""} / ${a.views?.toLocaleString() || "?"}回再生）
${a.analysisResult?.overallPattern ? `構成パターン: ${a.analysisResult.overallPattern}` : ""}
--- 書き起こし全文（《》は位置マーカー） ---
${annotateWithOffsets(a.transcript || "")}`)
      .join("\n\n");

    const context = `【タイトル】${title || "（未設定）"}
【スタイル】${style === "healing" ? "ヒーリング系" : style === "tarot" ? "タロット系" : "教育系"}

【生成台本（現在の版。《》は位置マーカー）】
${script ? annotateWithOffsets(script) : "（まだ生成されていません）"}

【骨組み】
${skeleton || "（なし）"}

【元ネタ台本】
${refsText || "（元台本の書き起こしがありません）"}

【チャンネルルール（抜粋）】
${(rulesText || "（なし）").slice(0, 6000)}`;

    // 会話履歴を組み立て（最初のユーザーメッセージに資料を添付）
    const history = messages.slice(-12); // 直近12往復まで
    const anthropicMessages = history.map((m, i) => ({
      role: m.role,
      content: i === 0 && m.role === "user"
        ? `${context}\n\n=============\n【質問】\n${m.content}`
        : m.content,
    }));
    // 先頭がassistantの場合（切り詰めで先頭がズレた場合）はコンテキストを独立メッセージで先頭に足す
    if (anthropicMessages[0]?.role !== "user" || !anthropicMessages[0].content.startsWith("【タイトル】")) {
      anthropicMessages.unshift({ role: "user", content: `${context}\n\n（これが参照資料です。以降の質問にこの資料を使って答えてください）` });
      anthropicMessages.splice(1, 0, { role: "assistant", content: "資料を確認しました。質問をどうぞ。" });
    }

    const r = await callAi(aiApiKey, aiModel, "", { maxTokens: 4000, system: SYSTEM_PROMPT, messages: anthropicMessages as { role: "user" | "assistant"; content: string }[] });
    if (r.error) return NextResponse.json({ error: r.error, ...(r.retryable ? { retryable: true } : {}) }, { status: r.status || 500 });
    const text = r.text;

    if (!text.trim()) return NextResponse.json({ error: "応答が空でした。もう一度お試しください" }, { status: 502 });
    return NextResponse.json({ reply: text });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "チャットに失敗しました" }, { status: 500 });
  }
}
