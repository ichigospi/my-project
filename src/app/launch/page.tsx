"use client";

import { useState, useEffect, useCallback } from "react";
import {
  type LaunchDesign,
  loadLaunchDesign,
  saveLaunchDesign,
} from "@/lib/launch-store";

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

export default function LaunchDesignPage() {
  const [design, setDesign] = useState<LaunchDesign | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDesign(loadLaunchDesign());
  }, []);

  const handleChange = useCallback((key: keyof LaunchDesign, value: string) => {
    setDesign((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }, []);

  const handleSave = useCallback(() => {
    if (design) {
      saveLaunchDesign(design);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }, [design]);

  if (!design) return null;

  const groups = [...new Set(DESIGN_FIELDS.map((f) => f.group))];
  const filledCount = DESIGN_FIELDS.filter((f) => design[f.key]).length;
  const progress = Math.round((filledCount / DESIGN_FIELDS.length) * 100);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">ローンチ設計書</h1>
        <p className="text-sm text-gray-500 mt-1">商品情報・教育ロジック・キーワードを入力して設計書を完成させましょう</p>
      </div>

      <div className="space-y-6">
        {/* Progress */}
        <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-foreground">
              進捗: {filledCount}/{DESIGN_FIELDS.length} 項目
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
                    onChange={(e) => handleChange(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {saved ? "保存しました" : "設計書を保存"}
        </button>
      </div>
    </div>
  );
}
