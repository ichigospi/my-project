// Threadsツール用プロンプト構築 + 結果パース + 類似度チェック（Xツールとは独立）

// ============================================================
// 型
// ============================================================

export interface ThreadsAccountContext {
  name: string;
  handle: string;
  concept: string;
  logic: string;
  target: string;
  tone: string; // JSON文字列
}

export interface ThreadsKnowledgeItem {
  type: string;
  title: string;
  content: string;
}

// 参考投稿（競合投稿のスナップショット）
export interface RefPostInput {
  authorHandle?: string;
  content: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  views?: number;
  planType?: string;
  hookType?: string;
  structureJson?: string;
}

export interface LibraryItemInput {
  type: "hook" | "plan" | "cta";
  title: string;
  content: string;
}

export type HomageMode = "single" | "hybrid" | "custom";

// 企画タイプの分類候補（AIはこの中から選ぶ。該当なしは "その他"）
export const PLAN_TYPES = [
  "あるある共感",
  "ノウハウ・手順",
  "リスト列挙",
  "問いかけ・議論喚起",
  "ストーリー・体験談",
  "実績・権威",
  "逆張り・持論",
  "注意喚起・失敗回避",
  "診断・チェックリスト",
  "名言・マインド",
  "その他",
] as const;

// ============================================================
// アカウントコンテキスト（キャッシュされるナレッジ部分）
// ============================================================

export function buildAccountKnowledgeContext(
  account: ThreadsAccountContext,
  knowledge: ThreadsKnowledgeItem[],
): string {
  const lines: string[] = [];
  lines.push("# 自アカウント情報（投稿はこの土台に沿って作成する）");
  lines.push(`- アカウント名: ${account.name}（@${account.handle}）`);
  if (account.concept) lines.push(`- コンセプト: ${account.concept}`);
  if (account.logic) lines.push(`- 投稿ロジック: ${account.logic}`);
  if (account.target) lines.push(`- ターゲット: ${account.target}`);
  try {
    const tone = JSON.parse(account.tone || "{}") as Record<string, string>;
    const toneEntries = Object.entries(tone).filter(([, v]) => v);
    if (toneEntries.length > 0) {
      lines.push("- 口調ルール:");
      for (const [k, v] of toneEntries) lines.push(`  - ${k}: ${v}`);
    }
  } catch {
    if (account.tone) lines.push(`- 口調: ${account.tone}`);
  }

  const rules = knowledge.filter((k) => k.type === "rule");
  const others = knowledge.filter((k) => k.type !== "rule");
  if (rules.length > 0) {
    lines.push("\n# 投稿ルール（必ず守る）");
    for (const r of rules) lines.push(`## ${r.title}\n${r.content}`);
  }
  if (others.length > 0) {
    lines.push("\n# ノウハウ・教材（作成時の判断基準として使う）");
    for (const k of others) lines.push(`## ${k.title}\n${k.content}`);
  }
  return lines.join("\n");
}

// ============================================================
// ① 貼り付けテキストのパース
// ============================================================

export const PASTE_PARSE_SYSTEM = `あなたはThreads投稿データの整理係です。
ユーザーがThreadsの画面からコピーした雑多なテキスト、またはThreads画面のスクリーンショット画像を渡すので、投稿ごとに分解してJSONで返してください。
スクリーンショットの場合は、画像内の投稿本文といいね・コメント・リポスト等の数値を正確に読み取ってください。

出力形式（JSON配列のみを出力。説明文・コードフェンス外の文章は不要）:
[
  {
    "content": "投稿本文（改行は保持）",
    "likes": 数値（不明なら0）,
    "replies": 数値（不明なら0）,
    "reposts": 数値（不明なら0）,
    "views": 数値（不明なら0）,
    "postUrl": "URLがあれば",
    "postedAt": "ISO8601形式の日時（分かる場合のみ。'3日前'等の相対表記は今日の日付から逆算）",
    "authorHandle": "@なしのハンドル（分かる場合のみ）"
  }
]

注意:
- 「いいね」「コメント」「再投稿」等のUI文字列や数字は本文に含めない
- 1.2万 のような表記は 12000 に変換する
- 本文の改行・絵文字はそのまま保持する`;

