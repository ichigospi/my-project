"use client";

import { useState, useEffect, useCallback } from "react";

// ===== 型定義 =====
interface SalesRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  balance: number;
  category: string;
  note: string;
}

const CATEGORY_OPTIONS = [
  { value: "income", label: "入金" },
  { value: "expense", label: "出金" },
  { value: "transfer", label: "振込" },
  { value: "other", label: "その他" },
];

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];

function getDayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return DAY_NAMES[d.getDay()];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  const dow = getDayOfWeek(dateStr);
  return `${Number(y)}年${Number(m)}月${Number(d)}日(${dow})`;
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString();
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatBalance(balance: number): string {
  return balance.toLocaleString();
}

// ===== 月タブ生成 =====
function getMonthTabs(currentYear: number, currentMonth: number) {
  const tabs = [];
  for (let i = -2; i <= 3; i++) {
    let m = currentMonth + i;
    let y = currentYear;
    if (m < 1) { m += 12; y -= 1; }
    if (m > 12) { m -= 12; y += 1; }
    tabs.push({ year: y, month: m });
  }
  return tabs;
}

// ===== 新規登録モーダル =====
function AddRecordModal({
  onClose,
  onSave,
  latestBalance,
}: {
  onClose: () => void;
  onSave: (record: Omit<SalesRecord, "id">) => void;
  latestBalance: number;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [isIncome, setIsIncome] = useState(true);
  const [category, setCategory] = useState("income");
  const [note, setNote] = useState("");

  const handleSubmit = () => {
    const amount = Number(amountStr);
    if (!date || !description || !amount) return;
    const signedAmount = isIncome ? Math.abs(amount) : -Math.abs(amount);
    const balance = latestBalance + signedAmount;
    onSave({ date, description, amount: signedAmount, balance, category, note });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">取引を追加</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* 入金/出金 切り替え */}
        <div className="flex gap-2">
          <button
            onClick={() => { setIsIncome(true); setCategory("income"); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              isIncome ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            入金（+）
          </button>
          <button
            onClick={() => { setIsIncome(false); setCategory("expense"); }}
            className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-colors ${
              !isIncome ? "bg-gray-700 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            出金（-）
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">日付</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">取引名</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 振込 タカハシ ユカリ"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">金額</label>
            <input type="number" value={amountStr} onChange={(e) => setAmountStr(e.target.value)}
              placeholder="例: 100000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">カテゴリ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">メモ（任意）</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="メモを入力"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
        </div>

        <button onClick={handleSubmit}
          disabled={!date || !description || !amountStr}
          className="w-full py-3 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
          登録する
        </button>
      </div>
    </div>
  );
}

// ===== メインページ =====
export default function SalesPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState<SalesRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const monthTabs = getMonthTabs(year, month);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales?year=${year}&month=${month}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleSave = async (record: Omit<SalesRecord, "id">) => {
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        setShowModal(false);
        fetchRecords();
      }
    } catch (e) {
      console.error("Save error:", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch("/api/sales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setDeletingId(null);
        fetchRecords();
      }
    } catch (e) {
      console.error("Delete error:", e);
    }
  };

  // 月の最初の残高（最新レコードから）
  const latestBalance = records.length > 0 ? records[0].balance : 0;

  // 月の合計入金・出金
  const totalIncome = records.reduce((sum, r) => r.amount > 0 ? sum + r.amount : sum, 0);
  const totalExpense = records.reduce((sum, r) => r.amount < 0 ? sum + Math.abs(r.amount) : sum, 0);

  return (
    <div className="min-h-screen bg-[#f0f2f7]">
      {/* ===== ヘッダー（銀行アプリ風） ===== */}
      <div className="bg-gradient-to-b from-[#1a2744] to-[#243351] text-white">
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4">
          <div className="text-center">
            <h1 className="text-lg font-bold tracking-wide">売上管理</h1>
            <p className="text-xs text-white/60 mt-0.5">Sales Record</p>
          </div>

          {/* 残高表示 */}
          <div className="mt-5 text-center">
            <p className="text-xs text-white/50">現在の残高</p>
            <p className="text-3xl font-bold mt-1 tracking-tight">
              {formatBalance(latestBalance)}
              <span className="text-base font-normal ml-1">円</span>
            </p>
          </div>

          {/* 月間サマリー */}
          <div className="flex gap-3 mt-4">
            <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-white/50">今月の入金</p>
              <p className="text-emerald-400 font-bold text-sm mt-0.5">+{totalIncome.toLocaleString()}円</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-white/50">今月の出金</p>
              <p className="text-white/80 font-bold text-sm mt-0.5">-{totalExpense.toLocaleString()}円</p>
            </div>
          </div>
        </div>

        {/* ===== 年表示 ===== */}
        <div className="max-w-lg mx-auto px-4">
          <div className="text-center">
            <p className="text-sm font-medium text-white/70">{year}</p>
          </div>
        </div>

        {/* ===== 月タブ ===== */}
        <div className="max-w-lg mx-auto px-2 mt-2">
          <div className="flex">
            {monthTabs.map((tab) => {
              const isActive = tab.year === year && tab.month === month;
              return (
                <button
                  key={`${tab.year}-${tab.month}`}
                  onClick={() => { setYear(tab.year); setMonth(tab.month); }}
                  className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
                    isActive
                      ? "text-white"
                      : "text-white/40 hover:text-white/70"
                  }`}
                >
                  {tab.month}月
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ===== 取引一覧 ===== */}
      <div className="max-w-lg mx-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm">この月の取引はありません</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {records.map((record) => (
              <div
                key={record.id}
                className="bg-white px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50/50 transition-colors relative group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-medium text-gray-900 truncate">
                    {record.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDate(record.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[17px] font-bold tabular-nums ${
                    record.amount >= 0 ? "text-emerald-500" : "text-gray-800"
                  }`}>
                    {formatAmount(record.amount)}円
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">
                    残高 {formatBalance(record.balance)}円
                  </p>
                </div>

                {/* 削除ボタン（ホバーで表示） */}
                <button
                  onClick={() => setDeletingId(record.id)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-400 p-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 下部スペース */}
        <div className="h-24" />
      </div>

      {/* ===== 追加ボタン（FAB） ===== */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center transition-colors z-40"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* ===== 新規登録モーダル ===== */}
      {showModal && (
        <AddRecordModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          latestBalance={latestBalance}
        />
      )}

      {/* ===== 削除確認ダイアログ ===== */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <p className="text-sm font-medium text-gray-900 text-center">この取引を削除しますか？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
