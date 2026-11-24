import { NextRequest, NextResponse } from "next/server";
import { callAi } from "@/lib/ai-call";
import { worldviewPromptBlock, scanWorldview, HOME_WORLDVIEW, skeletonForGeneration } from "@/lib/worldview";
import { normalizeAiModel, parseAiSpec, geminiPreamble } from "@/lib/ai-model";
import { extractCardsFromProse, extractDrawnCards, getCardImagery, getCardMeaning } from "@/lib/tarot-draw";
import { formatSectionTargets, parseSkeletonSections } from "@/lib/skeleton-chars";
import { formatEssenceForPrompt, type ScriptEssence } from "@/lib/script-analysis-store";
import { blacklistPromptBlock } from "@/lib/qc-blacklist";
import { TAROT_WRITING_NORMS, buildTechniqueBrief } from "@/lib/tarot-norms";
import { runConsistencyPass } from "@/lib/consistency";
import { loadCustomBans } from "@/lib/custom-bans";
import type { CardPlan } from "@/lib/project-store";

// タロット台本の生成（新方式）: 分割せず1回で書く。
// 渡すのは「ブリーフ（背骨・カード設計表・骨組み・使う型と場所・継承する訴求の要点）」「語り手（人格と文体サンプル）」「短い規範」「禁止表現」だけ。
// 元ネタの本文・37,000字のルール・型の例文は渡さない（過密と丸写しを構造的に断つ）。
// 生成後に、カードの一致と文字数を機械で確認し、外れていれば理由を添えて1回だけ書き直す。
export const maxDuration = 300;

interface StyleSample { text: string }
interface PatternIn { title: string; category?: string; content: string }
interface ProfileIn { channelName?: string; concept?: string; tone?: string; target?: string; characteristics?: string; commonRules?: string; ngExpressions?: string }

function jstToday(): string {
  return new Date().toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" });
}
const bodyChars = (s: string) => s.replace(/\s/g, "").length;

async function callModel(aiApiKey: string, aiModel: string, prompt: string): Promise<{ text: string; retryable?: boolean; error?: string; status?: number }> {
  return callAi(aiApiKey, aiModel, prompt, { maxTokens: 16000 });
}

