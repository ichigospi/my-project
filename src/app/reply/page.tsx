// 返信作成: お客様メッセージを貼り付け → 分類・エスカレーション判定 → 返信案生成
"use client";

import { useState } from "react";
import { getApiKey } from "@/lib/channel-store";
import { categoryLabel } from "@/lib/reply-prompts";

interface DraftRecord {
  id: string;
  category: string;
  isEscalation: boolean;
  escalationReason: string;
  confidence: string;
  reasoning: string;
  draft: string;
  status: string;
}

interface UsedPolicy { id: string; title: string; guideline: string }
interface UsedExample { id: string; customerMessage: string; replyMessage: string }

interface RuleProposal { category: string; title: string; situation: string; guideline: string }

const CONFIDENCE_BADGE: Record<string, { label: string; cls: string }> = {
  high: { label: "確信度: 高", cls: "bg-green-100 text-green-700" },
  medium: { label: "確信度: 中", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "確信度: 低（要確認）", cls: "bg-red-100 text-red-700" },
};

export default function ReplyCreatePage() {
  const [customerName, setCustomerName] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [context, setContext] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<DraftRecord | null>(null);
  const [usedPolicies, setUsedPolicies] = useState<UsedPolicy[]>([]);
  const [usedExamples, setUsedExamples] = useState<UsedExample[]>([]);
  const [approvalMode, setApprovalMode] = useState<"direct" | "approval">("direct");

  const [finalReply, setFinalReply] = useState("");
  const [saveAsExample, setSaveAsExample] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [copied, setCopied] = useState(false);

  const [learning, setLearning] = useState(false);
  const [proposals, setProposals] = useState<RuleProposal[]>([]);

  const generate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      setError("AI APIキーが未設定です。YTツールの設定画面で登録してください。");
      return;
    }
    if (!customerMessage.trim()) {
      setError("お客様のメッセージを入力してください");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setProposals([]);
    setSavedMessage("");
    try {
      const res = await fetch("/api/reply/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerMessage, customerName, context, aiApiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "生成に失敗しました");
        return;
      }
      setResult(data.draft);
      setUsedPolicies(data.usedPolicies || []);
      setUsedExamples(data.usedExamples || []);
      setApprovalMode(data.approvalMode || "direct");
      setFinalReply(data.draft.draft || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const copyFinal = async () => {
    await navigator.clipboard.writeText(finalReply);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const saveDraft = async (status: "sent" | "pending_approval") => {
    if (!result) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/reply/drafts/${result.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finalReply,
          status,
          saveAsExample: status === "sent" && saveAsExample,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }
      setResult({ ...result, status });
      setSavedMessage(
        status === "sent"
          ? "送信済みとして記録しました。" + (saveAsExample ? " 実例集にも追加しました。" : "")
          : "承認依頼を出しました。オーナーが「履歴・承認」タブで確認します。",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const learnFromEdit = async () => {
    if (!result) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      setError("AI APIキーが未設定です");
      return;
    }
    setLearning(true);
    setError("");
    try {
      // 学習には最終文の保存が必要なので、先に finalReply を反映しておく
      await fetch(`/api/reply/drafts/${result.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalReply }),
      });
      const res = await fetch("/api/reply/learn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: result.id, aiApiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ルール抽出に失敗しました");
        return;
      }
      setProposals(data.proposals || []);
      if ((data.proposals || []).length === 0) setSavedMessage("抽出できるルールはありませんでした");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ルール抽出に失敗しました");
    } finally {
      setLearning(false);
    }
  };

  const addProposalAsPolicy = async (p: RuleProposal, index: number) => {
    try {
      const res = await fetch("/api/reply/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...p, source: "learned" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ルールの追加に失敗しました");
        return;
      }
      setProposals((prev) => prev.filter((_, i) => i !== index));
      setSavedMessage("ルールを追加しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ルールの追加に失敗しました");
    }
  };

  const edited = result ? finalReply.trim() !== (result.draft || "").trim() : false;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
      {/* 入力 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">お客様からのメッセージ</h2>
        <p className="text-xs text-gray-400">UTAGE・LINE・DM・メールなど、どこからのメッセージでもそのまま貼り付けでOK</p>
        <div className="flex gap-3">
          <input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="お客様の名前（任意・入れると過去のやりとりを考慮）"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
          />
        </div>
        <textarea
          value={customerMessage}
          onChange={(e) => setCustomerMessage(e.target.value)}
          placeholder="お客様のメッセージをそのまま貼り付け"
          rows={6}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="補足メモ（任意）: 例「昨日、神社選定鑑定を申し込まれた方です」"
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        <button
          onClick={generate}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold rounded-lg py-2.5 text-sm transition-colors"
        >
          {loading ? "分析・生成中..." : "🔮 返信案を生成"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      {/* 結果 */}
      {result && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold">
              {categoryLabel(result.category)}
            </span>
            {CONFIDENCE_BADGE[result.confidence] && (
              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${CONFIDENCE_BADGE[result.confidence].cls}`}>
                {CONFIDENCE_BADGE[result.confidence].label}
              </span>
            )}
            {approvalMode === "approval" && !result.isEscalation && (
              <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold">承認必須モード</span>
            )}
          </div>

          {result.isEscalation ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
              <p className="text-sm font-bold text-red-700">🚨 このメッセージはオーナー本人の対応が必要です</p>
              <p className="text-sm text-red-700">{result.escalationReason}</p>
              <p className="text-xs text-red-500">
                AIによる返信案は作成していません。オーナーに直接共有してください（履歴・承認タブに記録済み）。
              </p>
            </div>
          ) : (
            <>
              {/* 判断根拠 */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500">判断根拠</p>
                <p className="text-sm text-gray-700">{result.reasoning}</p>
                {usedPolicies.length > 0 && (
                  <div className="text-xs text-gray-500">
                    参照ルール: {usedPolicies.map((p) => p.title).join(" / ")}
                  </div>
                )}
                {usedExamples.length > 0 && (
                  <div className="text-xs text-gray-500">参考実例: {usedExamples.length}件</div>
                )}
              </div>

              {/* 返信文（編集可能） */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">
                  返信文{edited && <span className="ml-2 text-purple-600">（修正あり）</span>}
                </p>
                <textarea
                  value={finalReply}
                  onChange={(e) => setFinalReply(e.target.value)}
                  rows={10}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={copyFinal}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {copied ? "✓ コピーしました" : "📋 コピー"}
                </button>
                {approvalMode === "direct" ? (
                  <button
                    onClick={() => saveDraft("sent")}
                    disabled={saving || result.status === "sent"}
                    className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    {result.status === "sent" ? "✓ 送信済み" : saving ? "保存中..." : "送信済みにする"}
                  </button>
                ) : (
                  <button
                    onClick={() => saveDraft("pending_approval")}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
                  >
                    {saving ? "保存中..." : "承認依頼を出す"}
                  </button>
                )}
                {approvalMode === "direct" && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={saveAsExample}
                      onChange={(e) => setSaveAsExample(e.target.checked)}
                    />
                    送信時に実例集へ追加
                  </label>
                )}
                {edited && (
                  <button
                    onClick={learnFromEdit}
                    disabled={learning}
                    className="px-4 py-2 rounded-lg border border-purple-200 text-purple-600 text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition-colors"
                  >
                    {learning ? "分析中..." : "🧠 この修正から学ぶ"}
                  </button>
                )}
              </div>
              {savedMessage && <p className="text-sm text-green-600">{savedMessage}</p>}
            </>
          )}
        </section>
      )}

      {/* 修正から抽出されたルール候補 */}
      {proposals.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-purple-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-purple-700">🧠 修正から抽出されたルール候補</h2>
          {proposals.map((p, i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="text-sm">
                <p className="font-semibold text-gray-900">
                  {p.title}
                  <span className="ml-2 text-xs font-normal text-gray-500">{categoryLabel(p.category)}</span>
                </p>
                {p.situation && <p className="text-xs text-gray-500 mt-1">状況: {p.situation}</p>}
                <p className="text-gray-700 mt-1">{p.guideline}</p>
              </div>
              <button
                onClick={() => addProposalAsPolicy(p, i)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition-colors"
              >
                ルールに追加
              </button>
            </div>
          ))}
          <p className="text-xs text-gray-400">※ ルールの追加はオーナー/管理者のみ可能です</p>
        </section>
      )}
    </div>
  );
}
