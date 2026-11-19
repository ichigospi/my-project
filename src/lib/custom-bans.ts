// 添削で消された言い回しから育てる「追加の禁止表現」（サーバー保存。品質チェック・生成・修正の全部で使う）
// - custom_bans: 登録済みの禁止表現（機械判定で fail、生成・修正プロンプトの禁止一覧にも入る）
// - ban_candidates: 添削で消された言い回しの候補（回数を数え、2回以上で登録を提案）
import { prisma } from "@/lib/prisma";
import type { QualityCheckItem } from "@/lib/project-store";

export interface CustomBan { phrase: string; reason: string; addedAt: string }
export interface BanCandidate { phrase: string; reason: string; count: number; lastAt: string; projects: string[] }

const BANS_KEY = "custom_bans";
const CAND_KEY = "ban_candidates";

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key } });
    return row?.value ? (JSON.parse(row.value) as T) : fallback;
  } catch { return fallback; }
}
async function writeJson(key: string, value: unknown): Promise<void> {
  const v = JSON.stringify(value);
  await prisma.appSetting.upsert({ where: { key }, update: { value: v }, create: { key, value: v } });
}

export async function loadCustomBans(): Promise<CustomBan[]> {
  const list = await readJson<CustomBan[]>(BANS_KEY, []);
  return Array.isArray(list) ? list.filter((b) => b && typeof b.phrase === "string" && b.phrase.trim()) : [];
}
export async function saveCustomBans(list: CustomBan[]): Promise<void> { await writeJson(BANS_KEY, list); }

export async function loadBanCandidates(): Promise<BanCandidate[]> {
  const list = await readJson<BanCandidate[]>(CAND_KEY, []);
  return Array.isArray(list) ? list : [];
}
export async function saveBanCandidates(list: BanCandidate[]): Promise<void> { await writeJson(CAND_KEY, list); }

// 候補を加算（同じ言い回しは回数を増やす）
export async function addBanCandidates(items: { phrase: string; reason: string }[], projectId: string): Promise<BanCandidate[]> {
  const list = await loadBanCandidates();
  const now = new Date().toISOString();
  for (const it of items) {
    const phrase = (it.phrase || "").replace(/\s+/g, "").trim();
    if (phrase.length < 4 || phrase.length > 40) continue;
    const hit = list.find((c) => c.phrase === phrase);
    if (hit) {
      if (!hit.projects.includes(projectId)) { hit.count += 1; hit.projects.push(projectId); }
      hit.lastAt = now; if (it.reason) hit.reason = it.reason;
    } else list.push({ phrase, reason: it.reason || "", count: 1, lastAt: now, projects: [projectId] });
  }
  list.sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
  await saveBanCandidates(list.slice(0, 200));
  return list;
}

// 機械判定: 登録済みの禁止表現が台本にあれば fail（該当文つき）
export function scanCustomBans(script: string, bans: CustomBan[] | undefined): QualityCheckItem[] {
  if (!bans || bans.length === 0) return [];
  const t = script.replace(/\s+/g, "");
  const items: QualityCheckItem[] = [];
  for (const b of bans) {
    const phrase = b.phrase.replace(/\s+/g, "");
    if (!phrase) continue;
    const hits: string[] = [];
    let from = 0;
    while (hits.length < 5) {
      const i = t.indexOf(phrase, from);
      if (i < 0) break;
      let s = i; while (s > 0 && !/[。！？!?]/.test(t[s - 1])) s--;
      let e = i + phrase.length; while (e < t.length && !/[。！？!?]/.test(t[e])) e++;
      const sent = t.slice(s, e + 1);
      if (!hits.includes(sent)) hits.push(sent.length > 120 ? sent.slice(0, 120) + "…" : sent);
      from = i + phrase.length;
    }
    if (hits.length === 0) continue;
    items.push({
      name: `禁止表現（添削で登録）: 「${b.phrase}」${hits.length > 1 ? `（${hits.length}箇所）` : ""}`,
      status: "fail",
      comment: `${b.reason || "添削で消された言い回し"}。該当${hits.length > 1 ? "（全部直す）" : ""}:\n${hits.map((h) => `「${h}」`).join("\n")}`,
      suggestion: "この言い回しを使わず、同じ意味を別の言葉で言う（文脈に合わせて段落ごと書き直す）",
    });
  }
  return items;
}

export function customBansPromptLines(bans: CustomBan[] | undefined): string {
  if (!bans || bans.length === 0) return "";
  return bans.slice(0, 60).map((b) => `・「${b.phrase}」${b.reason ? `: ${b.reason}` : ""}`).join("\n");
}
