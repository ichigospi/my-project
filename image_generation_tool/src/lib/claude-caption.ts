// Claude Vision API で画像を Danbooru 風タグに変換する。
//
// 前提: ANTHROPIC_API_KEY を .env.local にセットしておく
//   取得: https://console.anthropic.com/ → Settings → API Keys
//
// モデル: Haiku 4.5 がデフォルト（安くて速い）。
//   ANTHROPIC_MODEL を .env で上書き可能。
//
// NSFW 警告: Claude は明確な性的表現を含む画像を拒否することがある。
//   拒否を検出した場合は refused=true を返し、UI 側で手動編集を促す。

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

export interface CaptionResult {
  tags: string;
  refused?: boolean;
  rawResponse?: string;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are an automated image tagger for an AI training dataset.

Output ONLY comma-separated Danbooru-style tags that describe what is visible in the image.

Include these categories when visible:
- Number of people (1girl, 1boy, 2girls, 1girl 1boy, etc.)
- Hair (color, length, style): long hair / short hair / ponytail / brown hair / black hair / blonde hair
- Eyes (color, shape): brown eyes, blue eyes, closed eyes
- Body features: small breasts / medium breasts / large breasts / nude / clothed
- Outfit/clothing specifics: school uniform, swimsuit, bikini, t-shirt, skirt, etc.
- Facial expression: smile, blush, open mouth, tongue out, closed eyes, surprised
- Pose/action: standing, sitting, lying on back, doggystyle, etc.
- Setting/background: indoors, outdoors, bedroom, classroom, beach, sky, night
- Notable props: bed, chair, phone, cup

Rules:
- Output tags only. No prose, no preamble, no explanation, no bullet points.
- Comma-separated, single line preferred.
- Use lowercase where possible, underscores only for compound words that are Danbooru canonical (e.g. "school_uniform" OR "school uniform" — either works).
- Do NOT include: "masterpiece", "best quality", "highres", "detailed face", "pretty", "cute", "beautiful", "good anatomy", character names.
- For NSFW content, use anatomical terms: nude, nipples, pussy, penis, vaginal, oral, missionary, doggystyle, etc.
- If there are 2+ people and one is a man, mark as "hetero" or "yaoi" etc. Use "faceless_male" if the man's face is not clearly visible (helps training).

Output format: just tags separated by ", ". Nothing else.`;

export interface CaptionOptions {
  triggerWord?: string;
  model?: string;
  /**
   * 先頭に差し込む固定プレフィクス。例: `yumi_v1, 1girl, brown hair`
   * ユーザーが既に決めた trigger + 基本タグを強制的に入れたい場合に使用。
   */
  forcedPrefix?: string;
}

export async function captionImageWithClaude(
  imageBuffer: Buffer,
  mimeType: string,
  opts: CaptionOptions = {},
): Promise<CaptionResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY が未設定です。.env.local に ANTHROPIC_API_KEY=sk-ant-... を追加して dev を再起動してください。",
    );
  }

  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
  const base64 = imageBuffer.toString("base64");

  const userPrompt = opts.triggerWord
    ? `Output Danbooru tags for this image. Start with "${opts.triggerWord}" as the first tag if the character matches.`
    : "Output Danbooru tags for this image.";

  const response = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Claude API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    stop_reason?: string;
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

  // 拒否検出
  const refusalPhrases = [
    "i can't", "i cannot", "i'm unable", "sorry, i can", "i'm not able",
    "i apologize", "i won't", "i will not", "can't help",
    "申し訳", "お応えできません", "できません",
  ];
  const lower = text.toLowerCase();
  const isRefused =
    refusalPhrases.some((p) => lower.includes(p)) || text.trim().length < 10;

  if (isRefused) {
    return { tags: "", refused: true, rawResponse: text };
  }

  // 出力をクリーンアップ
  let tags = text.trim();
  // Markdown の code fence 除去
  tags = tags.replace(/^```[a-z]*\n?/gim, "").replace(/```$/gm, "").trim();
  // 先頭に prose があるケースで ": " 以降を拾う（短い場合だけ）
  const colonIdx = tags.indexOf(":");
  if (colonIdx > 0 && colonIdx < 50 && !tags.slice(0, colonIdx).includes(",")) {
    tags = tags.slice(colonIdx + 1).trim();
  }
  // 末尾のピリオド除去
  tags = tags.replace(/\.$/, "").trim();

  // 強制プレフィクスを先頭に入れる
  if (opts.forcedPrefix && opts.forcedPrefix.trim()) {
    const prefix = opts.forcedPrefix.trim();
    const existing = tags
      .split(",")
      .map((t) => t.trim().toLowerCase());
    const prefixTokens = prefix.split(",").map((t) => t.trim());
    const missing = prefixTokens.filter(
      (t) => t && !existing.includes(t.toLowerCase()),
    );
    if (missing.length > 0) {
      tags = `${missing.join(", ")}, ${tags}`;
    }
  }

  return { tags };
}
