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
  worldview?: string;
  uniqueLogic?: string;
  ngWords?: string;
  learnedInsights?: string; // JSON文字列（実績から蓄積した学習データ）
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
  if (account.worldview) lines.push(`- 世界観（この観点で世界を語る）: ${account.worldview}`);
  if (account.uniqueLogic)
    lines.push(`- 独自ロジック・独自用語（本文中で自然に繰り返し使う）: ${account.uniqueLogic}`);
  if (account.ngWords) lines.push(`- NG表現（使わない）: ${account.ngWords}`);

  // 実績から蓄積した学習データ（これを最大限活かして精度を上げる）
  if (account.learnedInsights) {
    try {
      const ins = JSON.parse(account.learnedInsights) as {
        hooks?: string[];
        strongWords?: string[];
        growthPatterns?: string[];
        toneNotes?: string[];
        logicNotes?: string[];
      };
      const insLines: string[] = [];
      if (ins.hooks?.length) insLines.push(`- 伸びてるフックの型（優先的に使う）: ${ins.hooks.join(" / ")}`);
      if (ins.strongWords?.length) insLines.push(`- 刺さる強ワード（適所で使う）: ${ins.strongWords.join(" / ")}`);
      if (ins.growthPatterns?.length) insLines.push(`- 伸びやすい傾向: ${ins.growthPatterns.join(" / ")}`);
      if (ins.toneNotes?.length) insLines.push(`- 効いている口調: ${ins.toneNotes.join(" / ")}`);
      if (ins.logicNotes?.length) insLines.push(`- 効いている勝ち筋ロジック: ${ins.logicNotes.join(" / ")}`);
      if (insLines.length > 0) {
        lines.push("\n# 学習データ（自投稿の実績から蓄積。ここを最大限活かして精度高く作る）");
        lines.push(...insLines);
      }
    } catch {
      // 壊れたJSONは無視
    }
  }
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
ユーザーがThreadsの画面からコピーした雑多なテキスト、またはThreads画面のスクリーンショット画像を渡すので、投稿を読み取ってJSONで返してください。
スクリーンショットの場合は、画像内の投稿本文といいね・コメント・リポスト等の数値を正確に読み取ってください。
指示で「1つの投稿として結合」と言われた場合は、複数画像/テキストを読む順に1つの content にまとめ、配列は1要素だけ返してください（長文ツリー投稿＝本文＋続きのリプの取り込みに使います）。

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

export type PostFormat = "short" | "long" | "tree" | "";

export function buildPasteParseInstruction(params: {
  raw?: string;
  todayIso: string;
  postFormat?: PostFormat;
  hasImages?: boolean;
}): string {
  const { raw, todayIso, postFormat, hasImages } = params;
  const lines: string[] = [`今日の日付: ${todayIso}`, ""];
  if (postFormat === "tree") {
    lines.push(
      "これは【1つの長文ツリー投稿】です。本文（親投稿）＋続きのリプライが複数枚の画像またはテキストに分かれています。",
      "すべてを読む順に結合し、content に1つにまとめて、配列は【1要素だけ】返してください。",
      "本文と各続きの境目には、改行2つと「─────（続き）─────」の区切り行を入れてください。",
      "いいね・コメント・表示回数などの数値は【親投稿（1枚目/最初）】のものを使ってください（続きのリプの数値は使わない）。",
    );
  } else if (postFormat === "long") {
    lines.push(
      "これは【1つの長文投稿】です。複数の画像/テキストに分かれていても、1つの投稿として結合し、配列は【1要素だけ】返してください。",
    );
  } else {
    lines.push("投稿ごとに分解してください（複数の投稿が含まれる場合は配列で複数返す）。");
  }
  if (raw?.trim()) {
    lines.push("", "対象テキスト:", raw);
  } else if (hasImages) {
    lines.push("", "スクリーンショットに写っている投稿を読み取ってください。");
  }
  return lines.join("\n");
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
  "handle": "@なしのハンドル（プロフィールやスクショの @xxx 表記から読み取る。不明なら空文字）",
  "concept": "誰に・何を・どう届けるアカウントかを2-3文で",
  "logic": "投稿の勝ちパターン・構成の傾向を2-3文で（投稿サンプルがある場合のみ具体的に。無ければ発信ジャンルから一般的な定石を提案）",
  "target": "想定ターゲット像を1-2文で",
  "worldview": "このアカウントがどんな世界観・前提で物事を語っているか（例: 念の流れ／神様との繋がり観）。投稿サンプルから読み取れる場合のみ。無ければ空文字",
  "uniqueLogic": "繰り返し使われている独自用語や、他と差別化する独自の持論・理論（例: 「器」「巡り」という概念、開運は創るものという主張）。投稿サンプルから読み取れる場合のみ。無ければ空文字",
  "tone": {
    "一人称": "投稿から読み取れる一人称（不明なら空文字）",
    "語尾": "文体・語尾の特徴（例: 断定調 / です・ます調）",
    "絵文字": "絵文字の使い方の傾向",
    "改行": "改行・空行の使い方の傾向"
  }
}

