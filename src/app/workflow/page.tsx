"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  getTasks, saveTask, deleteTask,
  genId, DEFAULT_STEPS, GENRE_LABELS, TASK_STATUS_LABELS,
} from "@/lib/project-store";
import type { ProductionTask, TaskStatus } from "@/lib/project-store";

const STATUS_COLORS: Record<TaskStatus, string> = {
  not_started: "bg-gray-100 text-gray-500",
  in_progress: "bg-blue-100 text-blue-700",
  review_waiting: "bg-yellow-100 text-yellow-700",
  reviewing: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

interface UserInfo { id: string; name: string; email: string; role: string }

export default function WorkflowPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role || "";
  const isViewer = userRole === "viewer";
  const [tasks, setTasks] = useState<ProductionTask[]>([]);
  const [members, setMembersState] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);
  const [editingMemo, setEditingMemo] = useState<{ taskId: string; stepIdx: number } | null>(null);
  const [memoText, setMemoText] = useState("");

  useEffect(() => {
    setTasks(getTasks());
    // DBからユーザー一覧を取得して担当者リストに使う
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.users) {
          setMembersState(data.users.map((u: UserInfo) => u.name));
        }
      })
      .catch(() => setMembersState(["自分"]));
    setMounted(true);
  }, []);

  const handleAddRow = () => {
    const task: ProductionTask = {
      id: genId(), title: "", genre: "love", style: "healing",
      steps: DEFAULT_STEPS.map((s) => ({ ...s, assignee: members[0] || "自分" })),
      deadline: "", publishUrl: "", linkedProjectId: "", sourceVideoUrl: "", urgent: false,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    setTasks(saveTask(task));
  };

  const updateField = (taskId: string, field: string, value: string | boolean) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setTasks(saveTask({ ...task, [field]: value } as ProductionTask));
  };

  // ステータス切替（検収ありの工程は検収フローを経由）
  const cycleStatus = (taskId: string, stepIdx: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const step = task.steps[stepIdx];
    let next: TaskStatus;

    if (step.needsReview) {
      // 検収あり: 未着手→作業中→検収待ち→検収中→完了
      const cycle: TaskStatus[] = ["not_started", "in_progress", "review_waiting", "reviewing", "completed"];
      const idx = cycle.indexOf(step.status);
      next = cycle[(idx + 1) % cycle.length];
    } else {
      // 検収なし: 未着手→作業中→完了
      const cycle: TaskStatus[] = ["not_started", "in_progress", "completed"];
      const idx = cycle.indexOf(step.status);
      next = cycle[(idx + 1) % cycle.length];
    }

    const newSteps = task.steps.map((s, i) => i === stepIdx ? {
      ...s, status: next, completedAt: next === "completed" ? new Date().toISOString() : s.completedAt,
    } : s);
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  const handleReject = (taskId: string, stepIdx: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSteps = [...task.steps];
    newSteps[stepIdx] = { ...newSteps[stepIdx], status: "rejected" };
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  const updateAssignee = (taskId: string, stepIdx: number, assignee: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const newSteps = task.steps.map((s, i) => i === stepIdx ? { ...s, assignee } : s);
    setTasks(saveTask({ ...task, steps: newSteps }));
  };

  const saveMemo = () => {
    if (!editingMemo) return;
    const task = tasks.find((t) => t.id === editingMemo.taskId);
    if (!task) return;
    const newSteps = task.steps.map((s, i) => i === editingMemo.stepIdx ? { ...s, memo: memoText } : s);
    setTasks(saveTask({ ...task, steps: newSteps }));
    setEditingMemo(null);
  };

  const getProgress = (task: ProductionTask) => {
    const done = task.steps.filter((s) => s.status === "completed").length;
    return Math.round((done / task.steps.length) * 100);
  };

  // 台本作成に飛ぶ
  const goToProject = (task: ProductionTask) => {
    if (task.linkedProjectId) {
      router.push(`/create`);
    } else {
      router.push(`/create`);
    }
  };

  // 期限が近いか判定
  const isUrgentByDeadline = (deadline: string) => {
    if (!deadline) return false;
    const diff = (new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 3 && diff >= 0;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">工程表</h1>
        {!isViewer && (
          <button onClick={handleAddRow}
            className="px-4 py-1.5 rounded-lg bg-accent text-white text-xs font-medium hover:bg-accent/90">+ 行を追加</button>
        )}
      </div>

      {editingMemo && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditingMemo(null)}>
          <div className="bg-white rounded-xl p-5 w-96 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-2">メモ編集</h3>
            <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)}
              rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none mb-3" autoFocus />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditingMemo(null)} className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs">キャンセル</button>
              <button onClick={saveMemo} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs">保存</button>
            </div>
          </div>
        </div>
      )}

      {!mounted ? <div className="text-center py-8 text-gray-400">読み込み中...</div> : (
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-2 w-8 font-semibold">No</th>
              <th className="border border-gray-200 px-2 py-2 w-12 font-semibold">🔥</th>
              <th className="border border-gray-200 px-2 py-2 text-left w-52 font-semibold">タイトル</th>
              <th className="border border-gray-200 px-2 py-2 w-16 font-semibold">ジャンル</th>
              <th className="border border-gray-200 px-2 py-2 w-20 font-semibold">ネタ元</th>
              <th className="border border-gray-200 px-2 py-2 w-20 font-semibold">期限</th>
              <th className="border border-gray-200 px-2 py-2 w-12 font-semibold">進捗</th>
              {DEFAULT_STEPS.map((s) => (
                <th key={s.name} className={`border border-gray-200 px-1 py-2 w-24 font-semibold ${s.needsReview ? "bg-yellow-50" : ""}`}>
                  {s.name}{s.needsReview ? " ✋" : ""}
                </th>
              ))}
              <th className="border border-gray-200 px-2 py-2 w-20 font-semibold">公開URL</th>
              <th className="border border-gray-200 px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task, rowIdx) => {
              const deadlineUrgent = isUrgentByDeadline(task.deadline);
              return (
                <tr key={task.id} className={`hover:bg-gray-50/50 ${deadlineUrgent ? "bg-red-50/30" : ""}`}>
                  <td className="border border-gray-200 px-2 py-1.5 text-center font-bold text-gray-400">{rowIdx + 1}</td>
                  <td className="border border-gray-200 px-1 py-1 text-center">
                    <button onClick={() => updateField(task.id, "urgent", !task.urgent)}
                      className="text-base">{task.urgent ? "🔥" : "⬜"}</button>
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    <input type="text" value={task.title} onChange={(e) => updateField(task.id, "title", e.target.value)}
                      placeholder="タイトルを入力" className="w-full px-1 py-1 text-xs outline-none bg-transparent" />
                  </td>
                  <td className="border border-gray-200 px-0.5 py-0.5">
                    <select value={task.genre} onChange={(e) => updateField(task.id, "genre", e.target.value)}
                      className="w-full px-0.5 py-1 text-xs outline-none bg-transparent text-center">
                      {Object.entries(GENRE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5">
                    {task.sourceVideoUrl ? (
                      <a href={task.sourceVideoUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-[10px]">リンク</a>
                    ) : (
                      <input type="text" placeholder="URL" onBlur={(e) => { if (e.target.value) updateField(task.id, "sourceVideoUrl", e.target.value); }}
                        className="w-full px-1 py-1 text-[10px] outline-none bg-transparent" />
                    )}
                  </td>
                  <td className={`border border-gray-200 px-0.5 py-0.5 ${deadlineUrgent ? "text-red-600 font-bold" : ""}`}>
                    <input type="date" value={task.deadline} onChange={(e) => updateField(task.id, "deadline", e.target.value)}
                      className="w-full px-0.5 py-1 text-xs outline-none bg-transparent" />
                  </td>
                  <td className="border border-gray-200 px-1 py-1.5 text-center">
                    <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${getProgress(task)}%` }} />
                    </div>
                    <span className="text-[10px] text-gray-400">{getProgress(task)}%</span>
                  </td>
                  {task.steps.map((step, stepIdx) => (
                    <td key={stepIdx} className={`border border-gray-200 px-0.5 py-0.5 ${step.needsReview && (step.status === "review_waiting" || step.status === "reviewing") ? "bg-yellow-50" : ""}`}>
                      <div className="flex flex-col items-center gap-0.5">
                        <button onClick={() => cycleStatus(task.id, stepIdx)}
                          className={`w-full px-0.5 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[step.status]}`}>
                          {TASK_STATUS_LABELS[step.status]}
                        </button>
                        <select value={step.assignee} onChange={(e) => updateAssignee(task.id, stepIdx, e.target.value)}
                          className="w-full text-[10px] text-gray-500 outline-none bg-transparent text-center">
                          {members.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <div className="flex gap-0.5">
                          {step.status === "reviewing" && (
                            <button onClick={() => handleReject(task.id, stepIdx)} className="text-[9px] text-red-500 hover:underline">戻し</button>
                          )}
                          <button onClick={() => { setEditingMemo({ taskId: task.id, stepIdx }); setMemoText(step.memo); }}
                            className={`text-[9px] ${step.memo ? "text-accent" : "text-gray-400"} hover:underline`}>
                            {step.memo ? "📝" : "メモ"}
                          </button>
                          {step.name === "台本作成" && (
                            <button onClick={() => goToProject(task)} className="text-[9px] text-accent hover:underline">開く</button>
                          )}
                        </div>
                      </div>
                    </td>
                  ))}
                  <td className="border border-gray-200 px-1 py-0.5">
                    {task.publishUrl ? (
                      <a href={task.publishUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline text-[10px]">公開済</a>
                    ) : (
                      <input type="text" placeholder="URL" onBlur={(e) => { if (e.target.value) updateField(task.id, "publishUrl", e.target.value); }}
                        className="w-full px-1 py-1 text-[10px] outline-none bg-transparent" />
                    )}
                  </td>
                  <td className="border border-gray-200 px-1 py-0.5 text-center">
                    <button onClick={() => { deleteTask(task.id); setTasks(getTasks()); }} className="text-gray-300 hover:text-red-500">×</button>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && (
              <tr><td colSpan={7 + DEFAULT_STEPS.length + 1} className="border border-gray-200 px-4 py-8 text-center text-gray-400">
                「+ 行を追加」で動画を追加、または台本作成から自動追加されます
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      <div className="flex gap-4 mt-3 text-[10px] text-gray-500">
        <span><span className="inline-block w-3 h-3 rounded bg-gray-100 mr-1" />未着手</span>
        <span><span className="inline-block w-3 h-3 rounded bg-blue-100 mr-1" />作業中</span>
        <span><span className="inline-block w-3 h-3 rounded bg-yellow-100 mr-1" />検収待ち</span>
        <span><span className="inline-block w-3 h-3 rounded bg-orange-100 mr-1" />検収中</span>
        <span><span className="inline-block w-3 h-3 rounded bg-green-100 mr-1" />完了</span>
        <span><span className="inline-block w-3 h-3 rounded bg-red-100 mr-1" />差し戻し</span>
        <span>✋ = 検収あり工程</span>
      </div>
    </div>
  );
}
