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

// =============================
// ポスト生成プロンプト
// =============================

export const GENERATE_BASE_SYSTEM = `あなたはXポスト作成の専門家です。
ユーザーの自アカ情報・教材・運用フレームワーク（教材1〜13）を踏まえ、伸びるポストを作成します。

【重要なルール】
- 自アカ情報の口調・USP・商品・過去のストーリーを必ず参照する（自分語りはストーリー教材の素材を使う）
- 指定された教育タイプに沿った訴求にする（目的=理想未来、信用=共通点、問題点=現状の痛み、手段=やり方、投資=コストの正当化、行動=今すぐ系）
- 冒頭一文目は14手法のいずれかで強く引っ張る
- ストーリー型運用で書く場合は「起承転結 + ネタの3要素」を意識
- NGパターン（教材5）に該当するもの（説教/上から目線/共感薄/抽象論だけ/単なる宣伝）は出さない
- 1ポスト=140字以内（半角280字）。連投の場合は各ポストごとに分けて出力
- 強化教育（読む見る/変化/素直/アウトプット/基準値/覚悟）はスパイス指定があれば自然に織り込む

【出力ルール】
- 必ず指定されたJSON形式のみで出力（前後に余計な文章を入れない）
- JSONはMarkdownコードブロックで囲まずに、生のJSONをそのまま出力
- フィールドが不明な場合は空文字列を返す
`;

export interface GenerateUserMessageOpts {
  genre: "business" | "spiritual";
  mode: "scratch" | "template" | "daily_slot";
  educationType: string; // 12教育タイプのいずれか or ""
  logicType?: "" | "課題解決型" | "欲求喚起型";
  topic: string; // 生成テーマ（自由記述）
  hookType?: string; // 14手法のいずれか
  structureType?: string; // 10構造タイプのいずれか
  reinforcementElements?: string[]; // 強化要素
  spiceEnabled?: boolean; // 強化教育の自動スパイス
  templateSkeleton?: string; // テンプレモード時の骨格
  templatePlaceholders?: string[]; // テンプレモード時のプレースホルダ一覧
  referenceExamples?: string[]; // 参考にしたい既存ポスト本文
  customInstruction?: string; // 自由追記
}

export function buildGenerateUserMessage(opts: GenerateUserMessageOpts): string {
  const genreLabel = opts.genre === "business" ? "ビジネス系" : "占いスピ系";
  const lines: string[] = [];
  lines.push(`ジャンル: ${genreLabel}`);
  lines.push(`生成モード: ${opts.mode === "scratch" ? "ゼロから" : opts.mode === "template" ? "テンプレから" : "デイリープランのスロットから"}`);
  if (opts.educationType) lines.push(`教育タイプ: ${opts.educationType}の教育`);
  if (opts.logicType) lines.push(`ロジック型: ${opts.logicType}`);
  if (opts.hookType) lines.push(`推奨フック: ${opts.hookType}`);
  if (opts.structureType) lines.push(`構造タイプ: ${opts.structureType}`);
  if (opts.reinforcementElements && opts.reinforcementElements.length > 0) {
    lines.push(`強化要素: ${opts.reinforcementElements.join(" / ")}`);
  }
  if (opts.spiceEnabled) {
    lines.push("強化教育のスパイス: ON（読む見る/変化/素直/アウトプット/基準値/覚悟 を自然に織り込む）");
  }
  lines.push("");
  lines.push(`【テーマ】`);
  lines.push(opts.topic || "（自由）");

  if (opts.templateSkeleton) {
    lines.push("");
    lines.push("【テンプレ骨格】");
    lines.push(opts.templateSkeleton);
    if (opts.templatePlaceholders && opts.templatePlaceholders.length > 0) {
      lines.push("");
      lines.push(`プレースホルダ: ${opts.templatePlaceholders.join(", ")}`);
    }
  }

  if (opts.referenceExamples && opts.referenceExamples.length > 0) {
    lines.push("");
    lines.push("【参考にしたい既存ポスト】");
    opts.referenceExamples.forEach((ex, i) => {
      lines.push(`参考${i + 1}: ${ex}`);
    });
  }

  if (opts.customInstruction) {
    lines.push("");
    lines.push("【追加指示】");
    lines.push(opts.customInstruction);
  }

  lines.push("");
  lines.push(`【出力フォーマット】次のJSONを出力してください（コードブロックなし、生JSON）:`);
  lines.push(`
{
  "posts": [
    {
      "content": "ポスト本文（140字目安）",
      "charCount": 137,
      "hookType": "使ったフック手法",
      "educationType": "${opts.educationType || "目的"}",
      "structureType": "使った構造タイプ",
      "reinforcementElements": ["即効性", "限定性"]
    }
  ],
  "rationale": "なぜこの構成にしたか・どこで伸びを狙ったか（1〜2文）"
}`);

  return lines.join("\n");
}