注意:
- 投稿サンプルが無い場合、tone・worldview・uniqueLogicは空文字にする（憶測で埋めない）
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
  handle: string;
  concept: string;
  logic: string;
  target: string;
  worldview?: string;
  uniqueLogic?: string;
  tone: Record<string, string>;
}

// 競合登録用の軽量版（ハンドル・名前・メモだけ推定）
export const COMPETITOR_PREFILL_SYSTEM = `あなたはSNSアカウント分析の専門家です。
Threadsアカウントのプロフィール情報（テキストまたはスクリーンショット画像）から、ベンチマーク登録用の情報を読み取ってJSONで返してください。

出力形式（JSONのみを出力）:
{
  "handle": "@なしのハンドル（@xxx 表記から読み取る。不明なら空文字）",
  "name": "アカウントの表示名（不明なら空文字）",
  "note": "何者か・発信ジャンル・強み（フォロワー規模が分かれば含める）を2-3文で"
}`;

export interface CompetitorPrefillResult {
  handle: string;
  name: string;
  note: string;
}

// ============================================================
// ⑦ 自投稿スクショの傾向分析（伸びる/伸びない傾向 + ロジック提案）
// ============================================================

// アカウントに蓄積される学習データ（分析のたびにマージ更新）
export interface AccountInsights {
  hooks: string[]; // 伸びてるフックの型
  strongWords: string[]; // 刺さってる強ワード・言い回し
  growthPatterns: string[]; // 伸びやすい傾向
  toneNotes: string[]; // 口調の特徴
  logicNotes: string[]; // 勝ち筋ロジック
  analyzedCount?: number;
  updatedAt?: string;
}

export const EMPTY_INSIGHTS: AccountInsights = {
  hooks: [],
  strongWords: [],
  growthPatterns: [],
  toneNotes: [],
  logicNotes: [],
};

export const ANALYZE_POSTS_SYSTEM = `あなたはThreads運用の分析者兼「アカウント学習データ」の管理者です。
ユーザー自身のアカウントの投稿スクリーンショット（各投稿に表示回数・いいね・返信・リポスト等の数値が写っている）と、必要に応じてテキストの実績データ、そして「これまでの学習データ（累積）」を渡します。
数値の高い投稿（伸びた）と低い投稿（伸びなかった）を比較し、伸びる/伸びない要因を投稿の中身（フック・構成・強ワード・テーマ・語り口・長さ・CTA・世界観の出し方など）に踏み込んで分析してください。
そのうえで、これまでの学習データを土台に、新しい発見を【マージして更新した最新版の学習データ】を返してください（既存の有効な項目は残し、新項目を追加し、重複や矛盾は整理。各リスト最大12項目まで）。

出力形式（JSONのみを出力。説明文やコードフェンス外の文章は不要）:
{
  "summary": "今回の所感を2-3文で。何件を見て、伸びの差がどこから来ていそうか。",
  "growingTraits": ["今回わかった、伸びている投稿の具体的特徴（1項目1文）", "..."],
  "notGrowingTraits": ["今回わかった、伸びていない投稿の具体的特徴", "..."],
  "logicSuggestions": ["投稿ロジックに追記すると良い具体的な指針（命令形・そのまま使える粒度）を3〜6個", "..."],
  "insights": {
    "hooks": ["伸びてるフックの型（短く。例: 数字を冒頭に置く／問いかけで始める）", "..."],
    "strongWords": ["刺さってる強ワード・言い回し（単語やフレーズ）", "..."],
    "growthPatterns": ["伸びやすい傾向（例: 朝の投稿が伸びる／体験談が伸びる）", "..."],
    "toneNotes": ["効いている口調・文体の特徴", "..."],
    "logicNotes": ["繰り返し効いている勝ち筋ロジック", "..."]
  }
}

注意:
- 数値（表示回数・いいね）を根拠に、高い群と低い群の差分として語る
- 抽象論（「質を上げる」等）でなく再現できる具体で書く
- insights は【累積の最新版】。渡された既存学習データの有効項目は保持し、新しい発見だけ足す・磨く。単純に消さない
- スクショが数枚でも、読み取れた範囲で最大限具体的に`;

