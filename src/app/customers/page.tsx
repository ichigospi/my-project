"use client";

import { useState, useEffect, useCallback } from "react";

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

function saveCustomers(customers: Customer[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

function calcSegment(customer: Customer): string {
  if (customer.totalPurchaseAmount >= 100000) return "VIP";
  if (customer.totalPurchaseAmount >= 10000) return "active";
  if (customer.totalPurchaseAmount > 0) return "cold";
  const created = new Date(customer.createdAt);
  const now = new Date();
  const diffDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays > 90) return "lost";
  return "cold";
}

function segmentBadge(segment: string) {
  const styles: Record<string, string> = {
    VIP: "bg-purple-100 text-purple-800",
    active: "bg-green-100 text-green-800",
    cold: "bg-gray-100 text-gray-800",
    lost: "bg-red-100 text-red-800",
  };
  const labels: Record<string, string> = {
    VIP: "VIP",
    active: "アクティブ",
    cold: "コールド",
    lost: "離脱",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${styles[segment] || "bg-gray-100 text-gray-800"}`}>
      {labels[segment] || segment}
    </span>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [utageConnected, setUtageConnected] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [lineDisplayName, setLineDisplayName] = useState("");
  const [source, setSource] = useState(SOURCES[0]);
  const [tags, setTags] = useState("");

  // Search / filter
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Inline purchase form
  const [newProductName, setNewProductName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  useEffect(() => {
    setCustomers(loadCustomers());
    try {
      const utageConfig = localStorage.getItem("utage_config");
      if (utageConfig) {
        const parsed = JSON.parse(utageConfig);
        if (parsed && parsed.apiKey) setUtageConnected(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((updated: Customer[]) => {
    setCustomers(updated);
    saveCustomers(updated);
  }, []);

  const handleAddCustomer = () => {
    if (!name.trim()) return;
    const now = new Date().toISOString();
    const newCustomer: Customer = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim(),
      lineDisplayName: lineDisplayName.trim(),
      lineUserId: "",
      source,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      totalPurchaseAmount: 0,
      purchaseCount: 0,
      ltv: 0,
      segment: "cold",
      purchases: [],
      events: [{ id: crypto.randomUUID(), eventType: "登録", occurredAt: now }],
      createdAt: now,
    };
    newCustomer.segment = calcSegment(newCustomer);
    const updated = [...customers, newCustomer];
    persist(updated);
    setName("");
    setEmail("");
    setLineDisplayName("");
    setSource(SOURCES[0]);
    setTags("");
  };

  const handleDelete = (id: string) => {
    if (!confirm("この顧客を削除しますか？")) return;
    persist(customers.filter((c) => c.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const handleAddPurchase = (customerId: string) => {
    const amount = parseFloat(newAmount);
    if (!newProductName.trim() || isNaN(amount) || amount <= 0) return;
    const now = new Date().toISOString();
    const updated = customers.map((c) => {
      if (c.id !== customerId) return c;
      const purchase: Purchase = {
        id: crypto.randomUUID(),
        productName: newProductName.trim(),
        amount,
        purchasedAt: now,
      };
      const purchases = [...c.purchases, purchase];
      const totalPurchaseAmount = purchases.reduce((sum, p) => sum + p.amount, 0);
      const purchaseCount = purchases.length;
      const ltv = totalPurchaseAmount;
      const events = [...c.events, { id: crypto.randomUUID(), eventType: "購入", occurredAt: now }];
      const updated = { ...c, purchases, totalPurchaseAmount, purchaseCount, ltv, events };
      updated.segment = calcSegment(updated);
      return updated;
    });
    persist(updated);
    setNewProductName("");
    setNewAmount("");
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q);
    const matchesSegment = !segmentFilter || c.segment === segmentFilter;
    return matchesSearch && matchesSegment;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">顧客管理</h1>

      {/* UTAGE Connection Status */}
      <div className={`rounded-xl p-4 border ${utageConnected ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"}`}>
        {utageConnected ? (
          <p className="text-green-800 text-sm font-medium">UTAGE連携: 接続済み</p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-yellow-800 text-sm font-medium">UTAGE連携: 未接続</p>
            <a href="/settings" className="text-sm text-blue-600 hover:underline font-medium">
              UTAGE連携設定 →
            </a>
          </div>
        )}
      </div>

      {/* Add Customer Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">顧客を追加</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">名前 *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="山田 太郎"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">メール</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="taro@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">LINE表示名</label>
            <input
              type="text"
              value={lineDisplayName}
              onChange={(e) => setLineDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="たろう"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">流入元</label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">タグ (カンマ区切り)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="新規, 見込み"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAddCustomer}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
            >
              追加
            </button>
          </div>
        </div>
      </div>

      {/* Search / Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="名前・メールで検索..."
        />
        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">全セグメント</option>
          <option value="VIP">VIP</option>
          <option value="active">アクティブ</option>
          <option value="cold">コールド</option>
          <option value="lost">離脱</option>
        </select>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">名前</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">メール</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">LINE名</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">流入元</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">購入回数</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">合計購入額</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">LTV</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">セグメント</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">タグ</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    顧客が見つかりません
                  </td>
                </tr>
              )}
              {filtered.map((c) => (
                <CustomerRow
                  key={c.id}
                  customer={c}
                  isExpanded={expandedId === c.id}
                  onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
                  onDelete={() => handleDelete(c.id)}
                  newProductName={expandedId === c.id ? newProductName : ""}
                  newAmount={expandedId === c.id ? newAmount : ""}
                  onProductNameChange={setNewProductName}
                  onAmountChange={setNewAmount}
                  onAddPurchase={() => handleAddPurchase(c.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CustomerRow({
  customer,
  isExpanded,
  onToggle,
  onDelete,
  newProductName,
  newAmount,
  onProductNameChange,
  onAmountChange,
  onAddPurchase,
}: {
  customer: Customer;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  newProductName: string;
  newAmount: string;
  onProductNameChange: (v: string) => void;
  onAmountChange: (v: string) => void;
  onAddPurchase: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 font-medium text-gray-900">{customer.name}</td>
        <td className="px-4 py-3 text-gray-600">{customer.email || "-"}</td>
        <td className="px-4 py-3 text-gray-600">{customer.lineDisplayName || "-"}</td>
        <td className="px-4 py-3 text-gray-600">{customer.source}</td>
        <td className="px-4 py-3 text-right text-gray-600">{customer.purchaseCount}</td>
        <td className="px-4 py-3 text-right text-gray-600">¥{customer.totalPurchaseAmount.toLocaleString()}</td>
        <td className="px-4 py-3 text-right text-gray-600">¥{customer.ltv.toLocaleString()}</td>
        <td className="px-4 py-3 text-center">{segmentBadge(customer.segment)}</td>
        <td className="px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {customer.tags.map((t, i) => (
              <span key={i} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-red-500 hover:text-red-700 text-xs font-medium"
          >
            削除
          </button>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={10} className="bg-gray-50 px-6 py-4">
            <div className="space-y-4">
              {/* Purchase History */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">購入履歴</h4>
                {customer.purchases.length === 0 ? (
                  <p className="text-xs text-gray-400">購入履歴なし</p>
                ) : (
                  <ul className="space-y-1">
                    {customer.purchases.map((p) => (
                      <li key={p.id} className="text-xs text-gray-600 flex justify-between">
                        <span>{p.productName}</span>
                        <span>¥{p.amount.toLocaleString()} - {new Date(p.purchasedAt).toLocaleDateString("ja-JP")}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {/* Add Purchase Inline */}
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newProductName}
                    onChange={(e) => onProductNameChange(e.target.value)}
                    placeholder="商品名"
                    className="border border-gray-300 rounded px-2 py-1 text-xs flex-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <input
                    type="number"
                    value={newAmount}
                    onChange={(e) => onAmountChange(e.target.value)}
                    placeholder="金額"
                    className="border border-gray-300 rounded px-2 py-1 text-xs w-28"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddPurchase();
                    }}
                    className="bg-green-600 text-white rounded px-3 py-1 text-xs font-medium hover:bg-green-700"
                  >
                    購入追加
                  </button>
                </div>
              </div>

              {/* Events Timeline */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">イベント履歴</h4>
                {customer.events.length === 0 ? (
                  <p className="text-xs text-gray-400">イベントなし</p>
                ) : (
                  <ul className="space-y-1">
                    {customer.events.map((ev) => (
                      <li key={ev.id} className="text-xs text-gray-600 flex gap-3">
                        <span className="text-gray-400">{new Date(ev.occurredAt).toLocaleDateString("ja-JP")}</span>
                        <span>{ev.eventType}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
