import { NextRequest, NextResponse } from "next/server";

interface InputAnalysis {
  videoTitle?: string;
  channelName?: string;
  views?: number;
  transcript?: string;
  analysisResult?: unknown;
  score?: { overall?: number };
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTubeの台本分析の専門家です。
複数の台本データを総合的に分析し、ユーザーの質問・追加質問・修正指示に対して洞察に富んだ実用的な回答をしてください。

【重要】
- 推測ではなく、与えられたデータから読み取れることを根拠に答える
- 該当する具体例（タイトル名・該当箇所）を引用して説明する
- 抽象論で終わらず、自分のチャンネルに活かせる具体的アクションまで踏み込む
- マークダウン記法（見出し・箇条書き）で構造化する
- 必要十分な長さで（端折らずに、ただし冗長は避ける）
- 追加質問・修正指示があれば、これまでの会話を踏まえて回答を更新する`;

function buildAnalysesContext(analyses: InputAnalysis[]): string {
  const lines: string[] = [];
  lines.push(`【分析対象の競合台本データ（${analyses.length}本）】`);
  lines.push("");
  analyses.forEach((a, i) => {
    lines.push(`---【台本${i + 1}】---`);
    lines.push(`タイトル: ${a.videoTitle || "(不明)"}`);
    lines.push(`チャンネル: ${a.channelName || "(不明)"}`);
    lines.push(`再生数: ${a.views ? a.views.toLocaleString() + "回" : "不明"}`);
    if (a.score?.overall != null) lines.push(`スコア: ${a.score.overall}/10`);
    if (a.analysisResult) {
      try {
        const ar = a.analysisResult as Record<string, unknown>;
        const summary = (ar.summary as string) || "";
        const overallPattern = (ar.overallPattern as string) || "";
        const hooks = (ar.hooks as string[]) || [];
        const ctas = (ar.ctas as string[]) || [];
        const appealPoints = (ar.appealPoints as string[]) || [];
        const growthFactors = (ar.growthFactors as string[]) || [];
        if (summary) lines.push(`概要: ${summary}`);
        if (overallPattern) lines.push(`構成パターン: ${overallPattern}`);
        if (hooks.length) lines.push(`フック: ${hooks.join(" / ")}`);
        if (ctas.length) lines.push(`CTA: ${ctas.join(" / ")}`);
        if (appealPoints.length) lines.push(`訴求: ${appealPoints.join(" / ")}`);
        if (growthFactors.length) lines.push(`伸びた要因: ${growthFactors.join(" / ")}`);
      } catch {
        // ignore
      }
    }
    if (a.transcript) {
      lines.push(`台本本文(冒頭2000字):`);
      lines.push(a.transcript.substring(0, 2000));
    }
    lines.push("");
  });
  return lines.join("\n");
}

async function callAnthropic(aiApiKey: string, messages: ChatMessage[]): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": aiApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    if (res.status === 429 || res.status === 529) {
      if (attempt === 2) throw new Error("AIが混雑しています。少し時間をおいて再実行してください");
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error (${res.status})`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || "";
  }
  throw new Error("リトライ上限");
}

async function callOpenAI(aiApiKey: string, messages: ChatMessage[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${aiApiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages,
      ],
      max_tokens: 16000,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error (${res.status})`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      analyses,           // 初回のみ（任意）: 分析対象データ
      messages,           // 会話履歴 (最後のメッセージは新規ユーザー発言)
      aiApiKey,
    } = body as {
      analyses?: InputAnalysis[];
      messages: ChatMessage[];
      aiApiKey: string;
    };

    if (!aiApiKey) {
      return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "質問内容がありません" }, { status: 400 });
    }
    const last = messages[messages.length - 1];
    if (last.role !== "user" || !last.content?.trim()) {
      return NextResponse.json({ error: "最後のメッセージはユーザー発言である必要があります" }, { status: 400 });
    }

    // 初回呼び出しで analyses が来ていれば、最初の user メッセージに分析データを前置
    let processed: ChatMessage[];
    if (Array.isArray(analyses) && analyses.length > 0 && messages.length === 1) {
      const ctx = buildAnalysesContext(analyses);
      processed = [
        { role: "user", content: `${ctx}\n\n【ユーザーの質問】\n${messages[0].content}` },
      ];
    } else {
      processed = messages;
    }

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    const result = isAnthropic
      ? await callAnthropic(aiApiKey, processed)
      : await callOpenAI(aiApiKey, processed);

    // クライアントには「分析データ前置済みの最初の user メッセージ」を含む
    // 次の発言時にこの processed をそのまま使えば再構築不要
    return NextResponse.json({
      result,
      messages: [...processed, { role: "assistant", content: result }],
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI分析に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
