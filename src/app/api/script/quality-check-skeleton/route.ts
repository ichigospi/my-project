import { NextRequest, NextResponse } from "next/server";
import { scanWorldviewItems } from "@/lib/worldview";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";
import { buildCardAdditionPrompt, parseCardAdditions, buildContentAdditionPrompt, parseContentAdditions, type CardAddition, type ContentAddition } from "@/lib/card-additions";
import { extractDrawnCards } from "@/lib/tarot-draw";
import { sumSkeletonChars } from "@/lib/skeleton-chars";
import { referenceModeQcNote } from "@/lib/structure-mode";

// 骨組み(構成)を構成ルール遵守・元台本ズレの観点で評価する。
// 出力は台本品質チェックと同じ QualityCheckResult 形（categories/overallScore/topPriority）で返し、
// フロントの信号機UIをそのまま再利用する。
export const maxDuration = 300;

interface RefAnalysis {
  videoTitle?: string;
  channelName?: string;
  views?: number;
  role?: "main" | "sub"; // main=構成の主軸（トレース元） / sub=要素どり

  analysisResult?: {
    summary?: string;
    structure?: { name: string; timeRange: string; purpose: string }[];
    hooks?: string[];
    ctas?: string[];
    growthFactors?: string[];
    appealPoints?: string[];
    overallPattern?: string;
    idealFuture?: string;
    worstFuture?: string;
    retentionTactics?: string[];
    worldview?: string;
  } | null;
}

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTubeの台本構成を評価するプロの構成プロデューサーです。
与えられた「台本の骨組み（構成案）」を、台本ルール(構成ルール)と参考元動画の分析に照らして厳しく評価します。
最終ゴールは「この骨組みで台本を書けば、構成ルールを守りつつ元ネタの上位互換になるか」を判定すること。
必ず指定されたJSON形式のみで回答してください。JSON以外のテキスト（説明文・マークダウン・コードブロック記法）は一切出力しないでください。

【評価対象外（重要）】
骨組みは構成の設計図であり、口調・語尾・敬語/方言・文体のルール（例: 京都弁で話す、丁寧語禁止、命令形の形 等）は台本生成時に適用される。
骨組みの説明文が標準語・敬語で書かれていても違反ではないため、**口調・文体に関する指摘は一切しないこと**。
評価するのは構成・要素・配分のみ。

【評価観点 / 5カテゴリ】

A. 構成ルール遵守
   下記【台本ルール】で定められた構成（例：【前半】オープニング→【中盤】→【終盤】の区切り、冒頭は選民フックから、カードを5枚順に引く、コメントCTAは1回のみ、等）を骨組みが守れているか。
   ※対象は構成・順番・要素の有無のみ。口調・語尾・文体のルールはここでは評価しない（台本生成時に適用されるため）。
   - ルールで必須の構成パートが欠けている → fail
   - 順番や役割がルールとズレている → warn
   - 守れている → pass

B. 元台本からのズレ
   参考元動画の構成（順番・役割・尺配分）と訴求要素を骨組みがトレースできているか。元ネタから乖離していないか、勝手に組み替えていないか。上位互換（各要素を一段具体化）になっているか。
   ※参考元が複数あり【★主軸（メイン）】の指定がある場合: 構成トレースの評価は主軸に対してのみ行う。
     サブは「要素が移植されて活きているか」だけを見る。主軸とサブの構成を混ぜた折衷構成（展開順やセクション役割が2本の中間になっている）は fail
   ※台本ルールで「冒頭・終盤CTAはチャンネルルール優先（元ネタをトレースしない）」と指定されている場合、冒頭・CTAが元ネタと違うことはズレとして指摘しない。本編のトレースのみ評価する
   - 元ネタの主要構成・訴求から大きく乖離 → fail
   - 一部の要素が抜け/弱い → warn
   - トレース＋上位互換できている → pass

C. 必須要素の有無
   チャンネル固有の必須要素（無料鑑定/LINE誘導の導線、放置リスクの警告、選民フック冒頭、コメントCTAは序盤1回 等、ルールで要求された要素）が骨組みに専用セクションとして組み込まれているか。
   - ヒーリングパートがある骨組みでは【変化の過程】の設計が必須:
     「部位の移動（頭→胸→手→腹→足 等）＝段階の進行」として、部位ごとに**異なる内側の課題**
     （頭=思い込み/胸=諦めの感情/手=受け取る機能/腹=軸/足=行動の道 等）が解決される設計になっているか。
     各段階に「体感の確認→マイナスが抜ける→書き換え（途中経過の言い方）」があるか。
     完成宣言（器ができた等）が最後に1回だけの設計か。
     部位ごとに毎回同じ結論（器ができた等）へ結びつける設計は段階性の欠如として warn〜fail。
     変化の過程自体が設計に無ければ fail
   - 必須要素が欠落 → fail / 弱い → warn / 揃っている → pass

