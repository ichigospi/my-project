"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useThreadsAccountId } from "@/lib/threads-account";
import {
  api,
  fmtNum,
  getAiKey,
  getThreadsModel,
  setThreadsModel,
  parseSnapshot,
  THREADS_AI_MODELS,
  type ThreadsAiModel,
  type RefSnapshotView,
} from "@/lib/threads-client";

interface CompetitorPost {
  id: string;
  content: string;
  likes: number;
  replies: number;
  views: number;
  planType: string;
  hookType: string;
  isHot: boolean;
  competitor: { handle: string };
}

interface LibraryItem {
  id: string;
  type: string;
  title: string;
  content: string;
  strength: number;
}

interface Similarity {
  overall: number;
  maxLine: number;
  worstLine: string;
  isCopyRisk: boolean;
}

interface Candidate {
  content: string;
  mapping: string;
  usedHook: string;
  similarity: { refA: Similarity; refB: Similarity | null };
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

interface Draft {
  id: string;
  content: string;
  refASnapshot: string;
  refBSnapshot: string;
  status: string;
}

function CreateContent() {
  const [accountId] = useThreadsAccountId();
  const searchParams = useSearchParams();

  // 参考投稿
  const [refA, setRefA] = useState<CompetitorPost | null>(null);
  const [refB, setRefB] = useState<CompetitorPost | null>(null);
  const [pickerFor, setPickerFor] = useState<"A" | "B" | null>(null);

  // 生成設定
  const [mode, setMode] = useState<"single" | "hybrid" | "custom">("single");
  const [modeInstruction, setModeInstruction] = useState("");
  const [extraInstruction, setExtraInstruction] = useState("");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [selectedLib, setSelectedLib] = useState<Set<string>>(new Set());
  const [model, setModel] = useState<ThreadsAiModel>("claude-sonnet-4-6");
  const [generating, setGenerating] = useState(false);

  // 生成結果
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savedDraft, setSavedDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  // 壁打ち
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    setModel(getThreadsModel());
  }, []);

  // クエリの refA/refB/draftId を初期ロード
  useEffect(() => {
    const refAId = searchParams.get("refA");
    const refBId = searchParams.get("refB");
    const draftId = searchParams.get("draftId");
    const loadPost = async (id: string): Promise<CompetitorPost | null> => {
      try {
        return await api<CompetitorPost>(`/api/threads/competitor-posts/${id}`);
      } catch {
        return null;
      }
    };
    (async () => {
      if (refAId) setRefA(await loadPost(refAId));
      if (refBId) setRefB(await loadPost(refBId));
      if (draftId) {
        try {
          const d = await api<Draft>(`/api/threads/drafts/${draftId}`);
          setSavedDraft(d);
          setEditContent(d.content);
          setPicked(0);
        } catch {
          // ignore
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ライブラリ読み込み
  useEffect(() => {
    if (!accountId) return;
    api<LibraryItem[]>(`/api/threads/library?accountId=${accountId}`)
      .then(setLibrary)
      .catch(() => {});
  }, [accountId]);

  // チャット履歴読み込み
  const loadChat = useCallback(async () => {
    if (!savedDraft) return;
    try {
      setChatMessages(await api<ChatMessage[]>(`/api/threads/drafts/${savedDraft.id}/chat`));
    } catch {
      // ignore
    }
  }, [savedDraft]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const generate = async () => {
    if (!refA) {
      setError("参考投稿Aを選択してください");
      return;
    }
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setError("AI APIキーが未設定です。設定ページで登録してください。");
      return;
    }
    setGenerating(true);
    setError("");
    setCandidates([]);
    setPicked(null);
    try {
      const res = await api<{ candidates: Candidate[] }>("/api/threads/generate", {
        method: "POST",
        body: JSON.stringify({
          accountId,
          refAPostId: refA.id,
          refBPostId: refB?.id,
          mode: refB ? mode : "single",
          modeInstruction,
          libraryItemIds: Array.from(selectedLib),
          extraInstruction,
          count: 3,
          aiApiKey,
          model,
        }),
      });
      setCandidates(res.candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  const pickCandidate = (i: number) => {
    setPicked(i);
    setEditContent(candidates[i].content);
  };

  const saveDraft = async () => {
    if (!editContent.trim() || !accountId) return;
    setSaving(true);
    setError("");
    try {
      if (savedDraft) {
        await api(`/api/threads/drafts/${savedDraft.id}`, { method: "PATCH", body: JSON.stringify({ content: editContent }) });
        setSavedDraft({ ...savedDraft, content: editContent });
      } else {
        const meta = picked !== null && candidates[picked] ? { mapping: candidates[picked].mapping, model, mode } : { model };
        const d = await api<Draft>("/api/threads/drafts", {
          method: "POST",
          body: JSON.stringify({
            accountId,
            content: editContent,
            refAPostId: refA?.id,
            refBPostId: refB?.id,
            generationMeta: meta,
          }),
        });
        setSavedDraft(d);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const sendChat = async () => {
    if (!savedDraft || !chatInput.trim() || chatSending) return;
    const aiApiKey = getAiKey();
    if (!aiApiKey) {
      setError("AI APIキーが未設定です");
      return;
    }
    const message = chatInput;
    setChatInput("");
    setChatSending(true);
    setChatMessages((prev) => [...prev, { id: "tmp", role: "user", content: message }]);
    try {
      await api(`/api/threads/drafts/${savedDraft.id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message, aiApiKey, model }),
      });
      await loadChat();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChatSending(false);
    }
  };

  // チャット返信中のコードブロックを投稿案に反映
  const applyFromChat = (content: string) => {
    const match = content.match(/```(?:\w*\n)?([\s\S]*?)```/);
    if (match) {
      setEditContent(match[1].trim());
    }
  };

  const refCard = (label: "A" | "B", post: CompetitorPost | null, snapshotFallback?: RefSnapshotView | null) => {
    const p = post ?? snapshotFallback;
    return (
      <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-neutral-300">参考投稿{label}{label === "B" ? "（任意）" : ""}</span>
          <div className="flex gap-1.5">
            <button onClick={() => setPickerFor(label)} className="text-[11px] px-2 py-1 rounded border border-neutral-600 text-neutral-200 hover:bg-neutral-800">
              {p ? "変更" : "選択"}
            </button>
            {post && label === "B" && (
              <button onClick={() => setRefB(null)} className="text-[11px] px-2 py-1 rounded border border-neutral-700 text-neutral-400 hover:bg-neutral-800">
                外す
              </button>
            )}
          </div>
        </div>
        {p ? (
          <div className="mt-2">
            <div className="text-[11px] text-neutral-500">
              @{"competitor" in (p as CompetitorPost) ? (p as CompetitorPost).competitor?.handle : (p as RefSnapshotView).authorHandle}
              {" ・ "}❤️{fmtNum(p.likes ?? 0)} 💬{fmtNum(p.replies ?? 0)}
            </div>
            <p className="text-xs text-neutral-200 mt-1 whitespace-pre-wrap max-h-40 overflow-y-auto">{p.content}</p>
          </div>
        ) : (
          <p className="text-xs text-neutral-500 mt-2">{label === "A" ? "オマージュ元の投稿を選択してください" : "2つ目を選ぶとハイブリッド合成ができます"}</p>
        )}
      </div>
    );
  };

  const libByType = (t: string) => library.filter((l) => l.type === t);
  const savedRefA = savedDraft ? parseSnapshot(savedDraft.refASnapshot) : null;
  const savedRefB = savedDraft ? parseSnapshot(savedDraft.refBSnapshot) : null;

  return (
    <main className="px-4 md:px-6 py-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-bold text-neutral-100">オマージュ作成</h2>
          <p className="text-xs text-neutral-400">参考投稿の型を保ったまま、自アカ文脈に置き換えた投稿案を生成します。</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-neutral-400">
          モデル:
          <select
            value={model}
            onChange={(e) => {
              const m = e.target.value as ThreadsAiModel;
              setModel(m);
              setThreadsModel(m);
            }}
            className="border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5"
          >
            {THREADS_AI_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-sm text-rose-700 mb-4">{error}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        {/* 左: 参考投稿 + 生成設定 */}
        <div className="space-y-3">
          {refCard("A", refA, savedRefA)}
          {refCard("B", refB, savedRefB)}

          {refB && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 space-y-2">
              <span className="text-xs font-bold text-neutral-300">合成モード</span>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { v: "single", label: "Aの型を踏襲" },
                  { v: "hybrid", label: "A×Bハイブリッド" },
                  { v: "custom", label: "自由指定" },
                ] as const).map((m) => (
                  <button
                    key={m.v}
                    onClick={() => setMode(m.v)}
                    className={`text-[11px] px-2 py-1 rounded-lg ${mode === m.v ? "bg-white text-black" : "bg-neutral-800 text-neutral-400"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {mode !== "single" && (
                <textarea
                  value={modeInstruction}
                  onChange={(e) => setModeInstruction(e.target.value)}
                  rows={2}
                  className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-xs"
                  placeholder={mode === "hybrid" ? "例: Aの本文骨格にBのフックを移植" : "自由に指定"}
                />
              )}
            </div>
          )}

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 space-y-2">
            <span className="text-xs font-bold text-neutral-300">ライブラリ差し替え（任意）</span>
            {(["hook", "plan", "cta"] as const).map((t) => {
              const items = libByType(t);
              if (items.length === 0) return null;
              const label = t === "hook" ? "🧲 フック" : t === "plan" ? "💡 企画" : "📣 CTA";
              return (
                <div key={t}>
                  <span className="text-[11px] text-neutral-500">{label}</span>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          const next = new Set(selectedLib);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          setSelectedLib(next);
                        }}
                        title={item.content}
                        className={`text-[11px] px-2 py-1 rounded-lg border ${selectedLib.has(item.id) ? "bg-white text-black border-white" : "bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500"}`}
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {library.length === 0 && (
              <p className="text-[11px] text-neutral-500">
                <Link href="/threads/library" className="text-sky-400 underline">ライブラリ</Link>に登録すると、生成時にフック等を差し替えられます。
              </p>
            )}
          </div>

          <div className="bg-neutral-900 rounded-xl border border-neutral-800 p-3 space-y-2">
            <span className="text-xs font-bold text-neutral-300">追加指示（任意）</span>
            <textarea
              value={extraInstruction}
              onChange={(e) => setExtraInstruction(e.target.value)}
              rows={2}
              className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-1.5 text-xs"
              placeholder="例: 神社ネタに置き換える / 数字は控えめに"
            />
          </div>

          <button
            onClick={generate}
            disabled={generating || !refA}
            className="w-full py-2.5 rounded-xl bg-white text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50"
          >
            {generating ? "生成中...（数十秒かかります）" : "🚀 オマージュ生成（3案）"}
          </button>
        </div>

        {/* 中央: 生成結果 */}
        <div className="space-y-3">
          {candidates.length === 0 && picked === null && (
            <div className="bg-neutral-900 rounded-xl border border-dashed border-neutral-700 p-8 text-center text-sm text-neutral-500">
              参考投稿を選んで生成すると、ここに投稿案が3つ表示されます
            </div>
          )}
          {candidates.map((c, i) => {
            const simA = c.similarity.refA;
            const risky = simA.isCopyRisk || c.similarity.refB?.isCopyRisk;
            return (
              <div
                key={i}
                onClick={() => pickCandidate(i)}
                className={`bg-neutral-900 rounded-xl border p-3 cursor-pointer transition-all ${picked === i ? "border-neutral-400 ring-1 ring-neutral-600" : "border-neutral-800 hover:border-neutral-600"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300">案{i + 1}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${risky ? "bg-rose-500/20 text-rose-300 font-bold" : "bg-emerald-500/20 text-emerald-300"}`}>
                    {risky ? "⚠️ 完コピ注意" : `類似度 ${Math.round(simA.overall * 100)}%`}
                  </span>
                </div>
                <p className="text-xs text-neutral-200 mt-2 whitespace-pre-wrap">{c.content}</p>
                <p className="text-[10px] text-neutral-500 mt-2">{c.mapping}</p>
                {risky && simA.worstLine && (
                  <p className="text-[10px] text-rose-400 mt-1">丸写しに近い行: 「{simA.worstLine.slice(0, 40)}…」</p>
                )}
              </div>
            );
          })}

          {picked !== null && (
            <div className="bg-neutral-900 rounded-xl border border-neutral-500 p-3 space-y-2">
              <span className="text-xs font-bold text-neutral-300">✏️ 採用案（編集可）</span>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={10}
                className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-2 py-2 text-sm"
              />
              <div className="flex items-center justify-between text-[11px] text-neutral-500">
                <span>{editContent.length}文字</span>
                {savedDraft && <span className="text-emerald-400">保存済み → 右で壁打ちできます</span>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={saveDraft}
                  disabled={saving || !editContent.trim()}
                  className="flex-1 py-2 rounded-lg bg-white text-black text-sm font-bold hover:bg-neutral-200 disabled:opacity-50"
                >
                  {saving ? "保存中..." : savedDraft ? "上書き保存" : "投稿管理に保存して壁打ちへ"}
                </button>
                {savedDraft && (
                  <Link href={`/threads/posts?draftId=${savedDraft.id}`} className="py-2 px-3 rounded-lg border border-neutral-700 text-sm text-neutral-300 hover:bg-neutral-800">
                    投稿管理へ
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 右: 壁打ちチャット */}
        <div className="bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col h-[70vh] lg:sticky lg:top-32">
          <div className="px-3 py-2.5 border-b border-neutral-800">
            <span className="text-xs font-bold text-neutral-300">💬 AI壁打ち</span>
            {!savedDraft && <span className="text-[10px] text-neutral-500 ml-2">投稿案を保存すると使えます</span>}
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.map((m) => (
              <div key={m.id} className={`text-xs whitespace-pre-wrap rounded-xl p-2.5 ${m.role === "user" ? "bg-sky-500/15 text-neutral-100 ml-6" : "bg-neutral-800 text-neutral-200 mr-6"}`}>
                {m.content}
                {m.role === "assistant" && /```/.test(m.content) && (
                  <button onClick={() => applyFromChat(m.content)} className="block mt-2 text-[11px] px-2 py-1 rounded bg-white text-black hover:bg-neutral-200">
                    この修正版を採用案に反映
                  </button>
                )}
              </div>
            ))}
            {chatSending && <div className="text-xs text-neutral-500 mr-6">考え中...</div>}
            {savedDraft && chatMessages.length === 0 && !chatSending && (
              <p className="text-[11px] text-neutral-500">
                例:「フックが弱い気がする」「もっと具体的な数字を入れて」「参考Bの締め方に寄せて」
              </p>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2.5 border-t border-neutral-800 flex gap-2">
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) sendChat();
              }}
              disabled={!savedDraft || chatSending}
              className="flex-1 border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-xs disabled:bg-neutral-900"
              placeholder={savedDraft ? "投稿案について相談..." : "先に投稿案を保存してください"}
            />
            <button
              onClick={sendChat}
              disabled={!savedDraft || chatSending || !chatInput.trim()}
              className="px-3 py-2 rounded-lg bg-white text-black text-xs font-bold hover:bg-neutral-200 disabled:opacity-50"
            >
              送信
            </button>
          </div>
        </div>
      </div>

      {/* 参考投稿ピッカー */}
      {pickerFor && (
        <PostPicker
          accountId={accountId}
          onClose={() => setPickerFor(null)}
          onPick={(p) => {
            if (pickerFor === "A") setRefA(p);
            else setRefB(p);
            setPickerFor(null);
          }}
        />
      )}
    </main>
  );
}

function PostPicker({
  accountId,
  onClose,
  onPick,
}: {
  accountId: string;
  onClose: () => void;
  onPick: (p: CompetitorPost) => void;
}) {
  const [posts, setPosts] = useState<CompetitorPost[]>([]);
  const [q, setQ] = useState("");
  const [hotOnly, setHotOnly] = useState(true);

  const load = useCallback(async () => {
    if (!accountId) return;
    const params = new URLSearchParams({ accountId, sort: "likes" });
    if (hotOnly) params.set("hot", "1");
    if (q) params.set("q", q);
    try {
      const res = await api<{ posts: CompetitorPost[] }>(`/api/threads/competitor-posts?${params}`);
      setPosts(res.posts);
    } catch {
      // ignore
    }
  }, [accountId, hotOnly, q]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-neutral-900 rounded-2xl w-full max-w-2xl p-5 space-y-3 my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-100">参考投稿を選択</h3>
          <label className="flex items-center gap-1.5 text-xs text-neutral-400">
            <input type="checkbox" checked={hotOnly} onChange={(e) => setHotOnly(e.target.checked)} />
            🔥伸びてる投稿のみ
          </label>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full border border-neutral-700 bg-neutral-950 text-neutral-100 rounded-lg px-3 py-2 text-sm"
          placeholder="本文を検索..."
        />
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {posts.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="w-full text-left bg-neutral-800/50 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-500 rounded-lg p-3"
            >
              <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                <span className="font-bold">@{p.competitor.handle}</span>
                {p.isHot && <span>🔥</span>}
                {p.planType && <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300">{p.planType}</span>}
                <span>❤️{fmtNum(p.likes)}</span>
              </div>
              <p className="text-xs text-neutral-200 mt-1 line-clamp-3 whitespace-pre-wrap">{p.content}</p>
            </button>
          ))}
          {posts.length === 0 && <p className="text-center text-sm text-neutral-500 py-6">投稿が見つかりません</p>}
        </div>
      </div>
    </div>
  );
}

export default function ThreadsCreatePage() {
  return (
    <Suspense fallback={<main className="px-6 py-6 text-sm text-neutral-500">読み込み中...</main>}>
      <CreateContent />
    </Suspense>
  );
}
