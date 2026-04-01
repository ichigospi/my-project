"use client";

import { useState, useEffect } from "react";
import {
  getTasks, saveTask, deleteTask, getMembers, saveMembers,
  genId, DEFAULT_STEPS, GENRE_LABELS, STYLE_LABELS, TASK_STATUS_LABELS,
} from "@/lib/project-store";
import type { ProductionTask, WorkflowStep, TaskStatus, Genre, Style } from "@/lib/project-store";

const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: "bg-gray-100 text-gray-500",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_CYCLE: TaskStatus[] = ["not_started", "in_progress", "completed"];

export default function WorkflowPage() {
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [members, setMembersState] = useState<string[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [newMember, setNewMember] = useState("");
  const [editingMemo, setEditingMemo] = useState<{ taskId: string; stepIdx: number } | null>(null);
  const [memoText, setMemoText] = useState("");

  useEffect(() => {
    setTasks(getTasks());
    setMembersState(getMembers());
  }, []);

  // 新規行を追加
  const handleAddRow = () => {
    const task: ProductionTask = {
      id: genId(),
      title: "",
      genre: "love",
      style: "healing",
      steps: DEFAULT_STEPS.map((s) => ({ ...s, assignee: members[0] || "自分" })),
      deadline: "",
      publishUrl: "",
      linkedProjectId: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTasks(saveTask(task));
  };

  // フィールド更新
  const updateField = (taskId: string, field: keyof ProductionTask, value: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setTasks(saveTask({ ...task, [field]: value }));
  };

  // 工程ステータストグル
  const toggleStatus = (taskId: string, stepIdx: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const current = task.steps[stepIdx].status;
    const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
    const next = STATUS_CYCLE[nextIdx];
    const newSteps = task.steps.map((s, i) => i === stepIdx ? {
      ...s, status: next, completedAt: next === "completed" ? new Date().toISOString() : s.completedAt,
    } : s);
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  // 担当者更新
  const updateAssignee = (taskId: string, stepIdx: number, assignee: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSteps = task.steps.map((s, i) => i === stepIdx ? { ...s, assignee } : s);
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  // 差し戻し
  const handleReject = (taskId: string, stepIdx: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSteps = [...task.steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], status: "rejected" };
    if (stepIdx > 0) newSteps[stepIdx - 1] = { ...newSteps[stepIdx - 1], status: "in_progress" };
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  // メモ保存
  const saveMemo = () => {
    if (!editingMemo) return;
    const task = tasks.find((t) => t.id === editingMemo.taskId);
    if (!task) return;
    const newSteps = task.steps.map((s, i) => i === editingMemo.stepIdx ? { ...s, memo: memoText } : s);
    setTasks(saveTask({ ...task, steps: newSteps }));
    setEditingMemo(null);
  };

  // メンバー管理
  const handleAddMember = () => {
    if (!newMember.trim() || members.includes(newMember.trim())) return;
    const updated = [...members, newMember.trim()];
    saveMembers(updated);
    setMembersState(updated);
    setNewMember("");
  };

  // 進捗計算
  const getProgress = (task: ProductionTask) => {
    const done = task.steps.filter((s) => s.status === "completed").length;
    return Math.round((done / task.steps.length) * 100);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">工程表</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowMembers(!showMembers)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs hover:bg-gray-50">
            担当者管理
          </button>
          <button onClick={handleAddRow}
            className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90">
            + 行を追加
          </button>
        </div>
      </div>

      {/* 担当者管理 */}
      {showMembers && (
        <div className="bg-card-bg rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
          <div className="flex gap-2 mb-2">
            <input type="text" value={newMember} onChange={(e) => setNewMember(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
              placeholder="名前を入力" className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none" />
            <button onClick={handleAddMember} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">追加</button>
          </div>
          <div className="flex flex-wrap gap-1">
            {members.map((m) => (
              <span key={m} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-accent/10 text-accent text-xs">
                {m}
                <button onClick={() => { saveMembers(members.filter((x) => x !== m)); setMembersState(members.filter((x) => x !== m)); }} className="text-accent/50 hover:text-accent">&times;</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* メモ編集モーダル */}
      {editingMemo && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditingMemo(null)}>
          <div className="bg-white rounded-xl p-5 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-2">メモ編集</h3>
            <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)}
              rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none mb-3" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingMemo(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs">キャンセル</button>
              <button onClick={saveMemo} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* スプレッドシート風テーブル */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1200px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-2 text-left w-10 font-semibold">No.</th>
              <th className="border border-gray-200 px-2 py-2 text-left w-56 font-semibold">タイトル</th>
              <th className="border border-gray-200 px-2 py-2 text-center w-16 font-semibold">ジャンル</th>
              <th className="border border-gray-200 px-2 py-2 text-center w-20 font-semibold">期限</th>
              <th className="border border-gray-200 px-2 py-2 text-center w-12 font-semibold">進捗</th>
              {DEFAULT_STEPS.map((s) => (
                <th key={s.name} className={`border border-gray-200 px-1 py-2 text-center w-24 font-semibold ${s.isReview ? "bg-yellow-50" : ""}`}>
                  {s.isReview ? `✋${s.name}` : s.name}
                </th>
              ))}
              <th className="border border-gray-200 px-2 py-2 text-center w-28 font-semibold">公開URL</th>
              <th className="border border-gray-200 px-2 py-2 text-center w-10 font-semibold"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, rowIdx) => (
              <tr key={task.id} className="hover:bg-gray-50/50">
                {/* No */}
                <td className="border border-gray-200 px-2 py-1.5 text-center font-bold text-gray-400">{rowIdx + 1}</td>

                {/* タイトル */}
                <td className="border border-gray-200 px-1 py-0.5">
                  <input type="text" value={task.title}
                    onChange={(e) => updateField(task.id, "title", e.target.value)}
                    placeholder="タイトルを入力"
                    className="w-full px-1 py-1 text-xs outline-none bg-transparent" />
                </td>

                {/* ジャンル */}
                <td className="border border-gray-200 px-0.5 py-0.5">
                  <select value={task.genre} onChange={(e) => updateField(task.id, "genre", e.target.value)}
                    className="w-full px-0.5 py-1 text-xs outline-none bg-transparent text-center">
                    {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>

                {/* 期限 */}
                <td className="border border-gray-200 px-0.5 py-0.5">
                  <input type="date" value={task.deadline}
                    onChange={(e) => updateField(task.id, "deadline", e.target.value)}
                    className="w-full px-0.5 py-1 text-xs outline-none bg-transparent" />
                </td>

                {/* 進捗 */}
                <td className="border border-gray-200 px-1 py-1.5 text-center">
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${getProgress(task)}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-400">{getProgress(task)}%</span>
                </td>

                {/* 各工程 */}
                {task.steps.map((step, stepIdx) => (
                  <td key={stepIdx} className={`border border-gray-200 px-0.5 py-0.5 ${step.isReview ? "bg-yellow-50/30" : ""}`}>
                    <div className="flex flex-col items-center gap-0.5">
                      {/* ステータスボタン */}
                      <button onClick={() => toggleStatus(task.id, stepIdx)}
                        className={`w-full px-1 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[step.status]}`}>
                        {TASK_STATUS_LABELS[step.status]}
                      </button>

                      {/* 担当者 */}
                      <select value={step.assignee} onChange={(e) => updateAssignee(task.id, stepIdx, e.target.value)}
                        className="w-full text-[10px] text-gray-500 outline-none bg-transparent text-center">
                        {members.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>

                      {/* 検収の差し戻し+メモ */}
                      <div className="flex gap-0.5">
                        {step.isReview && step.status === "in_progress" && (
                          <button onClick={() => handleReject(task.id, stepIdx)}
                            className="text-[9px] text-red-500 hover:underline">戻し</button>
                        )}
                        <button onClick={() => { setEditingMemo({ taskId: task.id, stepIdx }); setMemoText(step.memo); }}
                          className={`text-[9px] ${step.memo ? "text-accent" : "text-gray-400"} hover:underline`}>
                          {step.memo ? "📝" : "メモ"}
                        </button>
                      </div>
                    </div>
                  </td>
                ))}

                {/* 公開URL */}
                <td className="border border-gray-200 px-1 py-0.5">
                  {task.publishUrl ? (
                    <a href={task.publishUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-[10px] truncate block">公開済み</a>
                  ) : (
                    <input type="text" placeholder="URL"
                      onBlur={(e) => { if (e.target.value) updateField(task.id, "publishUrl", e.target.value); }}
                      className="w-full px-1 py-1 text-[10px] outline-none bg-transparent" />
                  )}
                </td>

                {/* 削除 */}
                <td className="border border-gray-200 px-1 py-0.5 text-center">
                  <button onClick={() => { deleteTask(task.id); setTasks(getTasks()); }}
                    className="text-gray-300 hover:text-red-500 text-xs">×</button>
                </td>
              </tr>
            ))}

            {/* 空行（追加用） */}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5 + DEFAULT_STEPS.length + 2} className="border border-gray-200 px-4 py-8 text-center text-gray-400">
                  「+ 行を追加」で動画を追加してください
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 凡例 */}
      <div className="flex gap-4 mt-3 text-[10px] text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded bg-gray-100 mr-1" />未着手</span>
        <span><span className="inline-block w-3 h-3 rounded bg-blue-100 mr-1" />作業中</span>
        <span><span className="inline-block w-3 h-3 rounded bg-green-100 mr-1" />完了</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-100 mr-1" />差し戻し</span>
        <span>✋ = 検収工程（人の確認が必要）</span>
        <span>📝 = メモあり</span>
      </div>
    </div>
  );
}