// 生成プロンプト用のシステム+ナレッジ（キャッシュ対象）
export async function buildGenerateSystemPrompt(genre: "business" | "spiritual"): Promise<{
  systemPrompt: string;
  knowledgeContext: string;
}> {
  const framework = await loadKnowledgeFramework();
  const genreKnowledge = await loadGenreKnowledge(genre);

  return {
    systemPrompt: GENERATE_BASE_SYSTEM,
    knowledgeContext: [
      "# 知識フレームワーク",
      framework,
      "",
      `# ${genre === "business" ? "ビジ垢" : "占い垢"}の自アカ情報・教材`,
      genreKnowledge,
    ].join("\n\n"),
  };
}

// 生成結果のパース
export interface GeneratedPostItem {
  content: string;
  charCount: number;
  hookType: string;
  educationType: string;
  structureType: string;
  reinforcementElements: string[];
}

export interface GeneratedResult {
  posts: GeneratedPostItem[];
  rationale: string;
}

// =============================
// テンプレ自動抽出プロンプト
// =============================

export const EXTRACT_TEMPLATE_BASE_SYSTEM = `あなたはXポストの構造分析専門家です。
渡された競合ポスト（または参考ポスト）から、再利用可能なテンプレ骨格を抽出します。

【重要なルール】
- 元ポストの固有名詞・数字・人物名をプレースホルダ（{固有名詞}/{数字}/{商品名}/{人名} 等）に置換する
- 言い回し・接続詞・改行は元の構造を残す（語尾の力強さも踏襲する）
- 教育タイプ（12要素）・冒頭一文目の14手法・構造タイプ（10種）・強化要素を判定する
- 出力は必ず指定されたJSON形式のみで（前後に文章を入れない・コードブロックなし）
`;

export function buildExtractTemplateUserMessage(opts: {
  genre: "business" | "spiritual";
  postContent: string;
  postMeta?: { likes?: number; retweets?: number; impressions?: number };
}): string {
  const genreLabel = opts.genre === "business" ? "ビジネス系" : "占いスピ系";
  const meta = opts.postMeta
    ? `（👍${opts.postMeta.likes ?? 0} 🔁${opts.postMeta.retweets ?? 0}${opts.postMeta.impressions ? ` 📊${opts.postMeta.impressions.toLocaleString()}` : ""}）`
    : "";
  return `以下の${genreLabel}ポストからテンプレ骨格を抽出してください ${meta}

【元ポスト】
${opts.postContent}

【出力フォーマット】次のJSONを出力してください（コードブロックなし、生JSON）:

{
  "name": "テンプレ名（30字以内、何のテンプレか分かる短い名前）",
  "skeleton": "プレースホルダ化した骨格テキスト（改行も保持）",
  "placeholders": ["{固有名詞1}", "{数字}", "{商品名}"],
  "structure": {
    "hookType": "不完全情報/重要性/希少性/権威性/恐怖損失回避/ターゲット刺し/強烈な感情/パワーワード/簡易性/矛盾/ニュース性/暴露報告/限定性/反社会性 のいずれか",
    "educationType": "目的/信用/問題点/手段/投資/行動/読む見る/変化/素直/アウトプット/基準値/覚悟 のいずれか",
    "structureType": "フック型/リスト型/ストーリー型/質問型/対比型/実績訴求型/Before/After型/短文インパクト/数字インパクト型/リアクション型 のいずれか",
    "reinforcementElements": ["再現性", "即効性"]
  },
  "notes": "このテンプレを使うコツ・注意点（1〜2文）"
}`;
}

