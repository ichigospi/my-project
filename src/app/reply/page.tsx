// 返信作成: ①段階を選ぶ → ②メッセージを貼る → ③生成 の3ステップ
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getApiKey } from "@/lib/channel-store";
import { categoryLabel, stageLabel, REPLY_STAGES } from "@/lib/reply-prompts";
import { ALLOWED_AI_MODELS, AI_MODEL_OPTIONS, DEFAULT_AI_MODEL, type AiModelId } from "@/lib/ai-model";

interface DraftRecord {
  id: string;
  category: string;
  stage: string;
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
  high: { label: "確信度 高", cls: "bg-green-100 text-green-700" },
  medium: { label: "確信度 中", cls: "bg-yellow-100 text-yellow-700" },
  low: { label: "確信度 低（要確認）", cls: "bg-red-100 text-red-700" },
};

const MODEL_STORAGE_KEY = "reply_ai_model";

function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold shrink-0">
      {n}
    </span>
  );
}

export default function ReplyCreatePage() {
  const [stage, setStage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [context, setContext] = useState("");
  const [model, setModel] = useState<AiModelId>(DEFAULT_AI_MODEL);

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

  useEffect(() => {
    const saved = localStorage.getItem(MODEL_STORAGE_KEY);
    if (saved && (ALLOWED_AI_MODELS as readonly string[]).includes(saved)) {
      setModel(saved as AiModelId);
    }
  }, []);

  const changeModel = (m: AiModelId) => {
    setModel(m);
    localStorage.setItem(MODEL_STORAGE_KEY, m);
  };

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
        body: JSON.stringify({ customerMessage, customerName, context, stage, aiApiKey, model }),
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
          ? "✓ 送信済みとして記録しました" + (saveAsExample ? "（実例集にも追加）" : "")
          : "✓ 承認依頼を出しました。オーナーが「履歴・承認」タブで確認します",
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
        body: JSON.stringify({ ...p, stage, source: "learned" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ルールの追加に失敗しました");
        return;
      }
      setProposals((prev) => prev.filter((_, i) => i !== index));
      setSavedMessage("✓ ルールを追加しました");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ルールの追加に失敗しました");
    }
  };

  const edited = result ? finalReply.trim() !== (result.draft || "").trim() : false;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      {/* あるある集への誘導 */}
      <Link
        href="/reply/scenarios"
        className="flex items-center gap-3 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100 rounded-xl px-4 py-3 hover:border-purple-300 transition-colors"
      >
        <span className="text-xl">💡</span>
        <span className="text-sm text-gray-700">
          <strong>メッセージを貼らずに作りたいときは</strong> — よくあるシーンから例文を探せる「あるある集」へ
        </span>
        <span className="ml-auto text-purple-400">→</span>
      </Link>

      {/* STEP 1: 段階 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StepBadge n={1} />
          <h2 className="text-sm font-bold text-gray-900">どの段階のお客様?</h2>
          <span className="text-xs text-gray-400">わからなければ「指定なし」でOK</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStage("")}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              stage === ""
                ? "bg-purple-600 text-white border-purple-600"
                : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
            }`}
          >
            指定なし
          </button>
          {REPLY_STAGES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStage(s.value)}
              title={s.desc}
              className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                stage === s.value
                  ? "bg-purple-600 text-white border-purple-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-purple-300"
              }`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>
      </section>

      {/* STEP 2: メッセージ */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StepBadge n={2} />
          <h2 className="text-sm font-bold text-gray-900">お客様のメッセージを貼り付け</h2>
        </div>
        <textarea
          value={customerMessage}
          onChange={(e) => setCustomerMessage(e.target.value)}
          placeholder="UTAGE・LINE・DM・メールなど、どこからのメッセージでもOK"
          rows={6}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />
        <details className="group">
          <summary className="text-xs text-gray-500 cursor-pointer select-none hover:text-gray-700">
            ＋ お客様の名前・補足メモを追加（任意）
          </summary>
          <div className="mt-3 space-y-2">
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="お客様の名前（入れると過去のやりとりを考慮）"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="補足メモ 例:「昨日、神社選定鑑定を申し込まれた方です」"
              rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
        </details>
      </section>

      {/* STEP 3: 生成 */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <StepBadge n={3} />
          <h2 className="text-sm font-bold text-gray-900">返信案を生成</h2>
          <select
            value={model}
            onChange={(e) => changeModel(e.target.value as AiModelId)}
            className="ml-auto border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 bg-white"
            title="生成に使うAIモデル"
          >
            {AI_MODEL_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold rounded-xl py-3 text-sm transition-colors shadow-sm"
        >
          {loading ? "🔮 あなたの判断基準で考え中..." : "🔮 返信案を生成する"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      {/* 結果 */}
      {result && (
        <section
          className={`rounded-xl shadow-sm border p-5 space-y-4 ${
            result.isEscalation ? "bg-red-50 border-red-200" : "bg-white border-purple-200"
          }`}
        >
          <div className="flex flex-wrap items-center gap-2">
            {result.stage && (
              <span className="px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {stageLabel(result.stage)}
              </span>
            )}
            <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-700 text-xs font-semibold">
              {categoryLabel(result.category)}
            </span>
            {!result.isEscalation && CONFIDENCE_BADGE[result.confidence] && (
              <span className={`px-2 py-1 rounded-md text-xs font-semibold ${CONFIDENCE_BADGE[result.confidence].cls}`}>
                {CONFIDENCE_BADGE[result.confidence].label}
              </span>
            )}
            {approvalMode === "approval" && !result.isEscalation && (
              <span className="px-2 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-semibold">承認必須モード</span>
            )}
          </div>

          {result.isEscalation ? (
            <div className="space-y-2">
              <p className="text-base font-bold text-red-700">🚨 オーナー本人の対応が必要な内容です</p>
              <p className="text-sm text-red-700">{result.escalationReason}</p>
              <p className="text-xs text-red-500">
                AIによる返信案は作成していません。オーナーに直接共有してください（履歴・承認タブに記録済み）。
              </p>
            </div>
          ) : (
            <>
              {/* 返信文（主役） */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-500">
                    ✉️ 返信文{edited && <span className="ml-2 text-purple-600">（修正あり）</span>}
                  </p>
                  <button
                    onClick={copyFinal}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
                  >
                    {copied ? "✓ コピーしました" : "📋 コピー"}
                  </button>
                </div>
                <textarea
                  value={finalReply}
                  onChange={(e) => setFinalReply(e.target.value)}
                  rows={10}
                  className="w-full border border-purple-200 bg-purple-50/40 rounded-lg px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>

              {/* アクション */}
              <div className="flex flex-wrap items-center gap-2">
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
                {edited && (
                  <button
                    onClick={learnFromEdit}
                    disabled={learning}
                    className="px-4 py-2 rounded-lg border border-purple-300 text-purple-600 text-sm font-medium hover:bg-purple-50 disabled:opacity-50 transition-colors"
                  >
                    {learning ? "分析中..." : "🧠 この修正から学ぶ"}
                  </button>
                )}
                {approvalMode === "direct" && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 ml-auto">
                    <input
                      type="checkbox"
                      checked={saveAsExample}
                      onChange={(e) => setSaveAsExample(e.target.checked)}
                    />
                    送信時に実例集へ追加
                  </label>
                )}
              </div>
              {savedMessage && <p className="text-sm text-green-600 font-medium">{savedMessage}</p>}

              {/* 判断根拠（折りたたみ） */}
              <details className="bg-gray-50 rounded-lg">
                <summary className="px-3 py-2 text-xs font-semibold text-gray-500 cursor-pointer select-none">
                  🔍 なぜこの返信? （判断根拠を見る）
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  <p className="text-sm text-gray-700">{result.reasoning}</p>
                  {usedPolicies.length > 0 && (
                    <div className="text-xs text-gray-500">
                      参照ルール: {usedPolicies.map((p) => p.title).join(" / ")}
                    </div>
                  )}
                  {usedExamples.length > 0 && (
                    <div className="text-xs text-gray-500">参考にした実例: {usedExamples.length}件</div>
                  )}
                </div>
              </details>
            </>
          )}
        </section>
      )}

      {/* 修正から抽出されたルール候補 */}
      {proposals.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-purple-200 p-5 space-y-3">
          <h2 className="text-sm font-bold text-purple-700">🧠 修正から抽出されたルール候補</h2>
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
