// 開運日・月相（満月/新月）カレンダー計算（Xツール・YTツールとは独立）
// - 干支/一粒万倍日/天赦日/寅の日/巳の日: 日付と節気から計算（アンカー2026-03-05=戊寅で検証済み）
// - 満月/新月: Meeusアルゴリズムで天文計算（2026年の実測値で検算済み）
// すべて日本時間(JST, UTC+9)基準の暦日で判定する。サーバー/クライアント両方で使える純粋関数。

const JST_OFFSET_MS = 9 * 3600 * 1000;
const DAY_MS = 86400000;
const DEG = Math.PI / 180;

// ===== 干支（日柱） =====
// アンカー: 2026-03-05(JST) = 干支インデックス14(戊寅)。天赦日×寅の日で二重に検証済み。
const GANSHI_ANCHOR_UTC = Date.UTC(2026, 2, 5); // JST暦日をUTC正午扱いせず0時基準で差分を取る
const GANSHI_ANCHOR_INDEX = 14;

// JST暦日(y,m,d)の通し日数（アンカー基準）
function jstDayNumber(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - GANSHI_ANCHOR_UTC) / DAY_MS);
}

// 干支インデックス 0..59 （0=甲子, 14=戊寅, 30=甲午, 44=戊申）
export function ganshiIndex(y: number, m: number, d: number): number {
  const n = (GANSHI_ANCHOR_INDEX + jstDayNumber(y, m, d)) % 60;
  return (n + 60) % 60;
}

// 地支インデックス 0=子,1=丑,2=寅,3=卯,4=辰,5=巳,6=午,7=未,8=申,9=酉,10=戌,11=亥
function branchIndex(y: number, m: number, d: number): number {
  return ganshiIndex(y, m, d) % 12;
}

// ===== 太陽黄経（Meeus 低精度, 誤差~0.01°）→ 節気の判定 =====
function jdFromUTCms(ms: number): number {
  return ms / DAY_MS + 2440587.5;
}
function sunLongitudeDeg(jd: number): number {
  const T = (jd - 2451545) / 36525;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
  const M = 357.52911 + 35999.05029 * T - 0.0001537 * T * T;
  const Mr = M * DEG;
  const C =
    (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(Mr) +
    (0.019993 - 0.000101 * T) * Math.sin(2 * Mr) +
    0.000289 * Math.sin(3 * Mr);
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * DEG);
  return ((lambda % 360) + 360) % 360;
}

// 角度差 a-b を [-180,180) に正規化
function angDiff(a: number, b: number): number {
  let d = (a - b + 180) % 360;
  if (d < 0) d += 360;
  return d - 180;
}

// 節（12の節入り）: 太陽黄経が targetLon を上向きに通過するUTC時刻(JD)を年内で1点求める
function findTermJD(year: number, targetLon: number): number {
  // 前年12/15あたりから探索開始（小寒が1月初でも捕捉できるよう余裕を持たせる）
  const startMs = Date.UTC(year - 1, 11, 15);
  let prevDiff = angDiff(sunLongitudeDeg(jdFromUTCms(startMs)), targetLon);
  let prevJd = jdFromUTCms(startMs);
  for (let day = 1; day <= 400; day++) {
    const ms = startMs + day * DAY_MS;
    const jd = jdFromUTCms(ms);
    const diff = angDiff(sunLongitudeDeg(jd), targetLon);
    if (prevDiff < 0 && diff >= 0) {
      const f = -prevDiff / (diff - prevDiff);
      return prevJd + f * (jd - prevJd);
    }
    prevDiff = diff;
    prevJd = jd;
  }
  return NaN;
}

