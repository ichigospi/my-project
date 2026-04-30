// ポスト収集モーダル（手動ペースト）と既存ポストの編集
"use client";

import { useState, useEffect } from "react";
import { parseXUrl, type XCollectedPost, type XCompetitor } from "@/lib/x-post-types";
import { getApiKey } from "@/lib/channel-store";

interface Props {
  // 新規収集の場合: 紐付ける競合を渡す
  competitor?: XCompetitor;
  // 編集の場合: 既存ポストを渡す
  post?: XCollectedPost;
  onClose: () => void;
  onSaved: () => void;
}

export default function PostCollectModal({ competitor, post, onClose, onSaved }: Props) {
  const [postUrl, setPostUrl] = useState(post?.postUrl ?? "");
  const [postId, setPostId] = useState(post?.postId ?? "");
  const [content, setContent] = useState(post?.content ?? "");
  const [likes, setLikes] = useState(String(post?.likes ?? 0));
  const [retweets, setRetweets] = useState(String(post?.retweets ?? 0));
  const [replies, setReplies] = useState(String(post?.replies ?? 0));
  const [impressions, setImpressions] = useState(String(post?.impressions ?? 0));
  const [postedAt, setPostedAt] = useState(post?.postedAt ? post.postedAt.slice(0, 16) : "");
  const [isQuoteRt, setIsQuoteRt] = useState(post?.isQuoteRt ?? false);
  const [quotedPostUrl, setQuotedPostUrl] = useState(post?.quotedPostUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [continueAdding, setContinueAdding] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractResult, setExtractResult] = useState<{ name: string; savedId: string | null } | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupMsg, setLookupMsg] = useState<{ type: "ok" | "warn" | "err"; text: string } | null>(null);

  // URL貼り付けで postId を自動抽出
  useEffect(() => {
    if (!postUrl) return;
    const parsed = parseXUrl(postUrl);
    if (parsed.postId && !postId) {
      setPostId(parsed.postId);
    }
  }, [postUrl, postId]);

  const lookup = async () => {
    if (!postUrl.trim()) {
      setLookupMsg({ type: "err", text: "URLを入力してください" });
      return;
    }
    const targetCompetitor = competitor ?? post?.competitor;
    const competitorId = post?.competitorId ?? competitor?.id;
    if (!competitorId && !targetCompetitor) {
      setLookupMsg({ type: "err", text: "競合アカウントが特定できません" });
      return;
    }
    setLooking(true);
    setLookupMsg(null);
    try {
      const res = await fetch("/api/x-post/posts/lookup-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: postUrl.trim(),
          competitorId,
          genre: targetCompetitor?.genre,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupMsg({ type: "err", text: data.error || "取得失敗" });
        return;
      }

      // フィールドにフィル
      if (data.postId) setPostId(data.postId);
      if (data.postUrl) setPostUrl(data.postUrl);
      if (data.content) setContent(data.content);
      if (data.likes !== undefined) setLikes(String(data.likes));
      if (data.retweets !== undefined) setRetweets(String(data.retweets));
      if (data.replies !== undefined) setReplies(String(data.replies));
      if (data.impressions !== undefined && data.impressions > 0) setImpressions(String(data.impressions));
      if (data.postedAt) {
        // ISO → datetime-local 形式（YYYY-MM-DDTHH:MM）
        try {
          const d = new Date(data.postedAt);
          const pad = (n: number) => String(n).padStart(2, "0");
          const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
          setPostedAt(local);
        } catch {}
      }
      if (data.isQuoteRt) setIsQuoteRt(true);

      const sourceLabel =
        data.source === "x_api" ? "X API"
        : data.source === "oembed" ? "oEmbed"
        : "部分取得";
      const warn = (data.warnings ?? []).join(" / ");
      setLookupMsg({
        type: warn ? "warn" : "ok",
        text: `✓ ${sourceLabel}で取得${warn ? ` — ${warn}` : ""}`,
      });
    } catch (e) {
      setLookupMsg({ type: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLooking(false);
    }
  };

  const reset = () => {
    setPostUrl("");
    setPostId("");
    setContent("");
    setLikes("0");
    setRetweets("0");
    setReplies("0");
    setImpressions("0");
    setPostedAt("");
    setIsQuoteRt(false);
    setQuotedPostUrl("");
  };

  const save = async () => {
    if (!content.trim()) {
      alert("本文は必須です");
      return;
    }
    const targetCompetitorId = post?.competitorId ?? competitor?.id;
    if (!targetCompetitorId) {
      alert("競合アカウントが特定できません");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        competitorId: targetCompetitorId,
        postId,
        postUrl,
        content,
        likes: Number(likes) || 0,
        retweets: Number(retweets) || 0,
        replies: Number(replies) || 0,
        impressions: Number(impressions) || 0,
        postedAt: postedAt || null,
        isQuoteRt,
        quotedPostUrl: isQuoteRt ? quotedPostUrl : "",
      };
      const res = await fetch(
        post ? `/api/x-post/posts/${post.id}` : "/api/x-post/posts",
        {
          method: post ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`保存失敗: ${e.error || res.statusText}`);
        return;
      }
      onSaved();
      if (continueAdding && !post) {
        // 続けて追加: モーダル閉じずにフォームだけリセット
        reset();
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const extractTemplate = async () => {
    if (!post) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      alert("AI APIキーが未設定です。設定ページで登録してください。");
      return;
    }
    setExtracting(true);
    setExtractResult(null);
    try {
      const res = await fetch("/api/x-post/extract-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id, aiApiKey, save: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`抽出失敗: ${data.error || res.statusText}`);
        return;
      }
      setExtractResult({ name: data.template?.name ?? "(無題)", savedId: data.savedId });
    } finally {
      setExtracting(false);
    }
  };

  const remove = async () => {
    if (!post) return;
    if (!confirm("この収集ポストを削除しますか？")) return;
    const res = await fetch(`/api/x-post/posts/${post.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    onSaved();
    onClose();
  };

  const competitorLabel = competitor
    ? `@${competitor.handle}${competitor.name ? `（${competitor.name}）` : ""}`
    : post
      ? `@${post.competitor.handle}${post.competitor.name ? `（${post.competitor.name}）` : ""}`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold">{post ? "収集ポストを編集" : "📥 ポスト収集"}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{competitorLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">ポストURL（推奨）</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={postUrl}
                onChange={(e) => setPostUrl(e.target.value)}
                placeholder="https://x.com/xxx/status/1234567890..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
              <button
                type="button"
                onClick={lookup}
                disabled={looking || !postUrl.trim()}
                className="shrink-0 px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-300 text-white text-sm font-medium rounded"
                title="URLから本文・いいね・RT・返信・日時を自動取得（インプは要手入力）"
              >
                {looking ? "取得中..." : "🔍 URLから取得"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              URLから本文・いいね/RT/返信/日時を自動取得。インプは X 画面の「N views」を見て手入力。
            </p>
            {lookupMsg && (
              <div className={`mt-2 text-xs rounded px-2 py-1 ${
                lookupMsg.type === "ok"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : lookupMsg.type === "warn"
                    ? "bg-amber-50 text-amber-800 border border-amber-200"
                    : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {lookupMsg.text}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              本文 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="ポストの本文を貼り付け"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">{content.length}文字</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">いいね</label>
              <input type="number" value={likes} onChange={(e) => setLikes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">RT</label>
              <input type="number" value={retweets} onChange={(e) => setRetweets(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">返信</label>
              <input type="number" value={replies} onChange={(e) => setReplies(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">インプ</label>
              <input type="number" value={impressions} onChange={(e) => setImpressions(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">投稿日時（任意）</label>
              <input
                type="datetime-local"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">postId（自動）</label>
              <input
                type="text"
                value={postId}
                onChange={(e) => setPostId(e.target.value)}
                placeholder="自動抽出される"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50"
              />
            </div>
          </div>

          <div className="bg-gray-50 rounded-md p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={isQuoteRt}
                onChange={(e) => setIsQuoteRt(e.target.checked)}
              />
              <span>このポストは引用RT</span>
            </label>
            {isQuoteRt && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">引用元のURL</label>
                <input
                  type="text"
                  value={quotedPostUrl}
                  onChange={(e) => setQuotedPostUrl(e.target.value)}
                  placeholder="https://x.com/.../status/..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {post && (
              <button onClick={remove} className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded">
                🗑️ 削除
              </button>
            )}
            {post && (
              <button
                onClick={extractTemplate}
                disabled={extracting}
                className="text-sm bg-amber-50 hover:bg-amber-100 disabled:bg-amber-50/50 text-amber-800 px-3 py-1.5 rounded"
              >
                {extracting ? "抽出中..." : "🧪 テンプレ化"}
              </button>
            )}
            {extractResult && (
              <span className="text-xs text-emerald-700">
                ✓ 「{extractResult.name}」を保存
              </span>
            )}
            {!post && (
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={continueAdding}
                  onChange={(e) => setContinueAdding(e.target.checked)}
                />
                続けて追加（モーダルを閉じない）
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded">
              キャンセル
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-4 py-1.5 rounded"
            >
              {saving ? "保存中..." : post ? "保存" : "+ 収集"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
