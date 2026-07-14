"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, ICONS } from "@/components/icons";
import { useAccounts } from "@/lib/use-dashboard-data";
import { todayStr } from "@/lib/dates";
import type { SummaryData } from "@/lib/aggregate";

type LaunchRow = {
  id: string;
  accountId: string;
  name: string;
  productName: string;
  startOn: string;
  endOn: string;
  goalAmount: number;
  memo: string;
  account: { name: string; color: string };
  stats: {
    period: SummaryData;
    attributedAmount: number;
    attributedQuantity: number;
  };
};

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400";

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function pct(numer: number, denom: number): string {
  if (denom === 0) return "—";
  return `${((numer / denom) * 100).toFixed(1)}%`;
}

// 前回ローンチ（同アカウントで直前の開催）との比較つきカード
function LaunchCard({ launch, previous }: { launch: LaunchRow; previous: LaunchRow | null }) {
  const p = launch.stats.period;
  const total = p.salesTotal;
  const paid = p.salesByCategory["paid_reading"]?.quantity ?? 0;
  const progress = launch.goalAmount > 0 ? Math.min(100, (total / launch.goalAmount) * 100) : null;
  const isActive = launch.startOn <= todayStr() && todayStr() <= launch.endOn;

  const compare = (cur: number, prev: number | undefined) => {
    if (prev === undefined || prev === 0) return null;
    const diff = ((cur - prev) / prev) * 100;
    return (
      <span className={`text-xs font-medium ${diff >= 0 ? "text-emerald-600" : "text-red-500"}`}>
        前回比 {diff >= 0 ? "+" : ""}
        {diff.toFixed(0)}%
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: launch.account.color }} />
        <span className="font-bold text-gray-900 text-lg">{launch.name}</span>
        {isActive && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">開催中</span>
        )}
        <span className="text-sm text-gray-400">
          {launch.startOn} 〜 {launch.endOn}
        </span>
        {launch.productName && <span className="text-sm text-gray-500">/ {launch.productName}</span>}
      </div>

      {/* 目標進捗 */}
      <div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-3xl font-bold text-gray-900">{yen(total)}</span>
          {launch.goalAmount > 0 && (
            <span className="text-sm text-gray-400">/ 目標 {yen(launch.goalAmount)}</span>
          )}
          {compare(total, previous?.stats.period.salesTotal)}
        </div>
        {progress !== null && (
          <div className="mt-2 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${progress >= 100 ? "bg-emerald-500" : "bg-violet-500"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {progress !== null && (
          <div className="mt-1 text-xs text-gray-400">達成率 {progress.toFixed(1)}%</div>
        )}
      </div>

      {/* 期間中ファネル */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <div className="text-[11px] text-gray-400">リストイン</div>
          <div className="text-lg font-bold text-gray-900">{p.listIn.toLocaleString("ja-JP")}</div>
          {compare(p.listIn, previous?.stats.period.listIn) ?? <div className="text-xs text-gray-300">—</div>}
        </div>
        <div>
          <div className="text-[11px] text-gray-400">無料鑑定</div>
          <div className="text-lg font-bold text-gray-900">{p.freeApply.toLocaleString("ja-JP")}</div>
          <div className="text-xs text-gray-400">{pct(p.freeApply, p.listIn)}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-400">有料鑑定</div>
          <div className="text-lg font-bold text-gray-900">{paid.toLocaleString("ja-JP")}</div>
          <div className="text-xs text-gray-400">{pct(paid, p.freeApply)}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-400">ローンチ商品売上</div>
          <div className="text-lg font-bold text-gray-900">{yen(launch.stats.attributedAmount)}</div>
          <div className="text-xs text-gray-400">{launch.stats.attributedQuantity}件</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-400">リスト単価</div>
          <div className="text-lg font-bold text-gray-900">{p.listIn === 0 ? "—" : yen(total / p.listIn)}</div>
        </div>
      </div>

      {launch.memo && <p className="text-sm text-gray-500 whitespace-pre-wrap">{launch.memo}</p>}
    </div>
  );
}

export default function LaunchesPage() {
  const { accounts } = useAccounts();
  const [launches, setLaunches] = useState<LaunchRow[]>([]);
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [account, setAccount] = useState("");
  const [productName, setProductName] = useState("");
  const [startOn, setStartOn] = useState("");
  const [endOn, setEndOn] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [memo, setMemo] = useState("");

  const reload = useCallback(() => {
    fetch("/api/launches")
      .then((r) => r.json())
      .then((d) => setLaunches(d.launches ?? []))
      .catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  const accountEffective = account || accounts[0]?.id || "";

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/launches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId: accountEffective,
        name,
        productName,
        startOn,
        endOn,
        goalAmount: Number(goalAmount) || 0,
        memo,
      }),
    });
    if (res.ok) {
      setName("");
      setProductName("");
      setMemo("");
      setShowCreate(false);
      flash("ローンチを登録しました");
      reload();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "登録に失敗しました");
    }
  };

  // 同アカウントの直前ローンチを比較対象にする（配列はstartOn降順）
  const previousOf = (index: number): LaunchRow | null => {
    const cur = launches[index];
    for (let i = index + 1; i < launches.length; i++) {
      if (launches[i].accountId === cur.accountId) return launches[i];
    }
    return null;
  };

  return (
    <div className="max-w-[1100px] mx-auto p-5 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mr-1">ローンチ</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
        >
          <Icon d={ICONS.trendUp} className="w-4 h-4" />
          ローンチを登録
        </button>
        {message && (
          <span className="text-sm font-medium text-violet-600 bg-violet-50 rounded-full px-4 py-1.5">{message}</span>
        )}
      </div>

      <p className="text-sm text-gray-500">
        期間を登録すると、その期間のリストイン・鑑定・売上が自動で集計され、同アカウントの前回ローンチと比較できます。売上記録でローンチに紐付けるとローンチ商品売上も計測されます。
      </p>

      {showCreate && (
        <form onSubmit={create} className="bg-white rounded-2xl border border-violet-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-3">
          <h3 className="font-bold text-gray-900">新規ローンチ</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">ローンチ名</label>
              <input type="text" required placeholder="例: 夏の開運祭" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">アカウント</label>
              <select value={accountEffective} onChange={(e) => setAccount(e.target.value)} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">商品名（任意）</label>
              <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">開始日</label>
              <input type="date" required value={startOn} onChange={(e) => setStartOn(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">終了日</label>
              <input type="date" required value={endOn} onChange={(e) => setEndOn(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">目標売上（円・任意）</label>
              <input type="number" min={0} value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">メモ（企画内容・振り返り）</label>
            <textarea rows={2} value={memo} onChange={(e) => setMemo(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
            登録
          </button>
        </form>
      )}

      <div className="space-y-4 pb-8">
        {launches.length === 0 && (
          <div className="text-sm text-gray-400 py-10 text-center">ローンチがまだ登録されていません</div>
        )}
        {launches.map((l, i) => (
          <LaunchCard key={l.id} launch={l} previous={previousOf(i)} />
        ))}
      </div>
    </div>
  );
}
