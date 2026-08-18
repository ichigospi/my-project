"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import RevenueNav from "@/components/revenue/RevenueNav";
import {
  DOW,
  QUICK_LABELS,
  addMonths,
  compactAmount,
  daysInMonth,
  formatDateLabel,
  groupByDate,
  netByDate,
  parseAmount,
  signedAmount,
  summarize,
  todayKey,
  yen,
  type RevenueEntry,
  type RevenueType,
} from "@/lib/revenue";

interface FormState {
  type: RevenueType;
  amount: string;
  label: string;
  category: string;
  memo: string;
}

const EMPTY_FORM: FormState = { type: "income", amount: "", label: "", category: "", memo: "" };

export default function RevenueCalendarPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entries, setEntries] = useState<RevenueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const today = todayKey();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/revenue?year=${year}&month=${month}`);
      if (!res.ok) throw new Error(`取得に失敗しました (${res.status})`);
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => summarize(entries), [entries]);
  const dayNet = useMemo(() => netByDate(entries), [entries]);
  const grouped = useMemo(() => groupByDate(entries), [entries]);
  const selectedEntries = useMemo(
    () => (selected ? entries.filter((e) => e.date === selected) : []),
    [entries, selected]
  );

  // カレンダーのマス（前後の空白を含む）
  const cells = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const total = daysInMonth(year, month);
    const list: (number | null)[] = Array(firstDow).fill(null);
    for (let d = 1; d <= total; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month]);

  const dateKey = (day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const shiftMonth = (diff: number) => {
    const next = addMonths(year, month, diff);
    setYear(next.year);
    setMonth(next.month);
  };

  const goToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const openDay = (key: string) => {
    setSelected(key);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  };

  const openToday = () => {
    const d = new Date();
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    openDay(today);
  };

  const startEdit = (entry: RevenueEntry) => {
    setSelected(entry.date);
    setEditingId(entry.id);
    setForm({
      type: entry.type,
      amount: String(entry.amount),
      label: entry.label,
      category: entry.category,
      memo: entry.memo,
    });
    setError("");
  };

  const closeSheet = () => {
    setSelected(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const save = async () => {
    if (!selected) return;
    const amount = parseAmount(form.amount);
    if (!amount || !Number.isFinite(amount)) {
      setError("金額を入力してください");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        date: selected,
        type: form.type,
        amount,
        label: form.label.trim(),
        category: form.category.trim(),
        memo: form.memo.trim(),
      };
      const res = await fetch("/api/revenue", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      if (!res.ok) throw new Error(`保存に失敗しました (${res.status})`);
      setForm(EMPTY_FORM);
      setEditingId(null);
      setError("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("この記録を削除しますか？")) return;
    try {
      const res = await fetch("/api/revenue", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`削除に失敗しました (${res.status})`);
      if (editingId === id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1020] text-white">
      <RevenueNav />

      <main className="max-w-lg mx-auto px-4 pb-32">
        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:scale-95 transition"
            aria-label="前の月"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button onClick={goToday} className="text-center active:scale-95 transition">
            <div className="text-xl font-bold tracking-tight">
              {year}年{month}月
            </div>
            <div className="text-[11px] text-white/40">タップで今月へ</div>
          </button>

          <button
            onClick={() => shiftMonth(1)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 active:scale-95 transition"
            aria-label="次の月"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* カレンダー */}
        <section className="mt-4 rounded-3xl bg-white/[0.04] border border-white/10 p-3">
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[11px] font-semibold py-1 ${
                  i === 0 ? "text-rose-300/80" : i === 6 ? "text-sky-300/80" : "text-white/40"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              if (day === null) return <div key={`blank-${i}`} className="h-16 rounded-xl" />;
              const key = dateKey(day);
              const net = dayNet.get(key);
              const isToday = key === today;
              const dow = i % 7;
              return (
                <button
                  key={key}
                  onClick={() => openDay(key)}
                  className={`h-16 rounded-xl flex flex-col items-center justify-start pt-1.5 px-0.5 border transition active:scale-95 ${
                    isToday
                      ? "bg-emerald-400/10 border-emerald-400/60"
                      : net !== undefined
                      ? "bg-white/[0.06] border-white/10"
                      : "bg-transparent border-white/[0.06]"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold leading-none ${
                      isToday
                        ? "text-emerald-300"
                        : dow === 0
                        ? "text-rose-300/90"
                        : dow === 6
                        ? "text-sky-300/90"
                        : "text-white/70"
                    }`}
                  >
                    {day}
                  </span>
                  {net !== undefined && (
                    <span
                      className={`mt-auto mb-1.5 text-[11px] font-bold leading-none tracking-tight ${
                        net >= 0 ? "text-emerald-300" : "text-rose-300"
                      }`}
                    >
                      {compactAmount(net)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 月サマリー */}
        <section className="mt-4 grid grid-cols-3 rounded-3xl bg-white/[0.04] border border-white/10 overflow-hidden">
          <div className="p-3 text-center">
            <div className="text-[11px] text-white/40">収入</div>
            <div className="mt-1 text-emerald-300 font-bold text-sm tracking-tight">{yen(summary.income)}</div>
          </div>
          <div className="p-3 text-center border-x border-white/10">
            <div className="text-[11px] text-white/40">支出</div>
            <div className="mt-1 text-rose-300 font-bold text-sm tracking-tight">{yen(summary.expense)}</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[11px] text-white/40">合計</div>
            <div
              className={`mt-1 font-bold text-sm tracking-tight ${
                summary.net >= 0 ? "text-white" : "text-rose-300"
              }`}
            >
              {yen(summary.net)}
            </div>
          </div>
        </section>

        {error && !selected && (
          <div className="mt-4 rounded-2xl bg-rose-500/10 border border-rose-400/30 text-rose-200 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* 当月の記録一覧 */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-white/50 px-1">
            {month}月の記録
            <span className="ml-2 text-white/30">{summary.count}件</span>
          </h2>

          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="mt-3 rounded-3xl border border-dashed border-white/15 py-10 text-center">
              <p className="text-white/40 text-sm">まだ記録がありません</p>
              <button
                onClick={openToday}
                className="mt-3 px-4 py-2 rounded-xl bg-emerald-400 text-[#0b1020] text-sm font-bold active:scale-95 transition"
              >
                今日の売上を入力
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {grouped.map((group) => (
                <div key={group.date} className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                  <button
                    onClick={() => openDay(group.date)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-white/[0.03] active:bg-white/[0.06] transition"
                  >
                    <span className="text-[12px] text-white/50">{formatDateLabel(group.date)}</span>
                    <span
                      className={`text-[12px] font-bold ${group.net >= 0 ? "text-emerald-300" : "text-rose-300"}`}
                    >
                      {yen(group.net)}
                    </span>
                  </button>
                  {group.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-4 py-3 border-t border-white/5"
                    >
                      <button onClick={() => startEdit(entry)} className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium truncate">
                          {entry.label || (entry.type === "expense" ? "支出" : "売上")}
                        </div>
                        {(entry.category || entry.memo) && (
                          <div className="text-[11px] text-white/40 truncate">
                            {[entry.category, entry.memo].filter(Boolean).join(" / ")}
                          </div>
                        )}
                      </button>
                      <div
                        className={`text-sm font-bold tracking-tight ${
                          entry.type === "expense" ? "text-rose-300" : "text-emerald-300"
                        }`}
                      >
                        {entry.type === "expense" ? "-" : "+"}
                        {entry.amount.toLocaleString("ja-JP")}円
                      </div>
                      <button
                        onClick={() => remove(entry.id)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 active:text-rose-300 transition"
                        aria-label="削除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* 追加ボタン */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 pointer-events-none"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="max-w-lg mx-auto px-4">
          <button
            onClick={openToday}
            className="pointer-events-auto w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 text-[#0b1020] font-bold shadow-xl shadow-emerald-500/20 active:scale-[0.98] transition"
          >
            ＋ 今日の売上を入力
          </button>
        </div>
      </div>

      {/* 日別の入力シート */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={closeSheet} />

          <div
            className="relative w-full max-w-lg bg-[#111834] border-t border-white/10 rounded-t-3xl max-h-[88vh] overflow-y-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="sticky top-0 bg-[#111834] px-5 pt-3 pb-3 border-b border-white/10">
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{formatDateLabel(selected)}</div>
                  <div className="text-[11px] text-white/40">
                    {selectedEntries.length}件 /{" "}
                    <span
                      className={
                        selectedEntries.reduce((s, e) => s + signedAmount(e), 0) >= 0
                          ? "text-emerald-300"
                          : "text-rose-300"
                      }
                    >
                      {yen(selectedEntries.reduce((s, e) => s + signedAmount(e), 0))}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeSheet}
                  className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/50"
                  aria-label="閉じる"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* その日の記録 */}
              {selectedEntries.length > 0 && (
                <div className="space-y-2">
                  {selectedEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl border ${
                        editingId === entry.id
                          ? "bg-emerald-400/10 border-emerald-400/40"
                          : "bg-white/[0.04] border-white/10"
                      }`}
                    >
                      <button onClick={() => startEdit(entry)} className="flex-1 text-left min-w-0">
                        <div className="text-sm truncate">
                          {entry.label || (entry.type === "expense" ? "支出" : "売上")}
                        </div>
                        {(entry.category || entry.memo) && (
                          <div className="text-[11px] text-white/40 truncate">
                            {[entry.category, entry.memo].filter(Boolean).join(" / ")}
                          </div>
                        )}
                      </button>
                      <span
                        className={`text-sm font-bold ${
                          entry.type === "expense" ? "text-rose-300" : "text-emerald-300"
                        }`}
                      >
                        {entry.type === "expense" ? "-" : "+"}
                        {entry.amount.toLocaleString("ja-JP")}円
                      </span>
                      <button
                        onClick={() => remove(entry.id)}
                        className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/30 active:text-rose-300"
                        aria-label="削除"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 入力フォーム */}
              <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white/50">
                    {editingId ? "記録を編集" : "新しく記録する"}
                  </span>
                  {editingId && (
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setForm(EMPTY_FORM);
                      }}
                      className="text-[11px] text-white/40 underline"
                    >
                      新規入力に戻す
                    </button>
                  )}
                </div>

                {/* 収入 / 支出 */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-black/20">
                  {(["income", "expense"] as RevenueType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`py-2 rounded-lg text-sm font-semibold transition ${
                        form.type === t
                          ? t === "income"
                            ? "bg-emerald-400 text-[#0b1020]"
                            : "bg-rose-400 text-[#0b1020]"
                          : "text-white/50"
                      }`}
                    >
                      {t === "income" ? "収入" : "支出"}
                    </button>
                  ))}
                </div>

                {/* 金額 */}
                <div className="flex items-end gap-2 border-b border-white/10 pb-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="flex-1 bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-white/20"
                  />
                  <span className="text-white/40 pb-1">円</span>
                </div>

                {/* 項目名 */}
                <div>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="項目名（例: 売上、報酬）"
                    className="w-full bg-black/20 rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-white/25 border border-white/10 focus:border-emerald-400/50"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_LABELS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setForm({ ...form, label: l })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border transition ${
                          form.label === l
                            ? "bg-white text-[#0b1020] border-white"
                            : "bg-white/5 text-white/50 border-white/10"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* カテゴリ・メモ */}
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="カテゴリ（任意）"
                    className="bg-black/20 rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-white/25 border border-white/10 focus:border-emerald-400/50"
                  />
                  <input
                    type="text"
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                    placeholder="メモ（任意）"
                    className="bg-black/20 rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-white/25 border border-white/10 focus:border-emerald-400/50"
                  />
                </div>

                {error && <div className="text-rose-300 text-[12px]">{error}</div>}

                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 text-[#0b1020] font-bold disabled:opacity-50 active:scale-[0.98] transition"
                >
                  {saving ? "保存中..." : editingId ? "更新する" : "記録する"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
