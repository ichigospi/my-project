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
      score?: { overall: number };
    };
  }, i: number) => `
【参考動画${i + 1}】「${a.videoTitle}」（${a.channelName}）再生数: ${a.views?.toLocaleString()}回
概要: ${a.analysisResult?.summary}
構成: ${a.analysisResult?.structure?.map((s) => `${s.name}(${s.timeRange})`).join(" → ")}
フック: ${a.analysisResult?.hooks?.join(" / ")}
CTA: ${a.analysisResult?.ctas?.join(" / ")}
伸び要因: ${a.analysisResult?.growthFactors?.join(" / ")}
訴求: ${a.analysisResult?.appealPoints?.join(" / ")}
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
    prompt = `あなたは占い・スピリチュアル系YouTubeの台本構成プロデューサーです。

以下の参考動画の分析を基に、「良いとこどり」の台本骨組みを提案してください。

【鉄則】
- 参考動画で実際に伸びている要素を軸にすること
- 各セクションで「どの参考動画のどの要素を取り入れたか」を必ず明記すること
- ヒーリング系の場合: 本編（ヒーリングパート）は3分以内に開始すること。冒頭のフック＋共感は1-2分で切り上げてすぐ本編に入る
- 教育系の場合: 冒頭2分以内に本題に入ること

【参考動画のトレース指針】
「外側のラベル(世界観)は自チャンネル / 中身の構造と訴求の強度は元ネタを忠実にトレース」する。

▶ 積極的にトレースする要素（構造・強度・密度を保つ）:
  - 全体の構成順序とパート分け
  - フックの型・話法・冒頭一文の構造
  - 損失回避フレーズの強度（「閉じると止まる」等の重ね方）
  - 理想の未来の描写（具体的金額・具体的シチュエーション・体感）
  - 最悪の未来の描写（具体的不安・痛点）
  - アファメーション/暗示の本数とリズム
  - 体感確認フレーズの入れ方
  - 完了宣言・受動保証の言い回し
  - CTAの誘導手順

▶ 必ず置き換える要素（自チャンネルに合わせる）:
  - ナレーターの名乗り（チャンネル名・自分の名前）
  - 世界観固有の用語（神格・象徴）
  - 一人称・二人称・敬称
  - 場所・神様の名称
  - キャラクター固有のエピソード・対話相手

避ける: 元ネタの訴求強度が抽象化・希薄化すること

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
