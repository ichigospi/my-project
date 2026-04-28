// Xアナリティクス CSV のクライアントサイドパーサ
// X が公式エクスポートする CSV はカラム名が時期によって少し違うので、
// 候補カラム名を複数許容してマッピングする

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

export interface CsvParseResult {
  posts: CsvParsedPost[];
  unmappedHeaders: string[];
  detectedColumns: Record<string, string>; // 内部キー → 元のCSVカラム名
  totalRows: number;
  errors: string[];
}

// カラム名候補（小文字で比較）
const COLUMN_ALIASES: Record<keyof CsvParsedPost, string[]> = {
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
          // エスケープされたクォート
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

// ヘッダーから内部キーへのマッピングを構築
function buildColumnMap(headers: string[]): {
  map: Partial<Record<keyof CsvParsedPost, number>>;
  detectedColumns: Record<string, string>;
} {
  const map: Partial<Record<keyof CsvParsedPost, number>> = {};
  const detectedColumns: Record<string, string> = {};
  const lowered = headers.map((h) => h.toLowerCase().trim());

  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as [
    keyof CsvParsedPost,
    string[],
  ][]) {
    for (const alias of aliases) {
      const idx = lowered.indexOf(alias);
      if (idx >= 0) {
        map[key] = idx;
        detectedColumns[key] = headers[idx];
        break;
      }
    }
  }
  return { map, detectedColumns };
}

export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((l) => l.length > 0);
  if (lines.length < 2) {
    return {
      posts: [],
      unmappedHeaders: [],
      detectedColumns: {},
      totalRows: 0,
      errors: ["ヘッダー行＋データ行が見つかりません"],
    };
  }

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => h.trim());
  const { map, detectedColumns } = buildColumnMap(headers);

  if (map.content === undefined) {
    errors.push("ポスト本文（Tweet text）のカラムが見つかりません");
  }

  const unmappedHeaders = headers.filter(
    (h) => !Object.values(detectedColumns).includes(h),
  );

  const posts: CsvParsedPost[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i], delimiter);
    const get = (key: keyof CsvParsedPost) => {
      const idx = map[key];
      return idx === undefined ? undefined : cells[idx];
    };

    const content = (get("content") ?? "").trim();
    if (!content) continue; // 空行スキップ

    const post: CsvParsedPost = {
      postId: (get("postId") ?? "").trim(),
      postUrl: (get("postUrl") ?? "").trim(),
      content,
      likes: parseNumber(get("likes")),
      retweets: parseNumber(get("retweets")),
      replies: parseNumber(get("replies")),
      impressions: parseNumber(get("impressions")),
      postedAt: parseDate(get("postedAt")),
      engagementRate: parseNumber(get("engagementRate")),
    };
    posts.push(post);
  }

  return {
    posts,
    unmappedHeaders,
    detectedColumns,
    totalRows: lines.length - 1,
    errors,
  };
}
