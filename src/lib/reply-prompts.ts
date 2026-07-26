// 顧客対応ツール（返信第二脳）のプロンプト定義
// ベース人格 = プロの占い師兼スピリチュアルマーケター。
// ここに DB のルール（ReplyPolicy）とオーナー補正（設定）を上乗せして生成する。

// ===== カテゴリ定義 =====

export const REPLY_CATEGORIES = [
  { value: "request", label: "鑑定依頼・申込", emoji: "🔮" },
  { value: "thanks", label: "感想・お礼", emoji: "💌" },
  { value: "question", label: "質問・相談", emoji: "❓" },
  { value: "complaint", label: "クレーム・不満", emoji: "⚡" },
  { value: "refund", label: "返金・キャンセル", emoji: "💸" },
  { value: "heavy", label: "重い相談（要注意）", emoji: "🚨" },
  { value: "spam", label: "営業・スパム", emoji: "🗑" },
  { value: "general", label: "その他", emoji: "💬" },
] as const;

export type ReplyCategory = (typeof REPLY_CATEGORIES)[number]["value"];

export function categoryLabel(value: string): string {
  const c = REPLY_CATEGORIES.find((c) => c.value === value);
  return c ? `${c.emoji} ${c.label}` : value;
}

// ===== ツール設定（AppSetting: reply_tool_settings）=====

export interface ReplyToolSettings {
  // オーナーによるペルソナ補正（ベース人格に上乗せ）
  personaNote: string;
  // 文体・口調の指定（呼びかけ方、絵文字、締めの定型文など）
  toneNote: string;
  // 承認フロー: direct = 外注がそのまま送信可 / approval = オーナー承認必須
  approvalMode: "direct" | "approval";
  // 事業・商品の前提情報（商品名、価格、提供形式など）
  businessNote: string;
}

export const DEFAULT_REPLY_SETTINGS: ReplyToolSettings = {
  personaNote: "",
  toneNote: "",
  approvalMode: "direct",
  businessNote: "",
};

export function parseReplySettings(json: string | null | undefined): ReplyToolSettings {
  if (!json) return { ...DEFAULT_REPLY_SETTINGS };
  try {
    return { ...DEFAULT_REPLY_SETTINGS, ...JSON.parse(json) };
  } catch {
    return { ...DEFAULT_REPLY_SETTINGS };
  }
}

export const REPLY_SETTINGS_KEY = "reply_tool_settings";

// ===== ベース人格（プロの占い師兼スピリチュアルマーケター）=====

const BASE_PERSONA = `あなたは、占い・スピリチュアル事業を10年以上運営してきたプロの占い師であり、同時に顧客心理を熟知したスピリチュアル系マーケターです。オーナー（占い師本人）の「第二の脳」として、お客様からのメッセージ（UTAGE経由の個別メッセージ）への返信文を作成します。

【占い師としての姿勢】
- お客様は不安や悩みを抱えてメッセージを送ってくる。まず感情に寄り添い、共感してから本題に入る
- 断定的に不幸を予言しない。恐怖を煽らない。「〜の傾向があります」「〜すると流れが良くなります」のように、希望と行動を残す表現を使う
- 鑑定結果そのものはここでは作成しない（鑑定はオーナー本人が行う）。あくまで接客・案内・フォローの返信に徹する
- お客様の呼び方・言葉遣いは丁寧に。上から目線・説教口調は厳禁

【マーケターとしての姿勢】
- 一通の返信はLTV（長期的な信頼関係）への投資。目先の売上のための押し売りは信頼を壊すので絶対にしない
- 感想・お礼のメッセージは関係を深める最大のチャンス。丁寧に受け止め、次の接点（リピート・企画案内）に自然につなげる
- クレームは離脱ではなくファン化の分岐点。言い訳せず、まず受け止める
- 案内をする場合も「売り込み」ではなく「その人の悩みに合う提案」として書く

【顧客対応の鉄則】
- 医療・法律・投資の判断が必要な内容には、占いの立場から断定的な助言をしない。専門機関への相談を優しく促す
- 返金・キャンセルの可否や金額の約束を、返信文の中で勝手に確定しない（方針の説明までに留める）
- できない約束（「絶対に良くなります」等）を書かない
- 長すぎる返信は読まれない。要点を絞り、温かさを保ちつつ簡潔に

【エスカレーション判定（最重要）】
以下に該当する場合は返信文を作成せず、必ずオーナー本人の対応に回す（isEscalation: true）:
- 希死念慮・自傷・自殺をほのめかす内容
- 深刻な健康問題・病気の診断や治療に関わる相談
- 法律トラブル・警察沙汰・脅迫的な内容
- 強い怒りの返金要求・炎上や訴訟をほのめかす内容
- ストーカー・依存が疑われる過度な執着メッセージ
- その他、判断を誤るとお客様や事業に重大な影響が出る内容`;

// ===== 型 =====

export interface PolicyForPrompt {
  id: string;
  category: string;
  title: string;
  situation: string;
  guideline: string;
}

export interface ExampleForPrompt {
  id: string;
  category: string;
  customerMessage: string;
  replyMessage: string;
  note: string;
}

export interface ReplyGenerationResult {
  category: string;
  isEscalation: boolean;
  escalationReason: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  usedPolicyIds: string[];
  usedExampleIds: string[];
  draft: string;
}

// ===== プロンプト構築 =====

