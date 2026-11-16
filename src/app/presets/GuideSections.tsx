"use client";

// 台本ガイド（外注ライター教育用）の表示セクション群。
// コンテンツは src/lib/guide-content.ts（解説）と /api/script-banks（抽選バンク実体）から供給。

import { useState, useEffect, useMemo, useRef } from "react";
import {
  INTRO, EDUCATION_TYPES, EDUCATION_FIRST_THREE, STRUCTURE_GUIDE, PROHIBITIONS, CHECKLIST, educationIdsForBank,
} from "@/lib/guide-content";
import type { ScriptBank } from "@/lib/tarot-draw";
import { getPatterns, type PatternItem } from "@/lib/pattern-store";

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

// ===== 共通: 技カタログのバンク取得 =====
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

// 技カタログの1項目を「カード」として表示するための見出し（【◯◯型】があればそれ、無ければ先頭）
export function techTitle(item: string): string {
  const m = item.match(/【([^】]{1,24})】/);
  if (m) return m[1];
  const t = item.replace(/^[「『]/, "").replace(/\s+/g, " ").trim();
  return t.length > 18 ? t.slice(0, 18) + "…" : t;
}

export type GuideNav = (q: { section: "education" | "techniques"; edu?: string; bank?: string; item?: string }) => void;

