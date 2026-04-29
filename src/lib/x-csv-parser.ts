// Xアナリティクス CSV のクライアントサイドパーサ
// X が公式エクスポートする CSV はカラム名が時期によって少し違うので、
// 候補カラム名を複数許容してマッピングする
// 自動検出が外れた場合に備えて、ユーザーが手動で列を上書きできる

export interface CsvParsedPost {
  postId: string;
  postUrl: string;
  content: string;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  postedAt: string | null; // ISO string or null
  engagementRate?: number;
}

// 内部フィールドキー
export type CsvFieldKey = keyof CsvParsedPost;

// 各列の中身プレビュー用
export interface ColumnPreview {
  index: number;
  header: string;
  sampleValue: string; // 最初の非空データ値
}

export interface CsvParseResult {
  posts: CsvParsedPost[];
  headers: string[];
  columns: ColumnPreview[];
  detectedColumns: Partial<Record<CsvFieldKey, number>>; // 自動検出のマッピング
  effectiveColumns: Partial<Record<CsvFieldKey, number>>; // overrides 適用後のマッピング
  totalRows: number;
  errors: string[];
}

// カラム名候補（小文字で比較）
const COLUMN_ALIASES: Record<CsvFieldKey, string[]> = {
  postId: ["tweet id", "tweet_id", "id", "post id", "post_id", "ツイートid", "ポストid"],
  postUrl: ["tweet permalink", "permalink", "url", "tweet url", "post url", "post_url", "ポストurl", "ツイートurl"],
  content: ["tweet text", "text", "tweet", "post text", "post", "ポスト本文", "本文", "ツイート本文", "ツイート"],
  postedAt: ["time", "created at", "created_at", "date", "datetime", "投稿日時", "日時", "投稿日"],
  impressions: [
    "impressions", "impression", "imp", "view count", "view_count", "views", "view",
    "インプレッション", "インプ", "表示回数", "表示", "閲覧数", "閲覧", "印象", "総閲覧数",
  ],
  likes: ["likes", "like", "favorites", "favorite", "fav", "いいね", "いいね数", "好評価"],
  retweets: ["retweets", "retweet", "reposts", "repost", "rt", "リツイート", "リツイート数", "リポスト", "リポスト数"],
  replies: ["replies", "reply", "返信", "返信数", "リプ", "リプ数"],
  engagementRate: ["engagement rate", "engagementrate", "engagement_rate", "エンゲージメント率"],
};

// 1行を CSV として安全にパース（クォート対応）
function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function detectDelimiter(headerLine: string): string {
  const tabs = (headerLine.match(/\t/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return tabs > commas ? "\t" : ",";
}

function parseNumber(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[%,]/g, "").trim();
  const n = Number(cleaned);
  return isFinite(n) ? n : 0;
}

function parseDate(v: string | undefined): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

// 自動検出: ヘッダーから内部キーへのマッピングを構築
function buildAutoColumnMap(headers: string[]): Partial<Record<CsvFieldKey, number>> {
  const map: Partial<Record<CsvFieldKey, number>> = {};
  const lowered = headers.map((h) => h.toLowerCase().trim());

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [CsvFieldKey, string[]][]) {
    for (const alias of aliases) {
      const idx = lowered.indexOf(alias);
      if (idx >= 0) {
        map[key] = idx;
        break;
      }
    }
  }
  return map;
}

// 各列の最初の非空サンプル値を抽出
function buildColumnPreviews(headers: string[], dataRows: string[][]): ColumnPreview[] {
  return headers.map((h, idx) => {
    let sample = "";
    for (const row of dataRows) {
      const v = row[idx]?.trim();
      if (v) {
        sample = v.length > 60 ? v.slice(0, 60) + "…" : v;
        break;
      }
    }
    return { index: idx, header: h, sampleValue: sample };
  });
}

export interface ParseCsvOptions {
  // 手動マッピングオーバーライド（フィールドキー → 列インデックス）
  // 値が undefined の場合は自動検出を採用、null の場合はそのフィールドを使わない
  overrides?: Partial<Record<CsvFieldKey, number | null>>;
}

export function parseCsv(text: string, options: ParseCsvOptions = {}): CsvParseResult {
  const errors: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) {
    return {
      posts: [],
      headers: [],
      columns: [],
      detectedColumns: {},
      effectiveColumns: {},
      totalRows: 0,
      errors: ["ヘッダー行＋データ行が見つかりません"],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());
  const dataRows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    dataRows.push(parseCsvLine(lines[i], delimiter));
  }

  const detected = buildAutoColumnMap(headers);
  const effective: Partial<Record<CsvFieldKey, number>> = { ...detected };

  // overrides 適用
  if (options.overrides) {
    for (const [k, v] of Object.entries(options.overrides) as [CsvFieldKey, number | null | undefined][]) {
      if (v === null) {
        delete effective[k];
      } else if (typeof v === "number" && v >= 0 && v < headers.length) {
        effective[k] = v;
      }
    }
  }

  if (effective.content === undefined) {
    errors.push("ポスト本文（Tweet text）の列が指定されていません。手動マッピングで指定してください。");
  }

  const columns = buildColumnPreviews(headers, dataRows);

  const posts: CsvParsedPost[] = [];
  for (const cells of dataRows) {
    const get = (key: CsvFieldKey) => {
      const idx = effective[key];
      return idx === undefined ? undefined : cells[idx];
    };

    const content = (get("content") ?? "").trim();
    if (!content) continue;

    posts.push({
      postId: (get("postId") ?? "").trim(),
      postUrl: (get("postUrl") ?? "").trim(),
      content,
      likes: parseNumber(get("likes")),
      retweets: parseNumber(get("retweets")),
      replies: parseNumber(get("replies")),
      impressions: parseNumber(get("impressions")),
      postedAt: parseDate(get("postedAt")),
      engagementRate: parseNumber(get("engagementRate")),
    });
  }

  return {
    posts,
    headers,
    columns,
    detectedColumns: detected,
    effectiveColumns: effective,
    totalRows: dataRows.length,
    errors,
  };
}
