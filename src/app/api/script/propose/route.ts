import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 骨組み出力は最大16Kトークンと長く生成に時間がかかるため、関数の実行上限を延長する
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { analyses, style, topic, channelProfile, aiApiKey, userPrompt, currentSkeleton, rulesText } = body;
  const aiModel = resolveAiModel(body.aiModel);

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
- トレースの基本イメージ: 「別の話に差し替える」のではなく「同じ効果・同じ役割を持つ訴求や例えを、別の言い方で言い直す」。各セクションの訴求の中身・狙う感情・例えの構図は元ネタのまま維持し、言い回しだけを自チャンネルの言葉にする設計を書くこと
- 参考動画が複数ある場合は、最も伸びている動画の構成を主軸とし、他は訴求要素の補強に使う
- 各セクションで「どの参考動画のどの要素を取り入れたか」を必ず明記すること
- 各セクションに、元ネタの5要素（理想の未来／最悪の未来／CTA／視聴維持の仕掛け／世界観の演出）のうち該当するものを「元ネタはこう → 上位互換ではこう一段具体的にする」の形で明記すること
- オリジナリティを出しすぎて参考動画から乖離しないこと
- ヒーリング系の場合: 本編（ヒーリングパート）は3分以内に開始すること。冒頭のフック＋共感は1-2分で切り上げてすぐ本編に入る
- 【ヒーリングパートの変化設計（必達）】ヒーリングは「内側が段階的に変わっていく1本の物語」として設計し、その過程を骨組みに必ず明記すること。
  ・お力が体を上から下へ流れる移動（頭→胸→手→腹→足 等）＝変化の段階。**部位ごとに解決する内側の課題を変えて設計する**
    （例: 頭＝思い込み・思考の声を溶かす／胸＝諦め・感情のブロックを抜く／手＝受け取る機能を作り変える／腹＝軸を整える／足＝行動と導きの道を開通。部位が象徴する意味に対応させる）
  ・各段階は「体感の確認（問いかけ）→ その部位のマイナスが抜ける → 新しい状態への書き換え（途中経過の言い方）」のセットで設計する
  ・**完成宣言（例: 億を受け取る器ができた／削られずに丸ごと届く体になった）は全身が繋がった最後に1回だけ**。部位ごとに同じ結論へ結びつける設計は禁止
  ・完成後に流れを固定する日常アクション（例: 朝「受け取ります」とひと言）を1つ設計に含める
  ・骨組みには「どの部位で・どの内側の課題が・何に書き換わるか」の対応を段階リストとして書くこと
- 教育系の場合: 冒頭2分以内に本題に入ること

【チャンネル必須要素の追加（構成トレースより優先）】
- 元ネタは競合動画なので、このチャンネル独自の必須要素（公式LINE誘導・収益化導線・放置するとどうなるかの警告など）は含まれていない
- 下記【チャンネル共通ルール】等で必須とされた要素は、元ネタに無くても専用セクションとして骨組みに必ず組み込むこと
- 特に「LINE誘導ブロック」「放置危険性の警告」がルールで要求されていれば、CTA付近に独立セクションとして必ず入れる。これらが欠けた骨組みは失格

【タイトル整合性（必達）】
- テーマ／タイトルに含まれる数字・スケール・約束（「億」「3分後」「100万人に一人」等）を、骨組みのどのセクションで・どう回収するかを設計に明記すること
- タイトルが「億」を謳うのに本文設計が数万円台、のような乖離は重大NG
- 【テーマの一貫】タイトルの具体テーマ（宝くじ/ロト/復縁等）を全セクションの主役にする設計にすること。フック・体験談・理想/最悪の未来・ヒーリング/リーディング誘導・口コミまで全部そのテーマに紐づける。「金運全体」等の上位概念に薄めた設計はNG
- 【口コミのテーマ一致】社会的証明・お客様の声のセクションには「タイトルと同じテーマの事例だけを使う」ことを設計に明記する（宝くじテーマなら宝くじ当選の口コミのみ）

【終盤クロージング設計（全動画共通・必達）】
※元ネタ分析や他のセクション設計でCTAに関する別形式の指示があっても、終盤クロージングは必ずこのパターンを優先する。
伸びている動画のクロージングは「軽CTA → 重CTA」の2段ラダー構造を持つ。骨組みの終盤セクションは下記7要素を順番通り、それぞれ独立した役割として組み込むこと。

1. 視聴完了の意味付け（既成事実化）
   - 「最後まで見届けたあなたは○○になりました」のように視聴完了自体に意味を持たせる
   - 「もう○○は決まっています」と既成事実化し離脱不能にする