// 技カードのモーダル（文章全体＋どこで使うか）
function TechModal({ bank, item, onClose, nav }: { bank: ScriptBank; item: string; onClose: () => void; nav?: GuideNav }) {
  const edus = educationIdsForBank(bank.id).map((id) => EDUCATION_TYPES.find((e) => e.id === id)).filter(Boolean) as typeof EDUCATION_TYPES;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm text-gray-500">{bank.category}｜{bank.label}</p>
            <h3 className="text-xl font-bold text-gray-900">{techTitle(item)}</h3>
          </div>
          <button onClick={onClose} className="shrink-0 px-3 py-1.5 rounded-lg bg-gray-800 text-white text-sm">✕ 閉じる</button>
        </div>
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 mb-4">
          <p className="text-sm font-bold text-gray-500 mb-1">文章全体（型の説明と例文）</p>
          <p className="text-base leading-8 text-gray-900 whitespace-pre-wrap">{item}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-bold text-gray-500 mb-1">どこで使うか</p>
            <p className="text-base text-gray-800">{edus.map((e) => e.place).filter(Boolean)[0] || bank.category}</p>
            <p className="text-sm text-gray-500 mt-2">🎲 {bank.draw}（ツールが自動で抽選。暗記は不要）</p>
          </div>
          <div className="rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-bold text-gray-500 mb-1">この技がしている教育</p>
            {edus.length === 0 && <p className="text-base text-gray-500">（分類なし）</p>}
            <div className="flex flex-wrap gap-2">
              {edus.map((e) => (
                <button key={e.id} onClick={() => { onClose(); nav?.({ section: "education", edu: e.id }); }}
                  className="text-sm px-3 py-1.5 rounded-full bg-accent/10 text-accent font-bold hover:bg-accent hover:text-white">
                  {e.no}. {e.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// 技のデッキ（横並びのカード。クリックで文章全体）
function TechDeck({ banks, bankIds, nav, limit = 8 }: { banks: ScriptBank[] | null; bankIds: string[]; nav?: GuideNav; limit?: number }) {
  const [modal, setModal] = useState<{ bank: ScriptBank; item: string } | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!banks) return <p className="text-sm text-gray-400">技カタログを読み込み中...</p>;
  const list = bankIds.map((id) => banks.find((b) => b.id === id)).filter(Boolean) as ScriptBank[];
  if (list.length === 0) return null;
  return (
    <div className="space-y-4">
      {list.map((b) => {
        const items = expanded[b.id] ? b.items : b.items.slice(0, limit);
        return (
          <div key={b.id}>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <p className="text-base font-bold text-gray-800">{b.label}</p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">🎲 {b.draw}</span>
              <span className="text-xs text-gray-400">{b.items.length}種</span>
              {nav && <button onClick={() => nav({ section: "techniques", bank: b.id })} className="text-xs text-accent underline ml-auto">技カタログで見る</button>}
            </div>
            <div className="flex gap-2 flex-wrap">
              {items.map((it, i) => (
                <button key={i} onClick={() => setModal({ bank: b, item: it })}
                  className="w-[150px] min-h-[84px] text-left rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md hover:border-accent/60 transition p-3 flex flex-col justify-between">
                  <span className="text-sm font-bold text-gray-900 leading-5 line-clamp-2">{techTitle(it)}</span>
                  <span className="text-[11px] text-gray-400 mt-1">クリックで全文</span>
                </button>
              ))}
              {b.items.length > limit && (
                <button onClick={() => setExpanded((e) => ({ ...e, [b.id]: !e[b.id] }))}
                  className="w-[150px] min-h-[84px] rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-accent hover:text-accent">
                  {expanded[b.id] ? "たたむ" : `残り${b.items.length - limit}種を見る`}
                </button>
              )}
            </div>
          </div>
        );
      })}
      {modal && <TechModal bank={modal.bank} item={modal.item} onClose={() => setModal(null)} nav={nav} />}
    </div>
  );
}

// ===== 2. 教育の型（目的 → 例 → ポイント） =====
export function GuideEducation({ initialId, nav }: { initialId?: string; nav?: GuideNav }) {
  const [open, setOpen] = useState<string>(initialId && EDUCATION_TYPES.some((e) => e.id === initialId) ? initialId : EDUCATION_TYPES[0].id);
  useEffect(() => { if (initialId && EDUCATION_TYPES.some((e) => e.id === initialId)) setOpen(initialId); }, [initialId]);
  const { banks } = useBanks();
  const [patterns, setPatterns] = useState<PatternItem[]>([]);
  useEffect(() => { setPatterns(getPatterns()); }, []);
  const [patternModal, setPatternModal] = useState<PatternItem | null>(null);
  const e = EDUCATION_TYPES.find((x) => x.id === open) || EDUCATION_TYPES[0];
  const myPatterns = patterns.filter((p) => e.patternCategories.includes(p.category));
  const detailRef = useRef<HTMLDivElement | null>(null);
  const select = (id: string) => { setOpen(id); setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); };

  return (
    <div className="max-w-4xl space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-base text-gray-700 leading-7">
          台本のすべての技は、この<b>11の教育</b>のどれかをするためにあります。各カードは<b>目的 → 例 → ポイント</b>の順に読めば足ります。
          初めての方は、まず <b>{EDUCATION_FIRST_THREE.map((id) => EDUCATION_TYPES.find((x) => x.id === id)?.title).filter(Boolean).join("・")}</b> の3つから。
        </p>
      </div>

      {/* 11枚のタイル */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {EDUCATION_TYPES.map((t) => {
          const first = EDUCATION_FIRST_THREE.includes(t.id);
          const active = t.id === open;
          return (
            <button key={t.id} onClick={() => select(t.id)}
              className={`text-left rounded-2xl border-2 p-4 transition ${active ? "border-accent bg-accent/5 shadow-md" : "border-gray-200 bg-white hover:border-accent/50 hover:shadow"}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center ${active ? "bg-accent text-white" : "bg-gray-800 text-white"}`}>{t.no}</span>
                {first && <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">まずこれ</span>}
              </div>
              <p className="text-base font-bold text-gray-900 leading-6">{t.title}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.purpose}</p>
            </button>
          );
        })}
      </div>

      {/* 選択中の教育カード */}
      <div ref={detailRef} className="rounded-2xl border-2 border-accent/40 bg-white shadow-sm overflow-hidden scroll-mt-24">
        <div className="px-6 py-5 bg-accent/5 border-b border-accent/20 flex items-center gap-4 flex-wrap">
          <span className="w-12 h-12 rounded-2xl bg-accent text-white text-2xl font-bold flex items-center justify-center">{e.no}</span>
          <h2 className="text-2xl font-bold text-gray-900">{e.title}</h2>
          <span className="ml-auto text-sm px-3 py-1.5 rounded-full bg-white border border-gray-300 text-gray-700">使う場所: {e.place}</span>
        </div>
        <div className="p-6 space-y-6">
          <section>
            <p className="text-sm font-bold text-accent mb-1">🎯 目的</p>
            <p className="text-xl leading-9 text-gray-900 font-medium">{e.purpose}</p>
          </section>
          <section>
            <p className="text-sm font-bold text-accent mb-2">📝 例</p>
            <div className="space-y-3">
              {e.examples.map((ex, i) => (
                <div key={i} className="rounded-xl border-l-4 border-accent bg-amber-50/60 p-4">
                  <p className="text-base leading-8 text-gray-900 whitespace-pre-wrap">{ex.text}</p>
                  <p className="text-sm text-gray-500 mt-2">出所: {ex.source}</p>
                  <p className="text-sm text-amber-900 mt-1 font-medium">ここが効いている: {ex.note}</p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <p className="text-sm font-bold text-accent mb-2">💡 ポイント</p>
            <ol className="space-y-2">
              {e.points.map((pt, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-gray-800 text-white text-sm font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span className="text-base leading-7 text-gray-800">{pt}</span>
                </li>
              ))}
            </ol>
          </section>
          <section className="pt-4 border-t border-gray-200">
            <p className="text-sm font-bold text-gray-700 mb-1">🎲 この教育で使う技（ツールが自動で抽選。カードを押すと全文）</p>
            <p className="text-sm text-gray-500 mb-3">骨組みや台本に出てきた「◯◯型」が何なのかを確認する辞書です。暗記は不要です。</p>
            <TechDeck banks={banks} bankIds={e.bankIds} nav={nav} />
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
  const [query, setQuery] = useState("");
  const [openBank, setOpenBank] = useState<string | null>(initialBank || null);
  const [modal, setModal] = useState<{ bank: ScriptBank; item: string } | null>(null);
  const bankRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ディープリンク: 指定バンクを開き、指定項目があれば全文モーダルで表示
  useEffect(() => {
    if (!banks || !initialBank) return;
    const b = banks.find((x) => x.id === initialBank);
    if (!b) return;
    setOpenBank(b.id);
    setTimeout(() => bankRefs.current[b.id]?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    if (initialItem) {
      const it = b.items.find((x) => techTitle(x) === initialItem || x.includes(initialItem));
      if (it) setModal({ bank: b, item: it });
    }
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
                const edus = educationIdsForBank(b.id).map((id) => EDUCATION_TYPES.find((e) => e.id === id)).filter(Boolean) as typeof EDUCATION_TYPES;
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
                        {b.items.map((it, i) => (
                          <button key={i} onClick={() => setModal({ bank: b, item: it })}
                            className={`w-[150px] min-h-[84px] text-left rounded-xl border bg-white shadow-sm hover:shadow-md hover:border-accent/60 transition p-3 flex flex-col justify-between ${initialItem && (techTitle(it) === initialItem || it.includes(initialItem)) ? "border-accent ring-2 ring-accent/30" : "border-gray-200"}`}>
                            <span className="text-sm font-bold text-gray-900 leading-5 line-clamp-2">{techTitle(it)}</span>
                            <span className="text-[11px] text-gray-400 mt-1">クリックで全文</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {modal && <TechModal bank={modal.bank} item={modal.item} onClose={() => setModal(null)} nav={nav} />}
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
