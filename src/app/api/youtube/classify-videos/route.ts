import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";

// 動画のサムネイル＋タイトルから「タロット系か」「テーマ（金運/総合/恋愛）」をAIで一括判定する。
// 1リクエストで最大10本。サムネはサーバー側でダウンロードしてbase64で渡す。
export const maxDuration = 300;

interface InputVideo { videoId: string; title: string; thumbnailUrl: string; }

const PROMPT = `あなたは占い・スピリチュアル系YouTube動画の分類アシスタントです。
各動画の「サムネイル画像」と「タイトル」が番号付きで与えられます。動画ごとに次の2つを判定してください。

1. tarot: サムネイルにタロットカード（カードを並べた盤面・カードをめくる手元・タロットの絵柄）が映っている、
   またはタイトルからタロット/オラクルカードリーディング動画と分かる場合は true。
   ヒーリング音楽・解説・名言・瞑想など、カードを使わない動画は false。
2. theme: タイトルとサムネの訴求テーマ。
   - "money": 金運・お金・臨時収入・宝くじなど金銭の訴求だけの場合
   - "love": 恋愛・復縁・ツインレイ・運命の人など恋愛の訴求だけの場合
   - "general": 金運と恋愛の両方が書いてある場合、またはどちらでもない（総合開運・浄化・健康・人間関係など）場合

次のJSONだけを出力してください（説明文は不要）:
{"items":[{"videoId":"...","tarot":true,"theme":"money"}, ...]}`;

async function fetchImageAsBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const mediaType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!mediaType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 4 * 1024 * 1024) return null; // サムネとしては異常なサイズは送らない
    return { data: buf.toString("base64"), mediaType };
  } catch {
    return null;
  }
}

function parseJSON(raw: string): { items?: unknown[] } | null {
  const candidate = raw.replace(/```json\s*|```/g, "").trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) {
    try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videos, aiApiKey } = body as { videos: InputVideo[]; aiApiKey: string };
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!Array.isArray(videos) || videos.length === 0) return NextResponse.json({ error: "videos が空です" }, { status: 400 });
    const batch = videos.slice(0, 10);

    // サムネを並列ダウンロード
    const images = await Promise.all(batch.map((v) => fetchImageAsBase64(v.thumbnailUrl)));

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let raw = "";

    if (isAnthropic) {
      const content: ({ type: "image"; source: { type: "base64"; media_type: string; data: string } } | { type: "text"; text: string })[] = [];
      batch.forEach((v, i) => {
        content.push({ type: "text", text: `【動画${i + 1}】videoId: ${v.videoId}\nタイトル: ${v.title}\nサムネイル:` });
        const img = images[i];
        if (img) content.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
        else content.push({ type: "text", text: "（サムネイル取得失敗。タイトルだけで判定して）" });
      });
      content.push({ type: "text", text: PROMPT });

      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({ model: aiModel, max_tokens: 2000, messages: [{ role: "user", content }], ...anthropicExtraBody(aiModel) }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res!.status }); }
      const data = await res!.json();
      recordUsage({ model: data.model || aiModel, usage: data.usage });
      raw = ((data.content || []) as { type?: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text || "").join("");
    } else {
      const content: ({ type: "image_url"; image_url: { url: string } } | { type: "text"; text: string })[] = [];
      batch.forEach((v, i) => {
        content.push({ type: "text", text: `【動画${i + 1}】videoId: ${v.videoId}\nタイトル: ${v.title}\nサムネイル:` });
        content.push({ type: "image_url", image_url: { url: v.thumbnailUrl } });
      });
      content.push({ type: "text", text: PROMPT });
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content }], max_tokens: 2000 }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      const odata = await res.json();
      recordUsage({ model: "gpt-4o", usage: odata.usage });
      raw = odata.choices?.[0]?.message?.content || "";
    }

    const parsed = parseJSON(raw);
    if (!parsed || !Array.isArray(parsed.items)) {
      console.error("[classify-videos] parse failed. raw head:", raw.slice(0, 300));
      return NextResponse.json({ error: `AI応答の解析に失敗しました（応答先頭: ${raw.slice(0, 120) || "空"}…）` }, { status: 500 });
    }
    // 返ってきたvideoIdが依頼分に含まれるものだけ採用
    const requested = new Set(batch.map((v) => v.videoId));
    const items = (parsed.items as { videoId?: string; tarot?: boolean; theme?: string }[])
      .filter((it) => it.videoId && requested.has(it.videoId))
      .map((it) => ({
        videoId: it.videoId as string,
        tarot: it.tarot === true,
        theme: it.theme === "money" || it.theme === "love" ? it.theme : "general",
      }));
    return NextResponse.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "分類に失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
