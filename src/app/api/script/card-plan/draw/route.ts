import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";
import { buildTarotDrawBlock, extractDrawnCards, getCardImagery, getCardMeaning, CARD_NAMES, makeRotationPicker, bankKey, bankLabel, techniqueShort } from "@/lib/tarot-draw";
import { prisma } from "@/lib/prisma";
import { formatEssenceForPrompt, type ScriptEssence } from "@/lib/script-analysis-store";
import type { CardPlan, CardSlot, CardPlanBackbone, DrawnTechnique } from "@/lib/project-store";

// 型のローテーション: チャンネルごとに「どの型を何回使ったか」を保存し、使用回数の少ない型を優先して引く
interface BankUsage { banks: Record<string, Record<string, number>>; patterns: Record<string, number> }
const usageKey = (channelId: string) => `bank_usage_${(channelId || "default").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60)}`;
async function loadUsage(channelId: string): Promise<BankUsage> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: usageKey(channelId) } });
    const parsed = row?.value ? (JSON.parse(row.value) as Partial<BankUsage>) : null;
    return { banks: parsed?.banks && typeof parsed.banks === "object" ? parsed.banks : {}, patterns: parsed?.patterns && typeof parsed.patterns === "object" ? parsed.patterns : {} };
  } catch { return { banks: {}, patterns: {} }; }
}
async function saveUsage(channelId: string, usage: BankUsage): Promise<void> {
  try {
    const key = usageKey(channelId); const value = JSON.stringify(usage);
    await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
  } catch { /* 保存できなくても抽選自体は成立させる */ }
}
// 登録パターンを、カテゴリごとに1つ、使用回数の少ないものを優先して自動選択（チャンネル指定のあるパターンは一致するチャンネルだけ）
function pickPatternsByRotation(patterns: { id: string; category: string; channelId?: string }[], channelId: string, used: Record<string, number>): string[] {
  const byCat = new Map<string, { id: string; n: number }[]>();
  for (const p of patterns) {
    if (!p?.id) continue;
    if (p.channelId && channelId && p.channelId !== channelId) continue;
    const list = byCat.get(p.category || "その他") || [];
    list.push({ id: p.id, n: used[p.id] || 0 });
    byCat.set(p.category || "その他", list);
  }
  const out: string[] = [];
  for (const list of byCat.values()) {
    const min = Math.min(...list.map((x) => x.n));
    const cands = list.filter((x) => x.n === min);
    out.push(cands[Math.floor(Math.random() * cands.length)].id);
  }
  return out;
}

// カード設計表に「実際のカード」と「伝えること」を入れる（旧・抽象ロジックの役割を設計表に統合）。
// action=draw   : 設計表の枚数ぶんカードを引く（サーバー乱数）。抽選ブロック（drawSpec）も返す
// action=redraw : 1枚だけ引き直す（使用中のカードは除外）
// action=info   : 指定のカード（名前・向き）の登録の意味と絵柄を返す（差し替え用）
// action=fill   : 引いたカードを元に、背骨（主張／中心メタファー／冒頭の約束）と各カードの「絵柄の見せ場・伝えること・流れ」をAIで埋める
export const maxDuration = 120;

