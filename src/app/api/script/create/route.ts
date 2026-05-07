import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { proposal, channelProfile, style, topic, additionalNotes, aiApiKey, rulesText } = body;

  if (!aiApiKey) {
    return NextResponse.json({ error: "AI APIキーが設定されていません" }, { status: 400 });
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  // 骨組みテキスト（マークダウン形式のconceptに入っている）
  const skeletonText = proposal?.concept || "";

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

  const prompt = `あなたは占い・スピリチュアル系YouTubeの台本ライターです。

以下の構成提案と自チャンネル設計を基に、完全な台本を作成してください。

【テーマ】${topic}
【スタイル】${style === "healing" ? "ヒーリング系（癒し・瞑想・エネルギーワーク中心）" : "解説・教育系（知識・解説中心）"}
${profileText}

【台本の骨組み（この構成に沿って台本を書くこと）】
${skeletonText}

${rulesText || ""}
${additionalNotes ? `【追加指示】\n${additionalNotes}` : ""}

以下のルールに従って台本を書いてください：
- 視聴者に直接語りかける温かく親しみやすい口調
- ${style === "healing" ? "癒しと安心感を与える穏やかなトーン" : "わかりやすく知識を伝える信頼感のあるトーン"}
- 各セクションを「## セクション名」で区切る
- セリフ形式で書く（「」は使わず、そのまま話す言葉として書く）
- 具体的なエピソードや例え話を入れる
- 感情に訴えるフレーズを要所に入れる
- 台本テキストのみを出力（メタ的な説明は不要）

【参考動画のトレース指針】
台本は「外側のラベル(世界観・persona)は自チャンネル / 中身の構造と訴求の強度は元ネタを忠実にトレース」する形で書く。

▶ 元ネタを **積極的にトレース** する要素（強度・順序・密度を保つ）:
  - 全体の構成順序とパート分け（フック→共感→展開→ヒーリング/解説→クライマックス→CTA→クロージング）
  - フックの型・話法・冒頭一文の構造
  - 損失回避フレーズの強度と具体性（「閉じると◯◯が止まる」等の重ね方）
  - 理想の未来の描写（具体的金額・具体的シチュエーション・体感）
  - 最悪の未来の描写（具体的不安・痛点・行動しなかった結果）
  - アファメーション/暗示の本数とリズム
  - 体感確認フレーズの入れ方（「手が温かくなっておられますか」等）
  - 完了宣言・受動保証の言い回し
  - CTAの誘導手順（高評価→チャンネル登録→コメント→LINE）

▶ 元ネタから **必ず置き換え** る要素（自チャンネルに合わせる）:
  - ナレーターの名乗り（チャンネル名・自分の名前）${channelProfile?.channelName ? ` → "${channelProfile.channelName}" を使う` : " → 名乗りは入れず二人称語りに"}
  - 世界観固有の用語（例: 元ネタが守護天使なら自チャンネルの神格・象徴に置換）
  - 一人称・二人称・敬称
  - 場所・神格・神様の名称
  - キャラクター固有のエピソード・対話相手・人物名
  - 口調・語尾の癖（自チャンネルの tone に合わせる）

【避ける】
- 元ネタの構造を弱めること（訴求が抽象化・短縮・希薄化するのは NG）
- 文字をなぞるだけのコピペ（言葉の選択は自チャンネル流に翻訳）`;

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
