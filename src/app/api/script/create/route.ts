import { NextRequest, NextResponse } from "next/server";

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
    targetEmotion?: string;
    overallPattern?: string;
    idealFuture?: string;
    worstFuture?: string;
    retentionTactics?: string[];
    worldview?: string;
  } | null;
}

// 元ネタ分析を「超えるべき基準値」としてプロンプトに整形する
function buildReferenceText(referenceAnalyses: RefAnalysis[]): string {
  if (!referenceAnalyses || referenceAnalyses.length === 0) return "";

  const blocks = referenceAnalyses.map((a, i) => {
    const r = a.analysisResult;
    if (!r) return "";
    return `■ 元ネタ${i + 1}「${a.videoTitle || "無題"}」（${a.channelName || "不明"} / 再生数: ${a.views?.toLocaleString() || "不明"}回）
・構成: ${r.structure?.map((s) => `${s.name}(${s.timeRange})`).join(" → ") || "不明"}
・理想の未来（欲求喚起）: ${r.idealFuture || r.appealPoints?.join(" / ") || "不明"}
・最悪の未来: ${r.worstFuture || "不明"}
・CTA: ${r.ctas?.join(" / ") || "不明"}
・視聴維持の仕掛け（離脱防止）: ${r.retentionTactics?.join(" / ") || r.hooks?.join(" / ") || "不明"}
・世界観の演出: ${r.worldview || "不明"}
・伸びた要因: ${r.growthFactors?.join(" / ") || "不明"}`;
  }).filter(Boolean);

  if (blocks.length === 0) return "";

  return `
【元ネタ分析（＝あなたが超えるべき基準値）】
${blocks.join("\n\n")}
`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { proposal, channelProfile, style, topic, additionalNotes, aiApiKey, rulesText, referenceAnalyses } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  // 骨組みテキスト（マークダウン形式のconceptに入っている）
  const skeletonText = proposal?.concept || "";

  const referenceText = buildReferenceText(referenceAnalyses);

  const profileText = channelProfile ? `
【自チャンネル設計】
チャンネル名: ${channelProfile.channelName || "未設定"}
コンセプト: ${channelProfile.concept || "未設定"}
口調・話し方: ${channelProfile.tone || "未設定"}
ターゲット層: ${channelProfile.target || "未設定"}
得意ジャンル: ${channelProfile.genres?.join(", ") || "未設定"}
スタイル: ${channelProfile.mainStyle === "healing" ? "ヒーリング系メイン" : channelProfile.mainStyle === "education" ? "教育系メイン" : "両方"}
特徴・こだわり: ${channelProfile.characteristics || "未設定"}
` : "";

  const prompt = `あなたはプロのスピーチマーケター兼YouTube台本ライターです。
あなたの仕事は、元ネタの台本を分析した上で、それを確実に超える「上位互換」の台本を書くことです。

【最重要ミッション：元ネタの上位互換を作る】
以下の3原則を必ず満たしてください。

原則1. 元ネタの構成を完全にトレースする
- 元ネタ分析の構成（セクションの順番・役割・尺配分）をそのまま踏襲する
- 「良い構成だから真似る」のであり、勝手に構成を組み替えたり省略したりしない
- 骨組みは元ネタ構成を反映済みなので、骨組みのセクション順を厳守する

原則2. 元ネタの5要素を、より具体的・よりターゲットに刺さる内容に上書きする
元ネタ分析に書かれた以下5要素は「超えるべき基準値」です。同等以下は失格。各要素で元ネタより一段具体的にすること。
  (1) 理想の未来（欲求喚起）… 元ネタより具体的な数字・固有のシチュエーション・五感描写で、視聴者の欲求を強く喚起する
  (2) 最悪の未来 … 元ネタより具体的に「放置するとどうなるか」を描き、回避欲求を刺激する
  (3) CTA … 元ネタより自然かつ行動の理由が明確で、視聴者が動きたくなる導線にする
  (4) 視聴維持率の確保（離脱防止）… 元ネタの仕掛けに加え、各セクション冒頭で続きを見たくなる予告・問いかけ・感情の起伏を入れる
  (5) 世界観の演出 … 元ネタより没入感のある語り口・比喩・独自用語で、チャンネルの世界観を一貫させる
※ただし元ネタ固有の固有名詞・キャラクター・エピソードはコピーせず、自チャンネル向けに具体性のレベルだけを引き継ぐこと。

原則3. マーケティング上、無駄な文章を1文も入れない
- どの一文も「欲求喚起・離脱防止・信頼構築・行動喚起」のいずれかの役割を持つこと
- 役割のない前置き・繰り返し・冗長な言い回し・当たり障りのない一般論は書かない
- 文字数を埋めるための水増しは禁止。密度を最優先する

【テーマ】${topic}
【スタイル】${style === "healing" ? "ヒーリング系（癒し・瞑想・エネルギーワーク中心）" : "解説・教育系（知識・解説中心）"}
${profileText}
${referenceText}
【台本の骨組み（この構成に沿って台本を書くこと）】
${skeletonText}

${rulesText || ""}
${additionalNotes ? `【追加指示】\n${additionalNotes}` : ""}

以下のルールに従って台本を書いてください：
- 視聴者に直接語りかける温かく親しみやすい口調
- ${style === "healing" ? "癒しと安心感を与える穏やかなトーン" : "わかりやすく知識を伝える信頼感のあるトーン"}
- 各セクションを「## セクション名」で区切る
- セリフ形式で書く（「」は使わず、そのまま話す言葉として書く）
- 抽象論ではなく、具体的なエピソード・数字・例え話で語る
- 感情に訴えるフレーズを要所に入れる
- 台本テキストのみを出力（メタ的な説明・分析コメントは不要）

【重要・自チャンネルpersona】
- ナレーターの名乗り（自己紹介・自分の名前）は **${channelProfile?.channelName ? `必ず "${channelProfile.channelName}" を使う` : "入れない（未設定のため）。代わりに「あなた」視点の二人称語りで進行する"}**
- 参考動画/骨組みに登場する別の人物名（例: アリサ, エリサ, かぐら 等）が出てきても **絶対にそのまま使わない**
- 参考動画固有のキャラクターストーリー（特定人物との対話シーン等）はチャンネル独自のキャラ・対象者語りに置き換える`;

  try {
    let text = "";

    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": aiApiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
            messages: [{ role: "user", content: prompt }],
          }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) {
        const error = await res!.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res!.status });
      }
      const data = await res!.json();
      text = data.content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 8192,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json({ error: error.error?.message || "API error" }, { status: res.status });
      }
      const data = await res.json();
      text = data.choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ script: text });
  } catch {
    return NextResponse.json({ error: "台本生成に失敗しました" }, { status: 500 });
  }
}