D. 尺・文字数配分の妥当性
   各セクションの尺・文字数配分が目標（目安4,500〜5,000文字 / 推定尺）に対して妥当か。前半が長すぎて本編が遅れる、終盤CTAが薄い等の偏りがないか。
   - 大きな偏り → fail / やや偏り → warn / 妥当 → pass
   - 【目標文字数に届くか（必達）】骨組み冒頭の「目標文字数」と、各セクションの尺（分:秒）・説明の量から、この骨組みで書いたときの総文字数を見積もる（目安: 1分≒250字）。
     見積もりが目標の85%に届かない「明らかな不足」は fail とし、comment に「推定◯字／目標◯字」を書き、suggestion に「どのセクションに、元ネタのどの内容（カードで視る内容・前触れ・時期・毎日の変化 等）を足せば届くか」を具体に書く。
     85〜95%は warn。上限（タロットは9,000字）を超える見込みも warn。セクションを減らす・カードを減らす提案はしない

E. プロットの一本線
   骨組み全体が「1本の線」として最初から最後まで繋がっているかを評価する。
   - 背骨の明記: 骨組み冒頭に「コアメッセージ（またはメインテーマと主張）」「中心メタファー」「冒頭の約束」が書かれているか。無ければ warn
   - 中心メタファーの単一性: 設計内でスピ的比喩が複数混在していないか（「豊かさの扉」と「受け取る器」の併用等は warn〜fail）
   - テーマの一貫: タイトルの具体テーマが冒頭から終盤まで主役であり続けているか。途中で別テーマに逸れる・上位概念に薄まる → warn〜fail
   - セクション間の接続: 各セクションが前のセクションを受けて次へ繋がる因果・流れになっているか。
     互いに独立したトピックの羅列（枝分かれ・並列展開・どこを入れ替えても成立する構成）になっていたら fail
   - 伏線の回収: 冒頭で張った約束・オープンループ（「あること」「最後に〇〇」等）が本編・終盤で必ず回収される設計か。未回収 → fail
   - 論理の整合: 冒頭→問題提起→本編→実践→CTAの流れの中で、論理の飛び・前後で噛み合わない主張・矛盾がないか
   - カードの正確性（タロット骨組みのみ）: 各カードセクションの設計が、骨組みに記載された「正統な意味（正位置/逆位置）」の範囲内か。
     記載にない意味の捏造・正位置と逆位置の取り違え・「絵柄」に記載のない絵の要素を使う設計 → fail。
     「正統な意味」の記載自体が欠落しているカードセクション → warn（抽選ブロックからの転記漏れ）
   - カード間の絵柄接続の正確性（タロット骨組みのみ）: 複数カードを絵柄で繋ぐ演出がある場合、接続に使う要素が両方のカードの「絵柄」記載に実在するか。
     片方にしか無い物をもう片方が「持っている・現れる」とする設計（例: 隠者のランタンを愚者に持たせる）→ fail（該当箇所を引用し、状態・構図の対比での接続案を添える）
   - 指摘するときは「どのセクションとどのセクションの間で線が切れているか」を具体的に示すこと

【出力JSON形式（厳守）】
{
  "overallScore": 0〜10の数値,
  "topPriority": "最優先で直すべき骨組みの問題点を1〜2文で。無ければ『大きな問題なし』",
  "categories": [
    {
      "name": "A. 構成ルール遵守",
      "passed": true/false,
      "items": [
        { "name": "短い項目名", "status": "pass|warn|fail", "comment": "具体的な指摘", "suggestion": "骨組みのどこをどう直すか（pass時は空文字でよい）" }
      ]
    }
  ]
}
各カテゴリ(A〜E)を必ず1つずつ含めること。`;

function buildReferenceText(refs: RefAnalysis[]): string {
  if (!refs || refs.length === 0) return "（参考元なし。元台本ズレの評価はスキップし、構成ルール遵守を中心に評価）";
  const hasRoles = refs.length > 1 && refs.some((a) => a.role);
  return refs.map((a, i) => {
    const r = a.analysisResult;
    const roleLabel = hasRoles ? (a.role === "main" ? "｜★主軸（メイン）: 構成トレースの評価対象" : "｜サブ（要素どり）: 要素の移植のみ評価") : "";
    return `■ 参考元${i + 1}${roleLabel}「${a.videoTitle || "無題"}」(${a.channelName || ""} / ${a.views?.toLocaleString() || "?"}回)
