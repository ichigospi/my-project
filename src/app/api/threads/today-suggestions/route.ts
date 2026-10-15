// 「今日のおすすめ投稿」5件を生成する。
// 今日の暦テーマ + 伸びてる競合投稿（オマージュ元）+ アカウント文脈 から、今日出すと良い企画を提案。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callThreadsAI, extractJson, resolveThreadsAiModel } from "@/lib/threads-ai";
import { dayAlmanac } from "@/lib/threads-koyomi";

export const maxDuration = 60;

interface SuggestionOut {
  id: string;
  title: string; // 今日出すと良い投稿のテーマ（14〜26字程度）
  angle: string; // 切り口・内容指示（生成時の追加指示に使う）
  planType: string;
  eduType: string; // 織り込む教育（任意）
  reason: string; // なぜ今日これか（暦/トレンド理由。1文）
  sourcePostId: string; // オマージュ元の競合投稿ID
  sourceExcerpt: string;
  sourceHandle: string;
  sourceLikes: number;
}

// 今日の暦からテーマのヒントを作る
function almanacThemeHint(): { label: string; hint: string } {
  const a = dayAlmanac();
  const tags: string[] = [];
  for (const e of a.lucky) tags.push(e.label);
  for (const g of a.gedan) tags.push(g.label);
  const label = `${a.rokuyo.label}${tags.length ? " / " + tags.join("・") : ""}`;
  // テーマ提案のヒント
  const hints: string[] = [];
  const has = (k: string) => a.lucky.some((e) => e.label.includes(k)) || a.gedan.some((g) => g.label.includes(k));
  if (has("満月")) hints.push("満月＝手放し・完了・感謝のテーマが刺さる");
  if (has("新月")) hints.push("新月＝願望設定・新しい始まり・宣言のテーマが刺さる");
  if (has("一粒万倍日")) hints.push("一粒万倍日＝小さな一歩・新しい挑戦を後押しするテーマ");
  if (has("天赦日")) hints.push("天赦日＝最強開運日。背中を押す・決断を促すテーマ");
  if (has("寅の日") || has("巳の日") || has("己巳")) hints.push("金運系の日＝お金・豊かさ・循環のテーマ");
  if (has("鬼宿日")) hints.push("鬼宿日＝大開運。行動・チャレンジを促すテーマ");
  if (hints.length === 0) hints.push("今日の運勢・日常の気づきから入ると親しみやすい");
  return { label, hint: hints.join(" / ") };
}

