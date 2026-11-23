// Chatwork通知のサーバー側: 設定の読み書き、ルーム/メンバー取得、送信、イベントの配信（dispatch）、履歴
import { prisma } from "@/lib/prisma";
import { defaultRules, renderTemplate, type ChatworkConfig, type ChatworkRule, type NotifyContext, type NotifyEvent, type NotifyLogEntry, type Recipient } from "@/lib/chatwork-rules";

const CONFIG_KEY = "chatwork_config";
const LOG_KEY = "chatwork_log";

async function readSetting(key: string): Promise<string> {
  try { const row = await prisma.appSetting.findUnique({ where: { key } }); return row?.value || ""; } catch { return ""; }
}
async function writeSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function getToken(): Promise<string> { return readSetting("shared_chatwork_api_token"); }

// 設定を読む。無ければ従来の共有設定（ルームID・オーナーID・ライターID・追加メンション）から既定ルールを組み立てる（移行）
export async function loadConfig(): Promise<{ config: ChatworkConfig; migrated: boolean }> {
  const raw = await readSetting(CONFIG_KEY);
  if (raw) {
    try {
      const c = JSON.parse(raw) as ChatworkConfig;
      return { config: { rules: Array.isArray(c.rules) ? c.rules : [], ownerAccountId: c.ownerAccountId || "", writers: Array.isArray(c.writers) ? c.writers : [], fallbackToAllWriters: c.fallbackToAllWriters !== false, updatedAt: c.updatedAt }, migrated: false };
    } catch { /* fallthrough */ }
  }
  const [roomId, ownerId, writerIds, extraIds] = await Promise.all([
    readSetting("shared_chatwork_room_id"), readSetting("shared_chatwork_owner_id"), readSetting("shared_chatwork_writer_ids"), readSetting("shared_chatwork_extra_ids"),
  ]);
  const ids = (s: string) => s.split(/[,、\s]+/).map((x) => x.trim()).filter((x) => /^\d+$/.test(x));
  const config: ChatworkConfig = {
    rules: roomId ? defaultRules(roomId, undefined, ids(extraIds)) : [],
    ownerAccountId: ids(ownerId)[0] || "",
    writers: ids(writerIds).map((id) => ({ name: `ライター(${id})`, accountId: id })),
    fallbackToAllWriters: true,
  };
  return { config, migrated: true };
}

export async function saveConfig(config: ChatworkConfig): Promise<void> {
  await writeSetting(CONFIG_KEY, JSON.stringify({ ...config, updatedAt: new Date().toISOString() }));
  // 旧キーも更新しておく（他の画面が参照している「オーナーID」「ライターID」との整合）
  await writeSetting("shared_chatwork_owner_id", config.ownerAccountId || "");
  await writeSetting("shared_chatwork_writer_ids", config.writers.map((w) => w.accountId).join(","));
}

export async function loadLog(): Promise<NotifyLogEntry[]> {
  try { const raw = await readSetting(LOG_KEY); const l = raw ? (JSON.parse(raw) as NotifyLogEntry[]) : []; return Array.isArray(l) ? l : []; } catch { return []; }
}
async function appendLog(entries: NotifyLogEntry[]): Promise<void> {
  const cur = await loadLog();
  await writeSetting(LOG_KEY, JSON.stringify([...entries, ...cur].slice(0, 100)));
}