// 節のターゲット黄経と、その節が始める「節月」の地支(0=子基準)
const SETSU_TERMS: { lon: number; branch: number }[] = [
  { lon: 315, branch: 2 }, // 立春 → 寅月
  { lon: 345, branch: 3 }, // 啓蟄 → 卯月
  { lon: 15, branch: 4 }, // 清明 → 辰月
  { lon: 45, branch: 5 }, // 立夏 → 巳月
  { lon: 75, branch: 6 }, // 芒種 → 午月
  { lon: 105, branch: 7 }, // 小暑 → 未月
  { lon: 135, branch: 8 }, // 立秋 → 申月
  { lon: 165, branch: 9 }, // 白露 → 酉月
  { lon: 195, branch: 10 }, // 寒露 → 戌月
  { lon: 225, branch: 11 }, // 立冬 → 亥月
  { lon: 255, branch: 0 }, // 大雪 → 子月
  { lon: 285, branch: 1 }, // 小寒 → 丑月
];

// 年ごとの節入りJST暦日(0時ms)と節月地支をキャッシュ
const termCache = new Map<number, { ms: number; branch: number }[]>();
function termsForYear(year: number): { ms: number; branch: number }[] {
  const cached = termCache.get(year);
  if (cached) return cached;
  const terms = SETSU_TERMS.map((t) => {
    const jd = findTermJD(year, t.lon);
    const utcMs = (jd - 2440587.5) * DAY_MS;
    // JST暦日の0時msに丸める（節入りは時刻に関係なくその暦日から新しい節月）
    const jst = new Date(utcMs + JST_OFFSET_MS);
    const dayMs = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
    return { ms: dayMs, branch: t.branch };
  }).sort((a, b) => a.ms - b.ms);
  termCache.set(year, terms);
  return terms;
}

// 指定JST暦日が属する節月の地支(0=子基準)
function setsuBranchForYMD(y: number, m: number, d: number): number {
  const dayMs = Date.UTC(y, m - 1, d);
  const candidates = [...termsForYear(y - 1), ...termsForYear(y)].filter((t) => t.ms <= dayMs);
  candidates.sort((a, b) => b.ms - a.ms);
  return candidates.length > 0 ? candidates[0].branch : 0;
}

// ===== 一粒万倍日・天赦日の判定ルール =====
// 節月地支(0=子基準) → 一粒万倍日となる日の地支(0=子基準)の組。8つのアンカー日で検証済み。
const ICHIRYU_TABLE: Record<number, number[]> = {
  2: [1, 6], // 寅月: 丑・午
  3: [9, 2], // 卯月: 酉・寅
  4: [0, 3], // 辰月: 子・卯
  5: [3, 4], // 巳月: 卯・辰
  6: [5, 6], // 午月: 巳・午
  7: [6, 9], // 未月: 午・酉
  8: [0, 7], // 申月: 子・未
  9: [3, 8], // 酉月: 卯・申
  10: [6, 9], // 戌月: 午・酉
  11: [9, 10], // 亥月: 酉・戌
  0: [0, 11], // 子月: 子・亥
  1: [3, 0], // 丑月: 卯・子
};

// 季節(0春,1夏,2秋,3冬) → 天赦日となる干支インデックス
const TENSHA_GANSHI = [14, 30, 44, 0]; // 春=戊寅, 夏=甲午, 秋=戊申, 冬=甲子

function seasonFromSetsuBranch(setsuBranch: number): number {
  const order = (setsuBranch - 2 + 12) % 12; // 寅月始まりの順序 0..11
  return Math.floor(order / 3); // 0春(寅卯辰)1夏(巳午未)2秋(申酉戌)3冬(亥子丑)
}

