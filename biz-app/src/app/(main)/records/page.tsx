"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, ICONS } from "@/components/icons";
import { useAccounts } from "@/lib/use-dashboard-data";
import { SOURCES, SALE_CATEGORIES, sourceLabel, categoryLabel } from "@/lib/domain";
import { todayStr } from "@/lib/dates";

type EventRow = {
  id: string;
  stage: string;
  source: string | null;
  count: number;
  occurredOn: string;
  account: { name: string; color: string };
};

type SaleRow = {
  id: string;
  category: string;
  productName: string;
  amount: number;
  quantity: number;
  occurredOn: string;
  account: { name: string; color: string };
};

const STAGE_LABELS: Record<string, string> = {
  list_in: "リストイン",
  free_apply: "無料鑑定申込",
  free_sent: "鑑定送付",
  template_sent: "テンプレ配信",
};

type TemplateLite = {
  id: string;
  accountId: string;
  name: string;
  versions: { id: string; label: string; activeTo: string | null }[];
};

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400";

export default function RecordsPage() {
  const { accounts } = useAccounts();
  const [message, setMessage] = useState("");

  // ---- 日次記録フォーム ----
  const [dDate, setDDate] = useState(todayStr());
  const [dAccount, setDAccount] = useState("");
  const [listIn, setListIn] = useState<Record<string, string>>({});
  const [freeApply, setFreeApply] = useState("");
  const [freeSent, setFreeSent] = useState("");
  const [dSaving, setDSaving] = useState(false);

  // ---- 売上記録フォーム ----
  const [sDate, setSDate] = useState(todayStr());
  const [sAccount, setSAccount] = useState("");
  const [category, setCategory] = useState("paid_reading");
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [templateVersionId, setTemplateVersionId] = useState("");
  const [templates, setTemplates] = useState<TemplateLite[]>([]);
  const [sSaving, setSSaving] = useState(false);

  // ---- 履歴 ----
  const [events, setEvents] = useState<EventRow[]>([]);
  const [sales, setSales] = useState<SaleRow[]>([]);

  const reloadHistory = useCallback(() => {
    fetch("/api/records")
      .then((r) => r.json())
      .then((d) => setEvents(d.events ?? []))
      .catch(() => {});
    fetch("/api/sales")
      .then((r) => r.json())
      .then((d) => setSales((d.sales ?? []).slice(0, 50)))
      .catch(() => {});
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);
  useEffect(reloadHistory, [reloadHistory]);

  // 未選択のあいだは先頭アカウントをデフォルトにする
  const dAccountEffective = dAccount || accounts[0]?.id || "";
  const sAccountEffective = sAccount || accounts[0]?.id || "";

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const submitDaily = async (e: React.FormEvent) => {
    e.preventDefault();
    setDSaving(true);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: dDate,
        accountId: dAccountEffective,
        listIn: Object.fromEntries(Object.entries(listIn).map(([k, v]) => [k, Number(v) || 0])),
        freeApply: Number(freeApply) || 0,
        freeSent: Number(freeSent) || 0,
      }),
    });
    setDSaving(false);
    if (res.ok) {
      setListIn({});
      setFreeApply("");
      setFreeSent("");
      flash("日次実績を記録しました");
      reloadHistory();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "記録に失敗しました");
    }
  };

  const submitSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setSSaving(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: sDate,
        accountId: sAccountEffective,
        category,
        productName,
        amount: Number(amount),
        quantity: Number(quantity) || 1,
        templateVersionId: templateVersionId || null,
      }),
    });
    setSSaving(false);
    if (res.ok) {
      setProductName("");
      setAmount("");
      setQuantity("1");
      flash("売上を記録しました");
      reloadHistory();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "記録に失敗しました");
    }
  };

  const deleteEvent = async (id: string) => {
    if (!confirm("この記録を削除しますか？")) return;
    await fetch(`/api/records/${id}`, { method: "DELETE" });
    reloadHistory();
  };

  const deleteSale = async (id: string) => {
    if (!confirm("この売上記録を削除しますか？")) return;
    await fetch(`/api/sales/${id}`, { method: "DELETE" });
    reloadHistory();
  };

  const accountSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );

  return (
    <div className="max-w-[1200px] mx-auto p-5 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">実績入力</h2>
        {message && (
          <span className="text-sm font-medium text-violet-600 bg-violet-50 rounded-full px-4 py-1.5">
            {message}
          </span>
        )}
      </div>

      <p className="text-sm text-gray-500">
        UTAGE連携（自動記録）を設定するまでのあいだ、日々の実績をここから記録します。連携後も手動運用分の補完に使えます。
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 日次実績 */}
        <form
          onSubmit={submitDaily}
          className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-4"
        >
          <h3 className="font-bold text-gray-900">日次実績（リストイン・無料鑑定）</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">日付</label>
              <input type="date" required value={dDate} onChange={(e) => setDDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">アカウント</label>
              {accountSelect(dAccountEffective, setDAccount)}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">リストイン数（媒体別）</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1">
              {SOURCES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16 shrink-0">{s.label}</span>
                  <input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={listIn[s.key] ?? ""}
                    onChange={(e) => setListIn({ ...listIn, [s.key]: e.target.value })}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">無料鑑定申込数</label>
              <input type="number" min={0} placeholder="0" value={freeApply} onChange={(e) => setFreeApply(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">鑑定送付数</label>
              <input type="number" min={0} placeholder="0" value={freeSent} onChange={(e) => setFreeSent(e.target.value)} className={inputClass} />
            </div>
          </div>
          <button
            type="submit"
            disabled={dSaving || !dAccountEffective}
            className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {dSaving ? "記録中..." : "日次実績を記録"}
          </button>
        </form>

        {/* 売上 */}
        <form
          onSubmit={submitSale}
          className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-4"
        >
          <h3 className="font-bold text-gray-900">売上記録</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">日付</label>
              <input type="date" required value={sDate} onChange={(e) => setSDate(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">アカウント</label>
              {accountSelect(sAccountEffective, setSAccount)}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">カテゴリ</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {SALE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">商品名（任意）</label>
              <input type="text" placeholder="例: 神社選定鑑定" value={productName} onChange={(e) => setProductName(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">金額（円・合計）</label>
              <input type="number" min={1} required placeholder="7980" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">件数</label>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">どのテンプレから？（任意・テンプレ別成績の計測に使われます）</label>
            <select value={templateVersionId} onChange={(e) => setTemplateVersionId(e.target.value)} className={inputClass}>
              <option value="">紐付けない</option>
              {templates
                .filter((t) => t.accountId === sAccountEffective)
                .map((t) =>
                  t.versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {t.name} / {v.label}
                      {v.activeTo === null ? "（運用中）" : ""}
                    </option>
                  ))
                )}
            </select>
          </div>
          <button
            type="submit"
            disabled={sSaving || !sAccountEffective}
            className="w-full py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {sSaving ? "記録中..." : "売上を記録"}
          </button>
        </form>
      </div>

      {/* 履歴 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6">
          <h3 className="font-bold text-gray-900 mb-3">日次実績の履歴（直近）</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {events.length === 0 && <div className="text-sm text-gray-400">まだ記録がありません</div>}
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-400 w-24 shrink-0">{ev.occurredOn}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ev.account.color }} />
                <span className="text-gray-600 truncate">
                  {STAGE_LABELS[ev.stage] ?? ev.stage}
                  {ev.source ? `（${sourceLabel(ev.source)}）` : ""} {ev.count}件
                </span>
                <button onClick={() => deleteEvent(ev.id)} className="ml-auto text-gray-300 hover:text-red-500 shrink-0" title="削除">
                  <Icon d={ICONS.trash} className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6">
          <h3 className="font-bold text-gray-900 mb-3">売上の履歴（直近）</h3>
          <div className="space-y-1 max-h-96 overflow-y-auto">
            {sales.length === 0 && <div className="text-sm text-gray-400">まだ記録がありません</div>}
            {sales.map((sl) => (
              <div key={sl.id} className="flex items-center gap-2 text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-400 w-24 shrink-0">{sl.occurredOn}</span>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sl.account.color }} />
                <span className="text-gray-600 truncate">
                  {categoryLabel(sl.category)}
                  {sl.productName ? ` / ${sl.productName}` : ""}（{sl.quantity}件）
                </span>
                <span className="ml-auto font-medium text-gray-900 shrink-0">
                  ¥{sl.amount.toLocaleString("ja-JP")}
                </span>
                <button onClick={() => deleteSale(sl.id)} className="text-gray-300 hover:text-red-500 shrink-0" title="削除">
                  <Icon d={ICONS.trash} className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
