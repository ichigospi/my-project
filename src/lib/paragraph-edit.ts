// 段落単位の編集（整合編集・段落書き直し）の共通部品。
// 台本を空行で段落に分け、番号付きで渡し、AIには「差し替える段落の番号と新しい文」だけを返させる。
// 指定の無い段落は1文字も変えないことをサーバー側で保証する。

export interface ParagraphEdit { index: number; text: string; reason?: string }

export function splitParagraphs(script: string): string[] {
  return script.replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export function numberedParagraphs(paras: string[]): string {
  return paras.map((p, i) => `[${i + 1}] ${p}`).join("\n\n");
}

// モデル出力から { "edits": [...] } を取り出す
export function parseParagraphEdits(raw: string): ParagraphEdit[] {
  const tryParse = (s: string): Record<string, unknown> | null => { try { return JSON.parse(s); } catch { return null; } };
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  let obj = tryParse((fence ? fence[1] : raw).trim());
  if (!obj) { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); if (s >= 0 && e > s) obj = tryParse(raw.slice(s, e + 1)); }
  const list = Array.isArray(obj?.edits) ? (obj!.edits as Record<string, unknown>[]) : [];
  return list.map((it) => ({ index: Number(it.index), text: String(it.text ?? ""), reason: it.reason ? String(it.reason) : undefined }))
    .filter((e) => Number.isFinite(e.index) && e.index >= 1);
}

export interface ApplyOptions {
  // 段落の字数がこの割合より減る差し替えは不適用（0.5 = 半分未満に減ったら不適用）。削除（空文字）は allowDelete のときだけ
  minKeepRatio?: number;
  allowDelete?: boolean;
  // 台本全体の字数がこの割合より減ったら、減らした差し替えを後ろから取り消す
  minTotalRatio?: number;
  // 変えてよい段落の番号（1始まり）。指定があればそれ以外の差し替えは不適用
  allowedIndexes?: number[];
}

export interface ApplyResult { script: string; applied: { index: number; reason?: string; before: string; after: string }[]; rejected: { index: number; reason: string }[] }

const chars = (s: string) => s.replace(/\s/g, "").length;

export function applyParagraphEdits(script: string, edits: ParagraphEdit[], opts?: ApplyOptions): ApplyResult {
  const paras = splitParagraphs(script);
  const out = [...paras];
  const applied: ApplyResult["applied"] = [];
  const rejected: ApplyResult["rejected"] = [];
  const minKeep = opts?.minKeepRatio ?? 0.5;
  const seen = new Set<number>();
  for (const e of edits) {
    const i = e.index - 1;
    if (i < 0 || i >= paras.length) { rejected.push({ index: e.index, reason: "存在しない段落番号" }); continue; }
    if (seen.has(i)) { rejected.push({ index: e.index, reason: "同じ段落への差し替えが重複" }); continue; }
    if (opts?.allowedIndexes && !opts.allowedIndexes.includes(e.index)) { rejected.push({ index: e.index, reason: "指示の対象外の段落" }); continue; }
    const before = paras[i];
    const after = e.text.trim();
    if (after === before) continue;
    if (!after) {
      if (!opts?.allowDelete) { rejected.push({ index: e.index, reason: "段落の削除は不可" }); continue; }
    } else if (chars(after) < chars(before) * minKeep) {
      rejected.push({ index: e.index, reason: `字数が${Math.round(minKeep * 100)}%未満に減る差し替え` }); continue;
    }
    seen.add(i);
    out[i] = after;
    applied.push({ index: e.index, reason: e.reason, before, after });
  }
  // 全体の字数ガード: 減りすぎていたら、減らした差し替えを後ろから取り消す
  const minTotal = opts?.minTotalRatio ?? 0.95;
  const total0 = chars(script);
  let total = chars(out.filter(Boolean).join("\n\n"));
  for (let k = applied.length - 1; k >= 0 && total < total0 * minTotal; k--) {
    const a = applied[k];
    if (chars(a.after) < chars(a.before)) {
      out[a.index - 1] = a.before;
      applied.splice(k, 1);
      rejected.push({ index: a.index, reason: "全体の字数が減りすぎるため取り消し" });
      total = chars(out.filter(Boolean).join("\n\n"));
    }
  }
  return { script: out.filter((p) => p !== "").join("\n\n"), applied, rejected };
}

export function summarizeApply(r: ApplyResult): string {
  const lines: string[] = [];
  if (r.applied.length === 0) lines.push("（変更はありませんでした）");
  for (const a of r.applied) lines.push(`・段落${a.index}: ${a.reason || "書き直し"}`);
  if (r.rejected.length > 0) lines.push("", "⚠ 適用しなかった差し替え:", ...r.rejected.map((x) => `・段落${x.index}: ${x.reason}`));
  return lines.join("\n");
}
