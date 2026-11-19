// 指定の型（カードを引いたときにローテーション抽選した型）と、選択した登録パターンが台本に反映されているかの構造化チェック。
// AIに「指定ごとに 入っている／入っていない＋台本からの引用」をJSONで答えさせ、引用が実際に台本にあるかを機械で照合する。
// 引用が台本に無いのに「入っている」と答えた場合は信用せず「要目視」に落とす。
import type { QualityCheckItem } from "@/lib/project-store";

export interface TechniqueSpec {
  id: string;
  kind: "technique" | "pattern";
  label: string;     // バンク名 or パターンのカテゴリ
  short: string;     // 型の短い名前 or パターン名
  text: string;      // 型の全文 or パターン本文
  required: boolean; // 無ければ fail（任意の型は warn）
}

export interface TechniqueVerdict { id: string; present: boolean; evidence: string; note: string }

// 必ず台本に入る前提の抽選バンク（抽選ブロックで「必達」扱いのもの）。ここに無いバンクは条件付き（該当する場面があれば使う）なので warn 止まり
export const REQUIRED_BANKS = new Set([
  "opening_hooks", "mid_hooks", "selection", "openingLine", "feelingBody", "feelingTail",
  "comment_cta", "light_cta", "social_proof", "strawmen", "break_styles", "advice", "scarcity",
  "proofs", "futureScale", "alreadyStarted", "negpos", "contrast", "regular",
]);

export function buildTechniqueCheckPrompt(script: string, specs: TechniqueSpec[]): string {
  const list = specs.map((s, i) => `[${s.id}] （${s.kind === "pattern" ? "登録パターン／" : "型／"}${s.label}）${s.short}\n  内容: ${s.text.replace(/\s+/g, " ").slice(0, 400)}`).join("\n\n");
  return `あなたはYouTube台本の校閲者です。次の台本に、指定された「型」と「登録パターン」が反映されているかを1件ずつ判定してください。
判定の基準:
- 「入っている」= その型の役割（例: 冒頭の離脱防止、仮想敵の批判、コメントCTAの形）が、台本の該当箇所で実際に機能している。言い回しが違っても役割が果たされていれば可
- 例文の丸写しは求めていない。型の説明文に書かれた「狙い」が台本に出ているかを見る
- evidence には、台本から「そのまま」引用した一節（20〜40字。改変禁止）を書く。無ければ空文字
- 迷ったら present=false にする（甘く判定しない）

【指定一覧】
${list}

【台本】
${script}

必ず次のJSONのみで回答（説明文・コードブロック記法は禁止）:
{ "items": [ { "id": "指定のid", "present": true, "evidence": "台本からの引用", "note": "どこで・どう入っているか／入っていない理由（30字以内）" } ] }`;
}

export function parseTechniqueVerdicts(raw: string): TechniqueVerdict[] {
  const tryParse = (s: string): Record<string, unknown> | null => { try { return JSON.parse(s); } catch { return null; } };
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  let obj = tryParse((fence ? fence[1] : raw).trim());
  if (!obj) { const s = raw.indexOf("{"); const e = raw.lastIndexOf("}"); if (s >= 0 && e > s) obj = tryParse(raw.slice(s, e + 1)); }
  const items = Array.isArray(obj?.items) ? (obj!.items as Record<string, unknown>[]) : [];
  return items.map((it) => ({ id: String(it.id || ""), present: it.present === true, evidence: String(it.evidence || "").trim(), note: String(it.note || "").trim() }));
}

const norm = (s: string) => s.replace(/\s+/g, "").replace(/[「」『』、。！？!?…・]/g, "");

// 判定を品質チェックの項目に変換。引用が台本に無い「入っている」は要目視（warn）に落とす
export function buildTechniqueItems(specs: TechniqueSpec[], verdicts: TechniqueVerdict[], script: string): QualityCheckItem[] {
  const ns = norm(script);
  const byId = new Map(verdicts.map((v) => [v.id, v]));
  const out: QualityCheckItem[] = [];
  for (const s of specs) {
    const v = byId.get(s.id);
    const head = `${s.kind === "pattern" ? "登録パターン" : "型"}: ${s.label}「${s.short}」`;
    if (!v) {
      out.push({ name: head, status: "warn", comment: "判定が返りませんでした（要目視）", suggestion: `台本に「${s.short}」の役割が入っているか確認する` });
      continue;
    }
    const ev = norm(v.evidence);
    const evidenceFound = ev.length >= 6 && ns.includes(ev);
    if (v.present && evidenceFound) {
      out.push({ name: head, status: "pass", comment: `反映あり: 「${v.evidence.slice(0, 40)}」${v.note ? `（${v.note}）` : ""}` });
    } else if (v.present) {
      out.push({ name: head, status: "warn", comment: `AIは「入っている」と判定しましたが、根拠の引用が台本に見つかりません（要目視）${v.note ? `: ${v.note}` : ""}`, suggestion: `台本の該当箇所を目で確認。無ければ「${s.short}」の役割を該当セクションに入れる` });
    } else {
      out.push({ name: head, status: s.required ? "fail" : "warn", comment: `反映なし${v.note ? `: ${v.note}` : ""}`, suggestion: `${s.required ? "必達の型です。" : ""}「${s.short}」の狙いを該当セクションに入れる（例文の丸写しはしない）: ${s.text.replace(/\s+/g, " ").slice(0, 120)}` });
    }
  }
  return out;
}
