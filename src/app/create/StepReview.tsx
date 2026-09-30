"use client";

// ⑦ 添削部屋: ライターが提出した台本をオーナーが添削する部屋。
// - 提出時の台本(submittedScript)と添削中の台本(reviewedScript)の差分を紫色で表示
// - 紫色の箇所をクリックすると変更前テキスト＋オーナーコメント入力を表示
// - 追加ルール提案の確認・コピー・ライブラリ追加
// - 最後に「再提出を依頼」「合格」ボタン → プロジェクト一覧に反映

import { useMemo, useState } from "react";
import { diffTexts, segKey, type DiffSeg } from "@/lib/text-diff";
import { addPattern } from "@/lib/pattern-store";
import { pushSharedSettings } from "@/lib/shared-sync";
import { notifyChatwork, reviewMessage } from "@/lib/notify";
import { getProfileByChannel } from "@/lib/script-analysis-store";
import type { ScriptProject, ReviewComment, RuleProposal } from "@/lib/project-store";

export default function StepReview({ project, onUpdate }: { project: ScriptProject; onUpdate: (p: ScriptProject) => void }) {
  const [tab, setTab] = useState<"preview" | "edit">("preview");
  const [draft, setDraft] = useState(project.reviewedScript ?? project.submittedScript ?? "");
  const [openSeg, setOpenSeg] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const submitted = project.submittedScript || "";
  const reviewed = project.reviewedScript ?? submitted;
  const comments = project.reviewComments || [];
  // 同一内容（カテゴリ＋タイトル）の提案は最初の1件だけ表示（過去の重複送信データ対策）
  const proposals = (() => {
    const seen = new Set<string>();
    return (project.ruleProposals || []).filter((p) => {
      const key = `${p.category}|${p.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  })();

  const segs: DiffSeg[] = useMemo(() => diffTexts(submitted, reviewed), [submitted, reviewed]);
  const changedCount = segs.filter((s) => s.type !== "same").length;

  if (!submitted) {
    return (
      <div className="w-full max-w-3xl">
        <h2 className="text-xl font-bold mb-2">⑦ 添削部屋</h2>
        <div className="bg-card-bg rounded-xl p-8 text-center text-gray-400 border border-gray-100 mb-4">
          <p>まだ台本が提出されていません</p>
          <p className="text-sm mt-1">⑥台本出力で「台本を提出」を押すと、ここに反映されます</p>
        </div>
        {project.generatedScript && (
          <div className="bg-card-bg rounded-xl p-5 border border-gray-100 text-sm leading-7 whitespace-pre-wrap text-gray-700">
            {project.generatedScript}
          </div>
        )}
      </div>
    );
  }

  const saveDraft = () => {
    if (draft !== reviewed) onUpdate({ ...project, reviewedScript: draft });
  };

  const openComment = (key: string) => {
    setOpenSeg(key);
    setCommentDraft(comments.find((c) => c.id === key)?.comment || "");
  };

  const saveComment = (seg: DiffSeg) => {
    const key = segKey(seg);
    const rest = comments.filter((c) => c.id !== key);
    const next: ReviewComment[] = commentDraft.trim()
      ? [...rest, { id: key, original: seg.original, changed: seg.text, comment: commentDraft.trim(), createdAt: new Date().toISOString() }]
      : rest;
    onUpdate({ ...project, reviewComments: next });
    setOpenSeg(null);
  };

  const decide = (result: "approved" | "rejected") => {
    if (result === "approved") {
      onUpdate({
        ...project,
        scriptReviewStatus: "approved",
        generatedScript: reviewed, // 添削後の台本を最終稿として反映
        status: "completed",
      });
    } else {
      onUpdate({ ...project, scriptReviewStatus: "rejected" });
    }
    notifyChatwork(reviewMessage(result, getProfileByChannel(project.channelId || "").channelName || "", project.title));
  };

  const updateProposal = (id: string, patch: Partial<RuleProposal>) => {
    onUpdate({ ...project, ruleProposals: proposals.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  const copyProposal = (p: RuleProposal) => {
    navigator.clipboard.writeText(`【追加ルール要請】[${p.category}] ${p.title}\n${p.content}\n（理由: ${p.reason}）`);
    setCopied(p.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const adoptToLibrary = (p: RuleProposal) => {
    addPattern({ category: p.category, title: p.title, content: p.content, channelId: project.channelId });
    updateProposal(p.id, { status: "adopted" });
    setTimeout(() => { pushSharedSettings(); }, 300);
  };

  const statusBadge =
    project.scriptReviewStatus === "approved" ? { label: "✅ 合格", cls: "bg-green-100 text-green-700" }
    : project.scriptReviewStatus === "rejected" ? { label: "🔁 再提出待ち", cls: "bg-red-100 text-red-700" }
    : { label: "🟣 台本添削待ち", cls: "bg-purple-100 text-purple-700" };

  return (
    <div className="w-full max-w-3xl">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-xl font-bold">⑦ 添削部屋</h2>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusBadge.cls}`}>{statusBadge.label}</span>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        紫色＝オーナーが変更した箇所（クリックで変更前とコメントを表示）。変更箇所: {changedCount}件 / コメント: {comments.length}件
      </p>

      {/* タブ */}
      <div className="flex gap-2 mb-3">
        <button onClick={() => { saveDraft(); setTab("preview"); }}
          className={`px-3 py-1.5 rounded-lg text-sm ${tab === "preview" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
          添削プレビュー
        </button>
        <button onClick={() => { setDraft(reviewed); setTab("edit"); }}
          className={`px-3 py-1.5 rounded-lg text-sm ${tab === "edit" ? "bg-accent text-white" : "bg-gray-100 text-gray-600"}`}>
          添削する（編集）
        </button>
        <button onClick={() => navigator.clipboard.writeText(reviewed)}
          className="ml-auto px-3 py-1.5 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">コピー</button>
      </div>

      {/* 編集タブ */}
      {tab === "edit" && (
        <div className="mb-6">
          <textarea value={draft} onChange={(e) => setDraft(e.target.value)}
            className="w-full h-[480px] p-4 rounded-xl border border-gray-200 text-sm leading-6 focus:outline-none focus:border-accent font-sans" />
          <div className="flex gap-2 mt-2">
            <button onClick={() => { saveDraft(); setTab("preview"); }}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90">保存してプレビュー</button>
            <button onClick={() => setDraft(reviewed)}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50">元に戻す</button>
          </div>
        </div>
      )}

      {/* プレビュータブ（差分表示） */}
      {tab === "preview" && (
        <div className="bg-card-bg rounded-xl p-5 border border-gray-100 mb-6 text-sm leading-7 whitespace-pre-wrap">
          {segs.map((seg, i) => {
            const key = segKey(seg);
            if (seg.type === "same") return <span key={i}>{seg.text}</span>;
            const hasComment = comments.some((c) => c.id === key);
            const label = seg.type === "removed" ? "【削除】" : seg.text;
            return (
              <span key={i} className="relative">
                <span onClick={() => openComment(key)}
                  className={`cursor-pointer rounded px-0.5 transition-colors ${seg.type === "removed" ? "bg-purple-200 text-purple-800 text-xs font-medium" : "bg-purple-100 text-purple-900 hover:bg-purple-200"} ${hasComment ? "underline decoration-purple-500 decoration-2" : ""}`}
                  title="クリックで変更前テキストとコメントを表示">
                  {label}{hasComment ? " 💬" : ""}
                </span>
                {openSeg === key && (
                  <span className="absolute left-0 top-full z-20 mt-1 block w-80 max-w-[80vw] bg-white rounded-xl shadow-xl border border-purple-200 p-3 text-xs leading-5" onClick={(e) => e.stopPropagation()}>
                    <span className="block font-semibold text-purple-700 mb-1">変更前:</span>
                    <span className="block bg-gray-50 rounded p-2 mb-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-gray-700">{seg.original || "（新規追加のため変更前テキストなし）"}</span>
                    <span className="block font-semibold text-purple-700 mb-1">オーナーコメント:</span>
                    <textarea value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder="なぜ変えたか・ライターへの指導コメント"
                      className="w-full h-16 p-2 rounded border border-gray-200 focus:outline-none focus:border-purple-400" />
                    <span className="flex gap-2 mt-2">
                      <button onClick={() => saveComment(seg)} className="px-3 py-1 rounded bg-purple-600 text-white hover:bg-purple-700">保存</button>
                      <button onClick={() => setOpenSeg(null)} className="px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">閉じる</button>
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* コメント一覧 */}
      {comments.length > 0 && (
        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 mb-6">
          <h3 className="font-semibold text-sm text-purple-700 mb-2">💬 オーナーコメント一覧（{comments.length}件）</h3>
          <div className="space-y-2">
            {comments.map((c) => (
              <div key={c.id} className="bg-white rounded-lg p-3 text-xs leading-5">
                {c.original && <p className="text-gray-400 line-through mb-0.5">{c.original.slice(0, 80)}{c.original.length > 80 ? "…" : ""}</p>}
                {c.changed && <p className="text-purple-800 mb-1">{c.changed.slice(0, 80)}{c.changed.length > 80 ? "…" : ""}</p>}
                <p className="text-gray-700">👤 {c.comment}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 追加ルール提案 */}
      {proposals.length > 0 && (
        <div className="bg-card-bg rounded-xl p-4 border border-gray-100 mb-6">
          <h3 className="font-semibold text-sm mb-1">💡 追加ルール提案（ライターから {proposals.length}件）</h3>
          <p className="text-xs text-gray-400 mb-3">内容を編集→「コピー」でClaudeチャットに貼り付けてルール化要請、または「ライブラリに追加」で構成提案から選べるパターンになります</p>
          <div className="space-y-3">
            {proposals.map((p) => (
              <div key={p.id} className={`rounded-lg border p-3 ${p.status === "adopted" ? "border-green-200 bg-green-50/50" : p.status === "dismissed" ? "border-gray-100 opacity-50" : "border-gray-200"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">{p.category}</span>
                  <span className="text-sm font-semibold">{p.title}</span>
                  {p.status === "adopted" && <span className="text-[10px] text-green-600 font-medium">✓ ライブラリ追加済み</span>}
                  {p.status === "dismissed" && <span className="text-[10px] text-gray-400">却下</span>}
                </div>
                <textarea value={p.content} onChange={(e) => updateProposal(p.id, { content: e.target.value })}
                  className="w-full h-24 p-2 rounded border border-gray-200 text-xs leading-5 focus:outline-none focus:border-accent" />
                <p className="text-[11px] text-gray-500 mt-1">理由: {p.reason}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => copyProposal(p)} className="px-3 py-1 rounded text-xs border border-gray-300 hover:bg-gray-50">{copied === p.id ? "✓ コピーしました" : "コピー"}</button>
                  {p.status !== "adopted" && (
                    <button onClick={() => adoptToLibrary(p)} className="px-3 py-1 rounded text-xs bg-accent text-white hover:bg-accent/90">ライブラリに追加</button>
                  )}
                  {p.status === "proposed" && (
                    <button onClick={() => updateProposal(p.id, { status: "dismissed" })} className="px-3 py-1 rounded text-xs text-gray-400 hover:text-gray-600">却下</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 判定ボタン */}
      {project.scriptReviewStatus !== "approved" && (
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => decide("approved")}
            className="flex-1 px-5 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700">
            ✅ 合格（添削後の台本を最終稿にする）
          </button>
          <button onClick={() => decide("rejected")}
            className="flex-1 px-5 py-3 rounded-xl border-2 border-red-300 text-red-600 font-medium hover:bg-red-50">
            🔁 再提出を依頼（コメントを参考に修正してもらう）
          </button>
        </div>
      )}
      {project.scriptReviewStatus === "approved" && (
        <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-sm text-green-700 font-medium">
          ✅ 合格済み。添削後の台本が最終稿として反映されています
        </div>
      )}
      {project.scriptReviewStatus === "rejected" && (
        <p className="text-xs text-gray-500 mt-3">
          ※ライターはコメントを確認し、⑥台本出力に戻って修正→再度「台本を提出」してください（再提出すると差分がリセットされます）
        </p>
      )}
    </div>
  );
}
