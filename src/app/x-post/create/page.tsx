"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";
import { getApiKey } from "@/lib/channel-store";
import { DEFAULT_X_POST_MODEL, X_POST_MODEL_LABELS, type XPostModel } from "@/lib/x-post-ai";
import {
  EDUCATION_TYPES,
  STRUCTURE_TYPES,
  parseTemplate,
  type XSinglePostTemplate,
  type EducationType,
} from "@/lib/x-post-types";

const HOOK_TYPES = [
  "不完全情報",
  "重要性",
  "希少性",
  "権威性",
  "恐怖損失回避",
  "ターゲット刺し",
  "強烈な感情",
  "パワーワード",
  "簡易性",
  "矛盾",
  "ニュース性",
  "暴露報告",
  "限定性",
  "反社会性",
];

const REINFORCEMENT_ELEMENTS = [
  "再現性",
  "即効性",
  "限定性",
  "常識破壊",
  "簡易性",
  "希少性",
  "権威性",
  "実績",
  "未来性",
  "感情訴求",
  "数字インパクト",
  "ストーリー性",
  "対比",
  "具体性",
];

const LOGIC_TYPES = ["", "課題解決型", "欲求喚起型"] as const;

type Mode = "scratch" | "template" | "daily_slot";

interface GeneratedPostItem {
  content: string;
  charCount: number;
  hookType: string;
  educationType: string;
  structureType: string;
  reinforcementElements: string[];
}

interface GeneratedResult {
  posts: GeneratedPostItem[];
  rationale: string;
}

interface ApiTemplate {
  id: string;
  genre: string;
  name: string;
  sourceType: string;
  sourceId: string | null;
  structure: string;
  skeleton: string;
  placeholders: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

interface ApiGeneratedPost {
  id: string;
  genre: string;
  topic: string;
  educationType: string;
  output: string;
  metadata: string;
  createdAt: string;
}

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">読み込み中...</div>}>
      <CreatePageInner />
    </Suspense>
  );
}