export async function buildExtractTemplateSystemPrompt(genre: "business" | "spiritual"): Promise<{
  systemPrompt: string;
  knowledgeContext: string;
}> {
  const framework = await loadKnowledgeFramework();
  const genreKnowledge = await loadGenreKnowledge(genre);
  return {
    systemPrompt: EXTRACT_TEMPLATE_BASE_SYSTEM,
    knowledgeContext: [
      "# 知識フレームワーク",
      framework,
      "",
      `# ${genre === "business" ? "ビジ垢" : "占い垢"}の自アカ情報・教材`,
      genreKnowledge,
    ].join("\n\n"),
  };
}

export interface ExtractedTemplate {
  name: string;
  skeleton: string;
  placeholders: string[];
  structure: {
    hookType: string;
    educationType: string;
    structureType: string;
    reinforcementElements: string[];
  };
  notes: string;
}

export function parseExtractedTemplate(raw: string): { template: ExtractedTemplate | null; parseError: boolean } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const structure = parsed.structure ?? {};
    const tpl: ExtractedTemplate = {
      name: typeof parsed.name === "string" ? parsed.name : "",
      skeleton: typeof parsed.skeleton === "string" ? parsed.skeleton : "",
      placeholders: Array.isArray(parsed.placeholders)
        ? parsed.placeholders.filter((x: unknown): x is string => typeof x === "string")
        : [],
      structure: {
        hookType: typeof structure.hookType === "string" ? structure.hookType : "",
        educationType: typeof structure.educationType === "string" ? structure.educationType : "",
        structureType: typeof structure.structureType === "string" ? structure.structureType : "",
        reinforcementElements: Array.isArray(structure.reinforcementElements)
          ? structure.reinforcementElements.filter((x: unknown): x is string => typeof x === "string")
          : [],
      },
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
    return { template: tpl, parseError: false };
  } catch {
    return { template: null, parseError: true };
  }
}

// =============================
// シーケンスパターン自動抽出プロンプト
// =============================

export const EXTRACT_SEQUENCE_BASE_SYSTEM = `あなたはXポスト連投・引用RT・ストーリー連投の構造分析専門家です。
ユーザーが選んだ複数のポスト（並び順は時系列）から、再利用可能な連投パターンを抽出します。

【重要なルール】
- 各スロットの教育タイプ（12要素）・構造タイプ（10種）・骨格スケルトンをプレースホルダ化して抽出する
- スロット間の接続タイプを判定: quote_rt（引用RT）/ consecutive（連投・スレッド）/ independent（独立投稿）/ story_chain（ストーリー連投）
- パターン全体の趣旨（どういう導線か・どこで反応を取りに行くか）も短く言語化する
- 出力は必ず指定されたJSON形式のみで（前後に文章を入れない・コードブロックなし）
`;

export interface SequenceExtractPostInput {
  index: number; // 1始まり
  content: string;
  isQuoteRt?: boolean;
  likes?: number;
  retweets?: number;
}

export function buildExtractSequenceUserMessage(opts: {
  genre: "business" | "spiritual";
  posts: SequenceExtractPostInput[];
}): string {
  const genreLabel = opts.genre === "business" ? "ビジネス系" : "占いスピ系";
  const postsText = opts.posts
    .map((p) => {
      const meta = [
        p.isQuoteRt ? "(引用RT)" : "",
        typeof p.likes === "number" ? `👍${p.likes}` : "",
        typeof p.retweets === "number" ? `🔁${p.retweets}` : "",
      ].filter(Boolean).join(" ");
      return `[ポスト${p.index}] ${meta}\n${p.content.trim()}`;
    })
    .join("\n\n---\n\n");

  return `以下の${genreLabel}ポスト${opts.posts.length}件を時系列順の連投パターンとして分析し、シーケンスパターンを抽出してください。

${postsText}

【出力フォーマット】次のJSONを出力してください（コードブロックなし、生JSON）:

{
  "name": "パターン名（30字以内）",
  "description": "このパターンの導線・狙い（1〜2文）",
  "pattern": [
    {
      "slot": 1,
      "educationType": "目的/信用/問題点/手段/投資/行動/読む見る/変化/素直/アウトプット/基準値/覚悟 のいずれか",
      "structureType": "フック型/リスト型/ストーリー型/質問型/対比型/実績訴求型/Before/After型/短文インパクト/数字インパクト型/リアクション型 のいずれか",
      "skeleton": "プレースホルダ化した骨格テキスト",
      "placeholders": ["{固有名詞}", "{数字}"],
      "connectionType": "quote_rt | consecutive | independent | story_chain （次スロットへの接続。最終スロットは空文字）"
    }
  ],
  "example": "実際のポスト本文を連結した参考例（読みやすいよう改行で区切る）"
}`;
}

