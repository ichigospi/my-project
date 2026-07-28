import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";
import { recordUsage } from "@/lib/usage-tracker";
import { listLibrary } from "@/lib/video-assets";

export const maxDuration = 300;

// 素材格納庫(ライブラリ)から各シーンに合う素材をAIで自動割り当てする
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { scenes, aiApiKey } = body as {
    scenes?: { id: string; section?: string; narration?: string; visualPrompt?: string }[];
    aiApiKey?: string;
    aiModel?: string;
  };
  const aiModel = resolveAiModel(body.aiModel);

  if (!aiApiKey) return NextResponse.json({ error: "AIのAPIキーが必要です" }, { status: 400 });
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json({ error: "scenes が必要です" }, { status: 400 });
  }

  try {
    const library = (await listLibrary()).filter((e) => e.kind === "video" || e.kind === "image");
    if (library.length === 0) {
      return NextResponse.json({ assignments: [], libraryCount: 0 });
    }

    const assetList = library
      .slice(0, 300)
      .map((e) => `- ${e.id} [${e.kind === "video" ? "動画" : "画像"}] ${e.prompt || e.label || "(説明なし)"}`)
      .join("\n");
    const sceneList = scenes
      .map((s) => `- ${s.id}: 【${s.section || ""}】${(s.narration || "").slice(0, 80)} / 映像イメージ: ${(s.visualPrompt || "").slice(0, 150)}`)
      .join("\n");

    const prompt = `動画のシーンごとに、素材格納庫から内容の合う素材を割り当ててください。

【素材格納庫】
${assetList}

【シーン一覧】
${sceneList}

ルール:
- シーンの内容・雰囲気に本当に合う素材だけを割り当てる。無理に割り当てず、合うものがなければ null
- 動画素材を画像素材より優先する
- 同じ素材を複数シーンに使ってもよいが、連続するシーンでの使い回しは避ける

以下のJSON配列のみを出力:
[{"sceneId": "シーンID", "assetId": "素材ID または null"}]`;

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    let text = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: anthropicHeaders(aiApiKey, aiModel),
          body: JSON.stringify({
            model: aiModel,
            max_tokens: 8192,
            messages: [{ role: "user", content: prompt }],
            ...anthropicExtraBody(aiModel),
          }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) {
        const e = await res!.json();
        return NextResponse.json({ error: e.error?.message || "AI APIエラー" }, { status: res!.status });
      }
      const data = await res!.json();
      recordUsage({ model: data.model || aiModel, usage: data.usage });
      text = (data.content || [])
        .filter((b: { type: string }) => b.type === "text")
        .map((b: { text?: string }) => b.text || "")
        .join("");
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 8192 }),
      });
      if (!res.ok) {
        const e = await res.json();
        return NextResponse.json({ error: e.error?.message || "AI APIエラー" }, { status: res.status });
      }
      const data = await res.json();
      recordUsage({ model: "gpt-4o", usage: data.usage });
      text = data.choices?.[0]?.message?.content || "";
    }

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return NextResponse.json({ error: "割り当て結果のパースに失敗しました" }, { status: 500 });
    let raw: { sceneId?: string; assetId?: string | null }[];
    try {
      raw = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: "割り当て結果のJSONが不正です" }, { status: 500 });
    }

    // 実在する素材IDのみ採用する
    const validIds = new Set(library.map((e) => e.id));
    const assignments = raw
      .filter((a) => a.sceneId && a.assetId && validIds.has(String(a.assetId)))
      .map((a) => ({ sceneId: String(a.sceneId), assetId: String(a.assetId) }));

    return NextResponse.json({ assignments, libraryCount: library.length });
  } catch (e) {
    console.error("POST /api/video/match-assets", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
