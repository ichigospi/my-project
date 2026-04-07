"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { getApiKey } from "@/lib/channel-store";
import {
  type LaunchDesign,
  loadLaunchDesign,
  saveLaunchDesign,
  saveGeneratedContent,
  loadGeneratedContent,
} from "@/lib/launch-store";

const TABS = [
  { id: "design", label: "設計書" },
  { id: "posts", label: "投稿生成" },
  { id: "columns", label: "コラム" },
  { id: "letter", label: "セールスレター" },
  { id: "line", label: "LINE配信" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const DESIGN_FIELDS: { key: keyof LaunchDesign; label: string; placeholder: string; group: string }[] = [
  { key: "productName", label: "商品名", placeholder: "例: 神社選定鑑定", group: "商品概要" },
  { key: "productContent", label: "商品内容", placeholder: "例: LINE経由で申込→鑑定→結果をお伝え", group: "商品概要" },
  { key: "price", label: "価格", placeholder: "例: 7,980円", group: "商品概要" },
  { key: "priceJustification", label: "価格の正当化", placeholder: "例: 通常の個別鑑定は3万円〜だが特別価格", group: "商品概要" },
  { key: "salesMethod", label: "販売方法", placeholder: "例: LINE経由で個別販売", group: "商品概要" },
  { key: "limit", label: "限定", placeholder: "例: 20名限定 / 期間限定3日間", group: "商品概要" },
  { key: "limitReason", label: "限定の理由", placeholder: "例: 1人ずつ丁寧に対応するため", group: "商品概要" },
  { key: "differentiation", label: "差別化", placeholder: "例: 独自メソッド + 豊富な実績", group: "商品概要" },
  { key: "pain", label: "悩み/欲求", placeholder: "例: 頑張ってるのに結果が出ない", group: "課題解決ロジック" },
  { key: "cause", label: "原因", placeholder: "例: 自分に合わない方法を続けている", group: "課題解決ロジック" },
  { key: "solution", label: "解決策", placeholder: "例: あなた専用の方法を見つける", group: "課題解決ロジック" },
  { key: "idealFuture", label: "理想の未来", placeholder: "例: 確信を持って行動できる / 迷いがなくなる", group: "課題解決ロジック" },
  { key: "strength", label: "強み", placeholder: "例: 独自メソッド / 豊富な実績 / 寄り添う姿勢", group: "課題解決ロジック" },
  { key: "productDetail", label: "商品詳細", placeholder: "例: LINE経由で申込→個別対応→結果をお伝え", group: "課題解決ロジック" },
  { key: "enemies", label: "仮想敵", placeholder: "例: 「有名なものを選べばOK」という常識", group: "課題解決ロジック" },
  { key: "kw1", label: "メインKW①", placeholder: "例: 相性（最重要概念）", group: "刷り込みキーワード" },
  { key: "kw2", label: "メインKW②", placeholder: "例: あなた専用（商品コンセプト）", group: "刷り込みキーワード" },
  { key: "kw3", label: "メインKW③", placeholder: "例: 波動（独自メソッド）", group: "刷り込みキーワード" },
  { key: "kw4", label: "メインKW④", placeholder: "例: 合わない（問題認知ワード）", group: "刷り込みキーワード" },
  { key: "kw5", label: "メインKW⑤", placeholder: "例: 任せてください（温かい表現）", group: "刷り込みキーワード" },
  { key: "subKw1", label: "サブKW①", placeholder: "例: 問題認知用", group: "刷り込みキーワード" },
  { key: "subKw2", label: "サブKW②", placeholder: "例: 理想の未来用", group: "刷り込みキーワード" },
  { key: "subKw3", label: "サブKW③", placeholder: "例: 権威性＋独自性", group: "刷り込みキーワード" },
  { key: "phase1Concept", label: "Phase 1 コンセプト", placeholder: "例: 「相性」という概念を植え付ける", group: "フェーズ設計" },
  { key: "phase2Concept", label: "Phase 2 コンセプト", placeholder: "例: 「私の方法が最適解」と思わせる", group: "フェーズ設計" },
  { key: "phase3Concept", label: "Phase 3 コンセプト", placeholder: "例: 「鑑定を受けたい」→ LINE → 購入", group: "フェーズ設計" },
];

const GENERATE_BUTTONS = [
  { type: "posts_phase1", label: "Phase 1 投稿", desc: "Day 1-5 / 15本", tab: "posts" },
  { type: "posts_phase2", label: "Phase 2 投稿", desc: "Day 6-10 / 15本", tab: "posts" },
  { type: "posts_phase3", label: "Phase 3 投稿", desc: "Day 11-14 / 12本+企画3本", tab: "posts" },
  { type: "columns", label: "コラム3本", desc: "企画投稿付き", tab: "columns" },
  { type: "letter", label: "セールスレター", desc: "3,000〜5,000字", tab: "letter" },
  { type: "line", label: "LINE配信", desc: "全11通", tab: "line" },
];

export default function LaunchPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>("design");
  const [design, setDesign] = useState<LaunchDesign | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDesign(loadLaunchDesign());
    // Load previously generated content
    const loaded: Record<string, string> = {};
    for (const btn of GENERATE_BUTTONS) {
      const gen = loadGeneratedContent(btn.type);
      if (gen) loaded[btn.type] = gen.content;
    }
    setResults(loaded);
  }, []);

  const handleDesignChange = useCallback((key: keyof LaunchDesign, value: string) => {
    setDesign((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [key]: value };
      return updated;
    });
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (design) {
      saveLaunchDesign(design);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [design]);

  const handleGenerate = useCallback(
    async (contentType: string) => {
      const aiApiKey = getApiKey("ai_api_key");
      if (!aiApiKey) {
        setError("AI APIキーが未設定です。設定ページから登録してください。");
        return;
      }
      if (!design) return;

      // Save design first
      saveLaunchDesign(design);

      setGenerating(contentType);
      setError(null);

      try {
        const res = await fetch("/api/launch/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType, design, aiApiKey }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "生成に失敗しました");
          return;
        }

        setResults((prev) => ({ ...prev, [contentType]: data.text }));
        saveGeneratedContent(contentType, data.text);
      } catch {
        setError("通信エラーが発生しました");
      } finally {
        setGenerating(null);
      }
    },
    [design]
  );

  const handleCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
  }, []);

  if (!design) return null;

  const groups = [...new Set(DESIGN_FIELDS.map((f) => f.group))];
  const filledCount = DESIGN_FIELDS.filter((f) => design[f.key]).length;
  const totalCount = DESIGN_FIELDS.length;
  const progress = Math.round((filledCount / totalCount) * 100);

  const currentButtons = GENERATE_BUTTONS.filter((b) => b.tab === activeTab);

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">ローンチツール</h1>
        <p className="text-sm text-gray-500 mt-1">
          14日間ローンチの設計書作成とコンテンツ一括生成
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-white text-foreground shadow-sm"
                : "text-gray-500 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Design Tab */}
      {activeTab === "design" && (
        <div className="space-y-6">
          {/* Progress */}
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">
                設計書の進捗: {filledCount}/{totalCount} 項目
              </span>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-accent h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Fields grouped */}
          {groups.map((group) => (
            <div key={group} className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-bold text-foreground mb-4">{group}</h2>
              <div className="space-y-4">
                {DESIGN_FIELDS.filter((f) => f.group === group).map((field) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      {field.label}
                    </label>
                    <input
                      type="text"
                      value={design[field.key]}
                      onChange={(e) => handleDesignChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Save button */}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              {saved ? "保存しました" : "設計書を保存"}
            </button>
          </div>
        </div>
      )}

      {/* Generate Tabs */}
      {activeTab !== "design" && (
        <div className="space-y-6">
          {/* Generate buttons */}
          <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">
              {TABS.find((t) => t.id === activeTab)?.label}を生成
            </h2>
            {progress < 30 && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-amber-50 text-amber-700 text-sm border border-amber-100">
                設計書の入力が少ないです（{progress}%）。先に「設計書」タブで商品情報を入力してください。
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {currentButtons.map((btn) => (
                <button
                  key={btn.type}
                  onClick={() => handleGenerate(btn.type)}
                  disabled={generating !== null}
                  className={`flex flex-col items-start gap-1 p-4 rounded-lg border text-left transition-colors ${
                    generating === btn.type
                      ? "bg-accent/10 border-accent"
                      : "border-gray-200 hover:border-accent hover:bg-accent/5"
                  } ${generating !== null && generating !== btn.type ? "opacity-50" : ""}`}
                >
                  <span className="text-sm font-medium text-foreground">{btn.label}</span>
                  <span className="text-xs text-gray-500">{btn.desc}</span>
                  {generating === btn.type && (
                    <span className="text-xs text-accent mt-1">生成中...</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Results */}
          {currentButtons.map(
            (btn) =>
              results[btn.type] && (
                <div
                  key={btn.type}
                  className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-foreground">{btn.label}</h3>
                    <button
                      onClick={() => handleCopy(results[btn.type])}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      コピー
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-foreground/80 bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto font-sans leading-relaxed">
                    {results[btn.type]}
                  </pre>
                </div>
              )
          )}
        </div>
      )}
    </div>
  );
}