export async function buildExtractSequenceSystemPrompt(genre: "business" | "spiritual"): Promise<{
  systemPrompt: string;
  knowledgeContext: string;
}> {
  const framework = await loadKnowledgeFramework();
  const genreKnowledge = await loadGenreKnowledge(genre);
  return {
    systemPrompt: EXTRACT_SEQUENCE_BASE_SYSTEM,
    knowledgeContext: [
      "# 知識フレームワーク",
      framework,
      "",
      `# ${genre === "business" ? "ビジ垢" : "占い垢"}の自アカ情報・教材`,
      genreKnowledge,
    ].join("\n\n"),
  };
}

export interface ExtractedSequenceSlot {
  slot: number;
  educationType: string;
  structureType: string;
  skeleton: string;
  placeholders: string[];
  connectionType: string;
}

export interface ExtractedSequencePattern {
  name: string;
  description: string;
  pattern: ExtractedSequenceSlot[];
  example: string;
}

export function parseExtractedSequence(raw: string): { pattern: ExtractedSequencePattern | null; parseError: boolean } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed.pattern) ? parsed.pattern : [];
    const slots: ExtractedSequenceSlot[] = arr.map((s: Partial<ExtractedSequenceSlot>, i: number) => ({
      slot: typeof s.slot === "number" ? s.slot : i + 1,
      educationType: typeof s.educationType === "string" ? s.educationType : "",
      structureType: typeof s.structureType === "string" ? s.structureType : "",
      skeleton: typeof s.skeleton === "string" ? s.skeleton : "",
      placeholders: Array.isArray(s.placeholders)
        ? s.placeholders.filter((x: unknown): x is string => typeof x === "string")
        : [],
      connectionType: typeof s.connectionType === "string" ? s.connectionType : "",
    }));
    const pattern: ExtractedSequencePattern = {
      name: typeof parsed.name === "string" ? parsed.name : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      pattern: slots,
      example: typeof parsed.example === "string" ? parsed.example : "",
    };
    return { pattern, parseError: false };
  } catch {
    return { pattern: null, parseError: true };
  }
}

export function parseGeneratedResult(raw: string): { result: GeneratedResult; parseError: boolean } {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed.posts) ? parsed.posts : [];
    const posts: GeneratedPostItem[] = arr.map((p: Partial<GeneratedPostItem>) => ({
      content: typeof p.content === "string" ? p.content : "",
      charCount: typeof p.charCount === "number" ? p.charCount : (typeof p.content === "string" ? p.content.length : 0),
      hookType: typeof p.hookType === "string" ? p.hookType : "",
      educationType: typeof p.educationType === "string" ? p.educationType : "",
      structureType: typeof p.structureType === "string" ? p.structureType : "",
      reinforcementElements: Array.isArray(p.reinforcementElements) ? p.reinforcementElements.filter((x): x is string => typeof x === "string") : [],
    }));
    return {
      result: {
        posts,
        rationale: typeof parsed.rationale === "string" ? parsed.rationale : "",
      },
      parseError: false,
    };
  } catch {
    return { result: { posts: [], rationale: "" }, parseError: true };
  }
}


// =============================
// 自アナリティクス: 伸び比較分析プロンプト
// =============================

export const ANALYTICS_COMPARE_BASE_SYSTEM = `あなたはXアカウント運用の改善コーチです。
ユーザー自身のアカウントの「伸びたポスト群」と「伸びなかったポスト群」を比較分析し、
ワード・フレーズ・訴求軸・構造の観点で「何が刺さっていて、何が刺さっていないか」を抽出します。

【絶対のルール】
- "該当なし"や空配列で逃げないこと。最低でも 伸びパターン3個・伸びないパターン3個・刺さりワード5個・刺さらない言い回し3個・改善ヒント3個 は必ず出す
- ポストの本文を実際に読み込んで、共通する具体的な単語・絵文字・冒頭一文・語尾・訴求パターンを抽出する
- 抽象論（「具体性が大事」「数字を入れる」など）禁止。必ず**実際に元ポストから引用**するか、**何文字目に何が書かれていたか**まで具体的に書く
- 教材の14手法・12教育要素・10構造タイプ・NGパターンの観点を踏まえて言語化する
- 自アカ情報の口調・USP・過去ストーリーと整合した改善案を出す

【出力ルール】
- 必ず指定されたJSON形式のみで出力（前後に文章を入れない・コードブロックなし）
- どうしても見つからない項目は空配列OKだが、その場合は他のフィールドで埋め合わせる
`;

