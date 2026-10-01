// Chatwork通知の送信ヘルパー（fire-and-forget）。
// 未設定・失敗しても本処理（台本提出・合格等）は止めない。
import { getApiKey } from "./channel-store";

export interface ChatworkTask {
  body: string;               // タスク内容
  assign: "owner" | "writers"; // 担当者（設定済みアカウントIDに割り当て）
}

export function notifyChatwork(message: string, task?: ChatworkTask) {
  try {
    fetch("/api/notify/chatwork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, task }),
    }).then(async (res) => {
      const data = await res.json().catch(() => null);
      if (data && data.ok === false && !data.skipped) {
        console.warn("[chatwork]", data.error || data.reason);
      }
    }).catch(() => { /* 通知失敗は無視 */ });
  } catch { /* ignore */ }
}

// カンマ/空白区切りのアカウントID文字列を [To:id] タグ列に変換
function toTags(raw: string): string {
  return (raw || "")
    .split(/[,、\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s))
    .map((id) => `[To:${id}]`)
    .join("");
}

export interface ReviewMessageOpts {
  reviewUrl?: string;  // 添削部屋ページのURL
  refUrls?: string[];  // 元ネタ動画のURL
}

// 台本レビュー系の定型メッセージ（Chatwork記法）
// 提出→オーナーにメンション / 合格・再提出→ライターにメンション
export function reviewMessage(kind: "submitted" | "approved" | "rejected", channelName: string, title: string, opts?: ReviewMessageOpts): string {
  const heads = {
    submitted: "📤 台本が提出されました（添削待ち）",
    approved: "✅ 台本が合格になりました",
    rejected: "🔁 台本の再提出依頼が出されました",
  } as const;
  const bodies = {
    submitted: "添削部屋（ステップ⑦）で確認・添削をお願いします。",
    approved: "添削後の台本が最終稿として反映されています。",
    rejected: "オーナーコメントを確認し、台本を修正して再提出してください。",
  } as const;
  const mention = kind === "submitted" ? toTags(getApiKey("chatwork_owner_id")) : toTags(getApiKey("chatwork_writer_ids"));
  const lines = [
    `チャンネル: ${channelName || "未設定"}`,
    `企画: ${title || "（タイトル未定）"}`,
    ...(opts?.reviewUrl ? [`添削部屋: ${opts.reviewUrl}`] : []),
    ...(opts?.refUrls && opts.refUrls.length > 0 ? [`元ネタ: ${opts.refUrls.join("\n")}`] : []),
    bodies[kind],
  ];
  return `${mention ? mention + "\n" : ""}[info][title]${heads[kind]}[/title]${lines.join("\n")}[/info]`;
}

// プロジェクトから添削部屋の直リンクを作る
export function reviewRoomUrl(projectId: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/create?project=${encodeURIComponent(projectId)}&step=review`;
}

// プロジェクトの元ネタ動画URL（選択済み優先・最大3件）
export function refVideoUrls(referenceVideos: { videoId: string; selected?: boolean }[] | undefined): string[] {
  const list = referenceVideos || [];
  const selected = list.filter((v) => v.selected);
  return (selected.length > 0 ? selected : list).slice(0, 3).map((v) => `https://www.youtube.com/watch?v=${v.videoId}`);
}