2. 第1CTA（軽め・心理ハードル低）+ 例文3パターン + 社会的証明
   - 多くはコメント誘導等の軽い行動。チャンネル共通ルールに従う
   - 視聴者が書きやすいよう、例文を3パターン提示する設計にする
   - 例文は【予祝＝完了形】で設計する（「叶いました」「受け取りました」型。「〜したい」「〜しますように」の願望形は予祝にならないため禁止と明記）
   - 直後に「以前○○と書いた方が翌月××になった」型の社会的証明を1件入れる（タイトルと同じテーマの事例）

3. 軽→重への橋渡し（サンクコスト型ペナルティ訴求）★最重要
   - 「ここで止めるとこれまでの○○が無駄になる／逃げる／消える」
   - 重CTAを「新しい行動」ではなく「今までの行動を守る延長線」として位置づける
   - これが軽→重の心理移行で最も効くポイント

4. 第2CTA（重め・本命の収益化導線）の価値再定義
   - チャンネル共通ルールで定められた本命CTA（LINE登録・有料鑑定等）
   - 「もう一つ、一番大事なことを伝えます」型の興味再フックで開始
   - 提供価値の不完全性を「いつ／どこで／いくら 等が分かりません」と3つの具体的な疑問形で露呈し、視聴者の頭に空欄を作る
   - 「一人ひとり全く違う」と量産感を否定

5. スケールアップした社会的証明
   - 第2CTA直後に、第1CTAの社会的証明より明確に大きいスケール（金額・成果）の事例を1〜2件出す
   - 段階的に大きくして「重CTAの先はもっと凄い」と印象づける

6. 比較強調
   - 「○○した人と、しなかった人では天と地ほどの差」型の明示的な対比を1文

7. 期限的限定 + 即時行動
   - 「いつまで続くか分かりません」「○○が強い今のうちに」型で動画視聴中の高揚をそのまま行動に変換

【自チャンネル persona の取り扱い】
- 参考動画のナレーターの名乗り（「私はアリサ」「私はエリサ」など）は**絶対にコピーしない**こと
- 自チャンネル名・人物名が指定されている場合のみその名乗りを使用する
- 未指定の場合は名乗りを入れず、「あなた」視点の語りで構成すること
- 参考動画固有のキャラクター・ストーリー（特定の人物との対話など）は採用要素から除外する

${analysisTexts}
${profileText}
スタイル: ${style === "healing" ? "ヒーリング系" : style === "tarot" ? "タロット系（リーディング進行型。カードを4〜5枚順番に引きながら読み解くカード鑑定）" : "教育系"}
テーマ: ${topic}
${style === "tarot" ? `
【タロットスタイル時の最優先指示（必達）】
- 骨組みは「カードを4〜5枚、順番に引きながらリーディングする」進行で組むこと。各カードを1セクションとし「カード名→意味→視聴者への紐付け」を含める。
- チャンネル共通ルールや参考情報に【中盤】ヒーリング音楽パート/瞑想/呼吸誘導/アファメーション連打 等のヒーリング構成が書かれていても、タロットスタイルでは骨組みに採用しない。ヒーリング動画の構成にしてはいけない。
- 元ネタ(参考動画)がカードを引きながらリーディングしているなら、その「カードを順に引いて読み解く」流れを必ずトレースする。
- 山選択(A/B/C)は使わず、1人の視聴者に向けた単一リーディングとして構成する。
` : ""}
${rulesText || ""}
${userPrompt ? `\n【追加指示】\n${userPrompt}` : ""}

【文字数の目標（必達）】
- 台本全体の目標文字数は「4,500〜5,000文字」とする。これを超える分量の構成にしない（セクションを増やしすぎない・各セクションを詰め込みすぎない）。
- 骨組みの「目標文字数」の行には必ず「4,500〜5,000文字」と書く。6,500〜7,500文字などの大きい数字は書かない。

以下のマークダウン形式で出力してください。

---

# 台本骨組み
推定尺: ○○分 | 目標文字数: 4,500〜5,000文字

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
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 16000, messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json(); return NextResponse.json({ error: e.error?.message }, { status: res!.status }); }
      const data = await res!.json();
      recordUsage({ model: data.model || aiModel, usage: data.usage });
      text = (data.content || []).filter((b: { type?: string }) => b.type === "text").map((b: { text?: string }) => b.text || "").join("");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 16000 }),
      });
      if (!res.ok) { const e = await res.json(); return NextResponse.json({ error: e.error?.message }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      text = odata.choices?.[0]?.message?.content || "";
    }

    return NextResponse.json({ skeleton: text });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "構成提案に失敗" }, { status: 500 });
  }
}
