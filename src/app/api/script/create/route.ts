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

【最優先のルール優先順位】
矛盾が生じた場合は必ずこの順で優先すること。
  1位: チャンネル共通ルール（${rulesText ? "下記【チャンネル共通ルール】" : "指定があれば"}）の必須要素・書式指定
  2位: タイトルとの整合性（タイトルの約束を本文で必ず回収する）
  3位: 元ネタの構成トレース
- 元ネタは競合動画なので、このチャンネル独自の必須要素（公式LINE誘導・収益化導線・放置危険性の警告など）は含まれていない。
  元ネタや骨組みに無くても、チャンネル共通ルールで必須とされた要素は専用ブロックとして必ず台本に追加すること。これは構成トレースより優先する。
- 特に「公式LINE誘導」「放置するとどうなるかの警告」は、ルールで要求されていれば絶対に省略しない。CTAパートに収益化導線が無い台本は失格。

【最重要ミッション：元ネタの上位互換を作る】
以下の3原則を満たしてください。

原則1. 元ネタの構成をトレースする
- 元ネタ分析の構成（セクションの順番・役割・尺配分）を基本的に踏襲する
- 勝手に構成を組み替えたり省略したりしない
- ただし上記【ルール優先順位】の通り、チャンネル必須要素は元ネタに無くても追加する

原則2. 元ネタの5要素を、より具体的・よりターゲットに刺さる内容に上書きする
元ネタ分析に書かれた以下5要素は「超えるべき基準値」です。同等以下は失格。各要素で元ネタより一段具体的にすること。
  (1) 理想の未来（欲求喚起）… 元ネタより具体的な数字・固有のシチュエーション・五感描写で、視聴者の欲求を強く喚起する
  (2) 最悪の未来 … 元ネタより具体的に「放置するとどうなるか」を描き、回避欲求を刺激する
  (3) CTA … 元ネタより自然かつ行動の理由が明確で、視聴者が動きたくなる導線にする
  (4) 視聴維持率の確保（離脱防止）… 元ネタの仕掛けに加え、各セクション冒頭で続きを見たくなる予告・問いかけ・感情の起伏を入れる
  (5) 世界観の演出 … 元ネタより没入感のある語り口・比喩・独自用語で、チャンネルの世界観を一貫させる
※元ネタ固有の固有名詞・キャラクター・エピソードはコピーせず、自チャンネル向けに具体性のレベルだけを引き継ぐこと。
※元ネタ分析（下記【元ネタ分析】）は、骨組みより優先する「具体性のソース」。骨組みが抽象的でも、元ネタの金額・シチュエーションのレベルまで必ず具体化すること。

原則3. マーケティング上、無駄な文章を1文も入れない
- どの一文も「欲求喚起・離脱防止・信頼構築・行動喚起」のいずれかの役割を持つこと
- 役割のない前置き・繰り返し・冗長な言い回し・当たり障りのない一般論は書かない
- 文字数を埋めるための水増しは禁止。密度を最優先する

【タイトル整合性（必達）】
タイトル「${topic}」に含まれる数字・スケール・約束（例:「億」「3分後」「100万人に一人」等）は、
本文のフック・体験談・理想の未来の中で、必ず同じレベルの具体性で回収すること。
タイトルが「億」を謳うのに本文の事例が数万円台、のような乖離は重大NG。

【テーマ／タイトル】${topic}
【スタイル】${style === "healing" ? "ヒーリング系（癒し・瞑想・エネルギーワーク中心）" : "解説・教育系（知識・解説中心）"}
${profileText}
${referenceText}
【台本の骨組み（この構成に沿って台本を書くこと）】
${skeletonText}

${rulesText || ""}
${additionalNotes ? `【追加指示】\n${additionalNotes}` : ""}

【書式ルール（チャンネル共通ルールに書式指定がある場合は必ずそちらを最優先）】
- チャンネル共通ルールに「記号（##・---・*等）を使わない」「1行○文字で改行」「【前半】【中盤】【終盤】等のラベルを付ける」といった書式指定があれば、それを厳守する
- 書式指定が無い場合のみ、各セクションを「## セクション名」で区切る
- 同じ語尾の連続使用の制限がルールにある場合でも、ヒーリングパート・アファメーションパートには適用しない（そこは繰り返しが演出として有効なため、語尾が連続してよい）。それ以外のパートでは制限を守る

以下のルールに従って台本を書いてください：
- 視聴者に直接語りかける温かく親しみやすい口調
- ${style === "healing" ? "癒しと安心感を与える穏やかなトーン" : "わかりやすく知識を伝える信頼感のあるトーン"}
- セリフ形式で書く（「」は使わず、そのまま話す言葉として書く）
- 抽象論ではなく、具体的なエピソード・数字・例え話で語る
- 感情に訴えるフレーズを要所に入れる
- 台本テキストのみを出力（メタ的な説明・分析コメントは不要）

【プロのスピーチライターレベルの文章作法（必達）】
素人っぽい単調な文章は禁止。読み上げた瞬間に「うまい」と感じさせるリズムと論理運びで書くこと。

1. 語尾のバリエーションを徹底する（ヒーリング/アファメーションパートは除く）
   - 「〜です。〜です。〜ます。」のように同じ語尾を3回以上続けるのは禁止
   - 「〜です／〜ます／〜なんです／〜ですよね／〜でしょう／〜のです／〜と思いませんか／体言止め」など複数の語尾を交互に混ぜる
   - 悪い例:「これは大切です。あなたに必要です。覚えておくことです。」
   - 良い例:「これは大切なこと。なぜならあなた自身の人生を変える力を持っているからです。覚えておいてくださいね。」

2. 接続詞・繋ぎ表現で論理の流れを作る
   - 文を単純に並べず、「つまり〜ということなんです」「なぜなら〜だからです」「ところが実は〜」「だからこそ〜」「その結果〜」「言い換えると〜」などで因果・対比・転換・言い換えを明示する
   - 視聴者の頭の中で「なるほど→だから→つまり」と論理が積み上がる流れにする
   - 悪い例:「お金が入ります。豊かになります。幸せになります。」
   - 良い例:「お金が入ってきます。つまり、ただ生活が楽になるだけじゃなく、心に余裕が生まれて、本当の意味で豊かな日々が始まるということなんです。」

3. 短文と長文のリズムを混ぜる
   - 重要な主張の前後には短文を置いて間を作る（「これ、本当です。」のように）
   - 説明・描写は適度な長さで展開し、緩急をつける
   - 全文が同じ長さだと聞き手が眠くなる

4. 含蓄のある言い回しを使う
   - 一文の中に「主張＋根拠／主張＋言い換え／問いかけ＋答え」の構造を入れる
   - 視聴者の心の声を代弁する一言を要所に入れる（「気づいてましたか？」「実はこれ、多くの人が見落としているんです」）
   - 比喩・対比・数字を使って具体性と説得力を両立させる

5. 単調な並列を避ける
   - 「Aです。Bです。Cです。」のような並列の羅列は、「Aです。そしてBも。さらに言えば、Cまで起こり始めるんです」のように接続でつなぐ

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
