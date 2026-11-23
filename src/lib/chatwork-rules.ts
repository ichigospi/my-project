// Chatwork通知の「ルール」モデル（画面・サーバー共通。prisma は使わない）
// 1ルール = いつ（イベント） → どこへ（ルーム） → 誰に（宛先） → 何を（本文テンプレ） ＋ タスク
export type NotifyEvent = "submitted" | "approved" | "rejected" | "script_generated" | "skeleton_done" | "title_fixed" | "video_done";

export interface NotifyEventDef { id: NotifyEvent; label: string; emoji: string; title: string; body: string; when: string }

export const NOTIFY_EVENTS: NotifyEventDef[] = [
  { id: "submitted", label: "台本提出", emoji: "📤", when: "ライターが「台本を提出」を押したとき", title: "台本が提出されました（添削待ち）",
    body: "チャンネル: {チャンネル名}\n企画: {企画名}\n担当: {担当ライター名}\n添削部屋: {添削部屋URL}\n元ネタ: {元ネタURL}\n添削部屋（ステップ⑦）で確認・添削をお願いします。" },
  { id: "approved", label: "添削完了（合格）", emoji: "✅", when: "オーナーが添削部屋で「合格」を押したとき", title: "台本が合格になりました",
    body: "チャンネル: {チャンネル名}\n企画: {企画名}\n添削部屋: {添削部屋URL}\nサムネテロップ:\n{サムネテロップ}\n参考デザイン元: {参考デザインURL}\n添削後の台本が最終稿として反映されています。" },
  { id: "rejected", label: "再提出依頼", emoji: "🔁", when: "オーナーが添削部屋で「再提出を依頼」を押したとき", title: "台本の再提出依頼が出されました",
    body: "チャンネル: {チャンネル名}\n企画: {企画名}\n添削部屋: {添削部屋URL}\nオーナーコメントを確認し、台本を修正して再提出してください。" },
  { id: "script_generated", label: "台本生成完了", emoji: "📝", when: "台本出力で台本が生成されたとき", title: "台本が生成されました",
    body: "チャンネル: {チャンネル名}\n企画: {企画名}\n品質チェックと修正のあと、提出してください。" },
  { id: "skeleton_done", label: "骨組み完成", emoji: "🧩", when: "構成提案で骨組みが生成されたとき", title: "骨組みができました",
    body: "チャンネル: {チャンネル名}\n企画: {企画名}" },
  { id: "title_fixed", label: "タイトル確定", emoji: "🏷️", when: "企画のタイトルが確定したとき", title: "タイトルが確定しました",
    body: "チャンネル: {チャンネル名}\n企画: {企画名}" },
  { id: "video_done", label: "動画完成", emoji: "🎬", when: "工程表で動画が完成になったとき", title: "動画が完成しました",
    body: "チャンネル: {チャンネル名}\n企画: {企画名}" },
];

export const PLACEHOLDERS = ["{企画名}", "{チャンネル名}", "{担当ライター名}", "{添削部屋URL}", "{元ネタURL}", "{サムネテロップ}", "{参考デザインURL}", "{コメント}"] as const;

// 宛先: 固定の人（account）／オーナー（owner: 設定のオーナーID）／この企画の担当ライター（assignee: 企画に設定した人。無ければ fallback）
export interface Recipient { kind: "account" | "owner" | "assignee"; accountId?: string; name?: string }

export interface ChatworkRule {
  id: string;
  event: NotifyEvent;
  enabled: boolean;
  roomId: string;
  roomName?: string;
  to: Recipient[];
  task?: { enabled: boolean; assignees: Recipient[]; dueDays: 0 | 1 | 3 | 7; body?: string };
  template: { title: string; body: string };
  channelIds?: string[];   // 空 = 全チャンネル
  memo?: string;
}

export interface ChatworkWriter { name: string; accountId: string }

export interface ChatworkConfig {
  rules: ChatworkRule[];
  ownerAccountId: string;          // 「オーナー」宛先の解決先
  writers: ChatworkWriter[];       // ライター名簿（企画の担当ライターをここから選ぶ。担当未設定時の代替宛先にも使う）
  fallbackToAllWriters: boolean;   // 担当ライター未設定のとき、名簿のライター全員に送る
  updatedAt?: string;
}

