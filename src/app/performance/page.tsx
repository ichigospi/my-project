"use client";

import { useState, useEffect } from "react";
import { getPerformanceRecords, savePerformanceRecord, deletePerformanceRecord, genId, GENRE_LABELS, STYLE_LABELS } from "@/lib/project-store";
import type { PerformanceRecord, Genre, Style } from "@/lib/project-store";
import { formatNumber } from "@/lib/mock-data";

export default function PerformancePage() {
  const [records, setRecords] = useState<PerformanceRecord[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ videoUrl: "", title: "", genre: "love" as Genre, style: "healing" as Style, publishedAt: "", views: 0, likes: 0, comments: 0, structureUsed: "", hooksUsed: "", ctasUsed: "", notes: "" });

  useEffect(() => { setRecords(getPerformanceRecords()); }, []);

  const handleSave = () => {
    if (!form.title) return;
    savePerformanceRecord({
      id: genId(), projectId: "", videoUrl: form.videoUrl, title: form.title,
      genre: form.genre, style: form.style, publishedAt: form.publishedAt,
      views: form.views, likes: form.likes, comments: form.comments,
      structureUsed: form.structureUsed,
      hooksUsed: form.hooksUsed.split(",").map((s) => s.trim()).filter(Boolean),
      ctasUsed: form.ctasUsed.split(",").map((s) => s.trim()).filter(Boolean),
      notes: form.notes, recordedAt: new Date().toISOString(),
    });
    setRecords(getPerformanceRecords());
    setShowForm(false);
    setForm({ videoUrl: "", title: "", genre: "love", style: "healing", publishedAt: "", views: 0, likes: 0, comments: 0, structureUsed: "", hooksUsed: "", ctasUsed: "", notes: "" });
  };

  const sorted = [...records].sort((a, b) => b.views - a.views);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">パフォーマンス記録</h1>
          <p className="text-gray-500 mt-1">公開済み動画の実績を記録して次の企画に活かす</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
          {showForm ? "閉じる" : "+ 実績を記録"}
        </button>
      </div>

      {showForm && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">動画タイトル</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">動画URL</label>
              <input type="text" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">ジャンル</label>
                <select value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value as Genre })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">スタイル</label>
                <select value={form.style} onChange={(e) => setForm({ ...form, style: e.target.value as Style })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  {Object.entries(STYLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">公開日</label>
              <input type="date" value={form.publishedAt} onChange={(e) => setForm({ ...form, publishedAt: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">再生数</label>
                <input type="number" value={form.views} onChange={(e) => setForm({ ...form, views: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
              <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">いいね</label>
                <input type="number" value={form.likes} onChange={(e) => setForm({ ...form, likes: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
              <div className="flex-1"><label className="block text-xs text-gray-500 mb-1">コメント</label>
                <input type="number" value={form.comments} onChange={(e) => setForm({ ...form, comments: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">使用した構成</label>
              <input type="text" value={form.structureUsed} onChange={(e) => setForm({ ...form, structureUsed: e.target.value })}
                placeholder="例: 共感→アファメーション→予祝CTA"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">メモ</label>
              <input type="text" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-accent outline-none" />
            </div>
          </div>
          <button onClick={handleSave} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">記録を保存</button>
        </div>
      )}

      {/* 実績一覧 */}
      {sorted.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p>まだ実績記録がありません</p>
          <p className="text-sm mt-1">動画を公開したら「+ 実績を記録」で追加してください</p>
        </div>
      )}
      <div className="space-y-3">
        {sorted.map((r, i) => (
          <div key={r.id} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 flex items-start gap-4">
            <span className="text-lg font-bold text-gray-300 w-8 text-center">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{r.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{GENRE_LABELS[r.genre as Genre]}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{STYLE_LABELS[r.style as Style]}</span>
                {r.publishedAt && <span className="text-xs text-gray-400">{r.publishedAt}</span>}
              </div>
              {r.structureUsed && <p className="text-xs text-gray-500 mt-1">構成: {r.structureUsed}</p>}
              {r.notes && <p className="text-xs text-gray-400 mt-0.5">{r.notes}</p>}
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold">{formatNumber(r.views)}<span className="text-xs text-gray-400">回</span></p>
              <p className="text-xs text-gray-500">{formatNumber(r.likes)}いいね · {formatNumber(r.comments)}コメント</p>
            </div>
            <button onClick={() => { deletePerformanceRecord(r.id); setRecords(getPerformanceRecords()); }}
              className="text-gray-300 hover:text-danger shrink-0"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        ))}
      </div>
    </div>
  );
}
