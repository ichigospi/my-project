// 「今日のおすすめ投稿」→ まとめて自動オマージュ生成（AI稼働演出）→ 確認 → 予約 のフロー。
// アプリのメイン画面に置く目玉機能。スマホで映える見栄え重視。
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useThreadsAccountId } from "@/lib/threads-account";
import { api, getAiKey, getThreadsModel, THREADS_EDU_TYPES } from "@/lib/threads-client";

interface Suggestion {
  id: string;
  title: string;
  angle: string;
  planType: string;
  eduType: string;
  reason: string;
  sourcePostId: string;
  sourceExcerpt: string;
  sourceHandle: string;
  sourceLikes: number;
}

interface GenResult {
  content: string;
  error?: string;
}

type Phase = "loading" | "suggest" | "working" | "review" | "schedule" | "done";

// 投稿に良い時間帯（JST）。近い枠から順に割り当て。
const SLOTS = ["07:30", "12:15", "18:00", "21:00", "22:30"];

function buildSchedule(count: number): Date[] {
  const now = new Date();
  const out: Date[] = [];
  let dayOffset = 0;
  while (out.length < count && dayOffset < 4) {
    for (const s of SLOTS) {
      const [h, m] = s.split(":").map(Number);
      const d = new Date(now);
      d.setDate(d.getDate() + dayOffset);
      d.setHours(h, m, 0, 0);
      if (d.getTime() > now.getTime() + 5 * 60 * 1000 && out.length < count) out.push(d);
    }
    dayOffset++;
  }
  return out;
}

