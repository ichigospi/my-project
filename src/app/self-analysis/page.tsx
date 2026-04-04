"use client";

import { useState, useEffect } from "react";

const SKILL_LABELS = [
  "タロット",
  "西洋占星術",
  "数秘術",
  "四柱推命",
  "手相",
  "霊感・チャネリング",
  "風水",
  "オラクルカード",
];

const CONTENT_TYPES = [
  { value: "講座", label: "講座" },
  { value: "電子書籍", label: "電子書籍" },
  { value: "個別鑑定", label: "個別鑑定" },
  { value: "グループセッション", label: "グループセッション" },
  { value: "物販", label: "物販" },
];

interface ContentAsset {
  id: string;
  name: string;
  type: string;
}

interface SelfAnalysisData {
  skills: Record<string, number>;
  usp: string;
  swot: { strengths: string; weaknesses: string; opportunities: string; threats: string };
  contentAssets: ContentAsset[];
}

const STORAGE_KEY = "self_analysis";

function defaultData(): SelfAnalysisData {
  const skills: Record<string, number> = {};
  SKILL_LABELS.forEach((s) => (skills[s] = 3));
  return {
    skills,
    usp: "",
    swot: { strengths: "", weaknesses: "", opportunities: "", threats: "" },
    contentAssets: [],
  };
}

function loadData(): SelfAnalysisData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultData(), ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return defaultData();
}

export default function SelfAnalysisPage() {
  const [data, setData] = useState<SelfAnalysisData>(defaultData);
  const [saved, setSaved] = useState(false);
  const [newAssetName, setNewAssetName] = useState("");
  const [newAssetType, setNewAssetType] = useState("講座");

  useEffect(() => {
    setData(loadData());
  }, []);

  const updateSkill = (label: string, value: number) => {
    setData((prev) => ({
      ...prev,
      skills: { ...prev.skills, [label]: value },
    }));
  };

  const updateSwot = (key: keyof SelfAnalysisData["swot"], value: string) => {
    setData((prev) => ({
      ...prev,
      swot: { ...prev.swot, [key]: value },
    }));
  };

  const addAsset = () => {
    if (!newAssetName.trim()) return;
    const asset: ContentAsset = {
      id: crypto.randomUUID(),
      name: newAssetName.trim(),
      type: newAssetType,
    };
    setData((prev) => ({
      ...prev,
      contentAssets: [...prev.contentAssets, asset],
    }));
    setNewAssetName("");
  };

  const removeAsset = (id: string) => {
    setData((prev) => ({
      ...prev,
      contentAssets: prev.contentAssets.filter((a) => a.id !== id),
    }));
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">自己分析</h1>
        <p className="text-gray-500 mt-1">自分の強みとビジネス資産を整理</p>
      </div>

      <div className="space-y-6">
        {/* 占術スキル */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-4">占術スキル</h2>
          <div className="space-y-4">
            {SKILL_LABELS.map((label) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-gray-700">{label}</label>
                  <span className="text-xs font-medium text-gray-500">
                    {data.skills[label]} / 5
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={1}
                  value={data.skills[label] ?? 3}
                  onChange={(e) => updateSkill(label, parseInt(e.target.value))}
                  className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-accent bg-gray-200"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* USP */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-1">USP（独自の強み）</h2>
          <p className="text-sm text-gray-500 mb-3">
            他の占い師と差別化できるあなただけの強みを記述してください
          </p>
          <textarea
            value={data.usp}
            onChange={(e) => setData((prev) => ({ ...prev, usp: e.target.value }))}
            rows={4}
            placeholder="例: 西洋占星術×心理学の知見を活かし、具体的な行動提案まで行える"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm resize-none"
          />
        </div>

        {/* SWOT */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-4">SWOT分析</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-700 mb-1">
                強み（Strengths）
              </label>
              <textarea
                value={data.swot.strengths}
                onChange={(e) => updateSwot("strengths", e.target.value)}
                rows={4}
                placeholder="内部のプラス要因"
                className="w-full px-4 py-2.5 rounded-lg border border-green-200 focus:border-green-400 focus:ring-2 focus:ring-green-100 outline-none text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-red-700 mb-1">
                弱み（Weaknesses）
              </label>
              <textarea
                value={data.swot.weaknesses}
                onChange={(e) => updateSwot("weaknesses", e.target.value)}
                rows={4}
                placeholder="内部のマイナス要因"
                className="w-full px-4 py-2.5 rounded-lg border border-red-200 focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-1">
                機会（Opportunities）
              </label>
              <textarea
                value={data.swot.opportunities}
                onChange={(e) => updateSwot("opportunities", e.target.value)}
                rows={4}
                placeholder="外部のプラス要因"
                className="w-full px-4 py-2.5 rounded-lg border border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-yellow-700 mb-1">
                脅威（Threats）
              </label>
              <textarea
                value={data.swot.threats}
                onChange={(e) => updateSwot("threats", e.target.value)}
                rows={4}
                placeholder="外部のマイナス要因"
                className="w-full px-4 py-2.5 rounded-lg border border-yellow-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-100 outline-none text-sm resize-none"
              />
            </div>
          </div>
        </div>

        {/* コンテンツ資産 */}
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold mb-4">コンテンツ資産</h2>

          {/* Add asset */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newAssetName}
              onChange={(e) => setNewAssetName(e.target.value)}
              placeholder="コンテンツ名"
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
            />
            <select
              value={newAssetType}
              onChange={(e) => setNewAssetType(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm outline-none"
            >
              {CONTENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              onClick={addAsset}
              disabled={!newAssetName.trim()}
              className="px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              追加
            </button>
          </div>

          {/* Asset list */}
          {data.contentAssets.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              コンテンツ資産がまだ登録されていません
            </p>
          ) : (
            <div className="space-y-2">
              {data.contentAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{asset.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                      {asset.type}
                    </span>
                  </div>
                  <button
                    onClick={() => removeAsset(asset.id)}
                    className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    title="削除"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {saved ? "保存しました！" : "保存する"}
        </button>
      </div>
    </div>
  );
}