export function buildPasteParseInstruction(raw: string, todayIso: string): string {
  return `今日の日付: ${todayIso}\n\n以下を投稿ごとに分解してください:\n\n${raw}`;
}

export interface ParsedPastePost {
  content: string;
  likes?: number;
  replies?: number;
  reposts?: number;
  views?: number;
  postUrl?: string;
  postedAt?: string;
  authorHandle?: string;
}

// ============================================================
// ② 構造分解 + 企画分類
// ============================================================

export const CLASSIFY_SYSTEM = `あなたはSNS投稿の構造分析の専門家です。
渡されたThreads投稿を分析し、JSONで返してください。

出力形式（JSON配列のみを出力）:
[
  {
    "index": 入力の番号,
    "planType": "${PLAN_TYPES.join(" | ")} のいずれか",
    "hookType": "フックの型を短く（例: 数字インパクト / 逆張り断言 / 問いかけ / 共感あるある）",
    "structure": {
      "hook": "冒頭のフック部分の抜き出し",
      "body": "展開部の構成を1-2文で説明",
      "closing": "締め・CTAの説明",
      "rhythm": "改行・文長のリズムの特徴を1文で"
    },
    "whyItWorks": "この投稿が伸びた（伸びそうな）理由を1-2文で"
  }
]`;

export function buildClassifyInstruction(posts: { content: string }[]): string {
  return posts
    .map((p, i) => `【投稿${i}】\n${p.content}`)
    .join("\n\n---\n\n");
}

export interface ClassifyResult {
  index: number;
  planType: string;
  hookType: string;
  structure: { hook: string; body: string; closing: string; rhythm: string };
  whyItWorks: string;
}

// ============================================================
// ③ オマージュ生成
// ============================================================

export const HOMAGE_SYSTEM = `あなたはThreads運用のプロのゴーストライターです。
伸びている競合投稿を「オマージュ元」として、自アカウント用の投稿を作成します。

## 作成の大原則
- オマージュ元の「型」に徹底的に忠実に: 構成・展開順・改行のリズム・文の長さ・フックの作り・締め方をそのまま踏襲する
- 差し替えるのは中身だけ: 固有名詞・数字・具体例・体験部分を自アカウントの文脈（コンセプト・ロジック・ターゲット）に置き換える
- オリジナルの工夫や独自の展開を勝手に足さない。「自分らしさ」はアカウント情報の口調ルールの範囲でのみ出す
- ただし文の丸写しは禁止。同じ意味でも表現は言い換える（類似度チェックで検出されるため）
- Threadsの投稿として自然な長さ・改行にする（最大500文字）

## 出力形式（JSON のみを出力）
{
  "candidates": [
    {
      "content": "投稿案の本文（改行込み）",
      "mapping": "どの部分をオマージュ元のどこから取ったかの対応を2-3行で",
      "usedHook": "使用したフックの説明（差し替えた場合はその旨）"
    }
  ]
}
候補は指定された件数だけ作成する。`;

export interface HomageRequest {
  refA: RefPostInput;
  refB?: RefPostInput | null;
  mode: HomageMode;
  // hybrid時: どの部位をどちらから取るか等の指定。custom時: 自由指示
  modeInstruction?: string;
  libraryItems?: LibraryItemInput[];
  extraInstruction?: string;
  count: number;
}

