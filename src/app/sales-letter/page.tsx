"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getApiKey } from "@/lib/settings-store";
import { searchKnowledge } from "@/lib/knowledge-store";

interface SalesMsg {
  id: string;
  sequenceOrder: number;
  dayOffset: number;
  phase: string;
  subject: string;
  body: string;
  cta: string;
  ctaUrl: string;
  psychologyTriggers: string[];
  status: string;
  notes: string;
}

interface SalesLetterData {
  id: string;
  title: string;
  productName: string;
  productPrice: number | null;
  targetPersona: string;
  fortuneType: string;
  launchType: string;
  totalDays: number;
  status: string;
  messages: SalesMsg[];
  createdAt: string;
}

const STORAGE_KEY = "sales_letters";
const uid = () => "sl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const PHASE_LABELS: Record<string, string> = {
  pre_pre: "プリプリ", pre: "プリローンチ", launch: "ローンチ", post: "ポスト",
};
const PHASE_COLORS: Record<string, string> = {
  pre_pre: "bg-gray-100 text-gray-700", pre: "bg-blue-100 text-blue-700",
  launch: "bg-purple-100 text-purple-700", post: "bg-green-100 text-green-700",
};
const LAUNCH_OPTIONS = [
  { value: "product_launch", label: "プロダクトローンチ", desc: "7-14日間の段階的配信" },
  { value: "evergreen", label: "エバーグリーン", desc: "自動配信（常時稼働）" },
  { value: "webinar", label: "ウェビナー", desc: "3-5日間の短期集中" },
  { value: "challenge", label: "チャレンジ", desc: "5-7日間の体験型" },
];
const FORTUNE_TYPES = ["タロット", "西洋占星術", "数秘術", "四柱推命", "霊感・チャネリング", "オラクルカード"];
const STATUS_LABELS: Record<string, string> = {
  draft: "下書き", generating: "生成中", review: "確認中", exported: "エクスポート済み",
};

