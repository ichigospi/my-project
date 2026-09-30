// Chatwork通知の送信ヘルパー（fire-and-forget）。
// 未設定・失敗しても本処理（台本提出・合格等）は止めない。

export function notifyChatwork(message: string) {
  try {
    fetch("/api/notify/chatwork", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).then(async (res) => {
      const data = await res.json().catch(() => null);
      if (data && data.ok === false && !data.skipped) {
        console.warn("[chatwork]", data.error || data.reason);
      }
    }).catch(() => { /* 通知失敗は無視 */ });
  } catch { /* ignore */ }
}

// 台本レビュー系の定型メッセージ（Chatwork記法）
export function reviewMessage(kind: "submitted" | "approved" | "rejected", channelName: string, title: string): string {
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
  return `[info][title]${heads[kind]}[/title]チャンネル: ${channelName || "未設定"}\n企画: ${title || "（タイトル未定）"}\n${bodies[kind]}[/info]`;
}
