import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";
import { formatEssenceForPrompt, type ScriptEssence } from "@/lib/script-analysis-store";
import type { CardPlan, CardSlot } from "@/lib/project-store";

// カード設計表: コア5役割（問題提起→深掘り→常識破壊→解決→未来）を背骨に、
// 元ネタ固有の必須要素を「既存カードに統合」か「カードを追加（最大2枚）」で配置し、位置と理由を表にする。
export const maxDuration = 120;

const SYSTEM_PROMPT = `あなたは占い系YouTube台本の構成プロデューサーです。タロットリーディング台本の「カード設計表」を作ってください。
読むのは外注ライターです。各欄は短く、やさしい言葉で、一読で分かるように書くこと。

【背骨（必ずこの順番・この5役割を含める）】
1. 問題提起（流れの変化＋視聴者の今の状態）
2. 深掘り（悩みの言い当て＋共感）
3. 常識破壊（仮想敵批判＋原因の本質）
4. 解決（今日やること）
5. 未来（理想の未来＋主体化）
この順番は崩さない。CTA（無料鑑定）は未来の後に来る（設計表には入れない）。

【カードに載せてよいのは「カードで視る内容」だけ（必達）】
- 設計表の各行は「1枚のカードをめくって読み解く中身」。カードは視聴者の状況・心・流れ・未来を映すものなので、
  載せてよいのは例えば: 今の状態／止まっている原因／変化のきっかけ／乗り越える壁／どう動くか／何が引っかからせるか／結末・理想の未来／最後の合図／時期の性質
- 次のものはカードで視る内容ではないので、コアにも追加にも絶対に入れない:
  「今日占うこと」「テーマの宣言」「導入・選民・あいさつ」「高評価・チャンネル登録のお願い」「コメント誘導」「LINE誘導・無料鑑定の案内」
  「口コミ・実績紹介」「開運アクションのまとめ」「締め・次回予告」。これらはオープニングか本編の合間かクロージングで扱う、カードの外側の要素
- 元ネタの「必ず反映する要素」にそうした外側の要素が含まれていたら、カードにはせず outside に「要素名: どこで扱うか（オープニング／合間／クロージング）」として書く
- 追加カードを作るときも、title は「◯◯（カードで何を視るか）」になっていること。「LINE誘導」「今日のテーマ」のような title は不可

【元ネタ固有の必須要素の置き方】
- 「元ネタの本質」の「必ず反映する要素」を1つずつ見て、背骨のどこかに「統合」するか、「追加カード」として差し込むかを決める
- 追加カードは最大2枚（合計7枚まで）。元ネタがその要素を1枚分の長さで語っていれば「追加」、ひと言なら「統合」
- 位置の決め方（優先順）: ①背骨の順序制約が最優先 ②元ネタでの出現位置（冒頭／序盤／中盤／終盤）に近い場所 ③経験則:
  期待を上げる情報（相手の特徴・入り口の種類 等）は早め＝問題提起の直後／場所・きっかけは解決の後〜未来の前／相手のセリフ・霊聴は未来の中
- 統合した場合は、その背骨カードの content に「＋◯◯（統合）」のように含めて、reason に「統合」と書く

【各欄のルール】
- title: 10字以内の見出し（例:「運命の人の特徴」「今日やること」）
- content: 何を言うかを1〜2文、60字以内。マーケ用語を使わず、台本で言う中身を書く
- source: 元ネタのどこから来たか（例:「元ネタ序盤（2枚目相当）」「ルールのコア」「元ネタに無い→ルール」）
- reason: 位置の理由を1行、30字以内（例:「期待を上げる情報は深掘りの前」）

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "slots": [ { "role": "問題提起|深掘り|常識破壊|解決|未来|追加", "kind": "core|extra", "title": "…", "content": "…", "source": "…", "reason": "…" } ],
  "outside": [ { "title": "カードにしない要素名", "where": "オープニング|合間|クロージング", "note": "一言" } ] }`;

// カードで視る内容ではないもの（AIが誤って入れた場合のサーバー側ガード）
const NON_READING = /LINE|ライン|無料鑑定|概要欄|高評価|チャンネル登録|登録|コメント|今日占う|占うこと|今日のテーマ|テーマ宣言|導入|オープニング|あいさつ|挨拶|選民|口コミ|実績|締め|クロージング|次回|開運アクション|行動まとめ|CTA|誘導/;
function isNonReadingSlot(sl: { title: string; content: string }): boolean {
  return NON_READING.test(sl.title) || /LINE|無料鑑定|概要欄|高評価|チャンネル登録|コメント(して|欄|を)|誘導/.test(sl.content);
}

