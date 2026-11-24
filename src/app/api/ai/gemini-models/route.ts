import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// Geminiで今使えるモデルの一覧（Google の models API から取得。新しいモデルが出てもコード変更なしで選べる）
// body.key があれば未保存のキーで取得、無ければ共有設定のキーを使う
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));
    let key = String(body.key || "");
    if (!key) { const row = await prisma.appSetting.findUnique({ where: { key: "shared_gemini_api_key" } }); key = row?.value || ""; }
    if (!key) return NextResponse.json({ error: "Gemini APIキーを入力してください" }, { status: 400 });
    const models: { id: string; label: string; inputLimit?: number; outputLimit?: number }[] = [];
    let pageToken = "";
    for (let page = 0; page < 5; page++) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
      const res = await fetch(url, { headers: { "x-goog-api-key": key } });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || `モデル一覧の取得に失敗 (HTTP ${res.status})` }, { status: 502 }); }
      const data = await res.json() as { models?: { name: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number; outputTokenLimit?: number }[]; nextPageToken?: string };
      for (const m of data.models || []) {
        if (!(m.supportedGenerationMethods || []).includes("generateContent")) continue;
        const id = m.name.replace(/^models\//, "");
        if (/embedding|aqa|imagen|veo|tts|audio|image|live|vision-only/i.test(id)) continue;
        models.push({ id, label: m.displayName || id, inputLimit: m.inputTokenLimit, outputLimit: m.outputTokenLimit });
      }
      pageToken = data.nextPageToken || "";
      if (!pageToken) break;
    }
    // 新しい世代・pro を上に
    models.sort((a, b) => {
      const v = (s: string) => { const m = s.match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
      return v(b.id) - v(a.id) || (b.id.includes("pro") ? 1 : 0) - (a.id.includes("pro") ? 1 : 0) || a.id.localeCompare(b.id);
    });
    return NextResponse.json({ models });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