// ===== 満月・新月（Meeus 天文計算, 日単位で正確）=====
function moonPhaseJDE(k: number, phase: 0 | 0.5): number {
  const kk = k + phase;
  const T = kk / 1236.85;
  let JDE =
    2451550.09766 +
    29.530588861 * kk +
    0.00015437 * T * T -
    0.00000015 * T * T * T +
    0.00000000073 * T * T * T * T;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  const M = (2.5534 + 29.1053567 * kk - 0.0000014 * T * T - 0.00000011 * T * T * T) * DEG;
  const Mp =
    (201.5643 + 385.81693528 * kk + 0.0107582 * T * T + 0.00001238 * T * T * T - 0.000000058 * T * T * T * T) * DEG;
  const F =
    (160.7108 + 390.67050284 * kk - 0.0016118 * T * T - 0.00000227 * T * T * T + 0.000000011 * T * T * T * T) * DEG;
  const Om = (124.7746 - 1.56375588 * kk + 0.0020672 * T * T + 0.00000215 * T * T * T) * DEG;
  // 新月・満月共通の周期補正（Meeus第49章。日単位精度に十分な主要項）
  const corr =
    -0.4072 * Math.sin(Mp) +
    0.17241 * E * Math.sin(M) +
    0.01608 * Math.sin(2 * Mp) +
    0.01039 * Math.sin(2 * F) +
    0.00739 * E * Math.sin(Mp - M) +
    -0.00514 * E * Math.sin(Mp + M) +
    0.00208 * E * E * Math.sin(2 * M) +
    -0.00111 * Math.sin(Mp - 2 * F) +
    -0.00057 * Math.sin(Mp + 2 * F) +
    0.00056 * E * Math.sin(2 * Mp + M) +
    -0.00042 * Math.sin(3 * Mp) +
    0.00042 * E * Math.sin(M + 2 * F) +
    0.00038 * E * Math.sin(M - 2 * F) +
    -0.00024 * E * Math.sin(2 * Mp - M) +
    -0.00017 * Math.sin(Om) +
    -0.00007 * Math.sin(Mp + 2 * M) +
    0.00004 * Math.sin(2 * Mp - 2 * F) +
    0.00004 * Math.sin(3 * M) +
    0.00003 * Math.sin(Mp + M - 2 * F) +
    0.00003 * Math.sin(2 * Mp + 2 * F) +
    -0.00003 * Math.sin(Mp + M + 2 * F) +
    0.00003 * Math.sin(Mp - M + 2 * F) +
    -0.00002 * Math.sin(Mp - M - 2 * F) +
    -0.00002 * Math.sin(3 * Mp + M) +
    0.00002 * Math.sin(4 * Mp);
  JDE += corr;
  return JDE;
}

// 指定期間[startMs,endMs]内の満月・新月をJST暦日で返す
function moonPhasesInRange(startMs: number, endMs: number): { ms: number; type: "newmoon" | "fullmoon" }[] {
  const startYearFrac = new Date(startMs).getUTCFullYear() + 0.0;
  const kStart = Math.floor((startYearFrac - 2000) * 12.3685) - 2;
  const out: { ms: number; type: "newmoon" | "fullmoon" }[] = [];
  for (let k = kStart; k < kStart + 20; k++) {
    for (const [phase, type] of [
      [0, "newmoon"],
      [0.5, "fullmoon"],
    ] as const) {
      const jde = moonPhaseJDE(k, phase);
      const utcMs = (jde - 2440587.5) * DAY_MS; // ΔTは日単位精度に影響しないため無視
      const jst = new Date(utcMs + JST_OFFSET_MS);
      const dayMs = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate());
      if (dayMs >= startMs - DAY_MS && dayMs <= endMs + DAY_MS) out.push({ ms: dayMs, type });
    }
  }
  return out;
}

// ===== 公開API =====
export type LuckyType = "tensha" | "ichiryu" | "tora" | "mi" | "tsuchinotomi" | "fullmoon" | "newmoon";
export interface LuckyEvent {
  type: LuckyType;
  label: string;
  emoji: string;
  strong?: boolean; // 最強クラス（天赦日など）
}

const BRANCH_TORA = 2;
const BRANCH_MI = 5;
const GANSHI_TSUCHINOTOMI = 5; // 己巳