export function buildAnalyzePostsInstruction(params: {
  accountName?: string;
  concept?: string;
  currentLogic?: string;
  existingInsights?: AccountInsights | null;
  storedPosts?: { content: string; views: number; likes: number; replies: number; reposts: number }[];
  pastedText?: string;
}): string {
  const lines: string[] = [];
  if (params.accountName) lines.push(`対象アカウント: ${params.accountName}`);
  if (params.concept) lines.push(`コンセプト: ${params.concept}`);
  if (params.currentLogic) lines.push(`現在の投稿ロジック: ${params.currentLogic}`);
  const ins = params.existingInsights;
  if (ins && (ins.hooks?.length || ins.strongWords?.length || ins.growthPatterns?.length || ins.toneNotes?.length || ins.logicNotes?.length)) {
    lines.push("\nこれまでの学習データ（累積。これを土台にマージ更新する）:");
    if (ins.hooks?.length) lines.push(`- 伸びてるフック: ${ins.hooks.join(" / ")}`);
    if (ins.strongWords?.length) lines.push(`- 強ワード: ${ins.strongWords.join(" / ")}`);
    if (ins.growthPatterns?.length) lines.push(`- 伸びやすい傾向: ${ins.growthPatterns.join(" / ")}`);
    if (ins.toneNotes?.length) lines.push(`- 口調: ${ins.toneNotes.join(" / ")}`);
    if (ins.logicNotes?.length) lines.push(`- ロジック: ${ins.logicNotes.join(" / ")}`);
  } else {
    lines.push("\nこれまでの学習データ: なし（今回が初回。ゼロから作ってよい）");
  }
  if (params.storedPosts && params.storedPosts.length > 0) {
    lines.push(`\n保存済みの投稿実績（本文一部 / 表示・いいね・返信・リポスト）:`);
    params.storedPosts.forEach((p, i) => {
      lines.push(`【${i + 1}】${p.content.slice(0, 80).replace(/\n/g, " ")} … / 表示${p.views}・❤️${p.likes}・💬${p.replies}・🔁${p.reposts}`);
    });
  }
  if (params.pastedText) lines.push(`\nユーザー補足:\n${params.pastedText}`);
  lines.push("\n添付スクショと上記を踏まえ、今回の傾向・ロジック提案と、マージ更新した最新の学習データ(insights)をJSONで返してください。");
  return lines.join("\n");
}

export interface AnalyzePostsResult {
  summary: string;
  growingTraits: string[];
  notGrowingTraits: string[];
  logicSuggestions: string[];
  insights: AccountInsights;
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
// ⑦ 画像生成用プロンプトの作成（Claudeが投稿本文から画像プロンプトを書く）
// ============================================================

export const IMAGE_PROMPT_SYSTEM = `あなたはSNS投稿用の画像プロンプト作成の専門家です。
Threads投稿の本文を渡すので、その投稿に添える画像を生成するためのプロンプト（英語）を作ってください。

ルール:
- 画像内に文字・テキストは入れない（画像生成AIは文字が苦手なため）
- 投稿の雰囲気・感情・テーマを視覚的なモチーフで表現する
- スマホのフィードで目を引く、明快で美しい構図にする
- 写真調かイラスト調かは投稿のトーンに合わせる（ユーザーがスタイル指定した場合はそれに従う）

出力形式（JSONのみを出力）:
{
  "prompt": "英語の画像生成プロンプト（1段落）",
  "description": "どんな画像になるかの日本語説明（1文）"
}`;

export function buildImagePromptInstruction(content: string, styleInstruction?: string): string {
  const lines: string[] = [];
  lines.push("## 投稿本文");
  lines.push("```");
  lines.push(content);
  lines.push("```");
  if (styleInstruction?.trim()) {
    lines.push(`\n## スタイル指定\n${styleInstruction.trim()}`);
  }
  lines.push("\nこの投稿に添える画像のプロンプトを作ってください。");
  return lines.join("\n");
}

export interface ImagePromptResult {
  prompt: string;
  description: string;
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
