// サーバー時刻との差（クロックスキュー）の学習と、補正済み現在時刻の提供。
//
// プロジェクト（台本）の updatedAt は端末の時計で付けている。サーバー側は
// 「サーバーに保存されている版のほうが新しければ上書きしない（stale）」で守っているため、
// 端末の時計が遅れていると、その端末の保存は全部 stale 扱いになり、
// 「作っても・分析しても・提出しても、ことごとく反映されない」状態になる。
// そこで API 応答に含まれる serverTime から差分を学習し、保存時の updatedAt に補正を掛ける。

let offsetMs = 0;          // serverTime - localTime（正ならこの端末の時計が遅れている）
let learnedAt = 0;         // 最後に学習した時刻（ローカル時計）
let learned = false;

export function learnServerTime(serverTimeIso: unknown): void {
  if (typeof serverTimeIso !== "string") return;
  const t = new Date(serverTimeIso).getTime();
  if (!Number.isFinite(t) || t <= 0) return;
  offsetMs = t - Date.now();
  learnedAt = Date.now();
  learned = true;
}

// サーバー時刻に補正した「今」
export function nowIso(): string {
  return new Date(Date.now() + (learned ? offsetMs : 0)).toISOString();
}

export function getClockSkew(): { learned: boolean; offsetMs: number; learnedAt: number } {
  return { learned, offsetMs, learnedAt };
}

// 同期トラブルの切り分け表示用: 60秒以上ズレていたら注意文を返す
export function describeClockSkew(): string {
  if (!learned) return "未確認（サーバーと通信後に表示）";
  const sec = Math.round(offsetMs / 1000);
  if (Math.abs(sec) < 60) return `ほぼ一致（${sec}秒）`;
  const who = sec > 0 ? "遅れています" : "進んでいます";
  return `⚠ この端末の時計がサーバーより ${Math.abs(Math.round(sec / 60))}分 ${who}（保存は自動補正済み）`;
}
