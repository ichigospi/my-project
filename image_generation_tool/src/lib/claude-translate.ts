// 日本語テキスト → Danbooru 英語タグ変換。
// SDXL/Illustrious/Pony で使える形式に変換する。

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `あなたは日本語の画像説明を Danbooru 風の英語タグに変換する翻訳器です。

ルール:
- 出力はカンマ区切りの英語タグのみ
- 前置き・説明文・コードフェンス・ピリオド不要
- タグは lowercase、複合語はスペースまたはアンダースコア（例: "school uniform"）
- 日本語の要素を漏れなくタグ化
- 同じ意味のタグは 1 つに絞る
- 画質タグ（masterpiece, best quality 等）は出力しない
- 主観形容詞（pretty, cute 等）も出力しない
- NSFW 用語は Danbooru 標準タグで（nude, sex, missionary, doggystyle, fellatio,
  cum, penis, vaginal, faceless_male 等）

頻出マッピング:
  制服 → school uniform
  セーラー服 → sailor uniform
  ブレザー → blazer
  水着 → swimsuit
  ビキニ → bikini
  下着 → underwear
  全裸 → nude
  半裸 → partially nude
  上半身裸 → topless
  下半身裸 → bottomless
  笑顔 → smile
  泣き顔 → crying
  アヘ顔 → ahegao
  恥じらい → blush, embarrassed
  よだれ → drooling, saliva
  ロング → long hair
  ショート → short hair
  ポニーテール → ponytail
  ツインテール → twintails
  教室 → classroom
  ベッド → bed
  屋外 → outdoors
  屋内 → indoors
  正常位 → missionary
  バック → doggystyle
  立ちバック → standing sex, from behind
  種付けプレス → mating press
  騎乗位 → cowgirl position
  駅弁 → carry fuck, suspended congress
  対面座位 → sitting sex, face-to-face
  挿入 → penetration, vaginal
  中出し → cum inside, creampie
  顔射 → cum on face, facial
  潮吹き → squirting
  手コキ → handjob
  フェラ → fellatio
  クンニ → cunnilingus
  パイズリ → paizuri, titfuck
  手マン → fingering
  ビクビク → trembling
  女子 / 女 → 1girl（人数を書く）
  男子 / 男 → 1boy
  相手の男 / モブ男 → faceless_male

出力形式: タグだけをカンマ区切りで、1 行で。それ以外は一切出力しない。`;

export interface TranslateResult {
  tags: string;
  rawResponse?: string;
}

export async function translateToTags(
  japaneseText: string,
  opts: { model?: string } = {},
): Promise<TranslateResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY が未設定です。.env.local に ANTHROPIC_API_KEY=sk-ant-... を追加して dev を再起動してください。",
    );
  }

  const model = opts.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

  const res = await fetch(ANTHROPIC_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: japaneseText.trim(),
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  let text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";

  // クリーンアップ
  text = text.replace(/^```[a-z]*\n?/gim, "").replace(/```$/gm, "").trim();
  const colonIdx = text.indexOf(":");
  if (colonIdx > 0 && colonIdx < 50 && !text.slice(0, colonIdx).includes(",")) {
    text = text.slice(colonIdx + 1).trim();
  }
  text = text.replace(/\.$/, "").trim();

  return { tags: text, rawResponse: text };
}
