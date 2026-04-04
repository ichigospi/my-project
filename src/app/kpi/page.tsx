"use client";

import { useState, useEffect, useCallback } from "react";

interface KpiGoal {
  id: string;
  goalType: string;
  targetValue: number;
  currentValue: number;
  unit: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
}

const GOAL_TYPES: Record<string, { label: string; unit: string }> = {
  revenue: { label: "月商", unit: "円" },
  line_followers: { label: "LINE友達数", unit: "人" },
  cvr: { label: "購入CVR", unit: "%" },
  ltv: { label: "顧客LTV", unit: "円" },
  open_rate: { label: "開封率", unit: "%" },
  click_rate: { label: "クリック率", unit: "%" },
};

const PERIOD_OPTIONS: Record<string, string> = {
  monthly: "月次",
  quarterly: "四半期",
  yearly: "年次",
};

const STORAGE_KEY = "kpi_goals";

function loadGoals(): KpiGoal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveGoals(goals: KpiGoal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

function progressColor(pct: number): string {
  if (pct >= 80) return "bg-green-500";
  if (pct >= 50) return "bg-yellow-500";
  return "bg-red-500";
}

function progressTextColor(pct: number): string {
  if (pct >= 80) return "text-green-700";
  if (pct >= 50) return "text-yellow-700";
  return "text-red-700";
}

export default function KpiPage() {
  const [goals, setGoals] = useState<KpiGoal[]>([]);
  const [goalType, setGoalType] = useState("revenue");
  const [targetValue, setTargetValue] = useState("");
  const [currentValue, setCurrentValue] = useState("");
  const [period, setPeriod] = useState("monthly");

  useEffect(() => {
    setGoals(loadGoals());
  }, []);

  const persist = useCallback((updated: KpiGoal[]) => {
    setGoals(updated);
    saveGoals(updated);
  }, []);

  const handleAdd = () => {
    const target = parseFloat(targetValue);
    const current = parseFloat(currentValue);
    if (isNaN(target) || target <= 0) return;

    const now = new Date();
    let periodStart = "";
    let periodEnd = "";

    if (period === "monthly") {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();
    } else if (period === "quarterly") {
      const q = Math.floor(now.getMonth() / 3);
      periodStart = new Date(now.getFullYear(), q * 3, 1).toISOString();
      periodEnd = new Date(now.getFullYear(), q * 3 + 3, 0).toISOString();
    } else {
      periodStart = new Date(now.getFullYear(), 0, 1).toISOString();
      periodEnd = new Date(now.getFullYear(), 11, 31).toISOString();
    }

    const newGoal: KpiGoal = {
      id: crypto.randomUUID(),
      goalType,
      targetValue: target,
      currentValue: isNaN(current) ? 0 : current,
      unit: GOAL_TYPES[goalType].unit,
      period,
      periodStart,
      periodEnd,
      updatedAt: now.toISOString(),
    };

    persist([...goals, newGoal]);
    setTargetValue("");
    setCurrentValue("");
  };

  const handleDelete = (id: string) => {
    persist(goals.filter((g) => g.id !== id));
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">KGI/KPI管理</h1>
        <p className="text-gray-500 mt-1">目標と進捗を管理</p>
      </div>

      {/* Add Goal Form */}
      <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
        <h2 className="font-semibold mb-4">目標を追加</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">指標タイプ</label>
            <select
              value={goalType}
              onChange={(e) => setGoalType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
            >
              {Object.entries(GOAL_TYPES).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">期間</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
            >
              {Object.entries(PERIOD_OPTIONS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              目標値（{GOAL_TYPES[goalType].unit}）
            </label>
            <input
              type="number"
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              placeholder="例: 1000000"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              現在値（{GOAL_TYPES[goalType].unit}）
            </label>
            <input
              type="number"
              value={currentValue}
              onChange={(e) => setCurrentValue(e.target.value)}
              placeholder="例: 500000"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleAdd}
          className="mt-4 px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          目標を追加
        </button>
      </div>

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <div className="text-center text-gray-400 py-12">
          目標がまだ登録されていません
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {goals.map((goal) => {
            const pct =
              goal.targetValue > 0
                ? Math.min(
                    Math.round((goal.currentValue / goal.targetValue) * 100),
                    100
                  )
                : 0;
            return (
              <div
                key={goal.id}
                className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-sm font-semibold">
                      {GOAL_TYPES[goal.goalType]?.label ?? goal.goalType}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      {PERIOD_OPTIONS[goal.period] ?? goal.period}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(goal.id)}
                    className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    title="削除"
                  >
                    &times;
                  </button>
                </div>

                <div className="flex items-end gap-1 mb-2">
                  <span className="text-2xl font-bold">
                    {goal.currentValue.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500 mb-0.5">
                    / {goal.targetValue.toLocaleString()} {goal.unit}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full transition-all ${progressColor(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span
                    className={`text-xs font-medium ${progressTextColor(pct)}`}
                  >
                    {pct}% 達成
                  </span>
                  <span className="text-xs text-gray-400">
                    更新: {new Date(goal.updatedAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
