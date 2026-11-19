// 分割パート（scriptSegments）と全体台本（generatedScript）の同期。
// 全体に対する修正・加筆・校閲・貼り付けで generatedScript だけが変わると、パートが古いまま残って文字数が食い違う。
// 新しい全体台本の中で各パートの先頭（アンカー）を順に探し、見つかればその境界で切り直す。見つからなければパートを無効化（undefined）する。
import type { ScriptSegment } from "@/lib/project-store";

function escapeRegExp(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function resyncSegments(segs: ScriptSegment[] | undefined, newScript: string): ScriptSegment[] | undefined {
  if (!segs || segs.length === 0) return undefined;
  if (segs.length === 1) return segs[0].script === newScript ? segs : [{ script: newScript }];
  const bounds: number[] = [0];
  let from = 0;
  for (let i = 1; i < segs.length; i++) {
    const anchorChars = segs[i].script.replace(/\s+/g, "").slice(0, 24);
    if (anchorChars.length < 8) return undefined;
    const re = new RegExp(anchorChars.split("").map(escapeRegExp).join("\\s*"));
    const m = newScript.slice(from).match(re);
    if (!m || m.index === undefined) return undefined;
    const at = from + m.index;
    // アンカーの直前の改行まで戻して、パートの切れ目を行頭に揃える
    const nl = newScript.lastIndexOf("\n", at);
    const start = nl >= 0 && at - nl <= 2 ? nl + 1 : at;
    bounds.push(start);
    from = start + 1;
  }
  bounds.push(newScript.length);
  return segs.map((s, i) => {
    const script = newScript.slice(bounds[i], bounds[i + 1]).replace(/\n+$/, "");
    // 本文が変わったパートは前回のチェック結果を捨てる（古い結果を見せない）
    return script === s.script ? s : { script };
  });
}
