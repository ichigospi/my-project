import { NextRequest, NextResponse } from "next/server";

// 骨組み(構成案)を、全文を書き直さずに「加筆／違反箇所の削除」の差分パッチで修正する。
// モデルには find→replace のパッチJSONだけを出させ、サーバ側で元の骨組みに適用する。
// これにより指示の無い箇所はバイト単位で元のまま（不変）を保証する。
export const maxDuration = 300;

interface Edit { op?: string; find?: string; replace?: string; reason?: string }

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractJson(text: string): { edits?: Edit[] } | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fence ? fence[1] : text).trim();
  try { return JSON.parse(candidate); } catch { /* fallthrough */ }
  const s = candidate.indexOf("{");
  const e = candidate.lastIndexOf("}");
  if (s >= 0 && e > s) { try { return JSON.parse(candidate.slice(s, e + 1)); } catch { /* fallthrough */ } }
  return null;
}

// 厳密一致→空白(改行)の揺れ吸収の順で、最初の1箇所だけ置換。見つからなければ null。
function applyOneEdit(text: string, find: string, replace: string): string | null {
  if (find && text.includes(find)) return text.replace(find, replace);
  const tokens = find.trim().split(/\s+/).filter(Boolean).map(escapeRegExp);
  if (tokens.length === 0) return null;
  try {
    const re = new RegExp(tokens.join("\\s*"));
    const m = text.match(re);
    if (m && m[0]) return text.replace(m[0], replace);
  } catch { /* 不正な正規表現は諦める */ }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { skeleton, revisionNote, aiApiKey } = body as { skeleton: string; revisionNote: string; aiApiKey: string };

  if (!aiApiKey) return NextResponse.json({ error: "AI APIキーが必要です" }, { status: 400 });
  if (!skeleton || !revisionNote) return NextResponse.json({ error: "骨組みと修正指示が必要です" }, { status: 400 });

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const prompt = `あなたはプロのYouTube台本構成プロデューサーです。
以下の【現在の骨組み】に対し、【修正指示】で挙げられた点だけを「加筆」または「違反箇所の削除」でピンポイントに直す**差分パッチ**を作成してください。

【最重要原則】
- 修正指示で明示された箇所だけを対象にする。全文の書き直しは絶対にしない
- 指示に無い箇所は1文字も変更しない（言い換え・並び替え・改行調整も禁止）
- 既に良いセクション・文言・構成はそのまま温存する
- 直し方は「加筆（不足要素の追加）」か「削除（ルール違反・重複ブロックの除去）」のどちらか。必要最小限の範囲で行う

【出力形式：JSONのみ】
次の形式のJSONだけを出力（前後に説明文やマークダウン装飾を付けない）：
{
  "edits": [
    {
      "op": "add" または "delete",
      "find": "現在の骨組みから、対象箇所を一字一句そのままコピーした文字列",
      "replace": "修正後の文字列（削除の場合は空文字 \\"\\" 、加筆の場合は find＋追記）",
      "reason": "何をなぜ直したかの短い説明"
    }
  ]
}

【find / replace の厳守事項】
- find は必ず【現在の骨組み】に実在する連続した文字列を、改行・記号・句読点まで含めて正確にコピーする（要約・省略・言い換えは厳禁。1文字でも違うと適用できず無視されます）
- find は前後を一意に特定できる十分な長さ（最低でも1文/1行）にする
- 【削除】違反箇所・重複ブロックを消す場合：find にその箇所、replace に空文字（前後が不自然に繋がらないよう、必要なら直前/直後の改行・見出しごと find に含める）
- 【加筆】不足要素を足す場合：挿入位置の直前か直後にある既存の一文/一行を find にし、replace に「その一文＋追加する内容」を入れる
- 既出のセクションの一部だけ直す必要がある場合は、その該当部分だけを find にして最小範囲で直す
- 修正が不要、または該当箇所が見つからない指摘は edits に含めない（無理に何かを変えない）

【修正指示】
${revisionNote}

【現在の骨組み】
${skeleton}`;

  try {
    let text = "";
    if (isAnthropic) {
      let res: Response | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "content-type": "application/json", "x-api-key": aiApiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 12000, messages: [{ role: "user", content: prompt }] }),
        });
        if (res.status === 429 || res.status === 529) {
          if (attempt === 2) return NextResponse.json({ error: "Overloaded", retryable: true }, { status: res.status });
          await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
          continue;
        }
        break;
      }
      if (!res!.ok) { const e = await res!.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res!.status }); }
      text = (await res!.json()).content?.[0]?.text || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
        body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "user", content: prompt }], max_tokens: 12000, response_format: { type: "json_object" } }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); return NextResponse.json({ error: e?.error?.message || "API error" }, { status: res.status }); }
      text = (await res.json()).choices?.[0]?.message?.content || "";
    }

    const parsed = extractJson(text);
    if (!parsed || !Array.isArray(parsed.edits)) {
      return NextResponse.json({ error: "修正結果の解析に失敗しました。もう一度お試しください。" }, { status: 502 });
    }

    let result = skeleton;
    const applied: string[] = [];
    const unmatched: string[] = [];
    for (const ed of parsed.edits) {
      const find = String(ed.find ?? "");
      const replace = String(ed.replace ?? "");
      const op = ed.op === "delete" ? "削除" : "加筆";
      const reason = (ed.reason ? String(ed.reason) : "").trim();
      if (!find) continue;
      const next = applyOneEdit(result, find, replace);
      if (next !== null) {
        result = next;
        applied.push(`・[${op}] ${reason || "修正を適用"}`);
      } else {
        const label = reason || (find.length > 24 ? find.slice(0, 24) + "…" : find);
        unmatched.push(`・[未適用/${op}] ${label}（該当箇所が見つからず自動適用できませんでした）`);
      }
    }

    let summary = applied.length > 0 ? applied.join("\n") : "（適用できる修正がありませんでした）";
    if (unmatched.length > 0) {
      summary += `\n\n⚠ 以下は自動適用できませんでした。指示を具体的にするか、手動で直してください:\n${unmatched.join("\n")}`;
    }

    return NextResponse.json({ skeleton: result, summary, applied: applied.length, unmatched: unmatched.length });
  } catch {
    return NextResponse.json({ error: "骨組みの修正に失敗しました" }, { status: 500 });
  }
}