export function buildReplySystemPrompt(
  settings: ReplyToolSettings,
  policies: PolicyForPrompt[],
): string {
  const parts: string[] = [BASE_PERSONA];

  if (settings.businessNote.trim()) {
    parts.push(`【事業・商品の前提情報】\n${settings.businessNote.trim()}`);
  }
  if (settings.personaNote.trim()) {
    parts.push(`【オーナーからの人格・判断の補正指示（ベース人格より優先）】\n${settings.personaNote.trim()}`);
  }
  if (settings.toneNote.trim()) {
    parts.push(`【文体・口調のルール（必ず守る）】\n${settings.toneNote.trim()}`);
  }

  if (policies.length > 0) {
    const lines = policies.map((p) => {
      const situation = p.situation ? `状況: ${p.situation} → ` : "";
      return `- [${p.id}] (${categoryLabel(p.category)}) ${p.title}: ${situation}${p.guideline}`;
    });
    parts.push(`【オーナーの判断ルール（ベース人格より優先。IDで引用すること）】\n${lines.join("\n")}`);
  }

  parts.push(`【出力形式】
必ず以下のJSONのみを出力する。説明文・コードブロックは不要。
{
  "category": "request|thanks|question|complaint|refund|heavy|spam|general",
  "isEscalation": false,
  "escalationReason": "エスカレーションの場合のみ理由を書く。それ以外は空文字",
  "confidence": "high|medium|low（ルールと実例で十分裏付けられるなら high、判断に迷いがあるなら low）",
  "reasoning": "なぜこの分類・この返信にしたか。参照したルール・実例のIDに触れながら2-3文で",
  "usedPolicyIds": ["参照したルールのID"],
  "usedExampleIds": ["参考にした実例のID"],
  "draft": "返信文。エスカレーションの場合は空文字"
}`);

  return parts.join("\n\n");
}

export function buildReplyUserMessage(opts: {
  customerMessage: string;
  customerName?: string;
  context?: string;
  examples: ExampleForPrompt[];
  pastReplies?: { customerMessage: string; reply: string }[];
}): string {
  const parts: string[] = [];

  if (opts.examples.length > 0) {
    const blocks = opts.examples.map(
      (e) =>
        `[${e.id}] (${categoryLabel(e.category)})${e.note ? ` ※${e.note}` : ""}\nお客様: ${e.customerMessage}\n返信: ${e.replyMessage}`,
    );
    parts.push(`【過去の実例（オーナーが実際に返した文。文体と判断の最重要参考。IDで引用すること）】\n${blocks.join("\n---\n")}`);
  }

  if (opts.pastReplies && opts.pastReplies.length > 0) {
    const blocks = opts.pastReplies.map(
      (h) => `お客様: ${h.customerMessage}\n返信: ${h.reply}`,
    );
    parts.push(`【このお客様との過去のやりとり（文脈として考慮する）】\n${blocks.join("\n---\n")}`);
  }

  if (opts.context?.trim()) {
    parts.push(`【補足情報（外注スタッフからのメモ）】\n${opts.context.trim()}`);
  }

  parts.push(
    `【今回のお客様からのメッセージ${opts.customerName ? `（${opts.customerName} さま）` : ""}】\n${opts.customerMessage}\n\n上記のメッセージを分類し、エスカレーション判定を行い、必要なら返信文を作成してください。JSONのみ出力。`,
  );

  return parts.join("\n\n");
}

// ===== 修正差分からのルール抽出（学習）=====

export function buildLearnFromEditPrompt(opts: {
  customerMessage: string;
  aiDraft: string;
  finalReply: string;
}): string {
  return `あなたは占い・スピリチュアル事業の顧客対応ルールを整備するアナリストです。
AIが作成した返信案を、オーナー（占い師本人）が修正して送信しました。この修正差分から「オーナーの判断ルール」を抽出してください。

【お客様のメッセージ】
${opts.customerMessage}

【AIの返信案】
${opts.aiDraft}

【オーナーが実際に送った文（修正後）】
${opts.finalReply}

修正のポイント（言い回しの好み、判断の違い、追加/削除された要素）を分析し、今後の返信生成に使えるルールを1〜3個提案してください。
以下のJSON配列のみ出力。説明文は不要。
[{"category":"request|thanks|question|complaint|refund|heavy|spam|general","title":"ルールの短い名前","situation":"どういう状況のとき","guideline":"どう対応するか（具体的に）"}]`;
}

// ===== JSONパース =====

export function parseReplyResult(text: string): ReplyGenerationResult | null {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const obj = JSON.parse(match[0]);
    return {
      category: typeof obj.category === "string" ? obj.category : "general",
      isEscalation: Boolean(obj.isEscalation),
      escalationReason: typeof obj.escalationReason === "string" ? obj.escalationReason : "",
      confidence: ["high", "medium", "low"].includes(obj.confidence) ? obj.confidence : "medium",
      reasoning: typeof obj.reasoning === "string" ? obj.reasoning : "",
      usedPolicyIds: Array.isArray(obj.usedPolicyIds) ? obj.usedPolicyIds.map(String) : [],
      usedExampleIds: Array.isArray(obj.usedExampleIds) ? obj.usedExampleIds.map(String) : [],
      draft: typeof obj.draft === "string" ? obj.draft : "",
    };
  } catch {
    return null;
  }
}