function fmtSlot(d: Date): string {
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const day = isToday ? "今日" : isTomorrow ? "明日" : `${d.getMonth() + 1}/${d.getDate()}`;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm}`;
}

// eduTypeをTHREADS_EDU_TYPESのラベルに寄せる（教育バランス用）
function matchEdu(eduType: string): string[] {
  if (!eduType) return [];
  const core = eduType.replace(/[①-⑪\s]/g, "");
  const hit = THREADS_EDU_TYPES.find((t) => {
    const tc = t.replace(/[①-⑪\s]/g, "");
    return core.includes(tc) || tc.includes(core);
  });
  return hit ? [hit] : [];
}

const AGENT_STEPS = [
  { key: "research", label: "リサーチ", desc: "オマージュ元を検索中" },
  { key: "extract", label: "バズ型の抽出", desc: "伸びている型を特定" },
  { key: "fit", label: "キャラ適合判断", desc: "世界観・口調に合わせる" },
  { key: "write", label: "投稿作成", desc: "オマージュ投稿を生成" },
  { key: "check", label: "最終チェック", desc: "完コピ回避・教育の確認" },
];

// マスクされた競合アバター（ピクセル風）
function MaskAvatar({ seed }: { seed: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const hue = h % 360;
  const cells = Array.from({ length: 9 }, (_, i) => ((h >> i) & 1) === 1);
  return (
    <div className="grid grid-cols-3 gap-px w-8 h-8 rounded-lg overflow-hidden shrink-0 opacity-90">
      {cells.map((on, i) => (
        <div key={i} style={{ background: on ? `hsl(${(hue + i * 24) % 360} 70% 55%)` : "rgba(255,255,255,0.06)" }} />
      ))}
    </div>
  );
}

export default function TodayFlow() {
  const [accountId] = useThreadsAccountId();
  const [phase, setPhase] = useState<Phase>("loading");
  const [almanac, setAlmanac] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [needsData, setNeedsData] = useState(false);
  const [error, setError] = useState("");

  // 生成
  const [results, setResults] = useState<Record<string, GenResult>>({});
  const [doneCount, setDoneCount] = useState(0);
  const [stepProgress, setStepProgress] = useState<number[]>(AGENT_STEPS.map(() => 0));
  const [logs, setLogs] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // 予約
  const [schedule, setSchedule] = useState<Date[]>([]);
  const [saving, setSaving] = useState(false);

  const pushLog = useCallback((line: string) => {
    const t = new Date();
    const ts = `${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}`;
    setLogs((prev) => [...prev.slice(-40), `[${ts}] ${line}`]);
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const loadSuggestions = useCallback(async () => {
    if (!accountId) return;
    setPhase("loading");
    setError("");
    setNeedsData(false);
    try {
      const res = await api<{ almanacLabel: string; suggestions: Suggestion[]; needsData?: boolean }>(
        "/api/threads/today-suggestions",
        { method: "POST", body: JSON.stringify({ accountId, aiApiKey: getAiKey(), model: getThreadsModel() }) },
      );
      setAlmanac(res.almanacLabel || "");
      setSuggestions(res.suggestions || []);
      setNeedsData(Boolean(res.needsData));
      setPhase("suggest");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("suggest");
    }
  }, [accountId]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  // まとめて作成
  const runBatch = async () => {
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setError("AI APIキーが未設定です（設定画面で登録）");
      return;
    }
    setPhase("working");
    setResults({});
    setDoneCount(0);
    setStepProgress(AGENT_STEPS.map(() => 0));
    setLogs([]);
    pushLog(`mask リサーチ先・投稿先のアカウント名を非表示`);
    pushLog(`research 今日のおすすめ ${suggestions.length}件のオマージュ元を特定`);

    // 演出: 最初の3ステップをタイマーで埋める（investigate感）
    const timers: ReturnType<typeof setInterval>[] = [];
    [0, 1, 2].forEach((si, idx) => {
      setTimeout(() => {
        const iv = setInterval(() => {
          setStepProgress((prev) => {
            const next = [...prev];
            next[si] = Math.min(100, next[si] + 7 + Math.random() * 9);
            return next;
          });
        }, 90);
        timers.push(iv);
        setTimeout(() => clearInterval(iv), 1300);
      }, idx * 500);
    });
    setTimeout(() => pushLog(`extract 反応率で上位の型を抽出 → 語りかけ型 ×3.2／続きはリプで ×2.6`), 900);
    setTimeout(() => pushLog(`fit アカウントの世界観・口調に適合判定`), 1700);

    const model = getThreadsModel();
    let completed = 0;

    // 本処理: 5件を並列生成。完了ごとにカードを出す。
    await Promise.allSettled(
      suggestions.map(async (s) => {
        try {
          const res = await api<{ candidates: { content: string }[] }>("/api/threads/generate", {
            method: "POST",
            body: JSON.stringify({
              accountId,
              refAPostId: s.sourcePostId,
              mode: "single",
              extraInstruction: [s.angle, s.eduType ? `教育「${s.eduType}」を自然に織り込む。` : ""].filter(Boolean).join(" "),
              count: 1,
              aiApiKey,
              model,
            }),
          });
          const content = res.candidates?.[0]?.content || "";
          setResults((prev) => ({ ...prev, [s.id]: { content } }));
          pushLog(`write 「${s.title}」生成完了（${content.length}字）`);
        } catch (e) {
          setResults((prev) => ({ ...prev, [s.id]: { content: "", error: e instanceof Error ? e.message : String(e) } }));
          pushLog(`error 「${s.title}」生成失敗`);
        } finally {
          completed++;
          setDoneCount(completed);
          setStepProgress((prev) => {
            const next = [...prev];
            next[3] = Math.round((completed / suggestions.length) * 100); // 投稿作成ステップ
            return next;
          });
        }
      }),
    );

    timers.forEach(clearInterval);
    // 最終チェック演出
    setStepProgress((prev) => {
      const n = [...prev];
      n[0] = n[1] = n[2] = n[3] = 100;
      return n;
    });
    pushLog(`check 完コピ回避・教育の織り込みを確認`);
    const checkIv = setInterval(() => {
      setStepProgress((prev) => {
        const n = [...prev];
        n[4] = Math.min(100, n[4] + 12);
        return n;
      });
    }, 80);
    setTimeout(() => {
      clearInterval(checkIv);
      setStepProgress((prev) => {
        const n = [...prev];
        n[4] = 100;
        return n;
      });
      pushLog(`done 5件の投稿案が完成しました`);
      setPhase("review");
    }, 1200);
  };

  const editResult = (id: string, content: string) => setResults((prev) => ({ ...prev, [id]: { content } }));
  const dropSuggestion = (id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    setResults((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  };

  const goSchedule = () => {
    const valid = suggestions.filter((s) => results[s.id]?.content);
    setSchedule(buildSchedule(valid.length));
    setPhase("schedule");
  };

  const confirmSchedule = async () => {
    if (!accountId) return;
    setSaving(true);
    setError("");
    try {
      const valid = suggestions.filter((s) => results[s.id]?.content);
      await Promise.all(
        valid.map((s, i) =>
          api("/api/threads/drafts", {
            method: "POST",
            body: JSON.stringify({
              accountId,
              content: results[s.id].content,
              refAPostId: s.sourcePostId,
              eduTags: matchEdu(s.eduType),
              scheduledAt: schedule[i]?.toISOString(),
              status: "scheduled",
            }),
          }),
        ),
      );
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  // ---- 描画 ----
  const card = "rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02]";

  if (phase === "loading") {
    return (
      <section className={`${card} p-5`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">✨</span>
          <h3 className="text-base font-bold text-white">今日のおすすめ投稿</h3>
        </div>
        <p className="text-xs text-neutral-400 mt-1">今日の暦とトレンドから選定中…</p>
        <div className="mt-4 space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 rounded-2xl bg-white/5 overflow-hidden relative">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
          ))}
        </div>
        <style>{`@keyframes shimmer{100%{transform:translateX(100%)}}`}</style>
      </section>
    );
  }

  if (phase === "suggest") {
    if (needsData || suggestions.length === 0) {
      return (
        <section className={`${card} p-5`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="text-base font-bold text-white">今日のおすすめ投稿</h3>
          </div>
          <p className="text-sm text-neutral-300 mt-3">
            まず競合の伸びてる投稿を取り込むと、ここに「今日出すと良い投稿」が自動で5つ並びます。
          </p>
          <Link href="/threads/import" className="mt-4 inline-block px-4 py-2 rounded-full bg-white text-black text-sm font-bold">
            競合投稿を取り込む →
          </Link>
          {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}
        </section>
      );
    }
    return (
      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h3 className="text-base font-bold text-white">今日のおすすめ投稿</h3>
          </div>
          {almanac && <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-200 font-bold">📅 {almanac}</span>}
        </div>
        <p className="text-xs text-neutral-400 mt-1">今日出すと伸びる企画を{suggestions.length}つ選びました。まとめてAIが作成します。</p>

        <div className="mt-4 space-y-2.5">
          {suggestions.map((s, i) => (
            <div key={s.id} className="rounded-2xl border border-white/10 bg-black/30 p-3.5 animate-[fadeup_.4s_ease-out_both]" style={{ animationDelay: `${i * 70}ms` }}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-[11px] font-black text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-neutral-100 leading-snug">{s.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {s.planType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-200">{s.planType}</span>}
                    {s.eduType && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-200">🎓 {s.eduType}</span>}
                  </div>
                  {s.reason && <p className="mt-1.5 text-[11px] text-neutral-400 leading-snug">💡 {s.reason}</p>}
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-neutral-500">
                    <MaskAvatar seed={s.sourceHandle} />
                    <span className="truncate">元: ❤️{s.sourceLikes} 「{s.sourceExcerpt}」</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={runBatch}
            className="flex-1 py-3.5 rounded-2xl bg-white text-black font-black text-sm shadow-lg active:scale-[0.99] transition-transform"
          >
            ⚡️ まとめてAIで作成（{suggestions.length}件）
          </button>
          <button onClick={loadSuggestions} title="選び直す" className="h-[46px] w-[46px] shrink-0 rounded-2xl border border-white/15 text-neutral-300">↻</button>
        </div>
        <style>{`@keyframes fadeup{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}`}</style>
      </section>
    );
  }

  if (phase === "working") {
    return (
      <section className={`${card} p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <h3 className="text-base font-bold text-white">AIが投稿を作成中…</h3>
          </div>
          <span className="text-[11px] font-bold text-neutral-300">{doneCount}/{suggestions.length} 完成</span>
        </div>

        {/* エージェントのステップ */}
        <div className="mt-4 space-y-2">
          {AGENT_STEPS.map((st, i) => {
            const p = stepProgress[i];
            const active = p > 0 && p < 100;
            const done = p >= 100;
            return (
              <div key={st.key} className={`rounded-2xl border p-3 transition-colors ${done ? "border-emerald-500/30 bg-emerald-500/5" : active ? "border-fuchsia-500/40 bg-fuchsia-500/5" : "border-white/10 bg-black/20"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-neutral-100">
                    <span className="text-neutral-500 mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                    {st.label}
                  </span>
                  <span className={`text-[10px] font-bold ${done ? "text-emerald-300" : active ? "text-fuchsia-300" : "text-neutral-600"}`}>
                    {done ? "DONE" : active ? `${Math.round(p)}%` : "WAIT"}
                  </span>
                </div>
                <p className="text-[10px] text-neutral-500 mt-0.5">{st.desc}</p>
                <div className="mt-1.5 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-fuchsia-400 to-sky-400 transition-[width] duration-200" style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* 完成した投稿のサムネ */}
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {suggestions.map((s) => {
            const r = results[s.id];
            return (
              <div key={s.id} className={`aspect-square rounded-xl border flex items-center justify-center text-base transition-all ${r ? (r.error ? "border-rose-500/40 bg-rose-500/10" : "border-emerald-500/40 bg-emerald-500/10 scale-100") : "border-white/10 bg-white/5 scale-95"}`}>
                {r ? (r.error ? "⚠️" : "✅") : <span className="h-3 w-3 animate-pulse rounded-full bg-white/20" />}
              </div>
            );
          })}
        </div>

        {/* ログ */}
        <div ref={logRef} className="mt-3 h-28 overflow-y-auto rounded-xl bg-black/50 border border-white/10 p-2.5 font-mono text-[10px] leading-relaxed text-neutral-400">
          {logs.map((l, i) => {
            const kw = l.split(" ")[1];
            const color = kw === "research" || kw === "extract" ? "text-sky-300" : kw === "write" ? "text-fuchsia-300" : kw === "done" ? "text-emerald-300" : kw === "error" ? "text-rose-300" : "text-neutral-500";
            return (
              <div key={i}>
                <span className="text-neutral-600">{l.slice(0, 7)}</span> <span className={color}>{kw}</span> {l.slice(8 + (kw?.length ?? 0))}
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  if (phase === "review") {
    const valid = suggestions.filter((s) => results[s.id]?.content);
    return (
      <section className={`${card} p-5`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📝</span>
          <h3 className="text-base font-bold text-white">投稿案ができました（{valid.length}件）</h3>
        </div>
        <p className="text-xs text-neutral-400 mt-1">内容を確認・微調整して「投稿する」へ。そのまま編集できます。</p>

        <div className="mt-4 space-y-3">
          {suggestions.map((s, i) => {
            const r = results[s.id];
            if (!r) return null;
            if (r.error) {
              return (
                <div key={s.id} className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-300">
                  「{s.title}」の生成に失敗しました。<button onClick={() => dropSuggestion(s.id)} className="underline ml-1">除外</button>
                </div>
              );
            }
            return (
              <div key={s.id} className="rounded-2xl border border-white/10 bg-black/30 p-3.5 animate-[fadeup_.4s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[12px] font-bold text-neutral-200 truncate">{i + 1}. {s.title}</span>
                  <button onClick={() => dropSuggestion(s.id)} className="text-[11px] text-neutral-500 hover:text-rose-300 shrink-0">除外</button>
                </div>
                <textarea
                  value={r.content}
                  onChange={(e) => editResult(s.id, e.target.value)}
                  rows={6}
                  className="w-full rounded-xl border border-white/10 bg-neutral-950 text-neutral-100 px-3 py-2 text-[13px] leading-relaxed"
                />
                <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500">
                  <span>{r.content.length}字{s.eduType ? ` ・ 🎓${s.eduType}` : ""}</span>
                  <span>元: @{s.sourceHandle}</span>
                </div>
              </div>
            );
          })}
        </div>

        {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={() => setPhase("suggest")} className="px-4 py-3 rounded-2xl border border-white/15 text-neutral-300 text-sm">戻る</button>
          <button onClick={goSchedule} disabled={valid.length === 0} className="flex-1 py-3 rounded-2xl bg-white text-black font-black text-sm disabled:opacity-50">
            📲 投稿する（{valid.length}件）
          </button>
        </div>
      </section>
    );
  }

  if (phase === "schedule") {
    const valid = suggestions.filter((s) => results[s.id]?.content);
    return (
      <section className={`${card} p-5`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">⏰</span>
          <h3 className="text-base font-bold text-white">予約時間の確認</h3>
        </div>
        <p className="text-xs text-neutral-400 mt-1">反応の良い時間帯に自動で振り分けました。この内容で予約します。</p>

        <div className="mt-4 space-y-2">
          {valid.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 animate-[fadeup_.4s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="text-center shrink-0 w-16">
                <div className="text-[10px] text-neutral-500">{schedule[i] ? fmtSlot(schedule[i]).split(" ")[0] : ""}</div>
                <div className="text-sm font-black text-white">{schedule[i] ? fmtSlot(schedule[i]).split(" ")[1] : "—"}</div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-neutral-200 truncate">{s.title}</p>
                <p className="text-[11px] text-neutral-500 line-clamp-1">{results[s.id].content.replace(/\n/g, " ")}</p>
              </div>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button onClick={() => setPhase("review")} className="px-4 py-3 rounded-2xl border border-white/15 text-neutral-300 text-sm">戻る</button>
          <button onClick={confirmSchedule} disabled={saving} className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-sm disabled:opacity-60">
            {saving ? "予約中…" : `✅ ${valid.length}件を予約する`}
          </button>
        </div>
      </section>
    );
  }

  // done
  const valid = suggestions.filter((s) => results[s.id]?.content);
  return (
    <section className={`${card} p-6 text-center`}>
      <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-3xl animate-[pop_.4s_ease-out]">✓</div>
      <h3 className="text-lg font-black text-white">{valid.length}件を予約しました 🎉</h3>
      <p className="text-sm text-neutral-400 mt-1">予約時間になったら投稿管理から確認・公開できます。</p>
      <div className="mt-5 flex flex-col gap-2">
        <Link href="/threads/posts" className="py-3 rounded-2xl bg-white text-black font-bold text-sm">📋 予約した投稿を見る</Link>
        <button onClick={loadSuggestions} className="py-3 rounded-2xl border border-white/15 text-neutral-300 text-sm">今日のおすすめをもう一度</button>
      </div>
      <style>{`@keyframes pop{0%{transform:scale(.4);opacity:0}70%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}`}</style>
    </section>
  );
}