export interface AnalyticsPostInput {
  index: number;
  content: string;
  likes: number;
  retweets: number;
  impressions: number;
  postedAt?: string;
}

export function buildAnalyticsCompareUserMessage(opts: {
  genre: "business" | "spiritual";
  topPosts: AnalyticsPostInput[];
  bottomPosts: AnalyticsPostInput[];
  customInstruction?: string;
}): string {
  const genreLabel = opts.genre === "business" ? "ビジネス系" : "占いスピ系";
  const fmt = (label: string, posts: AnalyticsPostInput[]) =>
    posts
      .map((p) => `[${label}${p.index}] 👍${p.likes} 🔁${p.retweets}${p.impressions ? ` 📊${p.impressions.toLocaleString()}` : ""}\n${p.content.trim()}`)
      .join("\n\n---\n\n");

  return `以下は自分の${genreLabel}アカウントのポスト群です。
「伸びたポスト」と「伸びなかったポスト」の本文を**注意深く読み込んで**、
何が刺さっていて何が刺さっていないかを比較分析してください。

【伸びたポスト（上位）】
${fmt("上位", opts.topPosts)}

【伸びなかったポスト（下位）】
${fmt("下位", opts.bottomPosts)}

${opts.customInstruction ? `\n【追加指示】\n${opts.customInstruction}\n` : ""}

【分析観点（必ず全部見る）】
1. **冒頭一文**: 上位はどんな言葉で始まる？下位は？（例: 「〇〇な人へ」「実は…」「【保存版】」など）
2. **刺さってるワード/フレーズ**: 上位群で頻出する具体的な単語・言い回し・絵文字（最低5個）
3. **刺さってないワード/フレーズ**: 下位群でしか出てこない or 下位群に偏ってる単語・言い回し（最低3個）
4. **訴求軸**: 数字訴求 / 緊急性 / 限定性 / 共感 / 暴露 / 実績 / 未来訴求 / 恐怖回避 / 反社会性 など、上位と下位で何が違う？
5. **教育タイプ**: 12教育要素のどれが上位に多いか / 下位に多いか
6. **構造**: 短文インパクト型 / リスト型 / ストーリー型 / 質問型 / 対比型 など、上位の構造傾向
7. **語尾・口調**: 「〜やで」「〜ます」「〜よね」など、語尾のリズム
8. **絵文字使い**: 数・位置・種類

【出力フォーマット】次のJSONを出力してください（コードブロックなし、生JSON）:

{
  "diff": "上位と下位の決定的な差を1〜2文で（最も重要な発見）",

  "stickyWords": [
    { "word": "実際の単語/フレーズ/絵文字", "context": "上位ポストN番に〇〇という形で出現", "why": "なぜ刺さるか" }
  ],

  "missingWords": [
    { "word": "下位で目立つ言い回し", "context": "下位ポストN番で〇〇のように使われていた", "why": "なぜ弱いか" }
  ],

  "appealAxes": [
    { "axis": "訴求軸名（数字訴求/限定性/暴露 など）", "winning": "上位での出方を具体的に", "losing": "下位での出方を具体的に" }
  ],

  "winningPatterns": [
    { "pattern": "上位群に共通する要素を1文で", "evidence": "ポストN番の〇〇という箇所", "category": "フック/構造/教育/語彙/語尾/絵文字/訴求" }
  ],

  "losingPatterns": [
    { "pattern": "下位群に共通する弱さを1文で", "evidence": "ポストN番の〇〇という箇所", "category": "フック/構造/教育/語彙/NG/訴求" }
  ],

  "improvementHints": [
    { "hint": "次のポストですぐ実行できる具体的アクション（XXすべき/XXは避けるべき）", "priority": "high", "rationale": "上位群の傾向から見るとXXが効いている" }
  ],

  "topPickToTemplate": [
    { "index": 1, "reason": "このポストはXXの観点で再現性高い" }
  ]
}`;
}

