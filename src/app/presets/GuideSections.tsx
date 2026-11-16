"use client";

// 台本ガイド（外注ライター教育用）の表示セクション群。
// コンテンツは src/lib/guide-content.ts（解説）と /api/script-banks（抽選バンク実体）から供給。

import { useState, useEffect, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  INTRO, EDUCATION_TYPES, EDUCATION_FIRST_THREE, STRUCTURE_GUIDE, PROHIBITIONS, CHECKLIST, educationIdsForBank,
  type EducationType, type EducationExample,
} from "@/lib/guide-content";
import type { ScriptBank } from "@/lib/tarot-draw";
import { getPatterns, type PatternItem } from "@/lib/pattern-store";
import { EMPTY_OVERRIDES, fetchGuideOverrides, saveGuideOverrides, itemKey, techTitle, type GuideOverrides } from "@/lib/guide-overrides";

const eduTitle = (id: string) => EDUCATION_TYPES.find((e) => e.id === id)?.title || id;

// ===== 1. はじめに =====
export function GuideIntro() {
  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-card-bg rounded-xl p-6 border border-gray-100">
        <h2 className="font-bold mb-1">この台本は何のためにあるか</h2>
        <p className="text-sm text-gray-500 mb-4">すべてのルールは、この1つの目的から逆算されています。</p>
        <div className="space-y-2">
          {INTRO.funnel.map((f, i) => (
            <div key={i} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-accent text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              <div>
                <p className="text-sm font-semibold">{f.step}</p>
                <p className="text-xs text-gray-600 leading-5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card-bg rounded-xl p-6 border border-gray-100">
        <h2 className="font-bold mb-1">視聴者は誰か</h2>
        <p className="text-sm text-gray-500 mb-3">実際の購入者データの分析から分かっている人物像です。</p>
        <ul className="space-y-2">
          {INTRO.persona.map((p, i) => (
            <li key={i} className="text-sm text-gray-700 leading-6 pl-4 relative before:content-['●'] before:absolute before:left-0 before:text-accent before:text-[8px] before:top-2">{p}</li>
          ))}
        </ul>
      </div>

      <div className="bg-card-bg rounded-xl p-6 border border-gray-100">
        <h2 className="font-bold mb-1">勝ち筋：視聴者の心をこう動かす</h2>
        <p className="text-sm text-gray-500 mb-3">台本1本を通して、視聴者の感情をこの順番で動かします。</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-400 border-b border-gray-100">
              <th className="py-2 pr-3">場面</th><th className="py-2 pr-3">視聴者の心理</th><th className="py-2">台本がやること</th>
            </tr></thead>
            <tbody>
              {INTRO.curve.map((c, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 pr-3 font-medium whitespace-nowrap">{c.phase}</td>
                  <td className="py-2 pr-3 text-gray-700">{c.viewer}</td>
                  <td className="py-2 text-gray-500 text-xs leading-5">{c.script}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== 共通: 技カタログのバンク取得 ＋ オーナー編集分（上書き） =====
function useBanks() {
  const [banks, setBanks] = useState<ScriptBank[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/script-banks")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setBanks(d.banks || []); })
      .catch(() => setError("バンクの取得に失敗しました"));
  }, []);
  return { banks, error };
}

// 編集できるのはオーナー・管理者（ローカル環境は常に可）
function useCanEdit(): boolean {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role || "";
  const [local, setLocal] = useState(false);
  useEffect(() => { try { const h = window.location.hostname; setLocal(h === "localhost" || h === "127.0.0.1"); } catch { /* ignore */ } }, []);
  return local || role === "owner" || role === "admin";
}

// オーナー編集分（サーバー保存）。読み込み→表示に重ねる→保存
function useOverrides() {
  const [ov, setOv] = useState<GuideOverrides>(EMPTY_OVERRIDES);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  useEffect(() => { fetchGuideOverrides().then(setOv); }, []);
  const save = async (next: GuideOverrides) => {
    setOv(next); setSaving(true); setSaveError("");
    const r = await saveGuideOverrides(next);
    setSaving(false);
    if (!r.ok) setSaveError(`保存に失敗しました: ${r.error || "不明"}`);
  };
  return { ov, save, saving, saveError };
}

export type GuideNav = (q: { section: "education" | "techniques"; edu?: string; bank?: string; item?: string }) => void;

// 技カタログの1項目（表示用に上書きを重ねたもの）
interface DeckItem { bank: ScriptBank; raw: string; key: string; text: string; title: string; place: string; eduIds: string[]; memo: string }
function resolveItem(bank: ScriptBank, raw: string, ov: GuideOverrides): DeckItem {
  const key = itemKey(bank.id, raw);
  const o = ov.items[key] || {};
  const text = o.text || raw;
  const defaultEdus = educationIdsForBank(bank.id);
  const eduIds = o.eduIds && o.eduIds.length ? o.eduIds : defaultEdus;
  const place = o.place || (EDUCATION_TYPES.find((e) => eduIds.includes(e.id))?.place || bank.category);
  return { bank, raw, key, text, title: techTitle(text), place, eduIds, memo: o.memo || "" };
}
// ある教育のデッキに出す項目: deck 定義（only フィルタ）＋ 上書きで追加された項目 − 外した項目
function deckItemsFor(e: EducationType, banks: ScriptBank[], ov: GuideOverrides): DeckItem[] {
  const hidden = new Set(ov.education[e.id]?.hiddenItems || []);
  const out: DeckItem[] = [];
  const seen = new Set<string>();
  for (const d of e.deck) {
    const bank = banks.find((b) => b.id === d.bankId);
    if (!bank) continue;
    for (const raw of bank.items) {
      const it = resolveItem(bank, raw, ov);
      if (d.only && !d.only.some((w) => it.title.includes(w) || raw.includes(w))) continue;
      if (hidden.has(it.key) || seen.has(it.key)) continue;
      seen.add(it.key); out.push(it);
    }
  }
  // 上書きで「この教育」に紐づけられた項目（別バンクでも表示）
  for (const bank of banks) {
    for (const raw of bank.items) {
      const key = itemKey(bank.id, raw);
      const o = ov.items[key];
      if (!o?.eduIds?.includes(e.id) || seen.has(key) || hidden.has(key)) continue;
      seen.add(key); out.push(resolveItem(bank, raw, ov));
    }
  }
  return out;
}

// 技カードのモーダル（文章全体・どこで使うか・この技がしている教育・解説メモ。オーナーは編集できる）
function TechModal({ item, onClose, nav, canEdit, ov, save, eduContext, onHideFromEdu }: {
  item: DeckItem; onClose: () => void; nav?: GuideNav; canEdit: boolean; ov: GuideOverrides; save: (n: GuideOverrides) => Promise<void>;
  eduContext?: EducationType; onHideFromEdu?: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(item.text);
  const [place, setPlace] = useState(item.place);
  const [eduIds, setEduIds] = useState<string[]>(item.eduIds);
  const [memo, setMemo] = useState(item.memo);
  const edus = eduIds.map((id) => EDUCATION_TYPES.find((e) => e.id === id)).filter(Boolean) as EducationType[];
  const doSave = async () => {
    const next: GuideOverrides = { ...ov, items: { ...ov.items, [item.key]: { text: text !== item.raw ? text : undefined, place, eduIds, memo } } };
    await save(next);
    setEdit(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm text-gray-500">{item.bank.category}｜{item.bank.label}</p>
            <h3 className="text-xl font-bold text-gray-900">{techTitle(text)}</h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && !edit && <button onClick={() => setEdit(true)} className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50">✏️ 編集</button>}
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm">✕ 閉じる</button>
          </div>
        </div>
        {!edit ? (
          <>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4">
              <p className="text-sm font-bold text-gray-500 mb-1">文章全体（型の説明と例文）</p>
              <p className="text-base leading-8 text-gray-900 whitespace-pre-wrap">{text}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-bold text-gray-500 mb-1">どこで使うか</p>
                <p className="text-base text-gray-800">{place}</p>
                <p className="text-sm text-gray-500 mt-2">🎲 {item.bank.draw}（ツールが自動で抽選。暗記は不要）</p>
              </div>
              <div className="rounded-xl border border-gray-200 p-4">
                <p className="text-sm font-bold text-gray-500 mb-1">この技がしている教育</p>
                {edus.length === 0 && <p className="text-base text-gray-500">（分類なし）</p>}
                <div className="flex flex-wrap gap-2">
                  {edus.map((e) => (
                    <button key={e.id} onClick={() => { onClose(); nav?.({ section: "education", edu: e.id }); }}
                      className="text-sm px-3 py-1.5 rounded-full bg-accent/10 text-accent font-bold hover:bg-accent hover:text-white">{e.no}. {e.title}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 mt-3">
              <p className="text-sm font-bold text-amber-900 mb-1">🗒 解説メモ</p>
              {memo ? <p className="text-base leading-7 text-gray-900 whitespace-pre-wrap">{memo}</p> : <p className="text-sm text-gray-400">（まだありません{canEdit ? "。「編集」から追加できます" : ""}）</p>}
            </div>
            {canEdit && eduContext && onHideFromEdu && (
              <button onClick={() => { if (confirm(`「${techTitle(text)}」を「${eduContext.title}」のデッキから外しますか？（技カタログ本体には残ります）`)) { onHideFromEdu(); onClose(); } }}
                className="mt-3 text-sm text-red-500 underline">この教育のデッキから外す</button>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <label className="block"><span className="text-sm font-bold text-gray-600">文章全体</span>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} className="mt-1 w-full p-3 rounded-lg border border-gray-300 text-base leading-7" /></label>
            <label className="block"><span className="text-sm font-bold text-gray-600">どこで使うか</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} className="mt-1 w-full p-2.5 rounded-lg border border-gray-300 text-base" /></label>
            <div>
              <span className="text-sm font-bold text-gray-600">この技がしている教育（複数可。チェックした教育のデッキにも表示されます）</span>
              <div className="mt-1 grid sm:grid-cols-2 gap-1">
                {EDUCATION_TYPES.map((e) => (
                  <label key={e.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={eduIds.includes(e.id)} onChange={() => setEduIds((cur) => cur.includes(e.id) ? cur.filter((x) => x !== e.id) : [...cur, e.id])} />
                    {e.no}. {e.title}
                  </label>
                ))}
              </div>
            </div>
            <label className="block"><span className="text-sm font-bold text-gray-600">解説メモ</span>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={4} placeholder="この技の狙い・使いどころ・注意点など" className="mt-1 w-full p-3 rounded-lg border border-gray-300 text-base leading-7" /></label>
            <p className="text-xs text-gray-500">※ ここでの編集は表示（学習用）に反映されます。台本生成に使う抽選バンク本体は変わりません。</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEdit(false)} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">キャンセル</button>
              <button onClick={doSave} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold">保存</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 技のデッキ（横並びのカード。クリックで文章全体）
function TechDeck({ items, onOpen, nav, limit = 8 }: { items: DeckItem[]; onOpen: (it: DeckItem) => void; nav?: GuideNav; limit?: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const byBank = new Map<string, DeckItem[]>();
  for (const it of items) { if (!byBank.has(it.bank.id)) byBank.set(it.bank.id, []); byBank.get(it.bank.id)!.push(it); }
  if (byBank.size === 0) return <p className="text-sm text-gray-400">この教育に紐づく技はまだありません。</p>;
  return (
    <div className="space-y-4">
      {[...byBank.entries()].map(([bankId, list]) => {
        const b = list[0].bank;
        const shown = expanded[bankId] ? list : list.slice(0, limit);
        return (
          <div key={bankId}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-base font-bold text-gray-800">{b.label}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🎲 {b.draw}</span>
              <span className="text-xs text-gray-400">{list.length}種</span>
              {nav && <button onClick={() => nav({ section: "techniques", bank: b.id })} className="text-xs text-accent underline ml-auto">技カタログで見る</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {shown.map((it) => (
                <button key={it.key} onClick={() => onOpen(it)}
                  className="w-[150px] min-h-[84px] text-left rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-accent/60 transition p-3 flex flex-col justify-between">
                  <span className="text-sm font-bold text-gray-900 leading-5 line-clamp-3">{it.title}</span>
                  <span className="text-[11px] text-gray-400 mt-1">{it.memo ? "🗒 メモあり" : "クリックで全文"}</span>
                </button>
              ))}
              {list.length > limit && (
                <button onClick={() => setExpanded((e) => ({ ...e, [bankId]: !e[bankId] }))}
                  className="w-[150px] min-h-[84px] rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-accent hover:text-accent">
                  {expanded[bankId] ? "たたむ" : `残り${list.length - limit}種を見る`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 教育カードの編集モーダル（目的・使う場所・例・ポイント・解説メモ）
function EducationEditModal({ e, ov, save, onClose }: { e: EducationType; ov: GuideOverrides; save: (n: GuideOverrides) => Promise<void>; onClose: () => void }) {
  const cur = ov.education[e.id] || {};
  const [purpose, setPurpose] = useState(cur.purpose ?? e.purpose);
  const [place, setPlace] = useState(cur.place ?? e.place);
  const [examples, setExamples] = useState<EducationExample[]>((cur.examples ?? e.examples).map((x) => ({ ...x })));
  const [points, setPoints] = useState((cur.points ?? e.points).join("\n"));
  const [memo, setMemo] = useState(cur.memo ?? e.memo);
  const doSave = async () => {
    const next: GuideOverrides = { ...ov, education: { ...ov.education, [e.id]: { ...cur, purpose, place, examples: examples.filter((x) => x.text.trim()), points: points.split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 5), memo } } };
    await save(next); onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto space-y-4" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-xl font-bold">{e.no}. {e.title} を編集</h3><button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm">✕ 閉じる</button></div>
        <label className="block"><span className="text-sm font-bold text-gray-600">🎯 目的</span>
          <textarea value={purpose} onChange={(ev) => setPurpose(ev.target.value)} rows={4} className="mt-1 w-full p-3 rounded-lg border border-gray-300 text-base leading-7" /></label>
        <label className="block"><span className="text-sm font-bold text-gray-600">使う場所</span>
          <input value={place} onChange={(ev) => setPlace(ev.target.value)} className="mt-1 w-full p-2.5 rounded-lg border border-gray-300 text-base" /></label>
        <div>
          <div className="flex items-center justify-between"><span className="text-sm font-bold text-gray-600">📝 例（1〜2つ）</span>
            {examples.length < 2 && <button onClick={() => setExamples([...examples, { text: "", source: "", note: "" }])} className="text-sm text-accent underline">＋ 例を追加</button>}</div>
          {examples.map((x, i) => (
            <div key={i} className="mt-2 rounded-xl border border-gray-200 p-3 space-y-2">
              <textarea value={x.text} onChange={(ev) => setExamples(examples.map((y, j) => j === i ? { ...y, text: ev.target.value } : y))} rows={4} placeholder="例文（台本の一節）" className="w-full p-3 rounded-lg border border-gray-300 text-base leading-7" />
              <input value={x.source} onChange={(ev) => setExamples(examples.map((y, j) => j === i ? { ...y, source: ev.target.value } : y))} placeholder="出所（例: 合格台本「収穫」3枚目）" className="w-full p-2.5 rounded-lg border border-gray-300 text-base" />
              <input value={x.note} onChange={(ev) => setExamples(examples.map((y, j) => j === i ? { ...y, note: ev.target.value } : y))} placeholder="ここが効いている（1行）" className="w-full p-2.5 rounded-lg border border-gray-300 text-base" />
              <button onClick={() => setExamples(examples.filter((_, j) => j !== i))} className="text-sm text-red-500 underline">この例を削除</button>
            </div>
          ))}
        </div>
        <label className="block"><span className="text-sm font-bold text-gray-600">💡 ポイント（1行に1つ。最大5つ）</span>
          <textarea value={points} onChange={(ev) => setPoints(ev.target.value)} rows={5} placeholder={"例: 5段で組む: 常識→違う→なぜ→新しい考え方→現実がどう変わるか"} className="mt-1 w-full p-3 rounded-lg border border-gray-300 text-base leading-7" /></label>
        <label className="block"><span className="text-sm font-bold text-gray-600">🗒 解説メモ</span>
          <textarea value={memo} onChange={(ev) => setMemo(ev.target.value)} rows={4} placeholder="補足の解説・注意点など（空でもOK）" className="mt-1 w-full p-3 rounded-lg border border-gray-300 text-base leading-7" /></label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-sm">キャンセル</button>
          <button onClick={doSave} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-bold">保存</button>
        </div>
      </div>
    </div>
  );
}

// ===== 2. 教育の型（目的 → 例 → ポイント） =====
export function GuideEducation({ initialId, nav }: { initialId?: string; nav?: GuideNav }) {
  const [open, setOpen] = useState<string>(initialId && EDUCATION_TYPES.some((e) => e.id === initialId) ? initialId : EDUCATION_TYPES[0].id);
  useEffect(() => { if (initialId && EDUCATION_TYPES.some((e) => e.id === initialId)) setOpen(initialId); }, [initialId]);
  const { banks } = useBanks();
  const { ov, save, saving, saveError } = useOverrides();
  const canEdit = useCanEdit();
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  useEffect(() => { setPatterns(getPatterns()); }, []);
  const [patternModal, setPatternModal] = useState<PatternItem | null>(null);
  const [itemModal, setItemModal] = useState<DeckItem | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const base = EDUCATION_TYPES.find((x) => x.id === open) || EDUCATION_TYPES[0];
  const o = ov.education[base.id] || {};
  const e: EducationType = { ...base, purpose: o.purpose ?? base.purpose, place: o.place ?? base.place, examples: o.examples ?? base.examples, points: o.points ?? base.points, memo: o.memo ?? base.memo };
  const myPatterns = patterns.filter((p) => e.patternCategories.includes(p.category));
  const deck = banks ? deckItemsFor(base, banks, ov) : [];
  const detailRef = useRef<HTMLDivElement | null>(null);
  const select = (id: string) => { setOpen(id); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };
  const hideFromEdu = async (key: string) => {
    const cur = ov.education[base.id] || {};
    await save({ ...ov, education: { ...ov.education, [base.id]: { ...cur, hiddenItems: [...(cur.hiddenItems || []), key] } } });
  };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-base text-gray-700 leading-7">
          台本のすべての技は、この<b>11の教育</b>のどれかをするためにあります。各カードは<b>目的 → 例 → ポイント</b>の順に読めば足ります。
          初めての方は、まず <b>{EDUCATION_FIRST_THREE.map((id) => EDUCATION_TYPES.find((x) => x.id === id)?.title).filter(Boolean).join("・")}</b> の3つから。
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {EDUCATION_TYPES.map((t) => {
          const first = EDUCATION_FIRST_THREE.includes(t.id);
          const active = t.id === open;
          const purpose = ov.education[t.id]?.purpose ?? t.purpose;
          return (
            <button key={t.id} onClick={() => select(t.id)}
              className={`text-left rounded-2xl border-2 p-4 transition ${active ? "border-accent bg-accent/5 shadow-md" : "border-gray-200 bg-white hover:border-accent/50 hover:shadow"}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${active ? "bg-accent text-white" : "bg-gray-800 text-white"}`}>{t.no}</span>
                {first && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">まずこれ</span>}
              </div>
              <p className="text-base font-bold text-gray-900 leading-6">{t.title}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{purpose}</p>
            </button>
          );
        })}
      </div>

      <div ref={detailRef} className="rounded-2xl border-2 border-accent/40 bg-white shadow-sm overflow-hidden scroll-mt-24">
        <div className="px-6 py-5 bg-accent/5 border-b border-accent/20 flex items-center gap-4 flex-wrap">
          <span className="w-12 h-12 rounded-2xl bg-accent text-white text-2xl font-bold flex items-center justify-center">{e.no}</span>
          <h2 className="text-2xl font-bold text-gray-900">{e.title}</h2>
          <span className="ml-auto text-sm px-3 py-1.5 rounded-full bg-white border border-gray-300 text-gray-700">使う場所: {e.place}</span>
          {canEdit && <button onClick={() => setEditOpen(true)} className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50">✏️ 編集</button>}
        </div>
        {saveError && <p className="px-6 pt-3 text-sm text-red-600">{saveError}</p>}
        {saving && <p className="px-6 pt-3 text-sm text-gray-500">保存中...</p>}
        <div className="p-6 space-y-6">
          <section>
            <p className="text-sm font-bold text-accent mb-1">🎯 目的</p>
            <p className="text-lg leading-9 text-gray-900 font-medium whitespace-pre-wrap">{e.purpose}</p>
          </section>
          <section>
            <p className="text-sm font-bold text-accent mb-2">📝 例</p>
            {e.examples.length === 0 && <p className="text-sm text-gray-400">（代表例はまだありません{canEdit ? "。「編集」から追加できます" : ""}）</p>}
            <div className="space-y-3">
              {e.examples.map((ex, i) => (
                <div key={i} className="rounded-xl border-l-4 border-accent bg-amber-50/60 p-4">
                  <p className="text-base leading-8 text-gray-900 whitespace-pre-wrap">{ex.text}</p>
                  {ex.source && <p className="text-sm text-gray-500 mt-2">出所: {ex.source}</p>}
                  {ex.note && <p className="text-sm text-amber-900 mt-1 font-medium">ここが効いている: {ex.note}</p>}
                </div>
              ))}
            </div>
          </section>
          <section>
            <p className="text-sm font-bold text-accent mb-2">💡 ポイント</p>
            {e.points.length === 0 ? (
              <p className="text-sm text-gray-400">（ポイントはオーナーが随時追加します{canEdit ? "。「編集」から1行ずつ追加できます" : ""}）</p>
            ) : (
              <ol className="space-y-2">
                {e.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-gray-800 text-white text-sm font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                    <span className="text-base leading-7 text-gray-800">{pt}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
          {(e.memo || canEdit) && (
            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <p className="text-sm font-bold text-amber-900 mb-1">🗒 解説メモ</p>
              {e.memo ? <p className="text-base leading-7 text-gray-900 whitespace-pre-wrap">{e.memo}</p> : <p className="text-sm text-gray-400">（まだありません。「編集」から追加できます）</p>}
            </section>
          )}
          <section className="pt-4 border-t border-gray-200">
            <p className="text-sm font-bold text-gray-700 mb-1">🎲 この教育で使う技（ツールが自動で抽選。カードを押すと全文）</p>
            <p className="text-sm text-gray-500 mb-3">骨組みや台本に出てきた「◯◯型」が何なのかを確認する辞書です。暗記は不要です。</p>
            {!banks ? <p className="text-sm text-gray-400">技カタログを読み込み中...</p> : <TechDeck items={deck} onOpen={setItemModal} nav={nav} />}
          </section>
          {myPatterns.length > 0 && (
            <section className="pt-4 border-t border-gray-200">
              <p className="text-sm font-bold text-gray-700 mb-3">📚 オーナーが登録したパターン（{e.patternCategories.join("・")}）</p>
              <div className="flex gap-2 flex-wrap">
                {myPatterns.map((p) => (
                  <button key={p.id} onClick={() => setPatternModal(p)}
                    className="w-[150px] min-h-[84px] text-left rounded-xl border border-emerald-200 bg-emerald-50 shadow-sm hover:shadow-md p-3 flex flex-col justify-between">
                    <span className="text-sm font-bold text-gray-900 leading-5 line-clamp-2">{p.title}</span>
                    <span className="text-[11px] text-emerald-700 mt-1">{p.category}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      {itemModal && <TechModal item={itemModal} onClose={() => setItemModal(null)} nav={nav} canEdit={canEdit} ov={ov} save={save} eduContext={base} onHideFromEdu={() => hideFromEdu(itemModal.key)} />}
      {editOpen && <EducationEditModal e={base} ov={ov} save={save} onClose={() => setEditOpen(false)} />}
      {patternModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPatternModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-3">
              <div><p className="text-sm text-gray-500">パターンライブラリ｜{patternModal.category}</p><h3 className="text-xl font-bold">{patternModal.title}</h3></div>
              <button onClick={() => setPatternModal(null)} className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm">✕ 閉じる</button>
            </div>
            <p className="text-base leading-8 text-gray-900 whitespace-pre-wrap rounded-xl bg-gray-50 border border-gray-200 p-4">{patternModal.content}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 3. 構成ガイド =====
export function GuideStructure({ nav }: { nav?: GuideNav }) {
  const [style, setStyle] = useState<"tarot" | "healing">("tarot");
  const guide = STRUCTURE_GUIDE[style];
  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gray-400">スタイル:</span>
        {(Object.keys(STRUCTURE_GUIDE) as ("tarot" | "healing")[]).map((s) => (
          <button key={s} onClick={() => setStyle(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${style === s ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
            {STRUCTURE_GUIDE[s].label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {guide.blocks.map((b, i) => (
          <div key={i} className="bg-card-bg rounded-xl border border-gray-100 p-5 relative">
            {i < guide.blocks.length - 1 && <div className="absolute left-8 -bottom-3 w-0.5 h-3 bg-gray-200" />}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-bold text-sm">{b.title}</h3>
              {b.time && <span className="text-[11px] text-gray-400">{b.time}</span>}
              {b.eduIds.map((id) => (
                <button key={id} onClick={() => nav?.({ section: "education", edu: id })} className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent hover:bg-accent hover:text-white">{eduTitle(id)}</button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mb-0.5">🎯 目的: {b.goal}</p>
            <p className="text-xs text-gray-500 mb-3">💭 視聴者の心理: {b.viewer}</p>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <p className="font-semibold text-gray-600 mb-1">✅ やること</p>
                <ul className="space-y-1">{b.must.map((m, j) => <li key={j} className="text-gray-600 leading-5 pl-3 relative before:content-['・'] before:absolute before:left-0">{m}</li>)}</ul>
              </div>
              <div>
                <p className="font-semibold text-red-500 mb-1">🚫 NG</p>
                <ul className="space-y-1">{b.ng.map((n, j) => <li key={j} className="text-gray-600 leading-5 pl-3 relative before:content-['・'] before:absolute before:left-0">{n}</li>)}</ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== 4. 技カタログ =====
export function GuideTechniques({ initialBank, initialItem, nav }: { initialBank?: string; initialItem?: string; nav?: GuideNav }) {
  const { banks, error } = useBanks();
  const { ov, save } = useOverrides();
  const canEdit = useCanEdit();
  const [query, setQuery] = useState("");
  const [openBank, setOpenBank] = useState<string | null>(initialBank || null);
  const [modal, setModal] = useState<DeckItem | null>(null);
  const bankRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ディープリンク: 指定バンクを開き、指定項目があれば全文モーダルで表示
  useEffect(() => {
    if (!banks || !initialBank) return;
    const b = banks.find((x) => x.id === initialBank);
    if (!b) return;
    setOpenBank(b.id);
    setTimeout(() => bankRefs.current[b.id]?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    if (initialItem) {
      const raw = b.items.find((x) => techTitle(x) === initialItem || x.includes(initialItem) || techTitle(resolveItem(b, x, ov).text) === initialItem);
      if (raw) setModal(resolveItem(b, raw, ov));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [banks, initialBank, initialItem]);

  const filtered = useMemo(() => {
    if (!banks) return null;
    const q = query.trim().toLowerCase();
    if (!q) return banks;
    return banks
      .map((b) => ({ ...b, items: b.items.filter((it) => it.toLowerCase().includes(q) || b.label.toLowerCase().includes(q) || b.category.toLowerCase().includes(q)) }))
      .filter((b) => b.items.length > 0 || b.label.toLowerCase().includes(q));
  }, [banks, query]);

  const categories = useMemo(() => {
    if (!filtered) return [];
    const map = new Map<string, ScriptBank[]>();
    for (const b of filtered) {
      if (!map.has(b.category)) map.set(b.category, []);
      map.get(b.category)!.push(b);
    }
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="max-w-4xl">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-base text-gray-700 leading-7">
        🎲 ここにある技は、<b>すべてツールが生成のたびに自動で抽選して台本に割り当てます</b>。暗記は不要です。
        骨組みや台本に出てきた「◯◯型」が何なのかを確認する辞書として使ってください。各バンクの「教育」タグを押すと、その技が何のためにあるかの説明に戻れます。
      </div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="🔎 技を検索（例: CTA / 言い当て / 切迫）"
        className="w-full px-4 py-3 rounded-lg border border-gray-200 text-base outline-none focus:border-accent mb-4 bg-card-bg" />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!banks && !error && <p className="text-sm text-gray-400">読み込み中...</p>}
      <div className="space-y-6">
        {categories.map(([cat, catBanks]) => (
          <div key={cat}>
            <h3 className="font-bold text-base mb-2">{cat} <span className="text-sm text-gray-400 font-normal">（{catBanks.reduce((s, b) => s + b.items.length, 0)}項目）</span></h3>
            <div className="space-y-2">
              {catBanks.map((b) => {
                const edus = educationIdsForBank(b.id).map((id) => EDUCATION_TYPES.find((e) => e.id === id)).filter(Boolean) as EducationType[];
                const isOpen = openBank === b.id || !!query.trim();
                return (
                  <div key={b.id} ref={(el) => { bankRefs.current[b.id] = el; }} className={`bg-card-bg rounded-xl border overflow-hidden scroll-mt-24 ${initialBank === b.id ? "border-accent" : "border-gray-100"}`}>
                    <button onClick={() => setOpenBank(openBank === b.id ? null : b.id)}
                      className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 flex-wrap">
                      <span className="font-bold text-base">{b.label}</span>
                      {edus.map((e) => (
                        <span key={e.id} role="link" onClick={(ev) => { ev.stopPropagation(); nav?.({ section: "education", edu: e.id }); }}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-bold hover:bg-accent hover:text-white cursor-pointer">教育 {e.no}. {e.title}</span>
                      ))}
                      <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">🎲 {b.draw}</span>
                      <span className="text-xs text-gray-400 shrink-0">{b.items.length}種</span>
                      <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-4 flex gap-2 flex-wrap">
                        {b.items.map((raw, i) => {
                          const it = resolveItem(b, raw, ov);
                          const hit = !!initialItem && (techTitle(raw) === initialItem || raw.includes(initialItem));
                          return (
                            <button key={i} onClick={() => setModal(it)}
                              className={`w-[150px] min-h-[84px] text-left rounded-xl border bg-white shadow-sm hover:shadow-md hover:border-accent/60 transition p-3 flex flex-col justify-between ${hit ? "border-accent ring-2 ring-accent/30" : "border-gray-200"}`}>
                              <span className="text-sm font-bold text-gray-900 leading-5 line-clamp-3">{it.title}</span>
                              <span className="text-[11px] text-gray-400 mt-1">{it.memo ? "🗒 メモあり" : "クリックで全文"}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {modal && <TechModal item={modal} onClose={() => setModal(null)} nav={nav} canEdit={canEdit} ov={ov} save={save} />}
    </div>
  );
}

// ===== 5. 禁止事項＋チェックリスト =====
export function GuideRules() {
  const [copied, setCopied] = useState(false);
  const checklistText = CHECKLIST.map((g) => `■ ${g.group}\n${g.items.map((i) => `□ ${i}`).join("\n")}`).join("\n\n");
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="font-bold mb-1">🚫 禁止事項と、その理由</h2>
        <p className="text-sm text-gray-500 mb-3">「なぜダメか」までセットで覚えると、応用が利くようになります。</p>
        <div className="space-y-3">
          {PROHIBITIONS.map((p, i) => (
            <div key={i} className="bg-card-bg rounded-xl border border-gray-100 p-4">
              <div className="flex items-start gap-2 mb-1.5">
                <p className="font-semibold text-sm flex-1">{p.rule}</p>
                {p.styles.includes("tarot") && !p.styles.includes("common") && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 shrink-0">タロット</span>
                )}
              </div>
              <p className="text-xs text-gray-600 leading-5 mb-2">{p.why}</p>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-red-50 rounded-lg p-2.5 border border-red-100"><span className="font-semibold text-red-500">❌ </span><span className="text-gray-600">{p.bad}</span></div>
                <div className="bg-green-50 rounded-lg p-2.5 border border-green-100"><span className="font-semibold text-green-600">⭕ </span><span className="text-gray-600">{p.good}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-1">
          <h2 className="font-bold">✅ 提出前セルフチェックリスト</h2>
          <button onClick={() => { navigator.clipboard.writeText(checklistText); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">{copied ? "✓ コピーしました" : "📋 コピー"}</button>
        </div>
        <p className="text-sm text-gray-500 mb-3">実際の添削で頻出した指摘から作っています。提出前に全項目を確認してください。</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {CHECKLIST.map((g, i) => (
            <div key={i} className="bg-card-bg rounded-xl border border-gray-100 p-4">
              <p className="font-semibold text-sm mb-2">{g.group}</p>
              <ul className="space-y-1.5">
                {g.items.map((it, j) => (
                  <li key={j} className="text-xs text-gray-600 leading-5 flex gap-2"><span className="text-gray-300 shrink-0">□</span>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