function parseJSON(raw: string): Record<string, unknown> | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : raw).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ } }
  return null;
}

const CORE_ROLES = ["問題提起", "深掘り", "常識破壊", "解決", "未来"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { essence, topic, genre, instruction, currentPlan, aiApiKey } = body as {
      essence?: ScriptEssence | null; topic?: string; genre?: string; instruction?: string; currentPlan?: CardPlan | null; aiApiKey: string;
    };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });

    const userPrompt = `${SYSTEM_PROMPT}

【企画】${topic || "（未設定）"}（ジャンル: ${genre || "不明"}）

${essence ? formatEssenceForPrompt(essence, "元ネタ") : "【元ネタの本質】（未抽出。背骨の5枚で設計する）"}
${essence?.timeline?.length ? `\n【元ネタでの出現位置】\n${essence.timeline.map((t) => `- ${t.element}: ${t.position}${t.card ? `（${t.card}枚目相当）` : ""}`).join("\n")}` : ""}
${currentPlan?.slots?.length ? `\n【今の設計表】\n${currentPlan.slots.map((sl, i) => `${i + 1}. [${sl.kind === "core" ? "コア" : "追加"}/${sl.role}] ${sl.title}: ${sl.content}`).join("\n")}` : ""}
${instruction ? `\n【オーナーからの指示（最優先で反映）】\n${instruction}` : ""}`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 2500, messages: [{ role: "user", content: userPrompt }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r2) => setTimeout(r2, 4000 * (attempt + 1)));
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
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: userPrompt }], max_tokens: 2500, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed || !Array.isArray(parsed.slots)) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    const outside: { title: string; where: string; note: string }[] = Array.isArray(parsed.outside)
      ? (parsed.outside as Record<string, unknown>[]).map((o) => ({ title: String(o.title || "").slice(0, 30), where: String(o.where || "").slice(0, 20), note: String(o.note || "").slice(0, 60) })).filter((o) => o.title)
      : [];
    const slots: CardSlot[] = (parsed.slots as Record<string, unknown>[])
      .map((sl) => ({
        role: String(sl.role || "追加"),
        kind: sl.kind === "core" || CORE_ROLES.includes(String(sl.role)) ? "core" : "extra",
        title: String(sl.title || "").slice(0, 20),
        content: String(sl.content || "").slice(0, 120),
        source: String(sl.source || ""),
        reason: String(sl.reason || "").slice(0, 60),
      }))
      .slice(0, 7) as CardSlot[];
    // 追加カードのうち「カードで視る内容」でないもの（LINE誘導・今日占うこと等）は設計表から外し、outside に回す
    for (let i = slots.length - 1; i >= 0; i--) {
      const sl = slots[i];
      if (sl.kind === "extra" && isNonReadingSlot(sl)) {
        outside.push({ title: sl.title || "（無題）", where: /LINE|無料鑑定|概要欄|締め|次回/.test(sl.title + sl.content) ? "クロージング" : /高評価|登録|コメント/.test(sl.title + sl.content) ? "合間（軽CTA）" : "オープニング", note: "カードで視る内容ではないため設計表から除外" });
        slots.splice(i, 1);
      }
    }
    // コア5役割が揃っていなければ補完（順序も保証）
    const roles = slots.filter((s) => s.kind === "core").map((s) => s.role);
    for (const r of CORE_ROLES) {
      if (!roles.includes(r)) slots.push({ role: r, kind: "core", title: r, content: "（ルールどおり）", source: "ルールのコア", reason: "背骨" });
    }
    const ordered = reorderByBackbone(slots);
    return NextResponse.json({ plan: { slots: ordered, outside, updatedAt: new Date().toISOString() } as CardPlan });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "カード設計表の作成に失敗しました" }, { status: 500 });
  }
}

// コア役割の順序を保証しつつ、追加カードは元の相対位置を保つ
function reorderByBackbone(slots: CardSlot[]): CardSlot[] {
  const out: CardSlot[] = [];
  let coreIdx = 0;
  const cores = CORE_ROLES.map((r) => slots.find((s) => s.kind === "core" && s.role === r)).filter(Boolean) as CardSlot[];
  for (const s of slots) {
    if (s.kind === "core") { if (coreIdx < cores.length) out.push(cores[coreIdx++]); }
    else out.push(s);
  }
  while (coreIdx < cores.length) out.push(cores[coreIdx++]);
  return out;
}
