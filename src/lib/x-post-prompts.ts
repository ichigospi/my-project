// AI生成・分析で使うシステムプロンプト構築（サーバ専用 — fs を使うのでクライアントから import しないこと）
// クライアント側で使う型・パーサは x-post-analysis-types.ts に分離
import { loadKnowledgeFramework, loadGenreKnowledge } from "./x-post-knowledge-loader";

// 型再エクスポート（API から使う）
export type { AnalysisResult } from "./x-post-analysis-types";
export { emptyAnalysisResult, parseAnalysisResult } from "./x-post-analysis-types";

// =============================
// 分析プロンプト
// =============================

export const ANALYSIS_BASE_SYSTEM = `あなたはXポスト分析の専門家です。
ユーザーが収集した競合ポスト群を分析し、共通する伸びパターン・フック・強化要素・教育タイプを抽出します。

以下の知識フレームワーク（教材1〜13）に基づいて、構造的に分析してください。
- 冒頭一文目の14手法（不完全情報/重要性/希少性/権威性/恐怖損失回避/ターゲット刺し/強烈な感情/パワーワード/簡易性/矛盾/ニュース性/暴露報告/限定性/反社会性）
- 強化要素14分類（再現性/即効性/限定性/常識破壊 等）
- ポスト構造タイプ（フック型/リスト型/ストーリー型/質問型/対比型 等）
- 12の教育要素（目的/信用/問題点/手段/投資/行動 + 強化6つ）
- ストーリー型運用（起承転結 + ネタの3要素）
- インセンティブ設計

【重要な出力ルール】
- 必ず指定されたJSON形式のみで出力してください（前後に余計な文章を入れない）
- JSONはMarkdownコードブロックで囲まずに、生のJSONをそのまま出力してください
- フィールドが不明な場合は空配列または空文字列を返してください
- 例文を引用するときは元ポストの一部を抜き出して示してください
`;

export interface AnalysisPostInput {
  authorHandle: string;
  authorName?: string;
  content: string;
  likes: number;
  retweets: number;
  impressions: number;
}

export function buildAnalysisUserMessage(opts: {
  posts: AnalysisPostInput[];
  customInstruction?: string;
  genre: "business" | "spiritual";
}): string {
  const postsText = opts.posts
    .map((p, i) => {
      const meta = [
        `@${p.authorHandle}`,
        p.authorName ? `（${p.authorName}）` : "",
        `👍${p.likes}`,
        `🔁${p.retweets}`,
        p.impressions > 0 ? `📊${p.impressions.toLocaleString()}` : "",
      ].filter(Boolean).join(" ");
      return `[ポスト${i + 1}] ${meta}\n${p.content.trim()}`;
    })
    .join("\n\n---\n\n");

  const genreLabel = opts.genre === "business" ? "ビジネス系" : "占いスピ系";

  return `以下の競合ポスト${opts.posts.length}件を分析してください。
対象ジャンル: ${genreLabel}

${postsText}

${opts.customInstruction ? `\n【追加指示】\n${opts.customInstruction}\n` : ""}

【出力フォーマット】次のJSONを出力してください（コードブロックなし、生JSON）:

{
  "summary": "全体傾向の1〜2文要約",
  "structureTypes": [
    {"type": "フック型", "count": 2, "evidence": "ポスト1, 2 が冒頭で実績数字で引っ張る型"}
  ],
  "commonHooks": [
    {"type": "他人の権威", "description": "解説", "examples": ["例文の一部"]}
  ],
  "reinforcementElements": [
    {"element": "即効性", "description": "解説", "examples": ["例文"]}
  ],
  "educationTypes": [
    {"type": "目的の教育", "description": "なぜそう判断したか", "evidence": "ポストの該当箇所"}
  ],
  "powerWords": ["速攻で", "㊙", "やってられない"],
  "applicationHints": [
    "${genreLabel}の自アカで使うとしたら、どういう翻訳/応用が考えられるか具体的に"
  ]
}`;
}

// =============================
// デイリープラン: AIテーマ提案プロンプト
// =============================