・構成: ${r?.structure?.map((s) => `${s.name}(${s.timeRange})→${s.purpose || ""}`).join(" / ") || "不明"}
・理想の未来: ${r?.idealFuture || r?.appealPoints?.join(" / ") || "不明"}
・最悪の未来: ${r?.worstFuture || "不明"}
・フック: ${r?.hooks?.join(" / ") || "不明"}
・CTA: ${r?.ctas?.join(" / ") || "不明"}
・視聴維持: ${r?.retentionTactics?.join(" / ") || "不明"}
・伸び要因: ${r?.growthFactors?.join(" / ") || "不明"}
・パターン: ${r?.overallPattern || "不明"}`;
  }).join("\n\n");
}

function parseJSON(raw: string): Record<string, unknown> | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : raw).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { skeleton, referenceAnalyses, rulesText, style, aiApiKey } = body as {
      skeleton: string;
      referenceAnalyses?: RefAnalysis[];
      rulesText?: string;
      style?: string;
      aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!skeleton?.trim()) return NextResponse.json({ error: "骨組みがありません" }, { status: 400 });

    const styleLabel = style === "healing" ? "ヒーリング系" : style === "tarot" ? "タロット系（リーディング進行型）" : "教育系";

    const systemPrompt = style === "tarot"
      ? SYSTEM_PROMPT.replace("目安4,500〜5,000文字", "目安6,000〜8,000文字。下限6,000字・上限9,000字。この範囲内なら文字数そのものは指摘しない")
      : SYSTEM_PROMPT;
    // 尺から総文字数を見積もる（1分≒250字）。不足していれば、不足量に応じた増筆提案の方針と材料をプロンプトに渡す
    const CHARS_PER_MINUTE = 250;
    const targetFromSkeleton = Number((skeleton.match(/目標文字数[:：]\s*約?\s*([0-9,，]+)\s*字/)?.[1] || "").replace(/[,，]/g, ""));
    const targetChars = Number((body as { targetChars?: number }).targetChars) || targetFromSkeleton || (style === "tarot" ? 7000 : 4750);
    let maxEndMin = 0;
    for (const m of skeleton.matchAll(/(\d{1,2}):(\d{2})\s*[-〜~ー–]\s*(\d{1,2}):(\d{2})/g)) {
      const end = Number(m[3]) + Number(m[4]) / 60;
      if (end > maxEndMin) maxEndMin = end;
    }
    // 推定は「約N字」の合計を優先（骨組みに字数配分がある場合）。無い古い骨組みは尺×250字/分で見積もる
    const charSum = sumSkeletonChars(skeleton);
    const estimated = charSum.annotated >= 3 ? charSum.total : (maxEndMin > 0 ? Math.round(maxEndMin * CHARS_PER_MINUTE) : 0);
    if (charSum.annotated >= 3) maxEndMin = estimated / CHARS_PER_MINUTE;
    const deficit = estimated > 0 ? Math.max(0, targetChars - estimated) : 0;
    const { referenceTranscripts, recentScripts } = body as { referenceTranscripts?: string[]; recentScripts?: string[] };
    const transcripts = (referenceTranscripts || []).filter((t) => t && t.trim()).slice(0, 2);
    const approved = (recentScripts || []).filter((t) => t && t.trim()).slice(0, 2);
    const expansionNote = estimated > 0 && estimated < targetChars * 0.95
      ? `
