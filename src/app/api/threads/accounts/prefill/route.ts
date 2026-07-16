// ThreadsプロフィールURLからアカウント情報（コンセプト・ロジック・口調等）をAIで自動入力
// ① URLをサーバー側でフェッチしてog:タグ・埋め込みJSONから情報抽出 → AI推定
// ② フェッチできない場合は 422 を返し、クライアントは貼り付けテキストでの再実行を促す
import { NextRequest, NextResponse } from "next/server";
import { callThreadsAI, extractJson, parseDataUrlImage, resolveThreadsAiModel, type ThreadsAiImage } from "@/lib/threads-ai";
import {
  PREFILL_SYSTEM,
  buildPrefillInstruction,
  type PrefillResult,
} from "@/lib/threads-prompts";

interface ProfileData {
  profileName: string;
  bio: string;
  posts: string[];
}

function parseHandle(input: string): string | null {
  const m = input.match(/@([A-Za-z0-9._]+)/) || input.match(/^([A-Za-z0-9._]+)$/);
  return m ? m[1] : null;
}

function decodeMetaContent(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function extractProfile(html: string): ProfileData {
  const meta = (prop: string): string => {
    const m =
      html.match(new RegExp(`<meta\\s+property="${prop}"\\s+content="([^"]*)"`, "i")) ||
      html.match(new RegExp(`<meta\\s+content="([^"]*)"\\s+property="${prop}"`, "i"));
    return m ? decodeMetaContent(m[1]) : "";
  };
  const ogTitle = meta("og:title"); // 例: 「名前 (@handle) on Threads」
  const ogDescription = meta("og:description"); // フォロワー数 + bio が入ることが多い
  const profileName = ogTitle.replace(/\s*\(@[^)]*\).*$/, "").trim();

  // 埋め込みJSONから投稿本文らしき "text":"..." を拾う（20〜500文字、重複除去）
  const posts: string[] = [];
  const seen = new Set<string>();
  const re = /"text"\s*:\s*"((?:[^"\\]|\\.){20,800}?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && posts.length < 10) {
    try {
      const decoded = JSON.parse(`"${m[1]}"`) as string;
      const key = decoded.slice(0, 40);
      if (seen.has(key)) continue;
      // URLやコード片っぽいものは除外
      if (/^https?:\/\//.test(decoded) || decoded.split(" ").length > 200) continue;
      seen.add(key);
      posts.push(decoded);
    } catch {
      continue;
    }
  }
  return { profileName, bio: ogDescription, posts };
}

async function fetchProfile(handle: string): Promise<ProfileData | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(`https://www.threads.net/@${handle}`, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en;q=0.8",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    const data = extractProfile(html);
    // og:tagすら取れなければ失敗扱い
    if (!data.profileName && !data.bio && data.posts.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}

// POST /api/threads/accounts/prefill
// Body: { url?, pastedText?, images?: string[](data URL), aiApiKey, model? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, pastedText, aiApiKey } = body as {
      url?: string;
      pastedText?: string;
      aiApiKey: string;
    };
    // スクリーンショット（data URL）→ API用画像に変換
    const images: ThreadsAiImage[] = (Array.isArray(body.images) ? (body.images as string[]) : [])
      .map(parseDataUrlImage)
      .filter((i): i is ThreadsAiImage => i !== null)
      .slice(0, 5);

    if (!aiApiKey) {
      return NextResponse.json({ error: "APIキーが未設定です" }, { status: 400 });
    }
    if (!url?.trim() && !pastedText?.trim() && images.length === 0) {
      return NextResponse.json({ error: "URL・スクショ・貼り付けテキストのいずれかが必要です" }, { status: 400 });
    }

    const handle = url ? parseHandle(url.trim()) : null;
    if (url?.trim() && !handle) {
      return NextResponse.json({ error: "URLからハンドルを読み取れませんでした（例: https://www.threads.net/@xxx）" }, { status: 400 });
    }

    // URL指定時はプロフィールをフェッチ（スクショがある場合はフェッチ失敗しても続行）
    let profile: ProfileData | null = null;
    if (handle) {
      profile = await fetchProfile(handle);
    }

    // フェッチ失敗 + スクショも貼り付けもない → クライアントにスクショ/貼り付けを促す
    if (!profile && !pastedText?.trim() && images.length === 0) {
      return NextResponse.json(
        {
          error:
            "プロフィールを自動取得できませんでした（Threads側のアクセス制限の可能性）。プロフィール画面のスクショを追加するか、プロフィール文と投稿数件を貼り付けてください。",
          needPaste: true,
          handle,
        },
        { status: 422 },
      );
    }

    const res = await callThreadsAI(aiApiKey, {
      systemPrompt: PREFILL_SYSTEM,
      userInstruction: buildPrefillInstruction({
        handle: handle ?? undefined,
        profileName: profile?.profileName,
        bio: profile?.bio,
        posts: profile?.posts,
        pastedText: pastedText?.trim() || undefined,
      }),
      images,
      model: resolveThreadsAiModel(body.model),
      maxTokens: 2048,
    });
    if (res.error) {
      return NextResponse.json({ error: res.error, retryable: res.retryable }, { status: res.retryable ? 503 : 500 });
    }
    const prefill = extractJson<PrefillResult>(res.text);
    if (!prefill) {
      return NextResponse.json({ error: "推定結果をパースできませんでした。再実行してください" }, { status: 422 });
    }

    return NextResponse.json({
      prefill,
      handle,
      source: {
        fetched: Boolean(profile),
        bioFound: Boolean(profile?.bio),
        postCount: profile?.posts.length ?? 0,
        pasted: Boolean(pastedText?.trim()),
        imageCount: images.length,
      },
    });
  } catch (e) {
    console.error("POST /api/threads/accounts/prefill", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
