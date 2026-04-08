"use client";

import { useState, useEffect, useCallback } from "react";
import { getApiKey } from "@/lib/channel-store";
import {
  loadLaunchDesign,
  saveGeneratedContent,
  loadGeneratedContent,
} from "@/lib/launch-store";

interface GenerateButton {
  type: string;
  label: string;
  desc: string;
}

export default function LaunchGenerator({ buttons }: { buttons: GenerateButton[] }) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const loaded: Record<string, string> = {};
    for (const btn of buttons) {
      const gen = loadGeneratedContent(btn.type);
      if (gen) loaded[btn.type] = gen.content;
    }
    setResults(loaded);
  }, [buttons]);

  const handleGenerate = useCallback(
    async (contentType: string) => {
      const aiApiKey = getApiKey("ai_api_key");
      if (!aiApiKey) {
        setError("AI APIキーが未設定です。YTツール側の設定ページから登録してください。");
        return;
      }

      const design = loadLaunchDesign();
      const filledCount = Object.values(design).filter((v) => v).length;
      if (filledCount < 5) {
        setError("設計書の入力が少なすぎます。先に「設計書」ページで商品情報を入力してください。");
        return;
      }

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
    []
  );

  const handleCopy = useCallback(async (type: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-100">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buttons.map((btn) => (
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

      {buttons.map(
        (btn) =>
          results[btn.type] && (
            <div
              key={btn.type}
              className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">{btn.label}</h3>
                <button
                  onClick={() => handleCopy(btn.type, results[btn.type])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  {copied === btn.type ? "コピーしました" : "コピー"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap text-sm text-foreground/80 bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto font-sans leading-relaxed">
                {results[btn.type]}
              </pre>
            </div>
          )
      )}
    </div>
  );
}
