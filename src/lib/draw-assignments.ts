// サーバー抽選ブロック（drawSpec）のテキストから、「今回どの技が割り当てられたか」を取り出す。
// 構成提案の抽象ロジックに「この技を使っています」のタグを出し、台本ルールの技カタログへ行き来するために使う。
// 抽選結果が正（AIが本文に書いた【◯◯型】は補助）。

export interface DrawAssignment {
  area: "冒頭" | "1枚目" | "2枚目" | "3枚目" | "4枚目" | "5枚目" | "終盤" | "本編";
  bankId: string;      // getScriptBanks() の id（技カタログへのリンク先）
  label: string;       // 表示名（バンク名）
  value: string;       // 割り当てられた型名（【…】の中身）または先頭の要約
  full: string;        // 割り当ての全文（モーダル表示用）
}

import { techTitle } from "./guide-overrides";
const typeName = (text: string): string => techTitle(text);

// 見出し【…】の直後にある「- …」「  …」「  ・…」「1. …」の本文行を取り出す
function linesUnder(spec: string, heading: RegExp, max = 3): string[] {
  const lines = spec.split("\n");
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length && i < start + 40; i++) {
    const l = lines[i];
    if (/^【/.test(l)) break;
    const t = l.trim();
    if (!t) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function firstMatching(lines: string[], re: RegExp): string {
  return lines.find((l) => re.test(l)) || "";
}

export function parseDrawAssignments(spec: string | undefined | null): DrawAssignment[] {
  if (!spec) return [];
  const out: DrawAssignment[] = [];
  const push = (area: DrawAssignment["area"], bankId: string, label: string, raw: string) => {
    const full = raw.replace(/^[-・]\s*/, "").replace(/^\d+\.\s*/, "").trim();
    if (!full) return;
    out.push({ area, bankId, label, value: typeName(full), full });
  };

  // 冒頭
  const opening = linesUnder(spec, /^【冒頭の選民宣言の型/, 4);
  push("冒頭", "openingLine", "冒頭の選民宣言", firstMatching(opening, /【/));
  const sel = linesUnder(spec, /^【選民・的中の追加演出/, 4);
  push("冒頭", "selection", "選民の追加演出", firstMatching(sel, /【/));
  const ret = linesUnder(spec, /^【離脱防止/, 8);
  const openHook = firstMatching(ret, /オープニングの離脱阻止/);
  if (openHook) push("冒頭", "opening_hooks", "冒頭の離脱防止", openHook.replace(/^・?オープニングの離脱阻止:\s*/, ""));
  const midHook = firstMatching(ret, /3枚目直前の離脱防止/);
  if (midHook) push("3枚目", "mid_hooks", "中盤の離脱防止", midHook.replace(/^・?3枚目直前の離脱防止の一言:\s*/, ""));
  const light = linesUnder(spec, /^【軽CTAの求め方の型/, 2);
  push("冒頭", "light_cta", "軽CTA（高評価・登録）", firstMatching(light, /^-/));
  const cta = linesUnder(spec, /^【コメントCTAの型/, 2);
  push("冒頭", "comment_cta", "コメントCTA", firstMatching(cta, /^-/));
  const negpos = linesUnder(spec, /^【ネガティブ風ポジティブ訴求/, 2);
  push("冒頭", "negpos", "ネガ風ポジ", firstMatching(negpos, /^-/));

  // 2枚目
  const scenes = linesUnder(spec, /^【悩みの深掘りの言い当てシーン/, 6).filter((l) => l.startsWith("・"));
  scenes.forEach((l) => push("2枚目", "scenes", "言い当てシーン", l.replace(/^・\s*/, "")));
  const extra = linesUnder(spec, /^【今回の追加素材/, 12);
  const body = firstMatching(extra, /^- 身体感覚の言い当て/); if (body) push("2枚目", "bodySense", "身体感覚の言い当て", body.replace(/^- 身体感覚の言い当て[^:：]*[:：]\s*/, ""));
  const wanted = firstMatching(extra, /^- 言ってほしかった言葉/); if (wanted) push("2枚目", "wantedWords", "言ってほしかった言葉", wanted.replace(/^- 言ってほしかった言葉[^:：]*[:：]\s*/, ""));
  const label = firstMatching(extra, /^- 性格の肯定ラベリング/); if (label) push("2枚目", "strengthLabels", "性格の肯定ラベリング", label.replace(/^- 性格の肯定ラベリング[^:：]*[:：]\s*/, ""));
  const ending = firstMatching(extra, /^- 「終わり」系カードの意味づけ/); if (ending && !/該当なし|今回は該当/.test(ending)) push("3枚目", "endingMeaning", "終わり系カードの意味づけ", ending.replace(/^- 「終わり」系カードの意味づけ[:：]\s*/, ""));
  const scale = firstMatching(extra, /^- 理想の未来の「規模の段差」/); if (scale) push("5枚目", "futureScale", "理想の未来の規模の段差", scale.replace(/^- 理想の未来の「規模の段差」[^:：]*[:：]\s*/, ""));
  const already = firstMatching(extra, /^- 既成事実化の締め/); if (already) push("終盤", "alreadyStarted", "既成事実化の締め", already.replace(/^- 既成事実化の締め[^:：]*[:：]\s*/, ""));

  // 3枚目
  const straw = linesUnder(spec, /^【仮想敵/, 2);
  push("3枚目", "strawmen", "仮想敵", firstMatching(straw, /^-/));
  const brk = linesUnder(spec, /^【3枚目の常識破壊の型/, 2);
  push("3枚目", "break_styles", "常識破壊の型", firstMatching(brk, /^-/));

  // 4枚目
  const adv = linesUnder(spec, /^【4枚目アドバイスの型/, 2);
  push("4枚目", "advice", "4枚目アドバイスの型", firstMatching(adv, /^-/));

  // 本編（位置はAIが決める）
  const spices = linesUnder(spec, /^【スパイス演出/, 3).filter((l) => /^\d+\./.test(l));
  spices.forEach((l) => push("本編", "spices", "スパイス演出", l));

  // 口コミ
  const proof = linesUnder(spec, /^【社会的証明エピソードの型/, 3);
  const p1 = firstMatching(proof, /序盤の口コミ/); if (p1) push("冒頭", "social_proof", "序盤の口コミ", p1.replace(/^- 序盤の口コミ[^:：]*[:：]\s*/, ""));
  const p2 = firstMatching(proof, /終盤の報告/); if (p2) push("終盤", "social_proof", "終盤の報告", p2.replace(/^- 終盤の報告[:：]\s*/, ""));

  // 終盤
  const close = linesUnder(spec, /^【終盤クロージングの割り当て/, 6);
  const tone = firstMatching(close, /重CTA前の理由づけ/); if (tone) push("終盤", "contrast", "重CTA前の理由づけ", tone.replace(/^- 重CTA前の理由づけ[:：]\s*/, ""));
  const contrast = firstMatching(close, /対比型の比喩/); if (contrast) push("終盤", "contrast", "対比型の比喩", contrast.replace(/^- 対比型の比喩[:：]\s*/, ""));
  const scarcity = firstMatching(close, /枠の切迫/); if (scarcity) push("終盤", "scarcity", "枠の切迫", scarcity.replace(/^- 枠の切迫[:：]\s*/, ""));
  const regular = firstMatching(close, /常連化の一言/); if (regular) push("終盤", "regular", "常連化の一言", regular.replace(/^- 常連化の一言[:：]\s*/, ""));

  // 確率搭載モジュール（【…（今回は入れる）】）
  for (const m of spec.matchAll(/^【([^】]+)（今回は入れる）】/gm)) {
    push("本編", "modules", "モジュール", `【${m[1]}】`);
  }
  return out;
}

// 抽象ロジック／骨組みのセクション見出し（例: 「2枚目: カップの2（正位置）｜悩みの深掘り＋共感」）から、該当する area を決める
export function areaForSectionTitle(title: string, index: number): DrawAssignment["area"] | null {
  const m = title.match(/(\d)枚目/);
  const n = m ? parseInt(m[1], 10) : index + 1;
  if (/問題提起|流れの変化/.test(title)) return "1枚目";
  if (/深掘り|共感|言い当て/.test(title)) return "2枚目";
  if (/常識破壊|仮想敵|原因/.test(title)) return "3枚目";
  if (/解決|アドバイス|ワーク/.test(title)) return "4枚目";
  if (/未来|結末/.test(title)) return "5枚目";
  if (n >= 1 && n <= 5) return `${n}枚目` as DrawAssignment["area"];
  return null;
}

// 技カタログへのリンク（/presets の技カタログを、該当バンク・該当項目を開いた状態で表示）
export function techniqueLink(bankId: string, value: string): string {
  return `/presets?section=techniques&bank=${encodeURIComponent(bankId)}&item=${encodeURIComponent(value)}`;
}