export async function buildAnalyticsCompareSystemPrompt(genre: "business" | "spiritual"): Promise<{
  systemPrompt: string;
  knowledgeContext: string;
}> {
  const framework = await loadKnowledgeFramework();
  const genreKnowledge = await loadGenreKnowledge(genre);
  return {
    systemPrompt: ANALYTICS_COMPARE_BASE_SYSTEM,
    knowledgeContext: [
      "# 知識フレームワーク",
      framework,
      "",
      `# ${genre === "business" ? "ビジ垢" : "占い垢"}の自アカ情報・教材`,
      genreKnowledge,
    ].join("\n\n"),
  };
}

export interface AnalyticsCompareResult {
  diff: string;
  stickyWords: { word: string; context: string; why: string }[];
  missingWords: { word: string; context: string; why: string }[];
  appealAxes: { axis: string; winning: string; losing: string }[];
  winningPatterns: { pattern: string; evidence: string; category: string }[];
  losingPatterns: { pattern: string; evidence: string; category: string }[];
  improvementHints: { hint: string; priority: "high" | "medium" | "low"; rationale: string }[];
  topPickToTemplate: { index: number; reason: string }[];
}

export function emptyAnalyticsCompareResult(): AnalyticsCompareResult {
  return {
    diff: "",
    stickyWords: [],
    missingWords: [],
    appealAxes: [],
    winningPatterns: [],
    losingPatterns: [],
    improvementHints: [],
    topPickToTemplate: [],
  };
}

export function parseAnalyticsCompareResult(raw: string): { result: AnalyticsCompareResult; parseError: boolean } {
  // 余計な前後テキストを耐えるため、最初の { から最後の } までを抜き出す
  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  try {
    const p = JSON.parse(cleaned);
    const arr = (a: unknown): unknown[] => (Array.isArray(a) ? a : []);
    const str = (v: unknown): string => (typeof v === "string" ? v : "");
    const result: AnalyticsCompareResult = {
      diff: str(p.diff),
      stickyWords: arr(p.stickyWords).map((x): AnalyticsCompareResult["stickyWords"][number] => {
        const o = x as Partial<AnalyticsCompareResult["stickyWords"][number]>;
        return { word: str(o.word), context: str(o.context), why: str(o.why) };
      }),
      missingWords: arr(p.missingWords).map((x): AnalyticsCompareResult["missingWords"][number] => {
        const o = x as Partial<AnalyticsCompareResult["missingWords"][number]>;
        return { word: str(o.word), context: str(o.context), why: str(o.why) };
      }),
      appealAxes: arr(p.appealAxes).map((x): AnalyticsCompareResult["appealAxes"][number] => {
        const o = x as Partial<AnalyticsCompareResult["appealAxes"][number]>;
        return { axis: str(o.axis), winning: str(o.winning), losing: str(o.losing) };
      }),
      winningPatterns: arr(p.winningPatterns).map((x): AnalyticsCompareResult["winningPatterns"][number] => {
        const o = x as Partial<AnalyticsCompareResult["winningPatterns"][number]>;
        return { pattern: str(o.pattern), evidence: str(o.evidence), category: str(o.category) };
      }),
      losingPatterns: arr(p.losingPatterns).map((x): AnalyticsCompareResult["losingPatterns"][number] => {
        const o = x as Partial<AnalyticsCompareResult["losingPatterns"][number]>;
        return { pattern: str(o.pattern), evidence: str(o.evidence), category: str(o.category) };
      }),
      improvementHints: arr(p.improvementHints).map((x): AnalyticsCompareResult["improvementHints"][number] => {
        const o = x as Partial<AnalyticsCompareResult["improvementHints"][number]>;
        return {
          hint: str(o.hint),
          priority: o.priority === "high" || o.priority === "low" ? o.priority : "medium",
          rationale: str(o.rationale),
        };
      }),
      topPickToTemplate: arr(p.topPickToTemplate).map((x): AnalyticsCompareResult["topPickToTemplate"][number] => {
        const o = x as Partial<AnalyticsCompareResult["topPickToTemplate"][number]>;
        return {
          index: typeof o.index === "number" ? o.index : 0,
          reason: str(o.reason),
        };
      }),
    };
    return { result, parseError: false };
  } catch {
    return { result: emptyAnalyticsCompareResult(), parseError: true };
  }
}
