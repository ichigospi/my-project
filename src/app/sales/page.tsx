"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

// ===== スワイプ可能な取引行（モバイル用） =====
function SwipeableRow({
  record,
  onDelete,
  onEdit,
}: {
  record: SalesRecord;
  onDelete: (id: string) => void;
  onEdit: (record: SalesRecord) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [showDelete, setShowDelete] = useState(false);
  const swiping = useRef(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    swiping.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentX.current = e.touches[0].clientX;
    const diff = startX.current - currentX.current;
    if (diff > 10) {
      swiping.current = true;
      setOffset(Math.min(diff, 80));
    } else if (diff < -10 && showDelete) {
      swiping.current = true;
      setOffset(Math.max(80 + (startX.current - currentX.current), 0));
    }
  };

  const handleTouchEnd = () => {
    if (offset > 40) {
      setOffset(80);
      setShowDelete(true);
    } else {
      setOffset(0);
      setShowDelete(false);
    }
  };

  const resetSwipe = () => {
    setOffset(0);
    setShowDelete(false);
  };

  const handleClick = () => {
    if (showDelete) {
      resetSwipe();
    } else if (!swiping.current) {
      onEdit(record);
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* 削除ボタン背景 */}
      <div className="absolute inset-y-0 right-0 flex items-center bg-red-500 w-20">
        <button
          onClick={() => { resetSwipe(); onDelete(record.id); }}
          className="w-full h-full flex flex-col items-center justify-center text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="text-[10px] mt-0.5">削除</span>
        </button>
      </div>

      {/* メインコンテンツ（スワイプで動く / タップで編集） */}
      <div
        ref={rowRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className="relative bg-white px-4 py-4 flex items-start justify-between gap-3 transition-transform duration-150 ease-out active:bg-gray-50"
        style={{ transform: `translateX(-${offset}px)` }}
      >
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-normal text-gray-900 truncate tracking-wide">
            {record.description}
          </p>
          <p className="text-[11px] font-light text-gray-400 mt-1">
            {formatDate(record.date)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-[16px] font-bold tabular-nums tracking-tight ${
            record.amount >= 0 ? "text-emerald-700" : "text-gray-900"
          }`}>
            {formatAmount(record.amount)} <span className="text-[11px] font-light text-gray-900">円</span>
          </p>
          <p className="text-[11px] font-light text-gray-400 mt-1 tabular-nums">
            残高 {formatBalance(record.balance)} 円
          </p>
        </div>
      </div>
    </div>
  );
}

// ===== 追加・編集モーダル（両対応） =====
function RecordModal({
  onClose,
  onSave,
  onDelete,
  latestBalance,
  initialRecord,
}: {
  onClose: () => void;
  onSave: (record: Omit<SalesRecord, "id"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
  latestBalance: number;
  initialRecord?: SalesRecord | null;
}) {
  const isEdit = !!initialRecord;
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(initialRecord?.date || today);
  const [description, setDescription] = useState(initialRecord?.description || "");
  const [amountStr, setAmountStr] = useState(
    initialRecord ? String(Math.abs(initialRecord.amount)) : ""
  );
  const [isIncome, setIsIncome] = useState(
    initialRecord ? initialRecord.amount >= 0 : true
  );
  const [category, setCategory] = useState(initialRecord?.category || "income");
  const [note, setNote] = useState(initialRecord?.note || "");

  const handleSubmit = () => {
    const amount = Number(amountStr);
    if (!date || !description || !amount) return;
    const signedAmount = isIncome ? Math.abs(amount) : -Math.abs(amount);

    // 編集時: 既存の残高差分を考慮しつつ、新しい残高を計算
    // シンプルに: 新しい残高 = (編集前の残高 - 編集前の金額) + 新しい金額
    let balance: number;
    if (isEdit && initialRecord) {
      balance = initialRecord.balance - initialRecord.amount + signedAmount;
    } else {
      balance = latestBalance + signedAmount;
    }

    onSave({
      id: initialRecord?.id,
      date,
      description,
      amount: signedAmount,
      balance,
      category,
      note,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
      <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5 md:p-6 space-y-4 max-h-[90vh] overflow-y-auto safe-bottom">
        {/* ドラッグハンドル（モバイル） */}
        <div className="md:hidden flex justify-center -mt-1 mb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">
            {isEdit ? "取引を編集" : "取引を追加"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">&times;</button>
        </div>

        {/* 入金/出金 切り替え */}
        <div className="flex gap-2">
          <button
            onClick={() => { setIsIncome(true); setCategory("income"); }}
            className={`flex-1 py-3 md:py-2.5 rounded-xl md:rounded-lg text-sm font-bold transition-colors ${
              isIncome ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            入金（+）
          </button>
          <button
            onClick={() => { setIsIncome(false); setCategory("expense"); }}
            className={`flex-1 py-3 md:py-2.5 rounded-xl md:rounded-lg text-sm font-bold transition-colors ${
              !isIncome ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            出金（-）
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">日付</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl md:rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">取引名</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="例: 振込 タカハシ ユカリ"
              className="w-full border border-gray-200 rounded-xl md:rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">金額</label>
            <input type="number" inputMode="numeric" value={amountStr} onChange={(e) => setAmountStr(e.target.value)}
              placeholder="例: 100000"
              className="w-full border border-gray-200 rounded-xl md:rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">カテゴリ</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl md:rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400">
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">メモ（任意）</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="メモを入力"
              className="w-full border border-gray-200 rounded-xl md:rounded-lg px-3 py-3 md:py-2.5 text-base md:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400" />
          </div>
        </div>

        <button onClick={handleSubmit}
          disabled={!date || !description || !amountStr}
          className="w-full py-3.5 md:py-3 rounded-xl md:rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
          {isEdit ? "更新する" : "登録する"}
        </button>

        {/* 編集時のみ削除ボタン */}
        {isEdit && initialRecord && onDelete && (
          <button
            onClick={() => {
              if (confirm("この取引を削除しますか？")) {
                onDelete(initialRecord.id);
              }
            }}
            className="w-full py-3 rounded-xl md:rounded-lg text-sm font-medium text-rose-500 hover:bg-rose-50 active:bg-rose-100 transition-colors"
          >
            この取引を削除
          </button>
        )}

        {/* モバイル下部余白 */}
        <div className="md:hidden h-4" />
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
  const [editingRecord, setEditingRecord] = useState<SalesRecord | null>(null);
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

  const handleSave = async (record: Omit<SalesRecord, "id"> & { id?: string }) => {
    try {
      const isEdit = !!record.id;
      const res = await fetch("/api/sales", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record),
      });
      if (res.ok) {
        setShowModal(false);
        setEditingRecord(null);
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
        setEditingRecord(null);
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
      {/* ===== ヘッダー ===== */}
      <div className="bg-gradient-to-b from-[#1a2744] to-[#243351] text-white">
        {/* モバイル: トップバー */}
        <div className="md:hidden flex items-center justify-between px-4 pt-3 pb-1">
          <div className="w-12" />
          <button
            onClick={() => { setEditingRecord(null); setShowModal(true); }}
            className="text-xs text-blue-300 active:text-blue-400 font-medium py-1"
          >
            + 追加
          </button>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-2 md:pt-6 pb-4">
          {/* タイトル */}
          <div className="text-center">
            <h1 className="text-lg font-bold tracking-wide">売上管理</h1>
            <p className="text-[10px] md:text-xs text-white/60 mt-0.5 font-light">Sales Record</p>
          </div>

          {/* 残高表示 */}
          <div className="mt-4 md:mt-5 text-center">
            <p className="text-[10px] md:text-xs text-white/50 font-light">現在の残高</p>
            <p className="text-2xl md:text-3xl font-bold mt-1 tracking-tight">
              {formatBalance(latestBalance)}
              <span className="text-sm md:text-base font-light ml-1">円</span>
            </p>
          </div>

          {/* 月間サマリー */}
          <div className="flex gap-2 md:gap-3 mt-3 md:mt-4">
            <div className="flex-1 bg-white/10 rounded-xl p-2.5 md:p-3 text-center">
              <p className="text-[9px] md:text-[10px] text-white/50 font-light">今月の入金</p>
              <p className="text-emerald-300 font-semibold text-xs md:text-sm mt-0.5 tabular-nums">+{totalIncome.toLocaleString()} 円</p>
            </div>
            <div className="flex-1 bg-white/10 rounded-xl p-2.5 md:p-3 text-center">
              <p className="text-[9px] md:text-[10px] text-white/50 font-light">今月の出金</p>
              <p className="text-white/80 font-medium text-xs md:text-sm mt-0.5 tabular-nums">-{totalExpense.toLocaleString()} 円</p>
            </div>
          </div>
        </div>

        {/* 年表示 */}
        <div className="max-w-lg mx-auto px-4">
          <div className="text-center">
            <p className="text-xs md:text-sm font-light text-white/70">{year}</p>
          </div>
        </div>

        {/* 月タブ */}
        <div className="max-w-lg mx-auto px-1 md:px-2 mt-1 md:mt-2">
          <div className="flex">
            {monthTabs.map((tab) => {
              const isActive = tab.year === year && tab.month === month;
              return (
                <button
                  key={`${tab.year}-${tab.month}`}
                  onClick={() => { setYear(tab.year); setMonth(tab.month); }}
                  className={`flex-1 py-2.5 md:py-3 text-xs md:text-sm font-light transition-colors relative ${
                    isActive
                      ? "text-white font-medium"
                      : "text-white/40 active:text-white/70 md:hover:text-white/70"
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
        {records.length > 0 && (
          <p className="md:hidden text-center text-[10px] text-gray-400 py-2 font-light">
            タップで編集 / 左スワイプで削除
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 px-4 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p className="text-sm font-light">この月の取引はありません</p>
            <button
              onClick={() => { setEditingRecord(null); setShowModal(true); }}
              className="mt-4 px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl active:bg-blue-700 md:hover:bg-blue-700 transition-colors"
            >
              最初の取引を追加
            </button>
          </div>
        ) : (
          <>
            {/* モバイル: スワイプ削除 & タップ編集 */}
            <div className="md:hidden divide-y divide-gray-100">
              {records.map((record) => (
                <SwipeableRow
                  key={record.id}
                  record={record}
                  onDelete={(id) => setDeletingId(id)}
                  onEdit={(r) => { setEditingRecord(r); setShowModal(true); }}
                />
              ))}
            </div>

            {/* デスクトップ: クリックで編集、×で削除 */}
            <div className="hidden md:block divide-y divide-gray-100">
              {records.map((record) => (
                <div
                  key={record.id}
                  onClick={() => { setEditingRecord(record); setShowModal(true); }}
                  className="bg-white px-5 py-4 flex items-start justify-between gap-3 hover:bg-gray-50 cursor-pointer transition-colors relative group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-normal text-gray-900 truncate tracking-wide">
                      {record.description}
                    </p>
                    <p className="text-[11px] font-light text-gray-400 mt-1">
                      {formatDate(record.date)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[16px] font-bold tabular-nums tracking-tight ${
                      record.amount >= 0 ? "text-emerald-700" : "text-gray-900"
                    }`}>
                      {formatAmount(record.amount)} <span className="text-[11px] font-light text-gray-900">円</span>
                    </p>
                    <p className="text-[11px] font-light text-gray-400 mt-1 tabular-nums">
                      残高 {formatBalance(record.balance)} 円
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(record.id); }}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-rose-500 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* 下部スペース */}
        <div className="h-28 md:h-24" />
      </div>

      {/* ===== 追加ボタン（FAB） ===== */}
      <button
        onClick={() => { setEditingRecord(null); setShowModal(true); }}
        className="hidden md:flex fixed bottom-6 right-6 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 items-center justify-center transition-colors z-40"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <button
        onClick={() => { setEditingRecord(null); setShowModal(true); }}
        className="md:hidden fixed bottom-6 right-4 w-14 h-14 bg-blue-600 active:bg-blue-700 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center z-40"
      >
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* ===== 追加・編集モーダル ===== */}
      {showModal && (
        <RecordModal
          onClose={() => { setShowModal(false); setEditingRecord(null); }}
          onSave={handleSave}
          onDelete={handleDelete}
          latestBalance={latestBalance}
          initialRecord={editingRecord}
        />
      )}

      {/* ===== 削除確認ダイアログ ===== */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-sm rounded-t-2xl md:rounded-2xl p-5 md:p-6 mx-0 md:mx-4 space-y-4">
            <div className="md:hidden flex justify-center -mt-1 mb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-900 text-center">この取引を削除しますか？</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-3 md:py-2.5 rounded-xl md:rounded-lg text-sm font-medium bg-gray-100 text-gray-600 active:bg-gray-200 md:hover:bg-gray-200 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                className="flex-1 py-3 md:py-2.5 rounded-xl md:rounded-lg text-sm font-medium bg-rose-500 text-white active:bg-rose-600 md:hover:bg-rose-600 transition-colors"
              >
                削除する
              </button>
            </div>
            <div className="md:hidden h-4" />
          </div>
        </div>
      )}
    </div>
  );
}