export function buildHomageInstruction(req: HomageRequest): string {
  const lines: string[] = [];

  const refBlock = (label: string, p: RefPostInput) => {
    const metrics = [
      p.views ? `表示${p.views}` : "",
      p.likes ? `いいね${p.likes}` : "",
      p.replies ? `コメント${p.replies}` : "",
      p.reposts ? `リポスト${p.reposts}` : "",
    ]
      .filter(Boolean)
      .join(" / ");
    lines.push(`## オマージュ元${label}${p.authorHandle ? `（@${p.authorHandle}）` : ""}`);
    if (metrics) lines.push(`実績: ${metrics}`);
    if (p.planType) lines.push(`企画タイプ: ${p.planType}`);
    if (p.hookType) lines.push(`フックの型: ${p.hookType}`);
    if (p.structureJson && p.structureJson !== "{}") {
      lines.push(`構造分解: ${p.structureJson}`);
    }
    lines.push("本文:");
    lines.push("```");
    lines.push(p.content);
    lines.push("```");
    lines.push("");
  };

  refBlock("A", req.refA);
  if (req.refB) refBlock("B", req.refB);

  lines.push("## 作成モード");
  if (req.mode === "single") {
    lines.push("Aの型を忠実に踏襲して作成する。");
  } else if (req.mode === "hybrid") {
    lines.push("AとBを組み合わせて作成する。" + (req.modeInstruction || "基本はAの本文骨格にBのフックの型を移植する。"));
  } else {
    lines.push(req.modeInstruction || "Aの型を踏襲して作成する。");
  }

  if (req.libraryItems && req.libraryItems.length > 0) {
    const labels: Record<string, string> = { hook: "フック", plan: "企画", cta: "CTA" };
    lines.push("\n## ライブラリからの差し替え指定（以下を必ず組み込む）");
    for (const item of req.libraryItems) {
      lines.push(`- ${labels[item.type] ?? item.type}「${item.title}」: ${item.content}`);
    }
  }

  if (req.extraInstruction) {
    lines.push(`\n## 追加指示\n${req.extraInstruction}`);
  }

  lines.push(`\n投稿案を${req.count}件作成してください。`);
  return lines.join("\n");
}

export interface HomageCandidate {
  content: string;
  mapping: string;
  usedHook: string;
}

// ============================================================
// ④ 壁打ちチャット
// ============================================================

export function buildChatSystemPrompt(params: {
  draftContent: string;
  refA?: RefPostInput | null;
  refB?: RefPostInput | null;
}): string {
  const lines: string[] = [];
  lines.push(`あなたはThreads運用の壁打ち相手です。ユーザーが作成中の投稿案について、改善の相談に乗ります。

## ふるまい
- 指示されたら投稿案の修正版を出す。修正版は必ず全文を \`\`\` で囲んで出力する（ユーザーがコピーして反映するため）
- 感想ではなく、フックの強さ・具体性・リズム・ターゲット適合の観点で具体的に指摘する
- オマージュ元の型から離れる提案はしない（型の踏襲がこのツールの方針）
- 回答は簡潔に。長い講釈はしない`);
  lines.push(`\n## 現在の投稿案\n\`\`\`\n${params.draftContent}\n\`\`\``);
  if (params.refA) {
    lines.push(`\n## オマージュ元A\n\`\`\`\n${params.refA.content}\n\`\`\``);
  }
  if (params.refB) {
    lines.push(`\n## オマージュ元B\n\`\`\`\n${params.refB.content}\n\`\`\``);
  }
  return lines.join("\n");
}

// ============================================================
// ⑤ AI考察下書き
// ============================================================

// ============================================================
// ⑥ アカウント情報の自動入力（プロフィール→コンセプト等の推定）
// ============================================================

export const PREFILL_SYSTEM = `あなたはSNSアカウント分析の専門家です。
Threadsアカウントのプロフィール情報・投稿サンプル（テキストまたはスクリーンショット画像）から、そのアカウントの運用設計を推定してJSONで返してください。
スクリーンショットが渡された場合は、画像からプロフィール文・表示名・ハンドル・投稿内容を読み取って分析してください。

出力形式（JSONのみを出力）:
{
  "name": "アカウントの表示名（プロフィールから。不明なら空文字）",
  "concept": "誰に・何を・どう届けるアカウントかを2-3文で",
  "logic": "投稿の勝ちパターン・構成の傾向を2-3文で（投稿サンプルがある場合のみ具体的に。無ければ発信ジャンルから一般的な定石を提案）",
  "target": "想定ターゲット像を1-2文で",
  "tone": {
    "一人称": "投稿から読み取れる一人称（不明なら空文字）",
    "語尾": "文体・語尾の特徴（例: 断定調 / です・ます調）",
    "絵文字": "絵文字の使い方の傾向",
    "改行": "改行・空行の使い方の傾向"
  }
}

注意:
- 投稿サンプルが無い場合、toneの各項目は空文字にする（憶測で埋めない）
- conceptとtargetはプロフィール文からの推定でよいが、簡潔に`;