【文字数の見込みと増筆提案（必達）】
尺からの見積もりは約${estimated.toLocaleString()}字で、目標約${targetChars.toLocaleString()}字に対して約${deficit.toLocaleString()}字足りません。
観点Dの suggestion には、次の方針で「どのセクションに・何を・約何字」足すかを具体に書くこと（セクション・カードを減らす提案はしない）:
${deficit >= 1000
  ? `- 不足が1,000字以上なので「新しいリーディング内容の追加」を最優先にする。元ネタ台本の書き起こしから、この骨組みにまだ無い「カードで視ている内容」（相手の今の様子・なぜ今動くのか・どんな形で返るか／来るか・前触れのサイン・時期の段階・返った後の毎日 等）を抜き出し、意味の近い既存のセクション（カード）に足す。元ネタのどの部分から取ったかを添える`
  : `- 不足が1,000字未満なので「新しいアドバイスの追加」を最優先にする。元ネタ台本や同チャンネルの合格台本にある軽い行動・構え・やらないこと・受け取り方のうち、この骨組みに無いものを1つ選び、解決（行動を渡す）セクションの中か直後に足す。どこから取ったかを添える`}
- それでも足りない分は、深掘りの場面・理想の未来の具体・常識破壊の「現実がどう変わるか」で補う
${transcripts.length ? `\n【元ネタ台本の書き起こし（増筆の材料。文はそのまま写さない）】\n${transcripts.map((t, i) => `■ 元ネタ${i + 1}\n${t.slice(0, 6000)}`).join("\n\n")}\n` : ""}${deficit < 1000 && approved.length ? `\n【同チャンネルの合格台本（アドバイスの材料。文はそのまま写さない）】\n${approved.map((t, i) => `■ 合格台本${i + 1}\n${t.slice(0, 5000)}`).join("\n\n")}\n` : ""}`
      : "";

    const userPrompt = `${systemPrompt}
${expansionNote}
${(body as { structureMode?: string }).structureMode === "reference" ? referenceModeQcNote() : ""}
【スタイル】${styleLabel}

【台本ルール（この構成を守れているか＝観点A・Cの基準）】
${rulesText || "（ルール指定なし。一般的な構成の妥当性で評価）"}

【参考元動画の分析（この構成・訴求からズレていないか＝観点Bの基準）】
${buildReferenceText(referenceAnalyses || [])}