// ===== Chatwork API =====
export async function fetchRooms(token: string): Promise<{ roomId: string; name: string; type: string }[]> {
  const res = await fetch("https://api.chatwork.com/v2/rooms", { headers: { "X-ChatWorkToken": token } });
  if (!res.ok) throw new Error(`ルーム一覧の取得に失敗 (HTTP ${res.status})`);
  const rooms = (await res.json()) as { room_id: number; name: string; type: string }[];
  return rooms.filter((r) => r.type !== "my").map((r) => ({ roomId: String(r.room_id), name: r.name, type: r.type }));
}
export async function fetchMembers(token: string, roomId: string): Promise<{ accountId: string; name: string; role: string }[]> {
  const res = await fetch(`https://api.chatwork.com/v2/rooms/${encodeURIComponent(roomId)}/members`, { headers: { "X-ChatWorkToken": token } });
  if (!res.ok) throw new Error(`メンバー取得に失敗 (HTTP ${res.status})`);
  const members = (await res.json()) as { account_id: number; name: string; role: string }[];
  return members.map((m) => ({ accountId: String(m.account_id), name: m.name, role: m.role }));
}
async function postMessage(token: string, roomId: string, body: string): Promise<void> {
  const res = await fetch(`https://api.chatwork.com/v2/rooms/${encodeURIComponent(roomId)}/messages`, {
    method: "POST", headers: { "X-ChatWorkToken": token, "Content-Type": "application/x-www-form-urlencoded" }, body: `body=${encodeURIComponent(body)}`,
  });
  if (!res.ok) throw new Error(`送信失敗 (HTTP ${res.status}): ${(await res.text().catch(() => "")).slice(0, 120)}`);
}
async function postTask(token: string, roomId: string, body: string, toIds: string[], dueDays: number): Promise<void> {
  if (toIds.length === 0) return;
  const jstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const limitUtcMs = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate() + dueDays, 23, 59, 0) - 9 * 3600 * 1000;
  const params = new URLSearchParams({ body, to_ids: toIds.join(","), limit: String(Math.floor(limitUtcMs / 1000)), limit_type: "date" });
  const res = await fetch(`https://api.chatwork.com/v2/rooms/${encodeURIComponent(roomId)}/tasks`, {
    method: "POST", headers: { "X-ChatWorkToken": token, "Content-Type": "application/x-www-form-urlencoded" }, body: params.toString(),
  });
  if (!res.ok) throw new Error(`タスク作成失敗 (HTTP ${res.status})`);
}

// 宛先の解決（オーナー／担当ライター／固定の人 → アカウントID）
export function resolveRecipients(list: Recipient[], config: ChatworkConfig, ctx: NotifyContext): string[] {
  const out: string[] = [];
  for (const r of list) {
    if (r.kind === "owner") { if (config.ownerAccountId) out.push(config.ownerAccountId); }
    else if (r.kind === "assignee") {
      if (ctx.assigneeAccountId) out.push(ctx.assigneeAccountId);
      else if (config.fallbackToAllWriters) out.push(...config.writers.map((w) => w.accountId));
    } else if (r.accountId) out.push(r.accountId);
  }
  return [...new Set(out.filter((id) => /^\d+$/.test(id)))];
}

export function buildMessage(rule: ChatworkRule, config: ChatworkConfig, ctx: NotifyContext): { text: string; to: string[] } {
  const to = resolveRecipients(rule.to, config, ctx);
  const mention = to.map((id) => `[To:${id}]`).join("");
  const title = renderTemplate(rule.template.title, ctx);
  const body = renderTemplate(rule.template.body, ctx);
  return { text: `${mention ? mention + "\n" : ""}[info][title]${title}[/title]${body}[/info]`, to };
}

// イベントを配信: 該当する有効ルールを全部実行し、履歴に残す
export async function dispatch(event: NotifyEvent, ctx: NotifyContext, opts?: { onlyRuleId?: string; dryRun?: boolean }): Promise<{ sent: number; results: NotifyLogEntry[]; skipped?: string }> {
  const token = await getToken();
  const { config } = await loadConfig();
  if (!token) return { sent: 0, results: [], skipped: "Chatworkのトークンが未設定です" };
  const rules = config.rules.filter((r) => r.enabled && r.event === event && (!opts?.onlyRuleId || r.id === opts.onlyRuleId)
    && (!r.channelIds || r.channelIds.length === 0 || !ctx.channelId || r.channelIds.includes(ctx.channelId)));
  if (rules.length === 0) return { sent: 0, results: [], skipped: "このイベントに有効なルールがありません" };
  const results: NotifyLogEntry[] = [];
  for (const rule of rules) {
    const { text, to } = buildMessage(rule, config, ctx);
    const entry: NotifyLogEntry = { at: new Date().toISOString(), event, ruleId: rule.id, roomId: rule.roomId, roomName: rule.roomName, ok: false, to, title: renderTemplate(rule.template.title, ctx) };
    try {
      if (!opts?.dryRun) {
        await postMessage(token, rule.roomId, text);
        if (rule.task?.enabled) {
          const taskTo = resolveRecipients(rule.task.assignees, config, ctx);
          const taskBody = renderTemplate(rule.task.body || rule.template.title, ctx);
          await postTask(token, rule.roomId, taskBody, taskTo, rule.task.dueDays ?? 1);
        }
      }
      entry.ok = true;
    } catch (e) {
      entry.error = e instanceof Error ? e.message : String(e);
    }
    results.push(entry);
  }
  if (!opts?.dryRun) await appendLog(results).catch(() => undefined);
  return { sent: results.filter((r) => r.ok).length, results };
}
