"use client";

import { useState, useEffect } from "react";

interface Purchase {
  id: string;
  productName: string;
  amount: number;
  purchasedAt: string;
}

interface CustomerEvent {
  id: string;
  eventType: string;
  occurredAt: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  lineDisplayName: string;
  lineUserId: string;
  source: string;
  tags: string[];
  totalPurchaseAmount: number;
  purchaseCount: number;
  ltv: number;
  segment: string;
  purchases: Purchase[];
  events: CustomerEvent[];
  createdAt: string;
}

const STORAGE_KEY = "customers";
const SOURCES = ["LINE広告", "SNS", "紹介", "自然流入"];

function loadCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const SEGMENT_CONFIG: Record<string, { label: string; color: string; bgCard: string; textColor: string }> = {
  VIP: { label: "VIP", color: "bg-purple-500", bgCard: "bg-purple-50 border-purple-200", textColor: "text-purple-800" },
  active: { label: "アクティブ", color: "bg-green-500", bgCard: "bg-green-50 border-green-200", textColor: "text-green-800" },
  cold: { label: "コールド", color: "bg-gray-400", bgCard: "bg-gray-50 border-gray-200", textColor: "text-gray-800" },
  lost: { label: "離脱", color: "bg-red-500", bgCard: "bg-red-50 border-red-200", textColor: "text-red-800" },
};

export default function CustomerSegmentsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    setCustomers(loadCustomers());
  }, []);

  const total = customers.length;
  const segmentCounts: Record<string, number> = { VIP: 0, active: 0, cold: 0, lost: 0 };
  let totalRevenue = 0;
  let totalLtv = 0;

  for (const c of customers) {
    if (segmentCounts[c.segment] !== undefined) {
      segmentCounts[c.segment]++;
    }
    totalRevenue += c.totalPurchaseAmount;
    totalLtv += c.ltv;
  }

  const avgLtv = total > 0 ? Math.round(totalLtv / total) : 0;

  const sourceCounts: Record<string, number> = {};
  for (const s of SOURCES) {
    sourceCounts[s] = 0;
  }
  for (const c of customers) {
    if (sourceCounts[c.source] !== undefined) {
      sourceCounts[c.source]++;
    } else {
      sourceCounts[c.source] = 1;
    }
  }

  const topCustomers = [...customers].sort((a, b) => b.ltv - a.ltv).slice(0, 5);

  const funnelSteps = [
    { label: "登録", pct: 100 },
    { label: "開封", pct: 68 },
    { label: "クリック", pct: 34 },
    { label: "購入", pct: 12 },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">セグメント分析</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <SummaryCard label="総顧客数" value={`${total}人`} />
        <SummaryCard label="VIP" value={`${segmentCounts.VIP}人`} accent="text-purple-600" />
        <SummaryCard label="アクティブ" value={`${segmentCounts.active}人`} accent="text-green-600" />
        <SummaryCard label="コールド" value={`${segmentCounts.cold}人`} accent="text-gray-600" />
        <SummaryCard label="離脱" value={`${segmentCounts.lost}人`} accent="text-red-600" />
      </div>

      {/* Revenue & LTV */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">平均LTV</p>
          <p className="text-2xl font-bold text-gray-900">¥{avgLtv.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <p className="text-sm text-gray-500 mb-1">総売上</p>
          <p className="text-2xl font-bold text-gray-900">¥{totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Segment Breakdown */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">セグメント内訳</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["VIP", "active", "cold", "lost"] as const).map((seg) => {
            const config = SEGMENT_CONFIG[seg];
            const count = segmentCounts[seg];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={seg} className={`rounded-xl border p-5 ${config.bgCard}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-3 h-3 rounded-full ${config.color}`} />
                  <span className={`text-sm font-semibold ${config.textColor}`}>{config.label}</span>
                </div>
                <p className={`text-3xl font-bold ${config.textColor}`}>{count}<span className="text-base font-normal ml-1">人</span></p>
                <p className="text-sm text-gray-500 mt-1">{pct}%</p>
                {/* Progress bar */}
                <div className="mt-2 w-full bg-white/60 rounded-full h-2">
                  <div className={`h-2 rounded-full ${config.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">ファネル概要</h2>
        <div className="flex items-end gap-4 justify-center">
          {funnelSteps.map((step, i) => (
            <div key={step.label} className="flex flex-col items-center">
              <p className="text-xs text-gray-500 mb-1">{step.pct}%</p>
              <div
                className="bg-blue-500 rounded-t-md"
                style={{ width: "60px", height: `${step.pct * 1.5}px` }}
              />
              <p className="text-xs font-medium text-gray-700 mt-2">{step.label}</p>
              {i < funnelSteps.length - 1 && (
                <span className="sr-only">→</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 mt-3 text-xs text-gray-400">
          <span>登録 → 開封 → クリック → 購入</span>
        </div>
      </div>

      {/* Source Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">流入元別</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {SOURCES.map((src) => {
            const count = sourceCounts[src] || 0;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={src} className="text-center p-4 rounded-lg bg-gray-50">
                <p className="text-sm font-medium text-gray-700">{src}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
                <p className="text-xs text-gray-400">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Customers */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 pb-3">
          <h2 className="text-lg font-semibold text-gray-800">トップ顧客 (LTV順)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">#</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">購入回数</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">LTV</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">セグメント</th>
              </tr>
            </thead>
            <tbody>
              {topCustomers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    顧客データがありません
                  </td>
                </tr>
              )}
              {topCustomers.map((c, i) => {
                const segCfg = SEGMENT_CONFIG[c.segment];
                return (
                  <tr key={c.id} className="border-b border-gray-100">
                    <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email || "-"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{c.purchaseCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">¥{c.ltv.toLocaleString()}</td>
                    <td className="px-4 py-3 text-center">
                      {segCfg && (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${segCfg.bgCard.split(" ")[0]} ${segCfg.textColor}`}>
                          {segCfg.label}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${accent || "text-gray-900"}`}>{value}</p>
    </div>
  );
}