export const DAILY_PLAN_BASE_SYSTEM = `あなたはXポスト戦略アドバイザーです。
ユーザーの自アカ情報・教材・運用フレームワーク（教材1〜13）を踏まえて、今日のポスト計画における各スロットの「具体的なテーマ」「推奨フックタイプ」「選定理由」を提案します。

【重要なルール】
- 各スロットには既に教育タイプが割り当てられています
- 自アカ情報の口調・USP・商品・過去のストーリーを必ず参照する
- 教育タイプに応じたテーマを提案する（例: 目的の教育なら理想未来訴求、信用の教育なら過去のへぼさからの共通点訴求 等）
- 提案するテーマは具体的で、すぐにポスト生成に使える形で書く
- 出力は必ず指定されたJSON形式のみで（前後に文章を入れない）
- JSONはMarkdownコードブロックで囲まずに、生のJSONをそのまま出力
`;

interface SlotForPrompt {
  slot: number;
  educationType: string;
  connectionType: string;
}

export function buildDailyPlanUserMessage(opts: {
  date: string;
  genre: "business" | "spiritual";
  slots: SlotForPrompt[];
  recentThemesSummary?: string; // 過去N日に既に使ったテーマの要約（被り回避用）
  customInstruction?: string;
}): string {
  const genreLabel = opts.genre === "business" ? "ビジネス系" : "占いスピ系";
  const slotsText = opts.slots
    .map((s) => `Slot ${s.slot}: ${s.educationType}の教育（次への接続: ${s.connectionType || "(最終)"}）`)
    .join("\n");

  return `日付: ${opts.date}
ジャンル: ${genreLabel}

【今日のスロット構成】
${slotsText}

${opts.recentThemesSummary ? `\n【最近使ったテーマ（被らないように）】\n${opts.recentThemesSummary}\n` : ""}
${opts.customInstruction ? `\n【追加指示】\n${opts.customInstruction}\n` : ""}

【出力フォーマット】次のJSONを出力してください（コードブロックなし、生JSON）:

{
  "slots": [
    {
      "slot": 1,
      "theme": "具体的なテーマ（読者が興味を持つ内容を1〜2文で）",
      "hookType": "推奨フック（不完全情報/重要性/希少性/権威性/恐怖損失回避/ターゲット刺し/強烈な感情/パワーワード/簡易性/矛盾/ニュース性/暴露報告/限定性/反社会性 のいずれか）",
      "reasoning": "なぜこのテーマ・フックを選んだか（1文）"
    }
  ]
}`;
}

// デイリープラン用システムプロンプト（キャッシュ対象）
export async function buildDailyPlanSystemPrompt(genre: "business" | "spiritual"): Promise<{
  systemPrompt: string;
  knowledgeContext: string;
}> {
  const framework = await loadKnowledgeFramework();
  const genreKnowledge = await loadGenreKnowledge(genre);

  return {
    systemPrompt: DAILY_PLAN_BASE_SYSTEM,
    knowledgeContext: [
      "# 知識フレームワーク",
      framework,
      "",
      `# ${genre === "business" ? "ビジ垢" : "占い垢"}の自アカ情報・教材`,
      genreKnowledge,
    ].join("\n\n"),
  };
}

// AI出力のテーマ提案をパース
export interface DailyPlanSlotProposal {
  slot: number;
  theme: string;
  hookType: string;
  reasoning: string;
}

export function parseDailyPlanProposals(raw: string): { proposals: DailyPlanSlotProposal[]; parseError: boolean } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed.slots) ? parsed.slots : [];
    const proposals: DailyPlanSlotProposal[] = arr.map((s: Partial<DailyPlanSlotProposal>) => ({
      slot: typeof s.slot === "number" ? s.slot : 0,
      theme: typeof s.theme === "string" ? s.theme : "",
      hookType: typeof s.hookType === "string" ? s.hookType : "",
      reasoning: typeof s.reasoning === "string" ? s.reasoning : "",
    }));
    return { proposals, parseError: false };
  } catch {
    return { proposals: [], parseError: true };
  }
}

// 分析用システムプロンプト（キャッシュ対象）
export async function buildAnalysisSystemPrompt(genre: "business" | "spiritual"): Promise<{
  systemPrompt: string;
  knowledgeContext: string;
}> {
  const framework = await loadKnowledgeFramework();
  const genreKnowledge = await loadGenreKnowledge(genre);

  return {
    systemPrompt: ANALYSIS_BASE_SYSTEM,
    knowledgeContext: [
      "# 知識フレームワーク",
      framework,
      "",
      `# ${genre === "business" ? "ビジ垢" : "占い垢"}の自アカ情報・教材`,
      genreKnowledge,
    ].join("\n\n"),
  };
}