export interface NotifyContext {
  title?: string;
  channelName?: string;
  channelId?: string;
  reviewUrl?: string;
  refUrls?: string[];
  thumbTelop?: string;
  thumbDesignUrl?: string;
  assigneeAccountId?: string;
  assigneeName?: string;
  comment?: string;
}

export interface NotifyLogEntry { at: string; event: NotifyEvent; ruleId: string; roomId: string; roomName?: string; ok: boolean; error?: string; to: string[]; title?: string }

export const genRuleId = () => `cwr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export function eventDef(id: NotifyEvent): NotifyEventDef { return NOTIFY_EVENTS.find((e) => e.id === id) || NOTIFY_EVENTS[0]; }

// 既定ルール（従来の「提出→オーナー／合格・再提出→ライター」をそのまま再現）
export function defaultRules(roomId: string, roomName?: string, extraIds: string[] = []): ChatworkRule[] {
  const extra: Recipient[] = extraIds.map((id) => ({ kind: "account", accountId: id }));
  const mk = (event: NotifyEvent, to: Recipient[], task?: ChatworkRule["task"]): ChatworkRule => {
    const d = eventDef(event);
    return { id: genRuleId(), event, enabled: true, roomId, roomName, to: [...to, ...extra], task, template: { title: d.title, body: d.body } };
  };
  return [
    mk("submitted", [{ kind: "owner" }], { enabled: true, assignees: [{ kind: "owner" }], dueDays: 1, body: "【台本添削】「{企画名}」の添削をお願いします\n添削部屋: {添削部屋URL}" }),
    mk("approved", [{ kind: "assignee" }]),
    mk("rejected", [{ kind: "assignee" }], { enabled: true, assignees: [{ kind: "assignee" }], dueDays: 1, body: "【台本修正・再提出】「{企画名}」のオーナーコメントを確認し、修正して再提出してください\n添削部屋: {添削部屋URL}" }),
  ];
}

// テンプレの差し込み。値が無いプレースホルダーだけの行（「サムネテロップ:」の次の行など）は行ごと落とす
export function renderTemplate(tpl: string, ctx: NotifyContext): string {
  const map: Record<string, string> = {
    "{企画名}": ctx.title || "（タイトル未定）",
    "{チャンネル名}": ctx.channelName || "未設定",
    "{担当ライター名}": ctx.assigneeName || "",
    "{添削部屋URL}": ctx.reviewUrl || "",
    "{元ネタURL}": (ctx.refUrls || []).join("\n"),
    "{サムネテロップ}": ctx.thumbTelop || "",
    "{参考デザインURL}": ctx.thumbDesignUrl || "",
    "{コメント}": ctx.comment || "",
  };
  const lines = tpl.split("\n");
  const out: string[] = [];
  const isLabelOnly = (s: string) => /^[^{}]*[:：]\s*$/.test(s.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const used = PLACEHOLDERS.filter((p) => line.includes(p));
    const allEmpty = used.length > 0 && used.every((p) => !map[p]);
    // 「ラベル:」の行で、次の行がプレースホルダーだけ・値が空なら2行とも落とす
    if (isLabelOnly(line) && i + 1 < lines.length) {
      const nxt = lines[i + 1].trim();
      if (/^\{[^}]+\}$/.test(nxt) && !map[nxt]) { i++; continue; }
    }
    if (allEmpty) continue;
    let filled = line;
    for (const p of used) filled = filled.split(p).join(map[p] || "");
    out.push(filled);
  }
  return out.join("\n");
}

export function recipientLabel(r: Recipient, cfg?: Pick<ChatworkConfig, "ownerAccountId" | "writers">): string {
  if (r.kind === "owner") return "オーナー";
  if (r.kind === "assignee") return "この企画の担当ライター";
  const w = cfg?.writers.find((x) => x.accountId === r.accountId);
  return r.name || w?.name || `ID:${r.accountId}`;
}