// 暦日ベースの開運日（月相を除く）
function calendricalEvents(y: number, m: number, d: number): LuckyEvent[] {
  const events: LuckyEvent[] = [];
  const g = ganshiIndex(y, m, d);
  const b = g % 12;
  const sb = setsuBranchForYMD(y, m, d);

  if ((ICHIRYU_TABLE[sb] ?? []).includes(b)) {
    events.push({ type: "ichiryu", label: "一粒万倍日", emoji: "🌱" });
  }
  const season = seasonFromSetsuBranch(sb);
  if (g === TENSHA_GANSHI[season]) {
    events.push({ type: "tensha", label: "天赦日", emoji: "✨", strong: true });
  }
  if (b === BRANCH_TORA) {
    events.push({ type: "tora", label: "寅の日", emoji: "🐯" });
  }
  if (b === BRANCH_MI) {
    if (g === GANSHI_TSUCHINOTOMI) {
      events.push({ type: "tsuchinotomi", label: "己巳の日", emoji: "🐍", strong: true });
    } else {
      events.push({ type: "mi", label: "巳の日", emoji: "🐍" });
    }
  }
  return events;
}

// 月相イベント（満月/新月）を暦日マップで取得
function moonEventMap(startMs: number, endMs: number): Map<number, LuckyEvent[]> {
  const map = new Map<number, LuckyEvent[]>();
  for (const p of moonPhasesInRange(startMs, endMs)) {
    const ev: LuckyEvent =
      p.type === "fullmoon"
        ? { type: "fullmoon", label: "満月", emoji: "🌕" }
        : { type: "newmoon", label: "新月", emoji: "🌑" };
    const list = map.get(p.ms) ?? [];
    list.push(ev);
    map.set(p.ms, list);
  }
  return map;
}

export interface DayLucky {
  y: number;
  m: number;
  d: number;
  iso: string; // YYYY-MM-DD
  events: LuckyEvent[];
}

// 指定年月(1-12)の全日の開運日・月相
export function luckyCalendar(year: number, month: number): DayLucky[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startMs = Date.UTC(year, month - 1, 1);
  const endMs = Date.UTC(year, month - 1, daysInMonth);
  const moons = moonEventMap(startMs, endMs);
  const out: DayLucky[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const events = [...calendricalEvents(year, month, d), ...(moons.get(Date.UTC(year, month - 1, d)) ?? [])];
    out.push({
      y: year,
      m: month,
      d,
      iso: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      events,
    });
  }
  return out;
}

// 指定JST暦日の開運日・月相
export function luckyForDate(y: number, m: number, d: number): LuckyEvent[] {
  const dayMs = Date.UTC(y, m - 1, d);
  const moons = moonEventMap(dayMs, dayMs).get(dayMs) ?? [];
  return [...calendricalEvents(y, m, d), ...moons];
}

export interface UpcomingNotice {
  offset: 0 | 1 | 2; // 0=当日, 1=前日, 2=2日前
  y: number;
  m: number;
  d: number;
  iso: string;
  events: LuckyEvent[];
}

// 今日(JST)を基準に、当日・翌日・翌々日で開運日/月相があるものを返す（通知用）
export function upcomingNotices(today: Date = new Date()): UpcomingNotice[] {
  // todayをJST暦日に変換
  const jst = new Date(today.getTime() + JST_OFFSET_MS);
  const baseY = jst.getUTCFullYear();
  const baseM = jst.getUTCMonth();
  const baseD = jst.getUTCDate();
  const notices: UpcomingNotice[] = [];
  for (const offset of [0, 1, 2] as const) {
    const dt = new Date(Date.UTC(baseY, baseM, baseD + offset));
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const events = luckyForDate(y, m, d);
    if (events.length > 0) {
      notices.push({
        offset,
        y,
        m,
        d,
        iso: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        events,
      });
    }
  }
  return notices;
}

// オフセット→表示ラベル
export function offsetLabel(offset: 0 | 1 | 2): string {
  return offset === 0 ? "今日" : offset === 1 ? "明日" : "2日後";
}
