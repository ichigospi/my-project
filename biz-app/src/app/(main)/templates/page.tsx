"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon, ICONS } from "@/components/icons";
import { AccountChips } from "@/components/FilterBar";
import { useAccounts } from "@/lib/use-dashboard-data";
import { TEMPLATE_TYPES, templateTypeLabel, categoryLabel } from "@/lib/domain";

type VersionStats = {
  sends: number;
  salesByCategory: Record<string, { amount: number; quantity: number }>;
  salesTotal: number;
};

type Version = {
  id: string;
  label: string;
  content: string;
  abGroup: string | null;
  activeFrom: string;
  activeTo: string | null;
  stats: VersionStats;
};

type Template = {
  id: string;
  accountId: string;
  type: string;
  name: string;
  account: { name: string; color: string };
  versions: Version[];
};

const inputClass =
  "w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-400";

function yen(n: number): string {
  return `¥${Math.round(n).toLocaleString("ja-JP")}`;
}

function salesQty(v: Version): number {
  return Object.values(v.stats.salesByCategory).reduce((s, x) => s + x.quantity, 0);
}

function cvRate(v: Version): number | null {
  if (v.stats.sends === 0) return null;
  return (salesQty(v) / v.stats.sends) * 100;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 10);
}

// バージョン1行分の成績表示
function VersionRow({
  version,
  template,
  onSend,
  sending,
}: {
  version: Version;
  template: Template;
  onSend: (v: Version) => void;
  sending: boolean;
}) {
  const [showContent, setShowContent] = useState(false);
  const cv = cvRate(version);
  const isActive = version.activeTo === null;

  return (
    <div className={`rounded-xl border p-4 ${isActive ? "border-violet-200 bg-violet-50/40" : "border-gray-100 bg-gray-50/50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-gray-900 text-sm">{version.label}</span>
        {version.abGroup && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
            ABテスト: {version.abGroup}
          </span>
        )}
        {isActive ? (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">運用中</span>
        ) : (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">終了</span>
        )}
        <span className="text-xs text-gray-400">
          {fmtDate(version.activeFrom)}〜{version.activeTo ? fmtDate(version.activeTo) : "現在"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setShowContent(!showContent)}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-violet-300 transition-colors"
          >
            {showContent ? "本文を隠す" : "本文を見る"}
          </button>
          <button
            onClick={() => onSend(version)}
            disabled={sending}
            className="text-xs px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 disabled:opacity-50 text-white font-medium transition-colors"
          >
            コピーして{template.type === "reading" ? "送付" : "配信"}記録
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <div className="text-[11px] text-gray-400">{template.type === "reading" ? "送付数" : "配信記録"}</div>
          <div className="text-lg font-bold text-gray-900">{version.stats.sends.toLocaleString("ja-JP")}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-400">成約数</div>
          <div className="text-lg font-bold text-gray-900">{salesQty(version).toLocaleString("ja-JP")}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-400">売上</div>
          <div className="text-lg font-bold text-gray-900">{yen(version.stats.salesTotal)}</div>
        </div>
        <div>
          <div className="text-[11px] text-gray-400">成約率（成約/送付）</div>
          <div className="text-lg font-bold text-gray-900">{cv === null ? "—" : `${cv.toFixed(1)}%`}</div>
        </div>
      </div>

      {Object.keys(version.stats.salesByCategory).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(version.stats.salesByCategory).map(([cat, v]) => (
            <span key={cat} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">
              {categoryLabel(cat)}: {v.quantity}件 / {yen(v.amount)}
            </span>
          ))}
        </div>
      )}

      {showContent && (
        <pre className="mt-3 whitespace-pre-wrap text-sm text-gray-700 bg-white border border-gray-100 rounded-xl p-4 max-h-64 overflow-y-auto font-[inherit]">
          {version.content || "（本文未登録）"}
        </pre>
      )}
    </div>
  );
}

// ABテスト中バージョンの比較表示
function AbComparison({ versions }: { versions: Version[] }) {
  const abVersions = versions.filter((v) => v.abGroup && v.activeTo === null);
  if (abVersions.length < 2) return null;

  const best = abVersions.reduce((a, b) => ((cvRate(a) ?? -1) >= (cvRate(b) ?? -1) ? a : b));

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="text-xs font-bold text-blue-700 mb-2">ABテスト比較（運用中）</div>
      <div className="flex flex-wrap gap-4">
        {abVersions.map((v) => {
          const cv = cvRate(v);
          const isBest = v.id === best.id && cv !== null;
          return (
            <div key={v.id} className={`flex-1 min-w-40 rounded-lg p-3 ${isBest ? "bg-white border-2 border-blue-400" : "bg-white border border-gray-200"}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">{v.abGroup}: {v.label}</span>
                {isBest && <span className="text-[10px] font-bold text-blue-600">リード中</span>}
              </div>
              <div className="mt-1 text-xs text-gray-500">
                送付 {v.stats.sends} → 成約 {salesQty(v)}（{cv === null ? "—" : `${cv.toFixed(1)}%`}） / {yen(v.stats.salesTotal)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const { accounts } = useAccounts();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [account, setAccount] = useState<string | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // 新規テンプレフォーム
  const [showCreate, setShowCreate] = useState(false);
  const [cName, setCName] = useState("");
  const [cType, setCType] = useState("reading");
  const [cAccount, setCAccount] = useState("");
  const [cContent, setCContent] = useState("");

  // 新バージョンフォーム（展開中テンプレ用）
  const [vLabel, setVLabel] = useState("");
  const [vAbGroup, setVAbGroup] = useState("");
  const [vContent, setVContent] = useState("");

  const reload = useCallback(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const filtered = useMemo(
    () =>
      templates.filter(
        (t) => (typeFilter === "all" || t.type === typeFilter) && (account === "all" || t.accountId === account)
      ),
    [templates, typeFilter, account]
  );

  const cAccountEffective = cAccount || accounts[0]?.id || "";

  const createTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: cAccountEffective, type: cType, name: cName, content: cContent }),
    });
    if (res.ok) {
      setCName("");
      setCContent("");
      setShowCreate(false);
      flash("テンプレを作成しました");
      reload();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "作成に失敗しました");
    }
  };

  const addVersion = async (templateId: string) => {
    if (!vContent.trim()) {
      flash("新バージョンの本文を入力してください");
      return;
    }
    const res = await fetch(`/api/templates/${templateId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: vContent, label: vLabel, abGroup: vAbGroup || null }),
    });
    if (res.ok) {
      setVLabel("");
      setVAbGroup("");
      setVContent("");
      flash(vAbGroup ? "ABテスト用バージョンを追加しました（旧版と並行運用）" : "新バージョンに切り替えました");
      reload();
    } else {
      const d = await res.json().catch(() => ({}));
      flash(d.error || "追加に失敗しました");
    }
  };

  const copyAndRecord = async (template: Template, version: Version) => {
    setSending(true);
    try {
      await navigator.clipboard.writeText(version.content);
    } catch {
      // クリップボードが使えない環境でも記録は続行
    }
    const res = await fetch("/api/templates/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateVersionId: version.id }),
    });
    setSending(false);
    if (res.ok) {
      flash(`本文をコピーし、${template.type === "reading" ? "送付" : "配信"}を1件記録しました`);
      reload();
    } else {
      flash("記録に失敗しました");
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-5 md:p-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mr-1">テンプレ管理</h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
        >
          <Icon d={ICONS.pencil} className="w-4 h-4" />
          新規テンプレ
        </button>
        {message && (
          <span className="text-sm font-medium text-violet-600 bg-violet-50 rounded-full px-4 py-1.5">{message}</span>
        )}
      </div>

      {/* 種類タブ */}
      <div className="max-w-full overflow-x-auto flex items-center bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-1 w-fit">
        {[{ key: "all", label: "すべて" }, ...TEMPLATE_TYPES].map((t) => (
          <button
            key={t.key}
            onClick={() => setTypeFilter(t.key)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              typeFilter === t.key ? "bg-violet-500 text-white" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AccountChips accounts={accounts} selected={account} onChange={setAccount} />

      {/* 新規テンプレフォーム */}
      {showCreate && (
        <form
          onSubmit={createTemplate}
          className="bg-white rounded-2xl border border-violet-200 shadow-[0_1px_3px_rgba(16,24,40,0.06)] p-6 space-y-3"
        >
          <h3 className="font-bold text-gray-900">新規テンプレ作成</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500">テンプレ名</label>
              <input type="text" required placeholder="例: 恋愛基本鑑定文" value={cName} onChange={(e) => setCName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-gray-500">種類</label>
              <select value={cType} onChange={(e) => setCType(e.target.value)} className={inputClass}>
                {TEMPLATE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">アカウント</label>
              <select value={cAccountEffective} onChange={(e) => setCAccount(e.target.value)} className={inputClass}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500">本文（鑑定文PDFの場合は本文テキスト or 保管場所メモ）</label>
            <textarea rows={5} value={cContent} onChange={(e) => setCContent(e.target.value)} className={inputClass} />
          </div>
          <button type="submit" className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors">
            作成
          </button>
        </form>
      )}

      {/* テンプレ一覧 */}
      <div className="space-y-3 pb-8">
        {filtered.length === 0 && (
          <div className="text-sm text-gray-400 py-10 text-center">
            テンプレがまだありません。「新規テンプレ」から作成してください。
          </div>
        )}
        {filtered.map((t) => {
          const latest = t.versions[t.versions.length - 1];
          const totalSends = t.versions.reduce((s, v) => s + v.stats.sends, 0);
          const totalSales = t.versions.reduce((s, v) => s + v.stats.salesTotal, 0);
          const isOpen = expanded === t.id;
          return (
            <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(16,24,40,0.06)]">
              <button
                onClick={() => setExpanded(isOpen ? null : t.id)}
                className="w-full flex flex-wrap items-center gap-3 p-5 text-left"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.account.color }} />
                <span className="font-bold text-gray-900">{t.name}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">
                  {templateTypeLabel(t.type)}
                </span>
                <span className="text-xs text-gray-400">
                  {t.versions.length}バージョン（最新: {latest?.label}）
                </span>
                <span className="ml-auto text-sm text-gray-500">
                  送付 {totalSends.toLocaleString("ja-JP")} / 売上 {yen(totalSales)}
                </span>
                <span className="text-gray-300">{isOpen ? "▲" : "▼"}</span>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 space-y-3">
                  <AbComparison versions={t.versions} />
                  {[...t.versions].reverse().map((v) => (
                    <VersionRow key={v.id} version={v} template={t} sending={sending} onSend={(ver) => copyAndRecord(t, ver)} />
                  ))}

                  {/* 新バージョン追加 */}
                  <div className="rounded-xl border border-dashed border-gray-300 p-4 space-y-3">
                    <div className="text-sm font-bold text-gray-700">新バージョンを追加</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">ラベル（任意）</label>
                        <input type="text" placeholder={`v${t.versions.length + 1}`} value={vLabel} onChange={(e) => setVLabel(e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">ABテスト</label>
                        <select value={vAbGroup} onChange={(e) => setVAbGroup(e.target.value)} className={inputClass}>
                          <option value="">なし（旧版を終了して切替）</option>
                          <option value="A">グループA（並行運用）</option>
                          <option value="B">グループB（並行運用）</option>
                        </select>
                      </div>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="新しい本文"
                      value={vContent}
                      onChange={(e) => setVContent(e.target.value)}
                      className={inputClass}
                    />
                    <button
                      onClick={() => addVersion(t.id)}
                      className="px-5 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
                    >
                      追加
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