const SUGGEST_SYSTEM = `あなたはThreads運用のプロ戦略家です。占い/スピリチュアル系アカウントの「今日出すと伸びる投稿テーマ」を提案します。
与えられた「今日の暦テーマ」「伸びている競合投稿リスト」「アカウント情報」をもとに、今日投稿すると良い企画を5つ提案してください。
各提案には、オマージュ元として最適な競合投稿を1つ（提供リストのidから）選びます。
出力は有効なJSONのみ（前置き・コードフェンス禁止）。形式:
{ "suggestions": [
  { "title": "テーマ(14〜26字・具体的で惹きのある言い回し)", "angle": "切り口や内容の方向性(1〜2文・生成時の指示に使う)", "planType": "企画タイプ", "eduType": "織り込む教育(なければ空文字)", "reason": "なぜ今日これか(暦やトレンド理由を1文)", "sourcePostId": "オマージュ元の競合投稿id" }
] }
ルール:
- 5件は切り口を散らす（全部同じ型にしない）。少なくとも1件は今日の暦テーマに紐づける。
- sourcePostId は必ず提供リストの中の実在idにする。
- titleは煽りすぎず、そのアカウントの世界観に合う言い回しで。`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const accountId = body.accountId as string | undefined;
    const aiApiKey = body.aiApiKey as string | undefined;
    if (!accountId) return NextResponse.json({ error: "accountId は必須" }, { status: 400 });

    const account = await prisma.threadsAccount.findUnique({ where: { id: accountId } });

    // 伸びてる競合投稿（オマージュ元候補）。いいね順 + Hot優先で最大16件。
    const posts = await prisma.threadsCompetitorPost.findMany({
      where: { competitor: { accountId } },
      orderBy: [{ isHot: "desc" }, { likes: "desc" }, { collectedAt: "desc" }],
      take: 16,
      include: { competitor: { select: { handle: true } } },
    });

    const theme = almanacThemeHint();

    if (posts.length === 0) {
      return NextResponse.json({ almanacLabel: theme.label, suggestions: [], needsData: true });
    }

    const excerpt = (s: string, n = 90) => (s.length > n ? s.slice(0, n) + "…" : s);
    const sourceList = posts.map((p) => ({
      id: p.id,
      handle: p.competitor.handle,
      planType: p.planType,
      format: p.postFormat,
      likes: p.likes,
      content: excerpt(p.content),
    }));
    const byId = new Map(posts.map((p) => [p.id, p]));

    let suggestions: SuggestionOut[] = [];

    if (aiApiKey) {
      const instruction = [
        `# 今日の暦テーマ\n${theme.label}\nヒント: ${theme.hint}`,
        account
          ? `# アカウント情報\n名前: ${account.name}\nコンセプト: ${account.concept || "(未設定)"}\n世界観: ${account.worldview || "(未設定)"}\n独自ロジック: ${account.uniqueLogic || account.logic || "(未設定)"}`
          : "",
        `# 伸びている競合投稿（オマージュ元候補）\n${JSON.stringify(sourceList, null, 1)}`,
        `上記をもとに、今日投稿すると良い企画を5つ、指定のJSON形式で提案してください。`,
      ]
        .filter(Boolean)
        .join("\n\n");
      try {
        const res = await callThreadsAI(aiApiKey, {
          systemPrompt: SUGGEST_SYSTEM,
          userInstruction: instruction,
          model: resolveThreadsAiModel(body.model),
          maxTokens: 2000,
        });
        if (!res.error) {
          const parsed = extractJson<{ suggestions: Omit<SuggestionOut, "id" | "sourceExcerpt" | "sourceHandle" | "sourceLikes">[] }>(res.text);
          if (parsed?.suggestions?.length) {
            suggestions = parsed.suggestions.slice(0, 5).map((s, i) => {
              const src = byId.get(s.sourcePostId) ?? posts[i % posts.length];
              return {
                id: `s${i}`,
                title: String(s.title || "").trim() || "今日のおすすめ投稿",
                angle: String(s.angle || "").trim(),
                planType: String(s.planType || src.planType || "").trim(),
                eduType: String(s.eduType || "").trim(),
                reason: String(s.reason || "").trim(),
                sourcePostId: src.id,
                sourceExcerpt: excerpt(src.content, 80),
                sourceHandle: src.competitor.handle,
                sourceLikes: src.likes,
              };
            });
          }
        }
      } catch {
        // フォールバックへ
      }
    }

    // フォールバック: 伸びてる競合投稿から機械的に5件
    if (suggestions.length === 0) {
      suggestions = posts.slice(0, 5).map((p, i) => ({
        id: `s${i}`,
        title: `${p.planType || "伸びてる型"}でオマージュ投稿`,
        angle: `この競合投稿の型を踏襲しつつ、自アカウントの世界観と教育を織り込む。`,
        planType: p.planType,
        eduType: "",
        reason: i === 0 ? `今日は${theme.label}。反応の良い型から始めましょう` : `直近で伸びている型（❤️${p.likes}）`,
        sourcePostId: p.id,
        sourceExcerpt: excerpt(p.content, 80),
        sourceHandle: p.competitor.handle,
        sourceLikes: p.likes,
      }));
    }

    return NextResponse.json({ almanacLabel: theme.label, suggestions });
  } catch (e) {
    console.error("POST /api/threads/today-suggestions", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
