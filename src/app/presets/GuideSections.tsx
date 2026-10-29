"use client";

// 台本ガイド（外注ライター教育用）の表示セクション群。
// コンテンツは src/lib/guide-content.ts（解説）と /api/script-banks（抽選バンク実体）から供給。

import { useState, useEffect, useMemo } from "react";
import {
  INTRO, EDUCATION_TYPES, STRUCTURE_GUIDE, PROHIBITIONS, CHECKLIST,
} from "@/lib/guide-content";
import type { ScriptBank } from "@/lib/tarot-draw";

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

// ===== 2. 教育の型 =====
export function GuideEducation() {
  const [open, setOpen] = useState<string | null>(EDUCATION_TYPES[0]?.id ?? null);
  return (
    <div className="max-w-3xl space-y-3">
      <p className="text-sm text-gray-500 mb-1">
        台本・SNSのすべての技は、この11の教育のどれかを実行するためにあります。新しい技に迷ったら「どの教育をしているのか」に立ち返ってください。
      </p>
      {EDUCATION_TYPES.map((e) => (
        <div key={e.id} className="bg-card-bg rounded-xl border border-gray-100 overflow-hidden">
          <button onClick={() => setOpen(open === e.id ? null : e.id)}
            className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50">
            <span className="w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center shrink-0">{e.no}</span>
            <span className="font-semibold text-sm flex-1">{e.title}</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${open === e.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          {open === e.id && (
            <div className="px-5 pb-5 space-y-3 text-sm">
              <p className="text-gray-700 leading-6"><span className="font-semibold text-accent">目的：</span>{e.purpose}</p>
              <div>
                <p className="font-semibold text-xs text-gray-500 mb-1.5">構造（この順番で組む）</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {e.structure.map((s, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-lg bg-gray-100 text-xs text-gray-700 leading-5">{s}</span>
                      {i < e.structure.length - 1 && <span className="text-gray-300">→</span>}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-gray-600 text-xs leading-5 bg-amber-50 border border-amber-100 rounded-lg p-3"><span className="font-semibold">💡 ポイント：</span>{e.point}</p>
              <div className="grid sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-red-50 rounded-lg p-3 border border-red-100"><span className="font-semibold">▶ YouTube台本では：</span><span className="text-gray-600 leading-5">{e.youtube}</span></div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100"><span className="font-semibold">▶ SNS投稿では：</span><span className="text-gray-600 leading-5">{e.sns}</span></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ===== 3. 構成ガイド =====
export function GuideStructure() {
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
                <span key={id} className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">{eduTitle(id)}</span>
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
export function GuideTechniques() {
  const [banks, setBanks] = useState<ScriptBank[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [openBank, setOpenBank] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/script-banks")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setBanks(d.banks || []); })
      .catch(() => setError("バンクの取得に失敗しました"));
  }, []);

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
    <div className="max-w-3xl">
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-sm text-gray-700 leading-6">
        🎲 ここにある技は、<b>すべてシステムが生成のたびに自動で抽選して台本に割り当てます</b>。暗記は不要です。
        「骨組みや台本に出てきた指定が、どういう狙いの技なのか」を理解するための辞書として使ってください。項目はツールの更新で自動的に最新になります。
      </div>
      <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="🔎 技を検索（例: CTA / 言い当て / 切迫）"
        className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent mb-4 bg-card-bg" />
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!banks && !error && <p className="text-sm text-gray-400">読み込み中...</p>}
      <div className="space-y-6">
        {categories.map(([cat, catBanks]) => (
          <div key={cat}>
            <h3 className="font-bold text-sm mb-2">{cat} <span className="text-xs text-gray-400 font-normal">（{catBanks.reduce((s, b) => s + b.items.length, 0)}項目）</span></h3>
            <div className="space-y-2">
              {catBanks.map((b) => (
                <div key={b.id} className="bg-card-bg rounded-xl border border-gray-100 overflow-hidden">
                  <button onClick={() => setOpenBank(openBank === b.id ? null : b.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50">
                    <span className="font-medium text-sm flex-1">{b.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">🎲 {b.draw}</span>
                    <span className="text-xs text-gray-400 shrink-0">{b.items.length}種</span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${openBank === b.id ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {(openBank === b.id || query.trim()) && (
                    <div className="px-4 pb-4 space-y-1.5">
                      {b.items.map((it, i) => (
                        <div key={i} className="text-xs text-gray-700 leading-5 bg-gray-50 rounded-lg p-2.5 whitespace-pre-wrap">{it}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
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