【評価対象：台本の骨組み（構成案）】
${skeleton}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    // モデル呼び出し（採点と、増筆プランの2回で使う）
    const callModel = async (prompt: string, maxTokens: number): Promise<{ raw: string } | { error: NextResponse }> => {
      if (isAnthropic) {
        let res: Response | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: anthropicHeaders(aiApiKey, aiModel),
            body: JSON.stringify({ model: aiModel, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(aiModel) }),
          });
          if (res.status === 429 || res.status === 529) {
            if (attempt === 2) return { error: NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status }) };
            await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
            continue;
          }
          break;
        }
        if (!res!.ok) { const e = await res!.json().catch(() => ({})); return { error: NextResponse.json({ error: e?.error?.message || "API error" }, { status: res!.status }) }; }
        const data = await res!.json();
        recordUsage({ model: data.model || aiModel, usage: data.usage });
        return { raw: ((data.content || []) as { type?: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text || "").join("") };
      }
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: maxTokens, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return { error: NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }) }; }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      return { raw: odata.choices?.[0]?.message?.content || "" };
    };

    const main = await callModel(userPrompt, 8000);
    if ("error" in main) return main.error;
    const parsed = parseJSON(main.raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });

    // 文字数不足のときは、追加するリーディング内容（またはアドバイス）の具体案を別途作らせる。
    // 「どのセクションの後に／何を視る内容を／約何字／元ネタのどこから」を箇条書きで返し、機械判定の提案文にそのまま載せる
    let expansionPlan = "";
    let cardAdditions: CardAddition[] = [];
    if (estimated > 0 && estimated < targetChars * 0.95 && deficit >= 1000) {
      // 1,000字以上の不足＝カードを1枚追加する提案（候補を複数返し、画面で選んで反映する）
      const usedCards = extractDrawnCards(skeleton).map((c) => c.name);
      const plan = await callModel(buildCardAdditionPrompt({ text: skeleton, kind: "skeleton", deficit, targetChars, transcripts, usedCards }), 4000);
      if (!("error" in plan)) cardAdditions = parseCardAdditions(parseJSON(plan.raw), usedCards);
      if (cardAdditions.length > 0) {
        expansionPlan = `【カードを1枚追加する候補（下の「追加カードの提案」から1つ選んで反映）】\n${cardAdditions.map((a, i) => `${i + 1}. ${a.afterIndex ? `${a.afterIndex}枚目` : a.after}の後に【${a.title}】 カード: ${a.card.name}（${a.card.orientation}） 約${a.chars}字\n　　${a.content.slice(0, 120)}\n　　（出どころ: ${a.source}）`).join("\n")}`;
      }
    } else if (estimated > 0 && estimated < targetChars * 0.95) {
      const planPrompt = `あなたは占いスピリチュアル系YouTube台本の構成プロデューサーです。
次の台本の骨組みは、尺からの見積もりが約${estimated.toLocaleString()}字で、目標約${targetChars.toLocaleString()}字に対して約${deficit.toLocaleString()}字足りません。
足りない分を埋めるために「追加する内容」を具体的に提案してください。

【方針（必達）】
${deficit >= 1000
  ? `- 不足が1,000字以上なので「新しいリーディング内容の追加」を最優先にする。元ネタ台本の書き起こしを読み、この骨組みにまだ無い「カードで視ている内容」（相手の今の様子・なぜ今動くのか・どんな形で返るか／来るか・前触れのサイン・時期の段階・返った後の毎日 など）を2〜4個抜き出す
- それぞれ、意味の近い既存のセクション（カード）の中に足す。カードの追加・削除・順番変更はしない。そのカードの正統な意味の範囲で語れる内容にする`
  : `- 不足が1,000字未満なので「新しいアドバイスの追加」を最優先にする。元ネタ台本や同チャンネルの合格台本にある軽い行動・構え・やらないこと・受け取り方のうち、この骨組みに無いものを1〜2個選ぶ
- 解決（行動を渡す）セクションの中か直後に足す。ハードルが低く今日できるものに限る。本編のアドバイスは占い師の言葉として言う`}
- 合計で約${deficit.toLocaleString()}字増える配分にする（1件あたり300〜700字）
- 元ネタ・合格台本の文をそのまま写す提案はしない。「何を視るか／何を言うか」の中身を、この骨組みの語り口で書く
- セクション・カードを減らす提案はしない

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "additions": [ { "after": "どのセクションの後か（骨組みのセクション名を書く）", "title": "追加する内容の見出し（15字以内）", "content": "何を視る／何を言うかを2〜3文で（台本でそのまま使える具体さ。元ネタの語り口のまま写さない）", "source": "元ネタのどの部分から取ったか（例: 元ネタ1の3枚目・前触れのサイン）", "chars": 500 } ] }

【骨組み】
${skeleton}
${transcripts.length ? `\n【元ネタ台本の書き起こし】\n${transcripts.map((t, i) => `■ 元ネタ${i + 1}\n${t.slice(0, 8000)}`).join("\n\n")}\n` : ""}${deficit < 1000 && approved.length ? `\n【同チャンネルの合格台本】\n${approved.map((t, i) => `■ 合格台本${i + 1}\n${t.slice(0, 6000)}`).join("\n\n")}\n` : ""}`;
      const plan = await callModel(planPrompt, 4000);
      if (!("error" in plan)) {
        const pj = parseJSON(plan.raw);
        const adds = Array.isArray(pj?.additions) ? (pj!.additions as { after?: string; title?: string; content?: string; source?: string; chars?: number }[]) : [];
        if (adds.length > 0) {
          expansionPlan = adds.map((a, i) =>
            `${i + 1}. 「${String(a.after || "").slice(0, 40)}」の後に【${String(a.title || "").slice(0, 20)}】を約${Number(a.chars) || 400}字\n　　${String(a.content || "").replace(/\s+/g, " ").slice(0, 220)}\n　　（出どころ: ${String(a.source || "").slice(0, 60)}）`,
          ).join("\n");
        }
      }
    }

    // 不足があれば（量に関係なく）、カードは増やさずに足せる要素の候補も作る（元ネタにあってこの骨組みに無い構成内容）
    let contentAdditions: ContentAddition[] = [];
    if (estimated > 0 && estimated < targetChars * 0.95) {
      const refStructure = (referenceAnalyses || []).map((a, i) => {
        const st = a.analysisResult?.structure;
        return st?.length ? `元ネタ${i + 1}「${a.videoTitle || "無題"}」: ${st.map((s) => `${s.name}(${s.timeRange})→${s.purpose || ""}`).join(" / ")}` : "";
      }).filter(Boolean).join("\n");
      const plan = await callModel(buildContentAdditionPrompt({ text: skeleton, kind: "skeleton", deficit, targetChars, transcripts, referenceStructure: refStructure }), 4000);
      if (!("error" in plan)) contentAdditions = parseContentAdditions(parseJSON(plan.raw));
    }

    // 機械判定: 尺からの見積もりが目標に明らかに届かなければ fail を足す（見積もりは上で計算済み）
    if (targetChars > 0 && estimated > 0) {
      const ratio = estimated / targetChars;
      const hardMax = style === "tarot" ? 9000 : Math.round(targetChars * 1.15);
      // 不足量に応じた増筆の方針（台本の増筆提案と同じ基準）
      const policy = deficit >= 1000
        ? `不足が約${deficit.toLocaleString()}字（1,000字以上）なので、カードを1枚追加する。追加するカードで視る内容は、元ネタで占っていたのにこの骨組みに無いもの（相手の今の様子・なぜ今動くのか・どんな形で返るか・前触れのサイン・時期の段階・返った後の毎日 等）。既存のセクションを膨らませて埋めない`
        : `不足が約${deficit.toLocaleString()}字（1,000字未満）なので、新しいアドバイスの追加を最優先にする。元ネタ台本や同チャンネルの合格台本にある軽い行動・構えのうち、この骨組みに無いものを1つ、解決のセクションの中か直後に足す`;
      const items: { name: string; status: "pass" | "warn" | "fail"; comment: string; suggestion?: string }[] = [];
      if (ratio < 0.85) {
        items.push({
          name: `目標文字数に届かない見込み（推定${estimated.toLocaleString()}字／目標${targetChars.toLocaleString()}字）`, status: "fail",
          comment: `骨組みの尺は約${Math.round(maxEndMin)}分で、1分≒${CHARS_PER_MINUTE}字で見積もると約${estimated.toLocaleString()}字です。目標の${Math.round(ratio * 100)}%しかなく、この骨組みのまま書くと文字数不足になります`,
          suggestion: expansionPlan
            ? `${policy}。\n【追加する内容（この順に骨組みへ足す）】\n${expansionPlan}\nセクションやカードを減らして合わせない`
            : `${policy}。具体案は「D. 尺・文字数配分」の提案を参照。セクションやカードを減らして合わせない`,
        });
      } else if (ratio < 0.95) {
        items.push({
          name: `目標文字数にやや足りない見込み（推定${estimated.toLocaleString()}字／目標${targetChars.toLocaleString()}字）`, status: "warn",
          comment: `骨組みの尺（約${Math.round(maxEndMin)}分）からの見積もりが目標の${Math.round(ratio * 100)}%です`,
          suggestion: expansionPlan
            ? `${policy}。\n【追加する内容】\n${expansionPlan}`
            : `${policy}。具体案は「D. 尺・文字数配分」の提案を参照`,
        });
      } else if (estimated > hardMax) {
        items.push({
          name: `上限を超える見込み（推定${estimated.toLocaleString()}字／上限${hardMax.toLocaleString()}字）`, status: "warn",
          comment: `骨組みの尺（約${Math.round(maxEndMin)}分）からの見積もりが上限を超えています`,
          suggestion: "各セクションの説明を詰め込みすぎない。カードは減らさず、1枚あたりの話題を絞る",
        });
      } else {
        items.push({ name: `文字数の見込み（推定${estimated.toLocaleString()}字／目標${targetChars.toLocaleString()}字）`, status: "pass", comment: "尺からの見積もりは目標の範囲内です" });
      }
      const cats = Array.isArray(parsed.categories) ? (parsed.categories as Record<string, unknown>[]) : [];
      items.push(...scanWorldviewItems(String(skeleton || "")));
      cats.push({ name: "L. 機械判定（尺から見た文字数・世界観）", passed: !items.some((it) => it.status === "fail"), items });
      parsed.categories = cats;
      if (items.some((it) => it.status === "fail")) {
        const score = Number(parsed.overallScore) || 0;
        parsed.overallScore = Math.min(score, 6.5);
        if (!parsed.topPriority || /^\s*$/.test(String(parsed.topPriority))) parsed.topPriority = items[0].name;
      }
    }
    if (cardAdditions.length > 0) parsed.cardAdditions = cardAdditions;
    if (contentAdditions.length > 0) parsed.contentAdditions = contentAdditions;
    // 画面側の自動補完（1,000字未満の不足は要素を自動で足す）の判断材料
    parsed.charEstimate = { estimated, targetChars, deficit };
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "骨組みの品質チェックに失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