function CreatePageInner() {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";
  const searchParams = useSearchParams();
  const router = useRouter();

  // ---- 入力フォーム ----
  const [mode, setMode] = useState<Mode>("scratch");
  const [topic, setTopic] = useState("");
  const [educationType, setEducationType] = useState<EducationType | "">("目的");
  const [logicType, setLogicType] = useState<(typeof LOGIC_TYPES)[number]>("");
  const [hookType, setHookType] = useState("");
  const [structureType, setStructureType] = useState("");
  const [reinforcementElements, setReinforcementElements] = useState<string[]>([]);
  const [customInstruction, setCustomInstruction] = useState("");
  const [model, setModel] = useState<XPostModel>(DEFAULT_X_POST_MODEL);

  // テンプレモード
  const [templates, setTemplates] = useState<XSinglePostTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // デイリースロットモード
  const [dailyPlanId, setDailyPlanId] = useState("");
  const [dailySlotIndex, setDailySlotIndex] = useState<number | null>(null);

  // ---- 生成・履歴 ----
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ApiGeneratedPost[]>([]);

  // クエリ → 初期値（デイリーから来た場合）
  useEffect(() => {
    const from = searchParams.get("from");
    if (from === "daily") {
      const planId = searchParams.get("planId") ?? "";
      const slotStr = searchParams.get("slot");
      const ed = searchParams.get("education") ?? "";
      const theme = searchParams.get("theme") ?? "";
      const hook = searchParams.get("hook") ?? "";
      setMode("daily_slot");
      setDailyPlanId(planId);
      setDailySlotIndex(slotStr ? Number(slotStr) : null);
      if (ed && (EDUCATION_TYPES as readonly string[]).includes(ed)) {
        setEducationType(ed as EducationType);
      }
      if (theme) setTopic(theme);
      if (hook) setHookType(hook);
    }
  }, [searchParams]);

  // テンプレ一覧
  useEffect(() => {
    fetch(`/api/x-post/templates?genre=${genre}`)
      .then((r) => r.json())
      .then((data: ApiTemplate[]) => {
        setTemplates(data.map(parseTemplate));
      })
      .catch(() => setTemplates([]));
  }, [genre]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch(`/api/x-post/generated-posts?genre=${genre}`);
      const data = (await r.json()) as ApiGeneratedPost[];
      setHistory(Array.isArray(data) ? data : []);
    } catch {
      setHistory([]);
    }
  }, [genre]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // テンプレを選んだら教育タイプ等を自動セット
  useEffect(() => {
    if (!selectedTemplate) return;
    if (selectedTemplate.structure.educationType) {
      setEducationType(selectedTemplate.structure.educationType as EducationType);
    }
    if (selectedTemplate.structure.hookType) setHookType(selectedTemplate.structure.hookType);
    if (selectedTemplate.structure.structureType) setStructureType(selectedTemplate.structure.structureType);
    if (selectedTemplate.structure.reinforcementElements) {
      setReinforcementElements(selectedTemplate.structure.reinforcementElements);
    }
  }, [selectedTemplate]);

  const generate = async () => {
    setError(null);
    setResult(null);
    setSavedId(null);
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      setError("AI APIキーが未設定です。設定ページで登録してください。");
      return;
    }
    if (!topic.trim()) {
      setError("テーマを入力してください");
      return;
    }
    if (mode === "template" && !selectedTemplate) {
      setError("テンプレを選択してください");
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/x-post/generated-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          genre,
          aiApiKey,
          model,
          save: true,
          mode,
          topic: topic.trim(),
          educationType,
          logicType,
          hookType,
          structureType,
          reinforcementElements,
          customInstruction: customInstruction.trim() || undefined,
          templateSkeleton: selectedTemplate?.skeleton,
          templatePlaceholders: selectedTemplate?.placeholders,
          sourceTemplateId: selectedTemplate?.id,
          dailyPlanId: mode === "daily_slot" && dailyPlanId ? dailyPlanId : undefined,
          slotIndex: mode === "daily_slot" ? dailySlotIndex ?? undefined : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `生成失敗: ${res.statusText}`);
        return;
      }
      setResult(data.result as GeneratedResult);
      setSavedId(data.savedId ?? null);
      // デイリースロットから来た場合はプランのスロットを generated に更新
      if (mode === "daily_slot" && dailyPlanId && dailySlotIndex != null && data.savedId) {
        try {
          const planRes = await fetch(`/api/x-post/daily-plans/${dailyPlanId}`);
          if (planRes.ok) {
            const plan = await planRes.json();
            const slots = JSON.parse(plan.slots || "[]");
            const idx = slots.findIndex((s: { slot: number }) => s.slot === dailySlotIndex);
            if (idx >= 0) {
              slots[idx] = { ...slots[idx], status: "generated", generatedPostId: data.savedId };
              await fetch(`/api/x-post/daily-plans/${dailyPlanId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slots: JSON.stringify(slots) }),
              });
            }
          }
        } catch {
          // 失敗しても生成自体は完了
        }
      }
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const loadHistoryItem = (item: ApiGeneratedPost) => {
    try {
      const out = JSON.parse(item.output || "{}") as GeneratedResult;
      setResult(out);
      setSavedId(item.id);
      setTopic(item.topic || "");
      if (item.educationType && (EDUCATION_TYPES as readonly string[]).includes(item.educationType)) {
        setEducationType(item.educationType as EducationType);
      }
    } catch {
      // ignore
    }
  };

  const toggleReinforcement = (e: string) => {
    setReinforcementElements((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e],
    );
  };

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>✏️</span>
            ポスト生成
            <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            ゼロから / テンプレから / デイリーから の3モードで生成
          </p>
        </div>
        <Link href="/x-post/daily" className="text-sm text-indigo-600 hover:underline shrink-0">
          ← デイリープラン
        </Link>
      </div>

      <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
        {/* 左: 入力フォーム */}
        <section className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
          {/* モード切替 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">生成モード</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ["scratch", "ゼロから"],
                ["template", "テンプレから"],
                ["daily_slot", "デイリーから"],
              ] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setMode(v)}
                  className={`px-3 py-2 text-sm rounded border transition ${
                    mode === v
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "template" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">テンプレ選択</label>
              {templates.length === 0 ? (
                <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
                  テンプレがまだありません。
                  <Link href="/x-post/templates" className="ml-1 text-indigo-600 hover:underline">
                    作成する
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">— 選択 —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              )}
              {selectedTemplate && (
                <pre className="mt-2 text-xs bg-gray-50 border border-gray-200 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {selectedTemplate.skeleton}
                </pre>
              )}
            </div>
          )}

          {mode === "daily_slot" && (
            <div className="text-xs bg-indigo-50 border border-indigo-200 rounded px-3 py-2 text-indigo-900">
              デイリープラン {dailyPlanId ? "✓" : "（未指定）"}
              {dailySlotIndex != null && ` / Slot ${dailySlotIndex}`}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">テーマ *</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              placeholder="例: 開運鑑定の威力を語る / 占い師選びの落とし穴 / 等"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">教育タイプ</label>
              <select
                value={educationType}
                onChange={(e) => setEducationType(e.target.value as EducationType | "")}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">—</option>
                {EDUCATION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">ロジック型</label>
              <select
                value={logicType}
                onChange={(e) => setLogicType(e.target.value as (typeof LOGIC_TYPES)[number])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {LOGIC_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t || "—"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">フック（任意）</label>
              <select
                value={hookType}
                onChange={(e) => setHookType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">—</option>
                {HOOK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">構造（任意）</label>
              <select
                value={structureType}
                onChange={(e) => setStructureType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">—</option>
                {STRUCTURE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">強化要素（複数可）</label>
            <div className="flex flex-wrap gap-1">
              {REINFORCEMENT_ELEMENTS.map((e) => {
                const active = reinforcementElements.includes(e);
                return (
                  <button
                    key={e}
                    onClick={() => toggleReinforcement(e)}
                    className={`text-xs px-2 py-1 rounded border ${
                      active
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">追加指示（任意）</label>
            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              rows={2}
              placeholder="例: 連投2本で出して / 数字を入れて / 反応取りやすくして"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">モデル</label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as XPostModel)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {Object.entries(X_POST_MODEL_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}

          <button
            onClick={generate}
            disabled={generating}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded"
          >
            {generating ? "生成中..." : "✨ ポスト生成"}
          </button>
        </section>

        {/* 右: 結果 + 履歴 */}
        <section className="space-y-4">
          {result && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-900">生成結果</h3>
                {savedId && (
                  <span className="text-xs text-gray-500">保存済み (id: {savedId.slice(0, 8)})</span>
                )}
              </div>
              {result.posts.length === 0 ? (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                  パース失敗。AI出力がJSON形式じゃない可能性があります。再生成してみてください。
                </div>
              ) : (
                <div className="space-y-3">
                  {result.posts.map((p, i) => (
                    <PostResultCard key={i} index={i} post={p} />
                  ))}
                </div>
              )}
              {result.rationale && (
                <div className="mt-3 text-xs text-gray-600 border-t border-gray-100 pt-3">
                  <span className="font-medium text-gray-700">構成意図:</span> {result.rationale}
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                <button
                  onClick={generate}
                  disabled={generating}
                  className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                >
                  🔁 再生成
                </button>
                {mode === "daily_slot" && dailyPlanId && (
                  <button
                    onClick={() => router.push("/x-post/daily")}
                    className="text-xs px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded"
                  >
                    デイリーに戻る
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-lg">
            <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">📚 生成履歴</h3>
              <span className="text-xs text-gray-400">{history.length} 件</span>
            </div>
            {history.length === 0 ? (
              <div className="px-4 py-6 text-xs text-gray-500 text-center">
                まだ生成履歴がありません
              </div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
                {history.slice(0, 50).map((h) => (
                  <button
                    key={h.id}
                    onClick={() => loadHistoryItem(h)}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${
                      savedId === h.id ? "bg-indigo-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{new Date(h.createdAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      {h.educationType && (
                        <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{h.educationType}</span>
                      )}
                    </div>
                    <div className="mt-1 text-gray-800 truncate">{h.topic || "(テーマなし)"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function PostResultCard({ index, post }: { index: number; post: GeneratedPostItem }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(post.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  const tooLong = post.charCount > 140;
  return (
    <div className="border border-gray-200 rounded p-3">
      <div className="flex items-center justify-between mb-2 text-xs text-gray-500">
        <span>ポスト{index + 1}</span>
        <span className={tooLong ? "text-red-600 font-medium" : ""}>
          {post.charCount}字{tooLong && " (オーバー)"}
        </span>
      </div>
      <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{post.content}</div>
      <div className="mt-2 flex flex-wrap gap-1 text-xs">
        {post.hookType && (
          <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">フック: {post.hookType}</span>
        )}
        {post.educationType && (
          <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">教育: {post.educationType}</span>
        )}
        {post.structureType && (
          <span className="bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">構造: {post.structureType}</span>
        )}
        {post.reinforcementElements.map((e) => (
          <span key={e} className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">{e}</span>
        ))}
      </div>
      <div className="mt-2">
        <button
          onClick={copy}
          className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
        >
          {copied ? "✓ コピー済み" : "📋 コピー"}
        </button>
      </div>
    </div>
  );
}
