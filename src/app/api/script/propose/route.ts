import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { analyses, style, topic, channelProfile, aiApiKey, userPrompt, currentSkeleton, rulesText } = body;

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const analysisTexts = analyses.map((a: {
    videoTitle: string; channelName: string; views: number;
    analysisResult: {
      summary: string;
      structure: { name: string; timeRange: string; purpose: string }[];
      hooks: string[]; ctas: string[]; growthFactors: string[];
      appealPoints: string[]; overallPattern: string;
      idealFuture?: string; worstFuture?: string;
      retentionTactics?: string[]; worldview?: string;
      score?: { overall: number };
    };
  }, i: number) => `
【参考動画${i + 1}】「${a.videoTitle}」（${a.channelName}）再生数: ${a.views?.toLocaleString()}回
概要: ${a.analysisResult?.summary}
構成（★この順番・役割・尺配分を完全トレースする）:
${a.analysisResult?.structure?.map((s, idx) => `  ${idx + 1}. ${s.name}（${s.timeRange}）— 役割: ${s.purpose || "不明"}`).join("\n") || "  不明"}
フック: ${a.analysisResult?.hooks?.join(" / ")}
理想の未来(欲求喚起): ${a.analysisResult?.idealFuture || a.analysisResult?.appealPoints?.join(" / ") || "不明"}
最悪の未来: ${a.analysisResult?.worstFuture || "不明"}
CTA: ${a.analysisResult?.ctas?.join(" / ")}
視聴維持の仕掛け(離脱防止): ${a.analysisResult?.retentionTactics?.join(" / ") || "不明"}
世界観の演出: ${a.analysisResult?.worldview || "不明"}
伸び要因: ${a.analysisResult?.growthFactors?.join(" / ")}
パターン: ${a.analysisResult?.overallPattern}
スコア: ${a.analysisResult?.score?.overall || "不明"}/10
`).join("\n");

  const profileText = channelProfile?.channelName ? `
自チャンネル: ${channelProfile.channelName}
コンセプト: ${channelProfile.concept || "未設定"}
口調: ${channelProfile.tone || "未設定"}
` : `
自チャンネル: (未設定)
※自チャンネル名が未設定のため、ナレーターの名乗り・自己紹介は入れず、二人称（あなた）視点で進行してください。
`;

  // 修正依頼モード（既存の骨組み+ユーザー指示がある場合）
  const isRevision = !!(currentSkeleton && userPrompt);

  let prompt: string;
  if (isRevision) {
    prompt = `あなたは占い・スピリチュアル系YouTubeの台本構成プロデューサーです。

以下の台本骨組みに対するユーザーからの修正依頼を反映してください。

【現在の骨組み】
${currentSkeleton}

【参考動画の分析】
${analysisTexts}
${profileText}

${rulesText || ""}

【ユーザーの修正依頼】
${userPrompt}

修正後の骨組み全体をマークダウン形式で出力してください。修正点以外はできるだけ維持してください。`;
  } else {
    prompt = `あなたはプロのスピーチマーケター兼YouTube台本構成プロデューサーです。

以下の参考動画の分析を基に、元ネタを超える「上位互換」の台本骨組みを設計してください。
これは元ネタの設計図をそのまま使い、中身の訴求だけを一段強くするための骨組みです。

【鉄則】
- 構成は元ネタを完全にトレースする: セクションの順番・役割・尺配分をそのまま踏襲し、勝手に組み替えない
- 参考動画が複数ある場合は、最も伸びている動画の構成を主軸とし、他は訴求要素の補強に使う
- 各セクションで「どの参考動画のどの要素を取り入れたか」を必ず明記すること
- 各セクションに、元ネタの5要素（理想の未来／最悪の未来／CTA／視聴維持の仕掛け／世界観の演出）のうち該当するものを「元ネタはこう → 上位互換ではこう一段具体的にする」の形で明記すること
- オリジナリティを出しすぎて参考動画から乖離しないこと
- ヒーリング系の場合: 本編（ヒーリングパート）は3分以内に開始すること。冒頭のフック＋共感は1-2分で切り上げてすぐ本編に入る
- 教育系の場合: 冒頭2分以内に本題に入ること

【自チャンネル persona の取り扱い】
- 参考動画のナレーターの名乗り（「私はアリサ」「私はエリサ」など）は**絶対にコピーしない**こと
- 自チャンネル名・人物名が指定されている場合のみその名乗りを使用する
- 未指定の場合は名乗りを入れず、「あなた」視点の語りで構成すること
- 参考動画固有のキャラクター・ストーリー（特定の人物との対話など）は採用要素から除外する

${analysisTexts}
${profileText}
スタイル: ${style === "healing" ? "ヒーリング系" : "教育系"}
テーマ: ${topic}
${rulesText || ""}
${userPrompt ? `\n【追加指示】\n${userPrompt}` : ""}

以下のマークダウン形式で出力してください。

---

# 台本骨組み
推定尺: ○○分 | 目標文字数: ○○○○文字

## ❶ セクション名（0:00-0:50）
このセクションで伝える内容の説明（2-3文）

> 📺 参考元: 「参考動画タイトル」の○○を採用
> 💡 この要素が有効な理由の解説
> ⬆️ 上位互換ポイント: 元ネタの「○○」を、より具体的な□□に強化する（該当する5要素がある場合のみ）

## ❷ セクション名（0:50-2:00）
...（同じ形式で全セクション）

---

# 🎯 訴求設計まとめ

**訴求の組み合わせ:**
- 参考動画Aの「○○訴求」× 参考動画Bの「○○訴求」

**採用フック:**
- フック内容（どの動画から採用したか）

**採用CTA:**
- CTA内容（どの動画から採用したか）

---`;
  }

  try {
    let text = "";

    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json(); return NextResponse.json({ error: e.error?.message }, { status: res!.status }); }
      text = (await res!.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 4096 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ skeleton: text });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "構成提案に失敗" }, { status: 500 });
  }
}
