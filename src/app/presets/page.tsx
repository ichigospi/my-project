"use client";

import { useState, useEffect } from "react";
import { getPresetsByChannel, savePreset, deletePreset, genId, GENRE_LABELS, STYLE_LABELS } from "@/lib/project-store";
import { getProfileByChannel, saveProfileByChannel, getAnalyses } from "@/lib/script-analysis-store";
import { pullSharedSettings, pushSharedSettings } from "@/lib/shared-sync";
import type { ScriptRulePreset, Genre, Style } from "@/lib/project-store";
import type { ChannelProfile, ScriptAnalysis } from "@/lib/script-analysis-store";
import { useChannel } from "@/lib/channel-context";

export default function PresetsPage() {
  const { activeChannel } = useChannel();
  const [presets, setPresets] = useState<ScriptRulePreset[]>([]);
  const [editing, setEditing] = useState<ScriptRulePreset | null>(null);
  const [saved, setSaved] = useState(false);
  const [profile, setProfileState] = useState<ChannelProfile | null>(null);
  const [analyses, setAnalysesState] = useState<ScriptAnalysis[]>([]);
  const [tab, setTab] = useState<"common" | "presets">("common");

  useEffect(() => {
    const channelId = activeChannel?.id || "";
    // 先に localStorage から即座に表示（pull完了を待たない）
    setPresets(getPresetsByChannel(channelId));
    setProfileState(getProfileByChannel(channelId));
    setAnalysesState(getAnalyses());
    // 後でサーバーから最新を取って上書き
    pullSharedSettings().then(() => {
      setPresets(getPresetsByChannel(channelId));
      setProfileState(getProfileByChannel(channelId));
      setAnalysesState(getAnalyses());
    }).catch(() => { /* pull失敗時もローカル表示は維持 */ });
  }, [activeChannel]);

  const handleSavePreset = () => {
    if (!editing) return;
    const channelId = activeChannel?.id || "";
    // 共有プリセット(channelId未設定)を編集中なら、このチャンネル専用に複製して保存
    // 既にチャンネル別プリセットなら、そのまま上書き
    const toSave: ScriptRulePreset = !editing.channelId && channelId
      ? { ...editing, id: genId(), channelId }
      : editing;
    savePreset(toSave);
    setPresets(getPresetsByChannel(channelId));
    setEditing(toSave);  // 新IDに切り替え
    pushSharedSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleResetToDefault = () => {
    if (!editing || !editing.channelId) return;
    if (!confirm("このチャンネル専用のカスタマイズを削除して共有プリセットに戻しますか？")) return;
    deletePreset(editing.id);
    setPresets(getPresetsByChannel(activeChannel?.id || ""));
    setEditing(null);
    pushSharedSettings();
  };

  const handleSaveProfile = () => {
    if (!profile) return;
    // 他ページ（自チャンネル設計等）が編集したフィールドを潰さないよう、保存直前に最新を取得してマージ
    const latest = getProfileByChannel(activeChannel?.id || "");
    saveProfileByChannel({
      ...latest,
      // 台本ルール画面で編集する項目だけ上書き
      commonRules: profile.commonRules,
      ngExpressions: profile.ngExpressions,
      referenceAnalysisIds: profile.referenceAnalysisIds,
      channelId: activeChannel?.id || "",
    });
    pushSharedSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggleReference = (id: string) => {
    if (!profile) return;
    const ids = profile.referenceAnalysisIds || [];
    const next = ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id];
    setProfileState({ ...profile, referenceAnalysisIds: next });
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-xl md:text-2xl font-bold">台本ルール</h1>
        <p className="text-gray-500 mt-1">AIが台本を生成する際に自動適用されるルール</p>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        <button onClick={() => { setTab("common"); setEditing(null); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === "common" ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
          チャンネル共通ルール
        </button>
        <button onClick={() => { setTab("presets"); setEditing(null); }}
          className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${tab === "presets" ? "border-accent text-accent" : "border-transparent text-gray-500"}`}>
          カテゴリ別プリセット
        </button>
      </div>

      {/* チャンネル共通ルールタブ */}
      {tab === "common" && profile && (
        <div className="max-w-2xl space-y-6">
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">チャンネル共通ルール</label>
              <p className="text-xs text-gray-400 mb-2">全ての台本生成・構成提案で適用されるルール</p>
              <textarea value={profile.commonRules || ""} onChange={(e) => setProfileState({ ...profile, commonRules: e.target.value })}
                rows={6} placeholder="例: 語尾は「〜ですます調」で統一&#10;必ず冒頭15秒以内にフックを入れる&#10;チャンネル登録は動画中盤で一度だけ促す&#10;「必ず」「絶対」等の断定表現は避ける"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">NG表現リスト</label>
              <p className="text-xs text-gray-400 mb-2">台本で使ってはいけない表現（1行1つ）</p>
              <textarea value={profile.ngExpressions || ""} onChange={(e) => setProfileState({ ...profile, ngExpressions: e.target.value })}
                rows={4} placeholder="例: 必ず当たります&#10;100%効果があります&#10;今すぐ購入&#10;返金保証"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
          </div>

          {/* お手本台本 */}
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1">お手本台本</label>
            <p className="text-xs text-gray-400 mb-3">台本生成時に参考にすべき分析を選択（分析ライブラリから）</p>
            {analyses.length === 0 ? (
              <p className="text-sm text-gray-400">分析ライブラリにデータがありません</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {analyses.map((a) => (
                  <label key={a.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={(profile.referenceAnalysisIds || []).includes(a.id)}
                      onChange={() => toggleReference(a.id)} className="w-4 h-4 rounded accent-accent" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{a.videoTitle}</p>
                      <p className="text-xs text-gray-400">{a.channelName} · スコア{a.score?.overall || "?"}/10</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button onClick={handleSaveProfile} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
            {saved ? "保存しました！" : "保存"}
          </button>
        </div>
      )}

      {/* カテゴリ別プリセットタブ */}
      {tab === "presets" && !editing && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {presets.map((p) => (
            <div key={p.id} onClick={() => setEditing(p)}
              className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:border-accent/30 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{GENRE_LABELS[p.genre as Genre]}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{STYLE_LABELS[p.style as Style]}</span>
                {p.channelId ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">{activeChannel?.name || "ch"}専用</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">共有</span>
                )}
              </div>
              <h3 className="font-semibold mb-2">{p.name}</h3>
              <p className="text-sm text-gray-600 line-clamp-4 mb-3 whitespace-pre-wrap">{p.rules}</p>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>目標: {p.targetWordCount}文字</span>
                <span>ルール: {(p.rules || "").length.toLocaleString()}字</span>
                <span className="text-accent">クリックで全文編集 →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* カテゴリ別プリセット編集 */}
      {tab === "presets" && editing && (
        <div className="max-w-4xl">
          <button onClick={() => setEditing(null)} className="text-accent text-sm font-medium mb-4 flex items-center gap-1 hover:underline">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            一覧に戻る
          </button>
          <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{GENRE_LABELS[editing.genre as Genre]}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">{STYLE_LABELS[editing.style as Style]}</span>
            </div>
            <h2 className="text-lg font-bold">{editing.name}</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">台本ルール（構成の全文。AIが台本生成時にこの内容を適用します）</label>
              <p className="text-xs text-gray-400 mb-1.5">{(editing.rules || "").length.toLocaleString()}文字</p>
              <textarea value={editing.rules} onChange={(e) => setEditing({ ...editing, rules: e.target.value })}
                rows={24} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm leading-relaxed font-mono resize-y" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">台本生成プロンプト（AIへの役割指示・1〜数文）</label>
              <textarea value={editing.prompt} onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
                rows={5} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm leading-relaxed resize-y" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">目標文字数</label>
                <input type="number" value={editing.targetWordCount} onChange={(e) => setEditing({ ...editing, targetWordCount: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">フックパターン</label>
              <input type="text" value={editing.hookPattern} onChange={(e) => setEditing({ ...editing, hookPattern: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CTAパターン</label>
              <input type="text" value={editing.ctaPattern} onChange={(e) => setEditing({ ...editing, ctaPattern: e.target.value })}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <textarea value={editing.notes} onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                rows={2} className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={handleSavePreset} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
                {saved ? "保存しました！" : (!editing.channelId && activeChannel?.id ? `${activeChannel.name}用に保存` : "保存")}
              </button>
              {editing.channelId && (
                <button onClick={handleResetToDefault} className="px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50">
                  共有プリセットに戻す
                </button>
              )}
              {!editing.channelId && activeChannel?.id && (
                <p className="text-xs text-gray-400">※ これは共有プリセット。保存すると{activeChannel.name}専用のコピーが作成されます</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
