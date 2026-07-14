"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon, ICONS } from "@/components/icons";

type Report = {
  id: string;
  createdAt: string;
  content: string;
  feedback: string;
};

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400";

// マークダウンの見出しと箇条書きだけ軽く整形して表示する
function ReportBody({ content }: { content: string }) {
  return (
    <div className="space-y-1.5 text-sm text-gray-700 leading-relaxed">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h4 key={i} className="text-base font-bold text-gray-900 mt-4 first:mt-0">
              {line.slice(3)}
            </h4>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h5 key={i} className="text-sm font-bold text-gray-800 mt-3">
              {line.slice(4)}
            </h5>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-violet-400 shrink-0">•</span>
              <span>{line.slice(2).replace(/\*\*(.+?)\*\*/g, "$1")}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i}>{line.replace(/\*\*(.+?)\*\*/g, "$1")}</p>;
      })}
    </div>
  );
}

function ReportCard({ report, onSaved, onDeleted }: { report: Report; onSaved: () => void; onDeleted: () => void }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(report.feedback);
  const [saving, setSaving] = useState(false);

  const saveFeedback = async () => {
    setSaving(true);
    await fetch(`/api/ai/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback }),
    });
    setSaving(false);
    onSaved();
  };

  const remove = async () => {
    if (!confirm("このレポートを削除しますか？")) return;
    await fetch(`/api/ai/${report.id}`, { method: "DELETE" });
    onDeleted();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-5 text-left">
        <span className="text-violet-500">
          <Icon d={ICONS.chart} className="w-5 h-5" />
        </span>
        <span className="font-bold text-gray-900">{report.createdAt.slice(0, 16).replace("T", " ")} の分析</span>
        {report.feedback && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
            フィードバック済み
          </span>
        )}
        <span className="ml-auto text-gray-300">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          <ReportBody content={report.content} />
          <div className="rounded-xl border border-dashed border-gray-300 p-4 space-y-2">
            <div className="text-sm font-bold text-gray-700">この分析へのフィードバック</div>
            <p className="text-xs text-gray-400">
              「この施策は効いた/合わなかった」「実際はこうだった」等を残すと、次回の分析がそれを踏まえて賢くなります。
            </p>
            <textarea
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="例: 提案どおり鑑定文のアップセル導線を変えたら成約率が2pt上がった。ローンチ頻度の提案は現実的でないので不要。"
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                onClick={saveFeedback}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {saving ? "保存中..." : "保存"}
              </button>
              <button onClick={remove} className="px-4 py-1.5 rounded-lg text-sm text-gray-400 hover:text-red-500 transition-colors">
                レポートを削除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AiPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [hasApiKey, setHasApiKey] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => {
        setReports(d.reports ?? []);
        setHasApiKey(!!d.hasApiKey);
      })
      .catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 5000);
  };

  const saveKey = async () => {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    if (res.ok) {
      setApiKey("");
      flash("APIキーを保存しました");
      reload();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "保存に失敗しました");
    }
  };

  const run = async () => {
    setRunning(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setRunning(false);
    if (res.ok) {
      flash("分析が完了しました");
      reload();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "分析に失敗しました");
    }
  };

  return (
    <div className="max-w-[900px] mx-auto p-5 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mr-1">AI分析</h2>
        <button
          onClick={run}
          disabled={running || !hasApiKey}
          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
        >
          <Icon d={ICONS.refresh} className={`w-4 h-4 ${running ? "animate-spin" : ""}`} />
          {running ? "分析中...（1〜3分かかります）" : "分析を実行"}
        </button>
        {message && (
          <span className="text-sm font-medium text-violet-600 bg-violet-50 rounded-full px-4 py-1.5">{message}</span>
        )}
      </div>

      <p className="text-sm text-gray-500">
        全アカウントのファネル実績・テンプレ成績・ローンチ結果を、スピリチュアル系ビジネス専門のマーケター視点で分析します。
        過去のレポートとあなたのフィードバックも毎回参照するため、使うほど提案の精度が上がります。
      </p>

      {!hasApiKey && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-600 font-bold">
            <Icon d={ICONS.warn} className="w-5 h-5" />
            AI APIキーが未設定です
          </div>
          <p className="text-sm text-gray-500">
            Anthropic（Claude）のAPIキーを設定してください。
            <a href="https://platform.claude.com/" target="_blank" rel="noreferrer" className="text-violet-600 hover:underline ml-1">
              platform.claude.com
            </a>
            で取得できます。
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={inputClass}
            />
            <button
              onClick={saveKey}
              disabled={!apiKey.trim()}
              className="shrink-0 px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              保存
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 pb-8">
        {reports.length === 0 && (
          <div className="text-sm text-gray-400 py-10 text-center">
            まだ分析レポートがありません。「分析を実行」を押してください。
          </div>
        )}
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} onSaved={reload} onDeleted={reload} />
        ))}
      </div>
    </div>
  );
}
