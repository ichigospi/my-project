"use client";

import { useState } from "react";

interface GenerateResult {
  id: string;
  imageUrl: string;
  imageBase64: string;
  delayTimeMs?: number;
  executionTimeMs?: number;
  seed: string;
}

export default function HomePage() {
  const [prompt, setPrompt] = useState(
    "masterpiece, best quality, 1girl, school uniform, smile, cherry blossoms",
  );
  const [negativePrompt, setNegativePrompt] = useState(
    "lowres, bad quality, worst quality, bad anatomy, deformed",
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(0);

    const start = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 500);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, negativePrompt }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(errJson.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as GenerateResult;
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-6 text-2xl font-bold">画像生成ツール</h1>

      <section className="grid gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">プロンプト</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-gray-700 bg-gray-900 p-3 text-sm"
            placeholder="masterpiece, best quality, 1girl, ..."
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">ネガティブプロンプト</span>
          <textarea
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-700 bg-gray-900 p-3 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-700"
        >
          {loading ? `生成中… ${elapsed}s` : "生成する"}
        </button>
      </section>

      {error && (
        <div className="mt-6 rounded-md border border-red-700 bg-red-950 p-4 text-sm text-red-200">
          <strong>エラー:</strong> {error}
        </div>
      )}

      {result && (
        <section className="mt-8 grid gap-4">
          <div className="rounded-md border border-gray-700 bg-gray-900 p-3 text-xs text-gray-400">
            <div>ID: {result.id}</div>
            <div>Seed: {result.seed}</div>
            <div>
              Delay: {result.delayTimeMs ?? "-"}ms / Execution: {result.executionTimeMs ?? "-"}ms
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.imageUrl}
            alt="generated"
            className="max-w-full rounded-md border border-gray-700"
          />
          <a
            href={result.imageUrl}
            download
            className="inline-block w-fit rounded-md bg-gray-800 px-4 py-2 text-sm"
          >
            画像をダウンロード
          </a>
        </section>
      )}
    </main>
  );
}