function load(): SalesLetterData[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function save(data: SalesLetterData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function SalesLetterPage() {
  const [letters, setLetters] = useState<SalesLetterData[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [step, setStep] = useState(0); // 0=list, 1=product, 2=launch, 3=generate, 4=edit
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [fortuneType, setFortuneType] = useState("");
  const [targetPersona, setTargetPersona] = useState("");
  const [launchType, setLaunchType] = useState("product_launch");
  const [totalDays, setTotalDays] = useState(7);

  useEffect(() => { setLetters(load()); }, []);

  const current = letters.find((l) => l.id === selected);

  const startNew = () => {
    setProductName(""); setProductPrice(""); setFortuneType(""); setTargetPersona("");
    setLaunchType("product_launch"); setTotalDays(7); setStep(1); setSelected(null); setError("");
  };

  const goStep2 = () => {
    if (!productName.trim()) { setError("商品名を入力してください"); return; }
    setError(""); setStep(2);
  };

  const generateMessages = async () => {
    setLoading(true); setError("");
    const apiKey = getApiKey("ai_api_key");
    if (!apiKey) { setError("設定からAI APIキーを登録してください"); setLoading(false); return; }

    const knowledgeChunks = searchKnowledge("セールスレター ローンチ コピーライティング LINE配信", ["コピーライティング", "ローンチ", "セールス"]);
    const knowledgeContext = knowledgeChunks.map((c) => c.content).join("\n---\n").slice(0, 3000);

    try {
      const res = await fetch("/api/sales-letter/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName, productPrice: productPrice ? Number(productPrice) : null,
          fortuneType, targetPersona, launchType, totalDays, apiKey, knowledgeContext,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const newLetter: SalesLetterData = {
        id: uid(), title: `${productName} セールスレター`,
        productName, productPrice: productPrice ? Number(productPrice) : null,
        targetPersona, fortuneType, launchType, totalDays, status: "review",
        messages: data.messages.map((m: Partial<SalesMsg>, i: number) => ({
          id: uid(), sequenceOrder: m.sequenceOrder ?? i + 1,
          dayOffset: m.dayOffset ?? i, phase: m.phase || "launch",
          subject: m.subject || "", body: m.body || "",
          cta: m.cta || "", ctaUrl: m.ctaUrl || "",
          psychologyTriggers: m.psychologyTriggers || [], status: "draft", notes: "",
        })),
        createdAt: new Date().toISOString(),
      };
      const updated = [...letters, newLetter];
      setLetters(updated); save(updated);
      setSelected(newLetter.id); setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成エラー");
    } finally { setLoading(false); }
  };

  const updateMessage = (msgId: string, field: string, value: string) => {
    if (!current) return;
    const updated = letters.map((l) => {
      if (l.id !== current.id) return l;
      return { ...l, messages: l.messages.map((m) => m.id === msgId ? { ...m, [field]: value } : m) };
    });
    setLetters(updated); save(updated);
  };

  const moveMessage = (msgId: string, dir: -1 | 1) => {
    if (!current) return;
    const msgs = [...current.messages];
    const idx = msgs.findIndex((m) => m.id === msgId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= msgs.length) return;
    [msgs[idx], msgs[newIdx]] = [msgs[newIdx], msgs[idx]];
    msgs.forEach((m, i) => { m.sequenceOrder = i + 1; });
    const updated = letters.map((l) => l.id === current.id ? { ...l, messages: msgs } : l);
    setLetters(updated); save(updated);
  };

  const exportText = () => {
    if (!current) return;
    const text = current.messages.map((m) =>
      `=== Day ${m.dayOffset} [${PHASE_LABELS[m.phase] || m.phase}] ===\n${m.subject}\n\n${m.body}\n\n${m.cta ? `CTA: ${m.cta}` : ""}`
    ).join("\n\n" + "─".repeat(40) + "\n\n");
    navigator.clipboard.writeText(text);
    const updated = letters.map((l) => l.id === current.id ? { ...l, status: "exported" } : l);
    setLetters(updated); save(updated);
  };

  const exportCsv = () => {
    if (!current) return;
    const header = "配信順,日数オフセット,フェーズ,件名,本文,CTA\n";
    const rows = current.messages.map((m) =>
      [m.sequenceOrder, m.dayOffset, PHASE_LABELS[m.phase] || m.phase, `"${m.subject}"`, `"${m.body.replace(/"/g, '""')}"`, `"${m.cta}"`].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${current.productName}_sales_letter.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const deleteLetter = (id: string) => {
    const updated = letters.filter((l) => l.id !== id);
    setLetters(updated); save(updated);
    if (selected === id) { setSelected(null); setStep(0); }
  };

  // ===== Step indicator =====
  const StepIndicator = ({ current: s }: { current: number }) => {
    const steps = ["商品設定", "ローンチ方式", "AI生成", "編集・確認"];
    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              i + 1 <= s ? "bg-accent text-white" : "bg-gray-200 text-gray-500"
            }`}>{i + 1}</div>
            <span className={`text-xs ${i + 1 <= s ? "text-accent font-medium" : "text-gray-400"}`}>{label}</span>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i + 1 < s ? "bg-accent" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>
    );
  };

  // ===== List view =====
  if (step === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">セールスレター作成</h1>
            <p className="text-sm text-gray-500 mt-1">LINE配信シナリオをAIで一括生成</p>
          </div>
          <button onClick={startNew}
            className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">
            + 新規作成
          </button>
        </div>

        {letters.length === 0 ? (
          <div className="bg-card-bg rounded-xl p-12 text-center border border-gray-100">
            <p className="text-gray-400 mb-4">セールスレターがありません</p>
            <button onClick={startNew} className="text-accent hover:underline text-sm">最初のレターを作成する</button>
          </div>
        ) : (
          <div className="grid gap-4">
            {letters.map((l) => (
              <div key={l.id} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="cursor-pointer flex-1" onClick={() => { setSelected(l.id); setStep(4); }}>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{l.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      l.status === "exported" ? "bg-green-100 text-green-700" :
                      l.status === "review" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                    }`}>{STATUS_LABELS[l.status] || l.status}</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{l.messages.length}通 · {l.fortuneType || "未指定"} · {new Date(l.createdAt).toLocaleDateString("ja-JP")}</p>
                </div>
                <button onClick={() => deleteLetter(l.id)} className="text-gray-400 hover:text-red-500 text-lg ml-4">&times;</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ===== Wizard steps =====
  return (
    <div className="p-8 max-w-3xl mx-auto">
      <button onClick={() => { setStep(0); setSelected(null); }} className="text-sm text-gray-500 hover:text-accent mb-4 inline-block">&larr; 一覧に戻る</button>
      {step < 4 && <StepIndicator current={step} />}

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">{error}</div>}

      {/* Step 1: 商品設定 */}
      {step === 1 && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-lg font-semibold">Step 1: 商品設定</h2>
          <div>
            <label className="block text-sm text-gray-600 mb-1">商品名 *</label>
            <input value={productName} onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" placeholder="例: 宇宙からのメッセージ講座" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">価格（円）</label>
            <input type="number" value={productPrice} onChange={(e) => setProductPrice(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" placeholder="例: 198000" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">占術ジャンル</label>
            <select value={fortuneType} onChange={(e) => setFortuneType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm">
              <option value="">選択してください</option>
              {FORTUNE_TYPES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">ターゲット像</label>
            <textarea value={targetPersona} onChange={(e) => setTargetPersona(e.target.value)} rows={3}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm resize-none"
              placeholder="例: 30-50代女性、人生の転機にいる、占いに興味はあるが本格的に学んだことはない" />
          </div>
          <div className="flex justify-end">
            <button onClick={goStep2} className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">次へ</button>
          </div>
        </div>
      )}

      {/* Step 2: ローンチ方式 */}
      {step === 2 && (
        <div className="bg-card-bg rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-lg font-semibold">Step 2: ローンチ方式</h2>
          <div className="grid grid-cols-2 gap-3">
            {LAUNCH_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setLaunchType(opt.value)}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  launchType === opt.value ? "border-accent bg-accent/5" : "border-gray-200 hover:border-gray-300"
                }`}>
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">配信日数</label>
            <input type="number" value={totalDays} onChange={(e) => setTotalDays(Number(e.target.value))} min={1} max={30}
              className="w-32 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm" />
            <span className="text-sm text-gray-500 ml-2">日間</span>
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep(1)} className="px-6 py-2.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">戻る</button>
            <button onClick={() => { setStep(3); generateMessages(); }}
              className="px-6 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">AI一括生成</button>
          </div>
        </div>
      )}

      {/* Step 3: Generating */}
      {step === 3 && (
        <div className="bg-card-bg rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <div className="animate-spin w-10 h-10 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">AI がセールスレターを生成中...</p>
          <p className="text-xs text-gray-400 mt-2">教材ナレッジも参照しています</p>
        </div>
      )}

      {/* Step 4: Edit */}
      {step === 4 && current && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{current.title}</h2>
            <div className="flex gap-2">
              <button onClick={exportText} className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">テキストコピー</button>
              <button onClick={exportCsv} className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">CSVダウンロード</button>
            </div>
          </div>

          <div className="text-sm text-gray-500">
            {current.productName} · {current.fortuneType || "未指定"} · {current.messages.length}通 · {current.totalDays}日間
          </div>

          {current.messages.map((msg, idx) => (
            <div key={msg.id} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-7 h-7 rounded-full bg-accent/10 text-accent text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${PHASE_COLORS[msg.phase] || "bg-gray-100 text-gray-600"}`}>
                  {PHASE_LABELS[msg.phase] || msg.phase}
                </span>
                <span className="text-xs text-gray-400">Day {msg.dayOffset}</span>
                <div className="ml-auto flex gap-1">
                  <button onClick={() => moveMessage(msg.id, -1)} disabled={idx === 0}
                    className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-30 hover:bg-gray-50">&uarr;</button>
                  <button onClick={() => moveMessage(msg.id, 1)} disabled={idx === current.messages.length - 1}
                    className="px-2 py-1 rounded border border-gray-200 text-xs disabled:opacity-30 hover:bg-gray-50">&darr;</button>
                </div>
              </div>
              <input value={msg.subject} onChange={(e) => updateMessage(msg.id, "subject", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium mb-2 outline-none focus:border-accent" placeholder="件名" />
              <textarea value={msg.body} onChange={(e) => updateMessage(msg.id, "body", e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2 outline-none focus:border-accent resize-none" />
              <input value={msg.cta} onChange={(e) => updateMessage(msg.id, "cta", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent" placeholder="CTA文面" />
              {msg.psychologyTriggers.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {msg.psychologyTriggers.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-xs">{t}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
