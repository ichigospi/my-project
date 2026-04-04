"use client";

import { useState, useEffect, useCallback } from "react";

// ===== 型定義 =====
interface ServiceInfo {
  name: string;
  description: string;
  price: number;
}

interface CurrentMetrics {
  lineFollowers: number;
  cvr: number;
  monthlyLeads: number;
}

interface ProposalResult {
  topMethods: { rank: number; title: string; description: string }[];
  timeline: string;
  salesSimulation: {
    lineFollowers: number;
    cvr: number;
    price: number;
    expectedRevenue: number;
    summary: string;
  };
  requiredContents: string[];
  risks: { risk: string; countermeasure: string }[];
}

interface LaunchProposal {
  id: string;
  title: string;
  serviceInfo: ServiceInfo;
  targetAudience: string;
  currentMetrics: CurrentMetrics;
  proposalResult: ProposalResult | null;
  selectedPlan: number | null;
  status: "draft" | "proposed" | "accepted";
  createdAt: string;
}

const STORAGE_KEY = "launch_proposals";

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadProposals(): LaunchProposal[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveProposals(proposals: LaunchProposal[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
}

const STATUS_BADGE: Record<LaunchProposal["status"], { label: string; className: string }> = {
  draft: { label: "下書き", className: "bg-gray-100 text-gray-600" },
  proposed: { label: "提案済み", className: "bg-blue-100 text-blue-700" },
  accepted: { label: "採用済み", className: "bg-green-100 text-green-700" },
};

// ===== メインページ =====
export default function LaunchProposalPage() {
  const [proposals, setProposals] = useState<LaunchProposal[]>([]);
  const [loaded, setLoaded] = useState(false);

  // フォーム
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [price, setPrice] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [lineFollowers, setLineFollowers] = useState("");
  const [cvr, setCvr] = useState("");
  const [monthlyLeads, setMonthlyLeads] = useState("");

  // AI生成
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [currentResult, setCurrentResult] = useState<ProposalResult | null>(null);
  const [currentProposalId, setCurrentProposalId] = useState<string | null>(null);

  useEffect(() => {
    setProposals(loadProposals());
    setLoaded(true);
  }, []);

  const persist = useCallback((updated: LaunchProposal[]) => {
    setProposals(updated);
    saveProposals(updated);
  }, []);

  function resetForm() {
    setServiceName("");
    setServiceDescription("");
    setPrice("");
    setTargetAudience("");
    setLineFollowers("");
    setCvr("");
    setMonthlyLeads("");
    setCurrentResult(null);
    setCurrentProposalId(null);
    setError("");
  }

  function isFormValid() {
    return (
      serviceName.trim() &&
      serviceDescription.trim() &&
      price.trim() &&
      targetAudience.trim() &&
      lineFollowers.trim() &&
      cvr.trim() &&
      monthlyLeads.trim()
    );
  }

  async function handleGenerate() {
    if (!isFormValid()) return;
    setGenerating(true);
    setError("");
    setCurrentResult(null);

    const formData = {
      serviceName: serviceName.trim(),
      serviceDescription: serviceDescription.trim(),
      price: parseFloat(price),
      targetAudience: targetAudience.trim(),
      lineFollowers: parseInt(lineFollowers, 10),
      cvr: parseFloat(cvr),
      monthlyLeads: parseInt(monthlyLeads, 10),
    };

    // 下書きとして保存
    const proposalId = generateId();
    const newProposal: LaunchProposal = {
      id: proposalId,
      title: formData.serviceName,
      serviceInfo: {
        name: formData.serviceName,
        description: formData.serviceDescription,
        price: formData.price,
      },
      targetAudience: formData.targetAudience,
      currentMetrics: {
        lineFollowers: formData.lineFollowers,
        cvr: formData.cvr,
        monthlyLeads: formData.monthlyLeads,
      },
      proposalResult: null,
      selectedPlan: null,
      status: "draft",
      createdAt: new Date().toISOString(),
    };
    const updated = [newProposal, ...proposals];
    persist(updated);
    setCurrentProposalId(proposalId);

    try {
      const res = await fetch("/api/launch-proposal/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error(`APIエラー: ${res.status}`);
      const data = await res.json();

      const result: ProposalResult = data.result ?? data;
      setCurrentResult(result);

      const withResult = updated.map((p) =>
        p.id === proposalId ? { ...p, proposalResult: result, status: "proposed" as const } : p
      );
      persist(withResult);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "提案の生成に失敗しました");
    } finally {
      setGenerating(false);
    }
  }

  function handleAccept(planRank?: number) {
    if (!currentProposalId) return;
    const updated = proposals.map((p) =>
      p.id === currentProposalId
        ? { ...p, status: "accepted" as const, selectedPlan: planRank ?? null }
        : p
    );
    persist(updated);
    resetForm();
  }

  function handleSelectProposal(proposal: LaunchProposal) {
    setServiceName(proposal.serviceInfo.name);
    setServiceDescription(proposal.serviceInfo.description);
    setPrice(String(proposal.serviceInfo.price));
    setTargetAudience(proposal.targetAudience);
    setLineFollowers(String(proposal.currentMetrics.lineFollowers));
    setCvr(String(proposal.currentMetrics.cvr));
    setMonthlyLeads(String(proposal.currentMetrics.monthlyLeads));
    setCurrentResult(proposal.proposalResult);
    setCurrentProposalId(proposal.id);
    setError("");
  }

  function handleDeleteProposal(id: string) {
    const updated = proposals.filter((p) => p.id !== id);
    persist(updated);
    if (currentProposalId === id) {
      resetForm();
    }
  }

  if (!loaded) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground">ローンチ提案</h1>
        <p className="text-sm text-gray-400 mt-1">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">ローンチ提案</h1>
        <p className="text-sm text-gray-500 mt-1">
          サービス情報とメトリクスからAIが最適なローンチ戦略を提案します
        </p>
      </div>

      {/* 保存済み提案一覧 */}
      {proposals.length > 0 && (
        <div className="mb-6 bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3">保存済み提案</h2>
          <div className="flex flex-wrap gap-2">
            {proposals.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectProposal(p)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors border ${
                  currentProposalId === p.id
                    ? "border-accent bg-accent/5"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                  {p.title}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STATUS_BADGE[p.status].className}`}>
                  {STATUS_BADGE[p.status].label}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteProposal(p.id); }}
                  className="text-gray-400 hover:text-red-500 text-xs ml-1 shrink-0"
                  aria-label="削除"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ===== 左パネル: 入力フォーム ===== */}
        <div className="lg:col-span-1">
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">サービス情報入力</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">サービス名</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="例: スピリチュアル起業講座"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">サービス概要</label>
                <textarea
                  value={serviceDescription}
                  onChange={(e) => setServiceDescription(e.target.value)}
                  placeholder="サービスの内容を詳しく記述してください..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">価格帯 (円)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="例: 298000"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ターゲット層</label>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="例: 30-50代女性、占い・スピリチュアルに興味がある起業志望者"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
                />
              </div>

              <hr className="border-gray-100" />

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">現在のLINE友達数</label>
                <input
                  type="number"
                  value={lineFollowers}
                  onChange={(e) => setLineFollowers(e.target.value)}
                  placeholder="例: 500"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">過去のCVR (%)</label>
                <input
                  type="number"
                  value={cvr}
                  onChange={(e) => setCvr(e.target.value)}
                  placeholder="例: 3.5"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">月間リスト獲得数</label>
                <input
                  type="number"
                  value={monthlyLeads}
                  onChange={(e) => setMonthlyLeads(e.target.value)}
                  placeholder="例: 100"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!isFormValid() || generating}
                className="w-full bg-accent text-white text-sm font-medium py-2.5 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? "生成中..." : "AI提案を生成"}
              </button>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== 右パネル: 提案結果 ===== */}
        <div className="lg:col-span-2 space-y-4">
          {generating && (
            <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">AIがローンチ戦略を分析中...</p>
            </div>
          )}

          {!generating && !currentResult && (
            <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <p className="text-gray-400 text-sm">
                左のフォームにサービス情報を入力し、「AI提案を生成」を押してください
              </p>
            </div>
          )}

          {!generating && currentResult && (
            <>
              {/* 推奨ローンチ手法 TOP3 */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">推奨ローンチ手法 TOP3</h3>
                <div className="space-y-3">
                  {currentResult.topMethods.map((method) => (
                    <div
                      key={method.rank}
                      className="flex items-start gap-3 p-4 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-lg font-bold text-accent bg-accent/10 rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                        {method.rank}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{method.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{method.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* タイムライン概要 */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">タイムライン概要</h3>
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                  {currentResult.timeline}
                </div>
              </div>

              {/* 売上シミュレーション */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">売上シミュレーション</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">LINE友達数</p>
                    <p className="text-lg font-bold text-foreground">
                      {currentResult.salesSimulation.lineFollowers.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">人</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">CVR</p>
                    <p className="text-lg font-bold text-foreground">
                      {currentResult.salesSimulation.cvr}%
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-gray-500">単価</p>
                    <p className="text-lg font-bold text-foreground">
                      {currentResult.salesSimulation.price.toLocaleString()}
                    </p>
                    <p className="text-xs text-gray-400">円</p>
                  </div>
                  <div className="bg-accent/10 rounded-lg p-3 text-center">
                    <p className="text-xs text-accent font-medium">予想売上</p>
                    <p className="text-lg font-bold text-accent">
                      {currentResult.salesSimulation.expectedRevenue.toLocaleString()}
                    </p>
                    <p className="text-xs text-accent/70">円</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  {currentResult.salesSimulation.summary}
                </p>
              </div>

              {/* 必要コンテンツリスト */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">必要コンテンツリスト</h3>
                <ul className="space-y-2">
                  {currentResult.requiredContents.map((content, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-accent mt-0.5 shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                      <span>{content}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* リスクと対策 */}
              <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">リスクと対策</h3>
                <div className="space-y-3">
                  {currentResult.risks.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-gray-100">
                      <div className="flex items-start gap-2">
                        <span className="text-red-400 shrink-0 mt-0.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                          </svg>
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{item.risk}</p>
                          <p className="text-sm text-gray-600 mt-1">
                            <span className="text-green-600 font-medium">対策: </span>
                            {item.countermeasure}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* この提案を採用ボタン */}
              {proposals.find((p) => p.id === currentProposalId)?.status !== "accepted" && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleAccept()}
                    className="bg-accent text-white text-sm font-medium px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity"
                  >
                    この提案を採用
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