function parseJSON(raw: string): Record<string, unknown> | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : raw).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ } }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action || "draw") as "draw" | "redraw" | "info" | "fill";
    const plan = body.cardPlan as CardPlan | undefined;
    const genre = String(body.genre || "");
    const topic = String(body.topic || "");

    if (action === "draw") {
      if (!plan?.slots?.length) return NextResponse.json({ error: "カード設計表がありません" }, { status: 400 });
      const negativeIndex = Math.max(1, plan.slots.findIndex((sl) => sl.role === "常識破壊") + 1);
      const channelId = String(body.channelId || "");
      const usage = await loadUsage(channelId);
      const { picker, picks } = makeRotationPicker(usage.banks);
      const drawSpec = buildTarotDrawBlock({ genre, topic, cardCount: plan.slots.length, negativeIndex, picker });
      const cards = extractDrawnCards(drawSpec);
      // 今回引いた型を記録（次回は使用回数の少ない型が優先される）
      const techniques: DrawnTechnique[] = [];
      for (const pk of picks) {
        const bank = usage.banks[pk.bankId] || (usage.banks[pk.bankId] = {});
        bank[bankKey(pk.item)] = (bank[bankKey(pk.item)] || 0) + 1;
        techniques.push({ bankId: pk.bankId, label: bankLabel(pk.bankId), short: techniqueShort(pk.item), item: pk.item });
      }
      // 登録パターンもカテゴリごとに1つ、ローテーションで自動選択
      const patterns = Array.isArray(body.patterns) ? (body.patterns as { id: string; category: string; channelId?: string }[]) : [];
      const pickedPatternIds = pickPatternsByRotation(patterns, channelId, usage.patterns);
      for (const id of pickedPatternIds) usage.patterns[id] = (usage.patterns[id] || 0) + 1;
      await saveUsage(channelId, usage);
      const slots: CardSlot[] = plan.slots.map((sl, i) => {
        const c = cards[i];
        if (!c) return sl;
        return { ...sl, card: { name: c.name, orientation: c.orientation }, meaning: getCardMeaning(c.name, c.orientation) || "", imagery: getCardImagery(c.name) || "", highlight: "", message: "", flow: "" };
      });
      return NextResponse.json({ drawSpec, slots, drawnAt: new Date().toISOString(), techniques, pickedPatternIds });
    }

    if (action === "redraw") {
      const used = Array.isArray(body.usedNames) ? (body.usedNames as string[]) : [];
      const pool = CARD_NAMES.filter((n) => !used.includes(n));
      if (pool.length === 0) return NextResponse.json({ error: "引けるカードがありません" }, { status: 400 });
      const name = pool[Math.floor(Math.random() * pool.length)];
      const orientation: "正位置" | "逆位置" = Math.random() < 0.5 ? "逆位置" : "正位置";
      return NextResponse.json({ card: { name, orientation }, meaning: getCardMeaning(name, orientation) || "", imagery: getCardImagery(name) || "" });
    }

    if (action === "info") {
      const name = String(body.name || "");
      const orientation: "正位置" | "逆位置" = body.orientation === "逆位置" ? "逆位置" : "正位置";
      if (!CARD_NAMES.includes(name)) return NextResponse.json({ error: "カード名が登録にありません" }, { status: 400 });
      return NextResponse.json({ card: { name, orientation }, meaning: getCardMeaning(name, orientation) || "", imagery: getCardImagery(name) || "" });
    }

    // fill
    const aiApiKey = String(body.aiApiKey || "");
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!plan?.slots?.length || !plan.slots.every((sl) => sl.card)) return NextResponse.json({ error: "先にカードを引いてください" }, { status: 400 });
    const onlyIndex: number | undefined = body.onlyIndex !== null && body.onlyIndex !== undefined && Number.isFinite(Number(body.onlyIndex)) ? Number(body.onlyIndex) : undefined;
    const instruction = String(body.instruction || "").trim();
    const refs = Array.isArray(body.referenceAnalyses) ? (body.referenceAnalyses as { videoTitle?: string; essence?: ScriptEssence | null; analysisResult?: { idealFuture?: string; appealPoints?: string[]; structure?: { name: string; timeRange?: string; purpose?: string }[] } | null }[]) : [];
    const analysisTexts = refs.map((a, i) => [
      `■ 元ネタ${i + 1}「${a.videoTitle || "無題"}」`,
      a.essence ? formatEssenceForPrompt(a.essence, `元ネタ${i + 1}`) : "",
      a.analysisResult?.structure?.length ? `構成: ${a.analysisResult.structure.map((s) => `${s.name}(${s.timeRange || ""})→${s.purpose || ""}`).join(" / ")}` : "",
      a.analysisResult?.idealFuture ? `理想の未来: ${a.analysisResult.idealFuture}` : "",
      a.analysisResult?.appealPoints?.length ? `訴求: ${a.analysisResult.appealPoints.join(" / ")}` : "",
    ].filter(Boolean).join("\n")).join("\n\n");
    const profileText = String(body.profileText || "");
    const genreKnowledge = String(body.genreKnowledge || "");

    const slotsText = plan.slots.map((sl, i) => `${i + 1}枚目 [${sl.kind === "core" ? "コア" : "追加"}／${sl.role}] ${sl.title}
  役割（設計表）: ${sl.content}
  カード: ${sl.card!.name}（${sl.card!.orientation}）
  正統な意味: ${sl.meaning || getCardMeaning(sl.card!.name, sl.card!.orientation) || "（標準的なウェイト版の意味）"}
  絵柄: ${sl.imagery || getCardImagery(sl.card!.name) || "（標準的なウェイト版の絵柄）"}${sl.message && onlyIndex !== undefined && onlyIndex !== i ? `\n  伝えること（確定済み・変えない）: ${sl.message}` : ""}`).join("\n\n");

    const prompt = `あなたはプロのスピーチマーケター兼YouTube台本構成プロデューサーです。
タロット台本の「カード設計表」に、引いたカードを元にした「伝えること」を入れてください。これは骨組み（具体ロジック）を作る前に「この動画で何を伝えるか」を確認・修正するためのものです。
詳細な肉付け・セリフ例・尺配分は書かないこと。オープニングと終盤CTAの設計も書かない（ルールで固定）。

【鉄則】
- 背骨（メインテーマと主張／中心メタファー／冒頭の約束）を先に決める。中心メタファーはこの台本で使うスピ的比喩を1つだけ。可能なら1枚目（または物語の軸になるカード）の絵柄に実際に描かれている要素から選ぶ。冒頭の約束は、終盤で同じ言葉で回収するオープンループを視聴者への語りかけ1行で
- 各カードの「絵柄の見せ場」は、記載の絵柄の中から、このテーマで視聴者に見せると効く要素を1つ選んで短く書く（記載に無い要素は書かない）
- 各カードの「伝えること」は、この台本固有の主張を1行で（そのまま台本のキーメッセージになる文）。引いたカードの「正統な意味」の範囲内でテーマと設計表の役割に紐づける。末尾に出典を付ける:（元ネタ◯の△△より）または（ジャンルナレッジより）。出典の無い新規の訴求を発明しない
- 「流れ」は何をどの順で言うかを1〜2行で具体的に
- 【禁止】「気づきを与えてファン化」「欲求を最大化」など、どの台本にも当てはまる汎用的なマーケ用語だけの記述。「伝えること」だけを読んで、この動画が何を言う動画か分かること
- 元ネタの文をそのまま写さない。要点を自分の言葉で書く
${onlyIndex !== undefined ? `- 今回は ${onlyIndex + 1}枚目だけを作り直す。他のカードの「伝えること」と背骨は変えずにそのまま返す` : ""}
${instruction ? `\n【ユーザーからの指示（最優先）】\n${instruction}\n` : ""}
テーマ: ${topic || "（未設定）"}
${profileText ? `\n【チャンネル・語り手】\n${profileText.slice(0, 1500)}\n` : ""}
【カード設計表（引いたカード入り）】
${slotsText}

${analysisTexts ? `【元ネタの分析】\n${analysisTexts.slice(0, 9000)}\n` : ""}${genreKnowledge ? `\n【ジャンルナレッジ】\n${genreKnowledge.slice(0, 3000)}\n` : ""}
必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "backbone": { "theme": "メインテーマと主張（1行）", "metaphor": "中心メタファー（◯◯の形。カギ括弧なし）", "promise": "冒頭の約束（視聴者への語りかけ1行）" },
  "slots": [ { "index": 1, "highlight": "絵柄の見せ場（短く）", "message": "伝えること（1行＋出典）", "flow": "流れ（1〜2行）" } ] }`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 4000, messages: [{ role: "user", content: prompt }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
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
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 4000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }
    const parsed = parseJSON(raw);
    if (!parsed) return NextResponse.json({ error: "AI応答の解析に失敗しました" }, { status: 500 });
    const bb = (parsed.backbone || {}) as Partial<CardPlanBackbone>;
    const backbone: CardPlanBackbone = {
      theme: String(bb.theme || plan.backbone?.theme || "").trim().slice(0, 200),
      metaphor: String(bb.metaphor || plan.backbone?.metaphor || "").replace(/[「」]/g, "").trim().slice(0, 40),
      promise: String(bb.promise || plan.backbone?.promise || "").trim().slice(0, 200),
    };
    const items = Array.isArray(parsed.slots) ? (parsed.slots as { index?: number; highlight?: string; message?: string; flow?: string }[]) : [];
    const slots: CardSlot[] = plan.slots.map((sl, i) => {
      const it = items.find((x) => Number(x.index) === i + 1) || items[i];
      if (!it) return sl;
      if (onlyIndex !== undefined && onlyIndex !== i && sl.message) return sl;   // 1枚だけ作り直すときは他は維持
      return {
        ...sl,
        meaning: sl.meaning || getCardMeaning(sl.card!.name, sl.card!.orientation) || "",
        imagery: sl.imagery || getCardImagery(sl.card!.name) || "",
        highlight: String(it.highlight || sl.highlight || "").trim().slice(0, 80),
        message: String(it.message || sl.message || "").trim().slice(0, 300),
        flow: String(it.flow || sl.flow || "").trim().slice(0, 300),
      };
    });
    return NextResponse.json({ backbone, slots, filledAt: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "カード設計の処理に失敗しました" }, { status: 500 });
  }
}