// 生成結果の整形: コードフェンス・見出し・メタ注記を落とす
function cleanScript(text: string): string {
  let s = text.replace(/```[a-z]*\n?/g, "").trim();
  s = s.replace(/^#{1,6}\s+.*$/gm, "").replace(/^\*\*[^*]+\*\*\s*$/gm, "");
  s = s.replace(/\n{3,}/g, "\n\n").trim();
  return s;
}

// 本体。長い処理（型の要約→生成（最大3回）→整合編集）なので、POST はストリームで進捗を流しながらこれを待つ
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function run(body: any, progress: (m: string) => void): Promise<Record<string, unknown>> {
  try {
    const aiApiKey = String(body.aiApiKey || "");
    if (!aiApiKey) return { ...{ error: "AI APIキーを設定してください" }, status: 400 };
    const aiModel = normalizeAiModel(body.aiModel);
    const topic = String(body.topic || "");
    const genre = String(body.genre || "");
    const skeleton = String(body.skeleton || "");
    const plan = body.cardPlan as CardPlan | null | undefined;
    if (!skeleton.trim()) return { ...{ error: "骨組みがありません" }, status: 400 };
    if (!plan?.slots?.length) return { ...{ error: "カード設計表がありません" }, status: 400 };
    const profile = (body.channelProfile || null) as ProfileIn | null;
    const essence = (body.essence || null) as ScriptEssence | null;
    const patterns = Array.isArray(body.patterns) ? (body.patterns as PatternIn[]) : [];
    const samples = Array.isArray(body.styleSamples) ? (body.styleSamples as StyleSample[]).map((s) => String(s.text || "")).filter((t) => t.trim()) : [];
    const targetChars = Math.max(5000, Math.min(Number(body.targetChars) || 7000, 8500));
    const extra = String(body.instruction || "").trim();
    const structureMode = body.structureMode === "reference" ? "reference" : "template";
    const customBans = await loadCustomBans().catch(() => []);

    // カード（骨組みが正。無ければ設計表）
    const skeletonCards = extractDrawnCards(skeleton);
    const cards = skeletonCards.length >= 3 ? skeletonCards : plan.slots.filter((sl) => sl.card).map((sl, i) => ({ name: sl.card!.name, orientation: sl.card!.orientation, slot: i + 1 }));
    if (cards.length < 3) return { ...{ error: "カードが揃っていません。設計表でカードを引いてください" }, status: 400 };
    const neg = plan.slots.findIndex((sl) => sl.role === "常識破壊") + 1;
    const cardsText = cards.map((c, i) => {
      const sl = plan.slots[i];
      return `${i + 1}枚目: ${c.name}（${c.orientation}）${sl ? `［${sl.role}］${sl.title ? ` ${sl.title}` : ""}` : ""}
  正統な意味: ${getCardMeaning(c.name, c.orientation) || "（標準的なウェイト版の意味）"}
  絵柄（これ以外の要素は語らない）: ${getCardImagery(c.name) || "（標準的なウェイト版の絵柄）"}${sl?.highlight ? `\n  絵柄の見せ場: ${sl.highlight}` : ""}${sl?.message ? `\n  伝えること: ${sl.message}` : ""}${sl?.flow ? `\n  流れ: ${sl.flow}` : ""}`;
    }).join("\n");
    const b = plan.backbone;
    const backboneText = b ? `- メインテーマと主張: ${b.theme || "—"}\n- 中心メタファー（この台本で使う比喩はこれ1つ）: ${b.metaphor || "—"}\n- 冒頭の約束（終盤で同じ言葉で回収）: ${b.promise || "—"}` : "";

    const sections = parseSkeletonSections(skeleton);
    const targetsText = formatSectionTargets(skeleton);
    // 型の「狙い」を1行に要約（例文の語句を含まない）。未要約の型があるときだけ1回呼び、結果は返して設計表に保存してもらう
    const techniques = (plan.techniques || []).map((tq) => ({ ...tq }));
    const need = techniques.map((tq, i) => ({ tq, i })).filter(({ tq }) => !tq.intent || !tq.intent.trim());
    let techniqueIntents: { index: number; intent: string }[] = [];
    if (need.length > 0) {
      progress(`型の狙いを要約しています（${need.length}件）`);
      const listText = need.map(({ tq, i }) => `[${i}] （${tq.label}）${tq.item.replace(/\s+/g, " ").slice(0, 500)}`).join("\n");
      const r = await callModel(aiApiKey, aiModel, `次の「型」の説明を、台本作家に渡す「狙い」1行（40〜90字）に要約してください。
条件: 何を・どの場面で・どういう効果のために言うか。例文の語句・言い回しは一切含めない（文面を写させないため）。【】の型名は残してよい。
必ずJSONのみ: { "items": [ { "index": 0, "intent": "..." } ] }

${listText}`);
      const m = r.text.match(/\{[\s\S]*\}/);
      try {
        const parsed = m ? JSON.parse(m[0]) as { items?: { index: number; intent: string }[] } : null;
        for (const it of parsed?.items || []) {
          const idx = Number(it.index);
          if (Number.isFinite(idx) && techniques[idx] && it.intent && String(it.intent).trim()) {
            techniques[idx].intent = String(it.intent).trim().slice(0, 160);
            techniqueIntents.push({ index: idx, intent: techniques[idx].intent! });
          }
        }
      } catch { techniqueIntents = []; }
    }
    const techniqueBrief = buildTechniqueBrief(techniques, { genre });
    const essenceText = essence ? formatEssenceForPrompt(essence, "元ネタ") : "";
    const patternsText = patterns.length ? `【登録パターン（狙いを満たす。文面は自分で作る）】\n${patterns.map((p) => `- [${p.category || "パターン"}] ${p.title}: ${p.content.replace(/\s+/g, " ").slice(0, 300)}`).join("\n")}` : "";
    const narratorText = profile ? `【語り手】
チャンネル: ${profile.channelName || "未設定"}／コンセプト: ${profile.concept || "未設定"}
口調・話し方: ${profile.tone || "未設定"}
ターゲット: ${profile.target || "未設定"}
特徴・こだわり: ${profile.characteristics || "未設定"}${profile.commonRules ? `\nチャンネル共通ルール: ${profile.commonRules.slice(0, 1200)}` : ""}${profile.ngExpressions ? `\nNG表現: ${profile.ngExpressions.slice(0, 600)}` : ""}` : "";
    const samplesText = samples.length ? `【語り手の文体サンプル（口調・テンポ・言葉の選び方の手本。文はそのまま使わない）】\n${samples.slice(0, 3).map((s, i) => `（${i + 1}）${s.replace(/\s+/g, " ").slice(0, 320)}`).join("\n")}` : "";

    const buildPrompt = (feedback: string) => `${parseAiSpec(aiModel).provider === "gemini" ? geminiPreamble("generate") + "\n\n" : ""}あなたはプロのタロット占い師兼スピリチュアルマーケターで、YouTube台本作家でもあります。
占い師として: 出たカードの正統な意味と絵柄から、1人の視聴者の状況・心・流れを一続きの物語として読み解く（役割に合わせて意味を捏造しない。逆位置・課題のカードも前向きに転換して読む）。
マーケターとして: 元ネタがハマった訴求の中身と構図を引き継ぎ、選民→共感→常識破壊→解決→理想の未来→無料鑑定、の欲求の流れで、視聴者が自分ごとにして最後まで見て動く設計にする。
下のブリーフに沿って、視聴者1人に語りかける台本を1本、最初から最後まで一続きで書いてください。これは喋るための台本です。

【今回の台本】
テーマ（タイトル）: ${topic || "（未設定）"}
ジャンル: ${genre || "（未設定）"}／構成: ${structureMode === "reference" ? "元ネタ準拠（骨組みの構成に従う）" : "いつものテンプレ"}
目標文字数: 約${targetChars.toLocaleString()}字（本文のみ。下限${Math.round(targetChars * 0.9).toLocaleString()}字、上限9,000字）
今日の日付: ${jstToday()}（時期の訴求はここを基点に。過ぎた月を未来として書かない）

【背骨】
${backboneText || "（骨組みの冒頭に従う）"}

【カード（この${cards.length}枚を、この順番・この向きで。増やさない・減らさない・入れ替えない${neg > 0 ? `。${neg}枚目が常識破壊` : ""}）】
${cardsText}

【骨組み（セクションごとの内容と字数。この順番・この分量で肉付けする）】
${skeletonForGeneration(skeleton)}

${targetsText ? `${targetsText}\n` : ""}${techniqueBrief ? `${techniqueBrief}\n` : ""}
${essenceText ? `【継承する訴求の要点（元ネタの濃さの基準。内容と構図を引き継ぎ、言い回し・数字・固有名詞は自分で作る）】\n${essenceText.slice(0, 4000)}\n` : ""}
${patternsText ? `${patternsText}\n` : ""}
${narratorText}
${samplesText}

${worldviewPromptBlock()}

${TAROT_WRITING_NORMS}

${blacklistPromptBlock(customBans)}
${extra ? `\n【追加の指示（最優先）】\n${extra}\n` : ""}${feedback ? `\n【前回の出力の問題（必ず直す）】\n${feedback}\n` : ""}
【出力】
- 台本の本文だけを出力する。見出し・箇条書き・「第◯パート」などの注記・前置き・後書きは書かない
- 段落は空行で区切る。1段落は2〜5文
- 最初の一文は割り当てられた冒頭の型から始め、最後は「またここで、お会いしましょうね」で終える`;

    // 機械確認: カードの一致と文字数
    const diffOf = (s: string): string[] => {
      const actual = extractCardsFromProse(s);
      const out: string[] = [];
      if (actual.length !== cards.length) out.push(`枚数: 指定${cards.length}枚／本文${actual.length}枚`);
      for (const a of actual) if (!cards.some((p) => p.name === a.name)) out.push(`指定に無いカード: ${a.name}（${a.orientation}）`);
      for (let i = 0; i < Math.min(actual.length, cards.length); i++) {
        const p = cards[i]; const a = actual[i];
        if (p.name !== a.name || p.orientation !== a.orientation) out.push(`${i + 1}枚目: 指定「${p.name}（${p.orientation}）」／本文「${a.name}（${a.orientation}）」`);
      }
      return out;
    };

    const attempts: { script: string; chars: number; mismatch: string[] }[] = [];
    let feedback = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      progress(attempt === 0 ? "台本を書いています（約8,000字。2〜4分かかります）" : `書き直しています（${attempt + 1}回目）: ${feedback.slice(0, 60)}`);
      const r = await callModel(aiApiKey, aiModel, buildPrompt(feedback));
      if (r.error) {
        if (attempts.length > 0) break;
        return { ...{ error: r.error, ...(r.retryable ? { retryable: true } : {}) }, status: r.status || 500 };
      }
      const script = cleanScript(r.text);
      const chars = bodyChars(script);
      const mismatch = diffOf(script);
      attempts.push({ script, chars, mismatch });
      const issues: string[] = [];
      const wv = scanWorldview(script);
      if (wv.length > 0) issues.push(`別の世界観の語が入っている: ${wv.map((h) => `「${h.label}」`).join("")}。語り手の世界観は${HOME_WORLDVIEW}。該当: ${wv.flatMap((h) => h.hits).slice(0, 3).join("／")}`);
      if (mismatch.length > 0) issues.push(`カードが指定と違う: ${mismatch.join("／")}。指定の${cards.length}枚を、この順番・この向きで出す`);
      if (chars < targetChars * 0.9) issues.push(`短すぎる: 実測${chars.toLocaleString()}字（目標約${targetChars.toLocaleString()}字）。各セクションの字数に合わせて、場面の具体・内心のセリフ・理由づけで厚くする（水増し・繰り返しはしない）`);
      if (chars > 9000) issues.push(`長すぎる: 実測${chars.toLocaleString()}字（上限9,000字）。同じ主張の繰り返し・説明の重複を削る`);
      if (issues.length === 0) break;
      feedback = issues.map((x) => `- ${x}`).join("\n");
    }
    // 最良を選ぶ: カード一致を最優先、次に目標との近さ
    const best = attempts.slice().sort((a, c) => (a.mismatch.length - c.mismatch.length) || (scanWorldview(a.script).length - scanWorldview(c.script).length) || (Math.abs(a.chars - targetChars) - Math.abs(c.chars - targetChars)))[0];
    if (!best) return { ...{ error: "台本が生成できませんでした" }, status: 500 };
    // 整合編集: 重複・矛盾・場所違い・AIっぽさだけを段落単位で直す（失敗しても生成結果は返す）
    let finalScript = best.script;
    let consistencySummary = "";
    if (body.consistencyPass !== false) {
      progress("整合編集（重複・矛盾・場所違い・AIっぽさ）をかけています");
      const c = await runConsistencyPass(aiApiKey, aiModel, best.script, {
        backbone: plan.backbone || null,
        cards: cards.map((x) => ({ name: x.name, orientation: x.orientation })),
        techniqueBrief,
        customBans,
      });
      if (!c.error) {
        // 整合編集でカードが崩れていないことを確認してから採用
        if (diffOf(c.result.script).length <= best.mismatch.length) { finalScript = c.result.script; consistencySummary = c.summary; }
        else consistencySummary = "（整合編集の結果はカードが崩れたため採用しませんでした）";
      } else consistencySummary = `（整合編集は実行できませんでした: ${c.error}）`;
    }
    return {
      script: finalScript,
      rawScript: best.script,
      consistencySummary,
      chars: bodyChars(finalScript),
      targetChars,
      attempts: attempts.length,
      sections: sections.length,
      ...(best.mismatch.length ? { cardMismatch: best.mismatch } : {}),
      techniqueBrief,
      ...(techniqueIntents.length ? { techniqueIntents } : {}),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "台本生成に失敗しました";
    return { error: msg, status: 500 };
  }
}

// POST: 進捗を流しながら待つストリーム応答。
// 1回で8,000字を書くと数分かかり、途中で何も流れないとプロキシに切られて 502 になるため、数秒ごとに進捗行を送り、
// 最後に「@@RESULT@@{json}」を1行で送る。クライアントは最後の行だけを結果として読む
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "リクエストが読めません" }, { status: 400 });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (line: string) => { if (!closed) { try { controller.enqueue(encoder.encode(line + "\n")); } catch { /* closed */ } } };
      const keep = setInterval(() => send("progress: 処理中…"), 4000);
      send("progress: 開始");
      run(body, (m) => send(`progress: ${m}`))
        .then((result) => { send("@@RESULT@@" + JSON.stringify(result)); })
        .catch((e) => { send("@@RESULT@@" + JSON.stringify({ error: e instanceof Error ? e.message : "台本生成に失敗しました", status: 500 })); })
        .finally(() => { clearInterval(keep); closed = true; try { controller.close(); } catch { /* ignore */ } });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
