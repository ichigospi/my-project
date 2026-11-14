"use client";

import { useState, useEffect, useRef } from "react";
import { getProjectsByChannel, getProjects, saveProject, deleteProject, createProject, GENRE_LABELS, STYLE_LABELS, addTaskFromProject, updateTaskStepStatus, lastLocalSaveFailed, freeLocalStorageSpace, getLocalStorageUsageKB } from "@/lib/project-store";
import type { ScriptProject, Genre, Style, ReviewStatus } from "@/lib/project-store";
import { pullSharedSettings, pushSharedSettings } from "@/lib/shared-sync";
import { useChannel } from "@/lib/channel-context";
import StepGenre from "./StepGenre";
import StepTitle from "./StepTitle";
import StepReferences from "./StepReferences";
import StepAnalyze from "./StepAnalyze";
import StepProposal from "./StepProposal";
import StepScript from "./StepScript";
import StepReview from "./StepReview";
import StepErrorBoundary from "@/components/StepErrorBoundary";

const STEPS = [
  { id: "genre", label: "ジャンル" },
  { id: "title", label: "企画タイトル" },
  { id: "references", label: "参考動画" },
  { id: "analyzing", label: "分析" },
  { id: "proposal", label: "構成提案" },
  { id: "script", label: "台本出力" },
  { id: "review", label: "添削部屋" },
];