export function buildPrefillInstruction(params: {
  handle?: string;
  profileName?: string;
  bio?: string;
  posts?: string[];
  pastedText?: string;
}): string {
  const lines: string[] = [];
  if (params.handle) lines.push(`ハンドル: @${params.handle}`);
  if (params.profileName) lines.push(`表示名: ${params.profileName}`);
  if (params.bio) lines.push(`プロフィール文: ${params.bio}`);
  if (params.posts && params.posts.length > 0) {
    lines.push(`\n投稿サンプル（${params.posts.length}件）:`);
    params.posts.forEach((p, i) => lines.push(`【${i + 1}】\n${p}\n`));
  }
  if (params.pastedText) {
    lines.push(`\nユーザーが貼り付けたプロフィール・投稿テキスト:\n${params.pastedText}`);
  }
  lines.push("\nこのアカウントの運用設計を推定してください。");
  return lines.join("\n");
}

export interface PrefillResult {
  name: string;
  concept: string;
  logic: string;
  target: string;
  tone: Record<string, string>;
}

export const INSIGHT_SYSTEM = `あなたはThreads運用の分析者です。投稿の実績データを見て、考察の下書きを作ります。
- オマージュ元の実績と自投稿の実績を比較し、何が効いた/効かなかったかを推測する
- 次の投稿に活かせる示唆を1-2個出す
- 3-5文の簡潔な日本語で。断定しすぎず、数字を根拠にする`;

export function buildInsightInstruction(params: {
  content: string;
  metrics: { views: number; likes: number; replies: number; reposts: number };
  refA?: RefPostInput | null;
  refB?: RefPostInput | null;
}): string {
  const lines: string[] = [];
  lines.push("## 自投稿");
  lines.push("```");
  lines.push(params.content);
  lines.push("```");
  const m = params.metrics;
  lines.push(`実績: 表示${m.views} / いいね${m.likes} / コメント${m.replies} / リポスト${m.reposts}`);
  const ref = (label: string, p: RefPostInput) => {
    lines.push(`\n## オマージュ元${label}の実績`);
    lines.push(`表示${p.views ?? 0} / いいね${p.likes ?? 0} / コメント${p.replies ?? 0} / リポスト${p.reposts ?? 0}`);
  };
  if (params.refA) ref("A", params.refA);
  if (params.refB) ref("B", params.refB);
  lines.push("\n考察の下書きを書いてください。");
  return lines.join("\n");
}

// ============================================================
// 類似度チェック（完コピ検出）
// ============================================================

function normalizeForSim(s: string): string {
  return s.toLowerCase().replace(/[【】「」『』（）()[\]！？!?、。・\s]/g, "");
}

function bigramSet(s: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i <= s.length - 2; i++) set.add(s.substring(i, i + 2));
  return set;
}

function jaccard(a: string, b: string): number {
  const na = normalizeForSim(a);
  const nb = normalizeForSim(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;
  const ga = bigramSet(na);
  const gb = bigramSet(nb);
  let inter = 0;
  ga.forEach((g) => {
    if (gb.has(g)) inter++;
  });
  const union = ga.size + gb.size - inter;
  return union > 0 ? inter / union : 0;
}

export interface SimilarityReport {
  overall: number; // 全文の類似度 0-1
  maxLine: number; // 行単位の最大類似度 0-1
  worstLine: string; // 最も似ている行
  isCopyRisk: boolean; // 完コピ警告
}

// 生成文 vs オマージュ元の類似度。行単位で最も似ている箇所を検出する
export function checkCopySimilarity(generated: string, source: string): SimilarityReport {
  const overall = jaccard(generated, source);
  const genLines = generated.split("\n").map((l) => l.trim()).filter((l) => l.length >= 8);
  const srcLines = source.split("\n").map((l) => l.trim()).filter((l) => l.length >= 8);
  let maxLine = 0;
  let worstLine = "";
  for (const g of genLines) {
    for (const s of srcLines) {
      const sim = jaccard(g, s);
      if (sim > maxLine) {
        maxLine = sim;
        worstLine = g;
      }
    }
  }
  return {
    overall,
    maxLine,
    worstLine,
    // 全文が6割以上一致 or ある行がほぼ丸写し（85%以上）なら警告
    isCopyRisk: overall >= 0.6 || maxLine >= 0.85,
  };
}
