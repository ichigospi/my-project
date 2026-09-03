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
    <div className="min-h-screen bg-white text-gray-900">
      <RevenueNav />

      <main className="max-w-lg mx-auto px-4 pb-32">
        {/* 月ナビゲーション */}
        <div className="flex items-center justify-between mt-4">
          <button
            onClick={() => shiftMonth(-1)}
            className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 active:scale-95 transition"
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
            <div className="text-[11px] text-gray-400">タップで今月へ</div>
          </button>

          <button
            onClick={() => shiftMonth(1)}
            className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 active:scale-95 transition"
            aria-label="次の月"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* カレンダー */}
        <section className="mt-4 rounded-3xl bg-white border border-gray-200 shadow-sm p-3">
          <div className="grid grid-cols-7 mb-1">
            {DOW.map((d, i) => (
              <div
                key={d}
                className={`text-center text-[11px] font-semibold py-1 ${
                  i === 0 ? "text-rose-500/80" : i === 6 ? "text-sky-500" : "text-gray-400"
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
                      ? "bg-violet-50 border-violet-500"
                      : net !== undefined
                      ? "bg-gray-50 border-gray-200"
                      : "bg-transparent border-gray-100"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold leading-none ${
                      isToday
                        ? "text-violet-600"
                        : dow === 0
                        ? "text-rose-500/90"
                        : dow === 6
                        ? "text-sky-500"
                        : "text-gray-600"
                    }`}
                  >
                    {day}
                  </span>
                  {net !== undefined && (
                    <span
                      className={`mt-auto mb-1.5 text-[11px] font-bold leading-none tracking-tight ${
                        net >= 0 ? "text-violet-600" : "text-rose-500"
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
        <section className="mt-4 grid grid-cols-3 rounded-3xl bg-white border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-3 text-center">
            <div className="text-[11px] text-gray-400">収入</div>
            <div className="mt-1 text-violet-600 font-bold text-sm tracking-tight">{yen(summary.income)}</div>
          </div>
          <div className="p-3 text-center border-x border-gray-200">
            <div className="text-[11px] text-gray-400">支出</div>
            <div className="mt-1 text-rose-500 font-bold text-sm tracking-tight">{yen(summary.expense)}</div>
          </div>
          <div className="p-3 text-center">
            <div className="text-[11px] text-gray-400">合計</div>
            <div
              className={`mt-1 font-bold text-sm tracking-tight ${
                summary.net >= 0 ? "text-gray-900" : "text-rose-500"
              }`}
            >
              {yen(summary.net)}
            </div>
          </div>
        </section>

        {error && !selected && (
          <div className="mt-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* 当月の記録一覧 */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-gray-500 px-1">
            {month}月の記録
            <span className="ml-2 text-gray-400">{summary.count}件</span>
          </h2>

          {loading ? (
            <div className="mt-3 space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : grouped.length === 0 ? (
            <div className="mt-3 rounded-3xl border border-dashed border-gray-200 py-10 text-center">
              <p className="text-gray-400 text-sm">まだ記録がありません</p>
              <button
                onClick={openToday}
                className="mt-3 px-4 py-2 rounded-xl bg-violet-500 text-white text-sm font-bold active:scale-95 transition"
              >
                今日の売上を入力
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {grouped.map((group) => (
                <div key={group.date} className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
                  <button
                    onClick={() => openDay(group.date)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 active:bg-gray-100 transition"
                  >
                    <span className="text-[12px] text-gray-500">{formatDateLabel(group.date)}</span>
                    <span
                      className={`text-[12px] font-bold ${group.net >= 0 ? "text-violet-600" : "text-rose-500"}`}
                    >
                      {yen(group.net)}
                    </span>
                  </button>
                  {group.entries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center gap-3 px-4 py-3 border-t border-gray-100"
                    >
                      <button onClick={() => startEdit(entry)} className="flex-1 text-left min-w-0">
                        <div className="text-sm font-medium truncate">
                          {entry.label || (entry.type === "expense" ? "支出" : "売上")}
                        </div>
                        {(entry.category || entry.memo) && (
                          <div className="text-[11px] text-gray-400 truncate">
                            {[entry.category, entry.memo].filter(Boolean).join(" / ")}
                          </div>
                        )}
                      </button>
                      <div
                        className={`text-sm font-bold tracking-tight ${
                          entry.type === "expense" ? "text-rose-500" : "text-violet-600"
                        }`}
                      >
                        {entry.type === "expense" ? "-" : "+"}
                        {entry.amount.toLocaleString("ja-JP")}円
                      </div>
                      <button
                        onClick={() => remove(entry.id)}
                        className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 active:text-rose-500 transition"
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
            className="pointer-events-auto w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-700 to-violet-400 text-white font-bold shadow-xl shadow-violet-500/25 active:scale-[0.98] transition"
          >
            ＋ 今日の売上を入力
          </button>
        </div>
      </div>

      {/* 日別の入力シート */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={closeSheet} />

          <div
            className="relative w-full max-w-lg bg-white border-t border-gray-200 rounded-t-3xl max-h-[88vh] overflow-y-auto"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            <div className="sticky top-0 bg-white px-5 pt-3 pb-3 border-b border-gray-200">
              <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold">{formatDateLabel(selected)}</div>
                  <div className="text-[11px] text-gray-400">
                    {selectedEntries.length}件 /{" "}
                    <span
                      className={
                        selectedEntries.reduce((s, e) => s + signedAmount(e), 0) >= 0
                          ? "text-violet-600"
                          : "text-rose-500"
                      }
                    >
                      {yen(selectedEntries.reduce((s, e) => s + signedAmount(e), 0))}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeSheet}
                  className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500"
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
                          ? "bg-violet-50 border-violet-500"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <button onClick={() => startEdit(entry)} className="flex-1 text-left min-w-0">
                        <div className="text-sm truncate">
                          {entry.label || (entry.type === "expense" ? "支出" : "売上")}
                        </div>
                        {(entry.category || entry.memo) && (
                          <div className="text-[11px] text-gray-400 truncate">
                            {[entry.category, entry.memo].filter(Boolean).join(" / ")}
                          </div>
                        )}
                      </button>
                      <span
                        className={`text-sm font-bold ${
                          entry.type === "expense" ? "text-rose-500" : "text-violet-600"
                        }`}
                      >
                        {entry.type === "expense" ? "-" : "+"}
                        {entry.amount.toLocaleString("ja-JP")}円
                      </span>
                      <button
                        onClick={() => remove(entry.id)}
                        className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 active:text-rose-500"
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
              <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500">
                    {editingId ? "記録を編集" : "新しく記録する"}
                  </span>
                  {editingId && (
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setForm(EMPTY_FORM);
                      }}
                      className="text-[11px] text-gray-400 underline"
                    >
                      新規入力に戻す
                    </button>
                  )}
                </div>

                {/* 収入 / 支出 */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100">
                  {(["income", "expense"] as RevenueType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => setForm({ ...form, type: t })}
                      className={`py-2 rounded-lg text-sm font-semibold transition ${
                        form.type === t
                          ? t === "income"
                            ? "bg-violet-500 text-white"
                            : "bg-rose-500 text-white"
                          : "text-gray-500"
                      }`}
                    >
                      {t === "income" ? "収入" : "支出"}
                    </button>
                  ))}
                </div>

                {/* 金額 */}
                <div className="flex items-end gap-2 border-b border-gray-200 pb-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    placeholder="0"
                    className="flex-1 bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-gray-300"
                  />
                  <span className="text-gray-400 pb-1">円</span>
                </div>

                {/* 項目名 */}
                <div>
                  <input
                    type="text"
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    placeholder="項目名（例: 売上、報酬）"
                    className="w-full bg-white rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 border border-gray-200 focus:border-violet-500"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {QUICK_LABELS.map((l) => (
                      <button
                        key={l}
                        onClick={() => setForm({ ...form, label: l })}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border transition ${
                          form.label === l
                            ? "bg-gray-900 text-white border-gray-900"
                            : "bg-white text-gray-600 border-gray-200"
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
                    className="bg-white rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 border border-gray-200 focus:border-violet-500"
                  />
                  <input
                    type="text"
                    value={form.memo}
                    onChange={(e) => setForm({ ...form, memo: e.target.value })}
                    placeholder="メモ（任意）"
                    className="bg-white rounded-xl px-3 py-2.5 text-sm outline-none placeholder:text-gray-400 border border-gray-200 focus:border-violet-500"
                  />
                </div>

                {error && <div className="text-rose-500 text-[12px]">{error}</div>}

                <button
                  onClick={save}
                  disabled={saving}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-700 to-violet-400 text-white font-bold disabled:opacity-50 active:scale-[0.98] transition"
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