export default function CreatePage() {
  const { activeChannel, channels } = useChannel();
  const [projects, setProjects] = useState<ScriptProject[]>([]);
  const [activeProject, setActiveProject] = useState<ScriptProject | null>(null);
  // 表示中ステップの上書き（nullならステータス通りの部屋を表示）
  const [viewStep, setViewStep] = useState<string | null>(null);
  const storageWarnedRef = useRef(false);
  const [storageKB, setStorageKB] = useState<number | null>(null);
  useEffect(() => { try { setStorageKB(getLocalStorageUsageKB()); } catch { /* ignore */ } }, [activeProject?.updatedAt]);
  const handleCleanStorage = () => {
    const freed = freeLocalStorageSpace();
    setStorageKB(getLocalStorageUsageKB());
    storageWarnedRef.current = false;
    alert(`保存領域を掃除しました（約${freed}KB 解放／現在 約${getLocalStorageUsageKB()}KB 使用）。履歴・検索キャッシュ・古いバックアップを削除しました。台本や分析はサーバーに残っています。`);
  };
  const [listQuery, setListQuery] = useState("");
  // プロジェクト一覧の並び順（date=日付順がベース / priority=タスク優先度順）
  const [listSort, setListSort] = useState<"date" | "priority">("date");

  useEffect(() => { pullSharedSettings().then(() => setProjects(getProjectsByChannel(activeChannel?.id || ""))); }, [activeChannel]);

  // 裏で動く同期（30秒ごと・ページ切替・stale検知の force pull）の結果を一覧に反映する。
  // これが無いと、管理者が提出しても、開きっぱなしのオーナー画面は再読み込みまで古いカードのまま。
  useEffect(() => {
    const onUpdated = () => {
      setProjects(getProjectsByChannel(activeChannel?.id || ""));
      setActiveProject((cur) => {
        if (!cur) return cur;
        const stored = getProjects().find((p) => p.id === cur.id);
        if (!stored) return cur;
        const a = new Date(stored.updatedAt || 0).getTime();
        const b = new Date(cur.updatedAt || 0).getTime();
        // サーバー由来で進捗や提出台本が進んでいる場合だけ差し替える（編集中の画面を巻き戻さない）
        if (a > b && (stored.status !== cur.status || (stored.submittedScript || "") !== (cur.submittedScript || ""))) {
          return stored;
        }
        return cur;
      });
    };
    window.addEventListener("fortune_yt_projects_updated", onUpdated);
    return () => window.removeEventListener("fortune_yt_projects_updated", onUpdated);
  }, [activeChannel]);

  // 別タブで保存された変更を、この画面にも即反映する（古い状態を持ったまま上書きしてしまうのを防ぐ）
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "fortune_yt_projects") return;
      setProjects(getProjectsByChannel(activeChannel?.id || ""));
      setActiveProject((cur) => (cur ? (getProjects().find((p) => p.id === cur.id) ?? cur) : cur));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [activeChannel]);

  // Chatwork通知等からの直リンク対応: /create?project=<id>&step=review
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const pid = sp.get("project");
    if (!pid) return;
    pullSharedSettings().then(() => {
      const p = getProjects().find((x) => x.id === pid);
      if (p) {
        setActiveProject(p);
        const step = sp.get("step");
        if (step && STEPS.some((s) => s.id === step)) setViewStep(step);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNew = () => {
    const p = createProject("love", "healing", activeChannel?.id);
    p.status = "genre";
    saveProject(p);
    setActiveProject(p);
    setProjects(getProjectsByChannel(activeChannel?.id || ""));
    pushSharedSettings();
  };

  const handleResume = (p: ScriptProject) => { setActiveProject(p); setViewStep(null); };

  const handleDelete = (id: string) => {
    if (!confirm("このプロジェクトを削除しますか？")) return;
    deleteProject(id);
    setProjects(getProjectsByChannel(activeChannel?.id || ""));
    pushSharedSettings();
  };

  // ===== 消えたプロジェクトの復元 =====
  // サーバーには削除後もプロジェクト行が残るため、そこから拾い直せる。
  // また、チャンネルID移行のズレで「どのチャンネル一覧にも出ない迷子」も検出する
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverItems, setRecoverItems] = useState<{ p: ScriptProject; kind: "server" | "orphan" }[] | null>(null);
  const [recoverError, setRecoverError] = useState("");

  const openRecover = async () => {
    setRecoverOpen(true);
    setRecoverItems(null);
    setRecoverError("");
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      const remote: ScriptProject[] = Array.isArray(data.projects) ? data.projects : [];
      const localAll = getProjects();
      const localIds = new Set(localAll.map((p) => p.id));
      const channelIds = new Set(channels.map((c) => c.id));
      const items: { p: ScriptProject; kind: "server" | "orphan" }[] = [];
      // サーバーにだけ残っているもの（この端末で削除済み等）
      for (const p of remote) {
        if (p?.id && !localIds.has(p.id)) items.push({ p, kind: "server" });
      }
      // ローカルにはあるが、存在しないチャンネルIDに紐づいて一覧に出ないもの
      for (const p of localAll) {
        if (p.channelId && !channelIds.has(p.channelId)) items.push({ p, kind: "orphan" });
      }
      items.sort((a, b) => (b.p.updatedAt || "").localeCompare(a.p.updatedAt || ""));
      setRecoverItems(items);
    } catch {
      setRecoverError("サーバーからの取得に失敗しました。通信環境を確認してもう一度試してください");
      setRecoverItems([]);
    }
  };

  // ===== サーバー上の台本を本文ごと探す（提出したのに消えた台本の復元） =====
  type ServerInspectItem = {
    id: string; title: string; refTitle: string; channelId: string; status: string; scriptReviewStatus: string; updatedAt: string;
    generatedLen: number; submittedLen: number; reviewedLen: number; segments: number; historyCount: number;
  };
  type ServerSnap = { at: string; savedAt: string; status?: string; scriptReviewStatus?: string; generatedScript?: string; submittedScript?: string; reviewedScript?: string };
  const [serverQuery, setServerQuery] = useState("");
  const [serverItems, setServerItems] = useState<ServerInspectItem[] | null>(null);
  const [serverBusy, setServerBusy] = useState(false);
  const [serverHist, setServerHist] = useState<Record<string, ServerSnap[] | null>>({});
  const searchServer = async () => {
    setServerBusy(true);
    try {
      const res = await fetch(`/api/projects/inspect?q=${encodeURIComponent(serverQuery.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setServerItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      alert(`サーバーの検索に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      setServerItems([]);
    } finally { setServerBusy(false); }
  };
  const fetchFull = async (id: string): Promise<{ project: ScriptProject | null; history: ServerSnap[] }> => {
    const res = await fetch(`/api/projects/inspect?id=${encodeURIComponent(id)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return { project: data.project || null, history: Array.isArray(data.history) ? data.history : [] };
  };
  // サーバーの現在版をこの端末に取り込む（この端末の版より古くても強制的に上書き）
  const importServerVersion = async (id: string) => {
    try {
      const { project } = await fetchFull(id);
      if (!project) { alert("サーバーにこの企画が見つかりませんでした"); return; }
      const local = getProjects().find((p) => p.id === id);
      if (local && !confirm(`この端末の「${local.title || "（タイトル未定）"}」をサーバー版で上書きします。よろしいですか？`)) return;
      saveProject({ ...project, channelId: activeChannel?.id || project.channelId || "" });
      setProjects(getProjectsByChannel(activeChannel?.id || ""));
      if (activeProject?.id === id) setActiveProject(getProjects().find((p) => p.id === id) || null);
      pushSharedSettings();
      alert("サーバー版を取り込みました");
    } catch (e) {
      alert(`取り込みに失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const loadHistory = async (id: string) => {
    setServerHist((m) => ({ ...m, [id]: null }));
    try {
      const { history } = await fetchFull(id);
      setServerHist((m) => ({ ...m, [id]: history }));
    } catch (e) {
      alert(`履歴の取得に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
      setServerHist((m) => ({ ...m, [id]: [] }));
    }
  };
  // サーバー履歴の本文を、提出済み台本として復元する（添削部屋に戻る）
  const restoreFromSnap = async (id: string, snap: ServerSnap) => {
    const text = snap.submittedScript || snap.reviewedScript || snap.generatedScript || "";
    if (!text.trim()) { alert("この履歴には本文がありません"); return; }
    if (!confirm(`この履歴の本文（${text.length}文字）を提出台本として復元し、添削部屋に戻します。よろしいですか？`)) return;
    try {
      let base = getProjects().find((p) => p.id === id) || null;
      if (!base) base = (await fetchFull(id)).project;
      if (!base) { alert("企画本体が見つかりませんでした"); return; }
      const restored: ScriptProject = {
        ...base,
        channelId: activeChannel?.id || base.channelId || "",
        generatedScript: snap.generatedScript || base.generatedScript || text,
        submittedScript: text,
        reviewedScript: snap.reviewedScript || text,
        status: "review",
        scriptReviewStatus: "pending",
      };
      saveProject(restored);
      setProjects(getProjectsByChannel(activeChannel?.id || ""));
      if (activeProject?.id === id) setActiveProject(restored);
      const r = await pushSharedSettings();
      alert(r.ok ? "復元してサーバーにも保存しました" : `この端末には復元しましたが、サーバーへの送信に失敗しました: ${r.error || ""}`);
    } catch (e) {
      alert(`復元に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleRecover = (item: { p: ScriptProject; kind: "server" | "orphan" }) => {
    // 今見ているチャンネルの一覧に必ず出るように、チャンネルIDを現在のチャンネルへ付け替えて保存
    const restored: ScriptProject = { ...item.p, channelId: activeChannel?.id || item.p.channelId || "" };
    saveProject(restored);
    setProjects(getProjectsByChannel(activeChannel?.id || ""));
    setRecoverItems((prev) => (prev || []).filter((x) => x.p.id !== item.p.id));
    pushSharedSettings();
  };

  const updateProject = (incoming: ScriptProject) => {
    const prev = activeProject;
    // 【古い画面からの上書き防止】別タブ・別端末で先に進めた後、古い状態を持った画面が保存すると
    // 進捗（status）や台本（generatedScript/submittedScript）が古い内容で消えてしまう。
    // この画面が持っていた版(prev)より保存済みの版(stored)が新しければ、stored を土台にして
    // この画面で実際に変更した項目だけを乗せる。
    let updated = incoming;
    const stored = getProjects().find((p) => p.id === incoming.id);
    if (prev && stored && stored.updatedAt && prev.updatedAt &&
        new Date(stored.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
      const merged = { ...stored } as ScriptProject;
      const rec = merged as unknown as Record<string, unknown>;
      const inc = incoming as unknown as Record<string, unknown>;
      const pv = prev as unknown as Record<string, unknown>;
      for (const k of Object.keys(inc)) {
        if (inc[k] !== pv[k]) rec[k] = inc[k];
      }
      updated = merged;
    }
    // ステータスが進んだ場合は表示上書きを解除し、新しいステータスの部屋に追従する。
    // ただし台本生成の完了（completed化）では添削部屋へ飛ばさず、台本出力の部屋に留まる
    // （分割生成の1/2を作るたびに部屋が移動してしまうのを防ぐ。添削部屋へは「提出」時に移動する）
    if (prev && updated.status !== prev.status) {
      if (updated.status === "completed") {
        setViewStep("script");
      } else {
        setViewStep(null);
      }
    }
    saveProject(updated);
    setActiveProject(updated);
    setProjects(getProjectsByChannel(activeChannel?.id || ""));
    pushSharedSettings();
    if (lastLocalSaveFailed && !storageWarnedRef.current) {
      storageWarnedRef.current = true;
      alert("この端末のブラウザ保存領域が一杯で、ローカル保存に失敗しました。今の変更はメモリ上に保持してサーバーへ直接送っています。\nこのタブを閉じる前に、左下の同期表示が「同期済み」になっていることを確認してください。\nその後、画面右上の「🧹 保存領域を掃除」を押すか、ブラウザの閲覧データ（このサイトのデータ）を削除してから「同期」で復元してください。");
    }

    // 工程表との自動連動
    if (updated.title && updated.status === "references" && prev?.status === "title") {
      // タイトル確定 → 工程表に追加+企画出し完了
      addTaskFromProject(updated.title, updated.genre, updated.style, updated.id);
      updateTaskStepStatus(updated.id, "企画出し", "completed");
    }
    if (updated.status === "script" && prev?.status === "proposal") {
      // 台本生成開始 → 台本作成を作業中に
      updateTaskStepStatus(updated.id, "台本作成", "in_progress");
    }
    if (updated.generatedScript && !prev?.generatedScript) {
      // 台本生成完了 → 台本作成を検収待ちに
      updateTaskStepStatus(updated.id, "台本作成", "review_waiting");
    }
  };

  const handleBack = () => { setActiveProject(null); setViewStep(null); setProjects(getProjectsByChannel(activeChannel?.id || "")); };

  // サーバーに残っている版を確認し、必要ならこの端末の版を置き換える（古い画面の上書きで消えた台本の復旧用）
  const handleRestoreFromServer = async () => {
    if (!activeProject) return;
    try {
      const res = await fetch("/api/projects");
      const d = await res.json();
      const sv = (Array.isArray(d.projects) ? (d.projects as ScriptProject[]) : []).find((p) => p.id === activeProject.id);
      if (!sv) { alert("サーバーにこの企画のデータがありません"); return; }
      const len = (t?: string) => (t || "").replace(/\s/g, "").length;
      const fmt = (p: ScriptProject) => `進捗: ${p.status}／台本出力 ${len(p.generatedScript).toLocaleString()}字／提出 ${len(p.submittedScript).toLocaleString()}字／添削後 ${len(p.reviewedScript).toLocaleString()}字`;
      const msg = `【サーバー版】${sv.updatedAt ? new Date(sv.updatedAt).toLocaleString("ja-JP") : "更新日時不明"}\n${fmt(sv)}\n\n【この端末の版】${activeProject.updatedAt ? new Date(activeProject.updatedAt).toLocaleString("ja-JP") : ""}\n${fmt(activeProject)}\n\nサーバー版でこの端末の版を置き換えますか？（置き換え前の台本は履歴に残ります）`;
      if (!confirm(msg)) return;
      saveProject(sv);
      setActiveProject(sv);
      setViewStep(null);
      setProjects(getProjectsByChannel(activeChannel?.id || ""));
    } catch (e) {
      alert("サーバーの確認に失敗しました: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  // 進捗の自己修復: 提出済み/生成済みの台本があるのに進捗が手前（構成提案など）に巻き戻っている企画は、
  // 開いた時に台本の有無から進捗を復元する（古い画面の上書きで status だけ戻った場合の救済）
  useEffect(() => {
    if (!activeProject) return;
    const idx = STEPS.findIndex((s) => s.id === activeProject.status);
    const scriptIdx = STEPS.findIndex((s) => s.id === "script");
    const reviewIdx = STEPS.findIndex((s) => s.id === "review");
    let repaired: ScriptProject["status"] | null = null;
    if (activeProject.submittedScript?.trim() && activeProject.status !== "completed" && idx < reviewIdx) repaired = "review";
    else if (activeProject.generatedScript?.trim() && idx < scriptIdx) repaired = "script";
    if (repaired) {
      const fixed = { ...activeProject, status: repaired };
      saveProject(fixed);
      setActiveProject(fixed);
      setProjects(getProjectsByChannel(activeChannel?.id || ""));
      pushSharedSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProject?.id, activeProject?.status, activeProject?.submittedScript, activeProject?.generatedScript]);

  const stepIndex = activeProject ? STEPS.findIndex((s) => s.id === activeProject.status) : -1;
  // completedの場合は最後のステップ扱い
  const statusStepIndex = stepIndex === -1 && activeProject?.status === "completed" ? STEPS.length - 1 : stepIndex;
  const dataStepIndex = activeProject?.submittedScript?.trim()
    ? STEPS.findIndex((s) => s.id === "review")
    : activeProject?.generatedScript?.trim()
      ? STEPS.findIndex((s) => s.id === "script")
      : -1;
  const effectiveStepIndex = Math.max(statusStepIndex, dataStepIndex);

  // 表示中のステップ（進捗ステータスとは独立。⑥⑦を行き来しても「台本添削待ち」等の進捗を壊さない）
  const displayedStepId = viewStep ?? (activeProject?.status === "completed" ? "review" : activeProject?.status);
  const displayedIndex = STEPS.findIndex((s) => s.id === displayedStepId);

  const goToStep = (stepId: string) => {
    if (!activeProject) return;
    // ステータスは変更せず、表示だけ切り替える（到達済みステップ間は自由に行き来できる）
    setViewStep(stepId);
  };

  // プロジェクト一覧
  if (!activeProject) {
    return (
      <div className="p-4 md:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold">台本作成</h1>
            <p className="text-gray-500 mt-1">ウィザード形式で台本を作成</p>
          </div>
          <button onClick={handleNew} className="w-full sm:w-auto px-5 py-3 rounded-xl bg-accent text-white text-base font-bold hover:bg-accent/90 shadow-sm">
            + 新規プロジェクト
          </button>
        </div>

        {projects.length === 0 && (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">プロジェクトがありません</p>
            <p className="text-sm mt-1">「+ 新規プロジェクト」で台本作成を始めましょう</p>
          </div>
        )}

        {/* 消えたプロジェクトの復元 */}
        <div className="mb-4">
          {!recoverOpen ? (
            <button onClick={openRecover} className="text-xs text-gray-400 hover:text-accent hover:underline">
              🔎 消えたプロジェクトを探す（削除したものを復元できます）
            </button>
          ) : (
            <div className="bg-card-bg rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-sm">🔎 消えたプロジェクト</h3>
                <button onClick={() => setRecoverOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">閉じる</button>
              </div>
              {recoverError && <p className="text-xs text-red-500 mb-2">{recoverError}</p>}
              {recoverItems === null && <p className="text-sm text-gray-400">サーバーを確認中...</p>}
              {recoverItems !== null && recoverItems.length === 0 && !recoverError && (
                <p className="text-sm text-gray-400">復元できるプロジェクトは見つかりませんでした</p>
              )}
              {recoverItems !== null && recoverItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-400">「復元」を押すと、今のチャンネルの一覧に戻ります</p>
                  {recoverItems.map((item) => (
                    <div key={item.p.id} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.p.title || "（タイトル未定）"}</p>
                        <p className="text-[11px] text-gray-400">
                          {item.kind === "server" ? "サーバーに保存が残っていました（この端末では削除済み）" : "チャンネルが見つからず一覧に出ていませんでした"}
                          ・最終更新 {item.p.updatedAt ? new Date(item.p.updatedAt).toLocaleDateString("ja-JP") : "不明"}
                          {(item.p.referenceVideos || []).length > 0 && ` ・元ネタ: ${(item.p.referenceVideos || [])[0]?.title?.slice(0, 30) || ""}`}
                        </p>
                      </div>
                      <button onClick={() => handleRecover(item)}
                        className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90 shrink-0">
                        復元
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* サーバー上の台本を本文ごと探す */}
              <div className="mt-4 pt-3 border-t border-gray-100">
                <h4 className="font-semibold text-xs mb-1">📄 サーバー上の台本を本文ごと探す</h4>
                <p className="text-[11px] text-gray-400 mb-2">提出したのに消えた台本はここで探せます。タイトルの一部（空欄なら全件）で検索すると、サーバーに本文が何文字残っているか、上書き前の履歴が何件あるかが分かります。</p>
                <div className="flex gap-2 mb-2">
                  <input value={serverQuery} onChange={(e) => setServerQuery(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") searchServer(); }}
                    placeholder="タイトルの一部（例: 運命の人）" className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
                  <button onClick={searchServer} disabled={serverBusy} className="px-3 py-1.5 rounded-lg bg-gray-800 text-white text-xs font-medium disabled:opacity-50">{serverBusy ? "検索中..." : "サーバーを検索"}</button>
                </div>
                {serverItems !== null && serverItems.length === 0 && <p className="text-xs text-gray-400">見つかりませんでした</p>}
                {serverItems !== null && serverItems.length > 0 && (
                  <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                    {serverItems.map((it) => {
                      const local = getProjects().find((p) => p.id === it.id);
                      const localSub = (local?.submittedScript || "").length;
                      const hist = serverHist[it.id];
                      return (
                        <div key={it.id} className="rounded-lg border border-gray-100 p-2.5">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{it.title || "（タイトル未定）"}</p>
                              <p className="text-[11px] text-gray-400">
                                サーバー更新 {it.updatedAt ? new Date(it.updatedAt).toLocaleString("ja-JP") : "不明"}・進捗 {it.status}{it.scriptReviewStatus ? `／台本チェック ${it.scriptReviewStatus}` : ""}
                              </p>
                              <p className="text-[11px] text-gray-500">
                                生成台本 {it.generatedLen}字／提出台本 {it.submittedLen}字／添削後 {it.reviewedLen}字{it.segments > 0 ? `／分割 ${it.segments}` : ""}／上書き前の履歴 {it.historyCount}件
                                {local ? `　｜ この端末: 提出台本 ${localSub}字` : "　｜ この端末には無し"}
                              </p>
                            </div>
                            <div className="flex flex-col gap-1 shrink-0">
                              <button onClick={() => importServerVersion(it.id)} className="px-2.5 py-1 rounded-lg bg-accent text-white text-[11px] font-medium hover:bg-accent/90">サーバー版を取り込む</button>
                              {it.historyCount > 0 && (
                                <button onClick={() => loadHistory(it.id)} className="px-2.5 py-1 rounded-lg border border-gray-200 text-[11px] text-gray-600 hover:bg-gray-50">履歴を見る</button>
                              )}
                            </div>
                          </div>
                          {hist === null && <p className="text-[11px] text-gray-400 mt-1">履歴を取得中...</p>}
                          {Array.isArray(hist) && hist.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {hist.map((s, i) => {
                                const t = s.submittedScript || s.reviewedScript || s.generatedScript || "";
                                return (
                                  <div key={i} className="flex items-center gap-2 text-[11px] bg-gray-50 rounded px-2 py-1">
                                    <span className="flex-1 min-w-0 truncate">
                                      {s.at ? new Date(s.at).toLocaleString("ja-JP") : "日時不明"} の版・{s.status || ""}{s.scriptReviewStatus ? `／${s.scriptReviewStatus}` : ""}・
                                      {s.submittedScript ? `提出 ${s.submittedScript.length}字` : s.generatedScript ? `生成 ${s.generatedScript.length}字` : `添削後 ${(s.reviewedScript || "").length}字`}
                                      <span className="text-gray-400">　{t.slice(0, 40).replace(/\s+/g, " ")}…</span>
                                    </span>
                                    <button onClick={() => restoreFromSnap(it.id, s)} className="px-2 py-0.5 rounded bg-green-600 text-white font-medium shrink-0">この本文を復元</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* タイトル検索＋並び替え */}
        {projects.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
              <input
                type="text"
                value={listQuery}
                onChange={(e) => setListQuery(e.target.value)}
                placeholder="タイトル・元ネタで検索"
                className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-accent bg-card-bg"
              />
              {listQuery && (
                <button onClick={() => setListQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-xs text-gray-400 mr-1">並び順:</span>
              <button onClick={() => setListSort("date")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${listSort === "date" ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                📅 日付順
              </button>
              <button onClick={() => setListSort("priority")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${listSort === "priority" ? "bg-accent text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                🔥 優先度順
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {[...projects]
            .filter((p) => {
              const q = listQuery.trim().toLowerCase();
              if (!q) return true;
              if ((p.title || "").toLowerCase().includes(q)) return true;
              return (p.referenceVideos || []).some((v) => (v.title || "").toLowerCase().includes(q));
            })
            .sort((x, y) => {
              // 日付順（ベース）: 更新日時の新しい順
              // 優先度順: 急ぎの案件（添削待ち→再提出待ち→企画チェック待ち→企画差し戻し）を最上部に、同順位内は更新日時の新しい順
              if (listSort === "priority") {
                const rank = (p: ScriptProject) =>
                  p.status === "review" && p.scriptReviewStatus === "pending" ? 0
                  : p.status === "review" && p.scriptReviewStatus === "rejected" ? 1
                  : p.reviewStatus === "pending" ? 2
                  : p.reviewStatus === "rejected" ? 3
                  : 4;
                const r = rank(x) - rank(y);
                if (r !== 0) return r;
              }
              return (y.updatedAt || "").localeCompare(x.updatedAt || "");
            })
            .map((p, pi) => {
            // 元ネタ（選択済み参考動画）のサムネイル。未選択なら候補全体から表示
            const selectedRefs = (p.referenceVideos || []).filter((v) => v.selected && v.thumbnailUrl);
            const refThumbs = (selectedRefs.length > 0 ? selectedRefs : (p.referenceVideos || []).filter((v) => v.thumbnailUrl)).slice(0, 3);
            return (
            <div key={p.id || `proj-${pi}`} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-4">
                {refThumbs.length > 0 && (
                  <div className="flex gap-1.5 shrink-0 cursor-pointer" onClick={() => handleResume(p)}>
                    {refThumbs.map((v, vi) => (
                      <img key={v.videoId || `thumb-${vi}`} src={v.thumbnailUrl} alt={v.title} title={`元ネタ: ${v.title}（${v.channelName}）`}
                        className="w-24 h-[54px] rounded-md object-cover border border-gray-200 hidden sm:block first:block" />
                    ))}
                  </div>
                )}
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleResume(p)}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{p.title || "（タイトル未定）"}</p>
                    {p.status === "review" && p.scriptReviewStatus === "pending" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-600 text-white font-bold shrink-0">🟣 台本添削待ち</span>
                    )}
                    {p.status === "review" && p.scriptReviewStatus === "rejected" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500 text-white font-bold shrink-0">🔁 再提出待ち</span>
                    )}
                    {p.scriptReviewStatus === "approved" && p.submittedScript && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-600 text-white font-bold shrink-0">✅ 添削合格</span>
                    )}
                  </div>
                  {refThumbs.length > 0 && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5" title={refThumbs.map((v) => v.title).join(" / ")}>
                      元ネタ: {refThumbs.map((v) => v.title).join(" / ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent">{GENRE_LABELS[p.genre]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{STYLE_LABELS[p.style]}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {STEPS.find((s) => s.id === p.status)?.label || p.status}
                    </span>
                    <span className="text-xs text-gray-400">{new Date(p.updatedAt).toLocaleDateString("ja-JP")}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button onClick={() => handleResume(p)} className="px-4 py-2 rounded-lg border border-accent text-accent text-sm hover:bg-accent hover:text-white transition-colors">再開</button>
                  {/* いつものステップ（台本出力等）がデータ不整合で開けない場合の安全な入り口 */}
                  <button onClick={() => { setActiveProject(p); setViewStep("proposal"); }}
                    className="text-[11px] text-gray-400 hover:text-accent hover:underline" title="台本出力部屋を経由せず、構成提案のステップから開きます（開けない場合の避難用）">
                    骨組みで開く
                  </button>
                </div>
                <button onClick={() => handleDelete(p.id)} className="text-gray-300 hover:text-danger shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {/* 企画チェック */}
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                {(!p.reviewStatus || p.reviewStatus === "none") && (
                  <button onClick={() => { saveProject({ ...p, reviewStatus: "pending" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                    className="px-3 py-1.5 rounded-lg text-xs border border-orange-300 text-orange-600 hover:bg-orange-50">
                    企画チェック依頼
                  </button>
                )}
                {p.reviewStatus === "pending" && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">チェック待ち</span>
                    <select
                      value="pending"
                      onChange={(e) => {
                        const val = e.target.value as ReviewStatus;
                        const note = val === "rejected" ? prompt("差し戻し理由:") || "" : "";
                        saveProject({ ...p, reviewStatus: val, reviewNote: note });
                        setProjects(getProjectsByChannel(activeChannel?.id || ""));
                        pushSharedSettings();
                      }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                    >
                      <option value="pending">チェック待ち</option>
                      <option value="approved">承認</option>
                      <option value="rejected">差し戻し</option>
                      <option value="none">取り消し</option>
                    </select>
                  </>
                )}
                {p.reviewStatus === "approved" && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">承認済み</span>
                    <button onClick={() => { saveProject({ ...p, reviewStatus: "none", reviewNote: "" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                      className="text-xs text-gray-400 hover:text-gray-600">リセット</button>
                  </>
                )}
                {p.reviewStatus === "rejected" && (
                  <>
                    <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">差し戻し</span>
                    {p.reviewNote && <span className="text-xs text-red-500">{p.reviewNote}</span>}
                    <button onClick={() => { saveProject({ ...p, reviewStatus: "pending", reviewNote: "" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                      className="px-2 py-1 rounded text-xs border border-orange-300 text-orange-600 hover:bg-orange-50">
                      再依頼
                    </button>
                  </>
                )}
              </div>
              {/* 台本チェック（台本生成済みの場合のみ表示） */}
              {!!p.generatedScript && (
                <div className="flex items-center gap-3 mt-2 pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400 shrink-0">台本</span>
                  {(!p.scriptReviewStatus || p.scriptReviewStatus === "none") && (
                    <button onClick={() => { saveProject({ ...p, scriptReviewStatus: "pending" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                      className="px-3 py-1.5 rounded-lg text-xs border border-blue-300 text-blue-600 hover:bg-blue-50">
                      台本チェック依頼
                    </button>
                  )}
                  {p.scriptReviewStatus === "pending" && (
                    <>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">チェック待ち</span>
                      <select
                        value="pending"
                        onChange={(e) => {
                          const val = e.target.value as ReviewStatus;
                          const note = val === "rejected" ? prompt("差し戻し理由:") || "" : "";
                          saveProject({ ...p, scriptReviewStatus: val, scriptReviewNote: note });
                          setProjects(getProjectsByChannel(activeChannel?.id || ""));
                          pushSharedSettings();
                        }}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none"
                      >
                        <option value="pending">チェック待ち</option>
                        <option value="approved">承認</option>
                        <option value="rejected">差し戻し</option>
                        <option value="none">取り消し</option>
                      </select>
                    </>
                  )}
                  {p.scriptReviewStatus === "approved" && (
                    <>
                      <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium">承認済み</span>
                      <button onClick={() => { saveProject({ ...p, scriptReviewStatus: "none", scriptReviewNote: "" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                        className="text-xs text-gray-400 hover:text-gray-600">リセット</button>
                    </>
                  )}
                  {p.scriptReviewStatus === "rejected" && (
                    <>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">差し戻し</span>
                      {p.scriptReviewNote && <span className="text-xs text-red-500">{p.scriptReviewNote}</span>}
                      <button onClick={() => { saveProject({ ...p, scriptReviewStatus: "pending", scriptReviewNote: "" }); setProjects(getProjectsByChannel(activeChannel?.id || "")); pushSharedSettings(); }}
                        className="px-2 py-1 rounded text-xs border border-blue-300 text-blue-600 hover:bg-blue-50">
                        再依頼
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ウィザードビュー
  return (
    <div className="p-4 md:p-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button onClick={handleBack} className="text-accent text-sm font-medium flex items-center gap-1 hover:underline">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          プロジェクト一覧
        </button>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={handleCleanStorage}
            className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap border ${storageKB !== null && storageKB > 3500 ? "border-red-300 text-red-600 bg-red-50 font-medium" : "border-gray-200 text-gray-600 bg-white hover:bg-gray-50"}`}
            title="履歴・検索キャッシュ・古いバックアップを削除して、この端末のブラウザ保存領域を空けます（台本や分析はサーバーに残ります）">
            🧹 掃除{storageKB !== null ? `（${storageKB}KB）` : ""}
          </button>
          <button onClick={handleRestoreFromServer}
            className="px-3 py-1.5 rounded-full text-xs whitespace-nowrap border border-gray-200 text-gray-600 bg-white hover:bg-gray-50"
            title="サーバーに残っている版（進捗・台本の有無）を確認し、必要ならこの端末の版を置き換えます">
            ☁ サーバー版を復元
          </button>
        </div>
      </div>

      {/* ステップインジケーター */}
      <div className="flex items-center gap-1 mb-6 md:mb-8 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => goToStep(s.id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                i === displayedIndex ? "bg-accent text-white" : i <= effectiveStepIndex ? "bg-accent/10 text-accent cursor-pointer hover:bg-accent/20" : "bg-gray-100 text-gray-400"
              }`}
              disabled={i > effectiveStepIndex}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                i === displayedIndex ? "bg-white/20" : i < effectiveStepIndex ? "bg-accent/20" : "bg-gray-200"
              }`}>{i < effectiveStepIndex ? "✓" : i + 1}</span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && <svg className="w-4 h-4 text-gray-300 mx-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>}
          </div>
        ))}
      </div>

      {/* ステップ本体（表示ステップに従う。進捗ステータスは変えずに行き来できる）
          エラーバウンダリ: 特定プロジェクトのデータ不整合で画面全体が開けなくなるのを防ぐ */}
      <StepErrorBoundary
        projectTitle={activeProject.title}
        onBackToList={() => { setActiveProject(null); setViewStep(null); }}
        onResetToProposal={() => { setViewStep("proposal"); }}
      >
        {displayedStepId === "genre" && <StepGenre project={activeProject} onUpdate={updateProject} />}
        {displayedStepId === "title" && <StepTitle project={activeProject} onUpdate={updateProject} />}
        {displayedStepId === "references" && <StepReferences project={activeProject} onUpdate={updateProject} />}
        {displayedStepId === "analyzing" && <StepAnalyze project={activeProject} onUpdate={updateProject} />}
        {displayedStepId === "proposal" && <StepProposal project={activeProject} onUpdate={updateProject} onNavigate={goToStep} />}
        {displayedStepId === "script" && <StepScript project={activeProject} onUpdate={updateProject} />}
        {displayedStepId === "review" && <StepReview project={activeProject} onUpdate={updateProject} />}
      </StepErrorBoundary>
    </div>
  );
}
