"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getXPosts,
  addXPost,
  updateXPost,
  deleteXPost,
  getXBearerToken,
  type XPostLocal,
} from "@/lib/x-store";
import { getApiKey } from "@/lib/channel-store";
import { runSafetyCheck, detectSpamPatterns } from "@/lib/x-safety";

type GenerateType = "promotion" | "trend" | "daily" | "engagement";
type ViewMode = "list" | "generate";

// ===== 投稿生成パネル =====
function GeneratePanel({
  initialType,
  onDraftCreated,
}: {
  initialType?: GenerateType;
  onDraftCreated: () => void;
}) {
  const [genType, setGenType] = useState<GenerateType>(initialType || "promotion");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");

  // タイプ別のコンテキスト入力
  const [videoTitle, setVideoTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [trendKeyword, setTrendKeyword] = useState("");
  const [topic, setTopic] = useState("");

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      setError("AI APIキーが設定されていません。設定ページから登録してください。");
      return;
    }

    setLoading(true);
    setError("");
    setSuggestions([]);

    const context: Record<string, string> = {};
    switch (genType) {
      case "promotion":
        context.videoTitle = videoTitle;
        context.videoUrl = videoUrl;
        break;
      case "trend":
        context.trendKeyword = trendKeyword;
        context.channelTheme = "占い・スピリチュアル";
        break;
      case "daily":
        context.theme = topic || "全体運";
        break;
      case "engagement":
        context.topic = topic;
        break;
    }

    try {
      const res = await fetch("/api/x/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: genType, aiApiKey, context }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuggestions(data.suggestions || [data.text]);
      }
    } catch {
      setError("生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = (content: string) => {
    addXPost({
      content,
      type: genType,
      status: "draft",
    });
    onDraftCreated();
  };

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">投稿をAI生成</h2>

      {/* タイプ選択 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: "promotion", label: "動画宣伝" },
          { key: "trend", label: "トレンド" },
          { key: "daily", label: "今日の占い" },
          { key: "engagement", label: "エンゲージメント" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setGenType(t.key as GenerateType)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              genType === t.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* タイプ別入力フォーム */}
      <div className="space-y-3 mb-4">
        {genType === "promotion" && (
          <>
            <input
              type="text"
              value={videoTitle}
              onChange={(e) => setVideoTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="動画タイトル"
            />
            <input
              type="text"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="動画URL（任意）"
            />
          </>
        )}
        {genType === "trend" && (
          <input
            type="text"
            value={trendKeyword}
            onChange={(e) => setTrendKeyword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="トレンドキーワード"
          />
        )}
        {(genType === "daily" || genType === "engagement") && (
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder={genType === "daily" ? "テーマ（例: 金運、恋愛運）" : "トピック（任意）"}
          />
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "生成中..." : "AIで投稿案を生成"}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 生成結果 */}
      {suggestions.length > 0 && (
        <div className="mt-4 space-y-3">
          <h3 className="text-sm font-medium text-gray-500">生成された投稿案:</h3>
          {suggestions.map((s, i) => (
            <div
              key={i}
              className="p-4 bg-gray-50 rounded-lg border border-gray-100"
            >
              <p className="text-sm text-foreground whitespace-pre-wrap mb-3">{s}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{s.length}/280文字</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveDraft(s)}
                    className="px-3 py-1 text-xs bg-accent text-white rounded-lg hover:bg-accent/90"
                  >
                    下書き保存
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== 投稿エディタ（下書き編集 + 投稿） =====
function PostEditor({
  post,
  onUpdate,
  onDelete,
}: {
  post: XPostLocal;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [content, setContent] = useState(post.content);
  const [posting, setPosting] = useState(false);
  const [safetyResult, setSafetyResult] = useState<ReturnType<typeof runSafetyCheck> | null>(null);
  const [spamWarnings, setSpamWarnings] = useState<string[]>([]);

  useEffect(() => {
    setSafetyResult(runSafetyCheck(content));
    setSpamWarnings(detectSpamPatterns(content));
  }, [content]);

  const handleSave = () => {
    updateXPost(post.id, { content });
    onUpdate();
  };

  const handlePost = async () => {
    const bearerToken = getXBearerToken();
    if (!bearerToken) {
      alert("Xアカウントを接続してください");
      return;
    }

    if (safetyResult && !safetyResult.passed) {
      if (!confirm("安全チェックに通過していない項目があります。投稿しますか？")) return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/x/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, bearerToken }),
      });
      const data = await res.json();
      if (data.error) {
        alert(`投稿エラー: ${data.error}`);
      } else {
        updateXPost(post.id, {
          content,
          status: "posted",
          postedAt: new Date().toISOString(),
          tweetId: data.tweet?.id,
        });
        onUpdate();
      }
    } catch {
      alert("投稿に失敗しました");
    } finally {
      setPosting(false);
    }
  };

  const typeLabels: Record<string, string> = {
    promotion: "動画宣伝",
    trend: "トレンド",
    daily: "占い",
    reply: "リプライ",
    thread: "スレッド",
    engagement: "エンゲージメント",
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
            {typeLabels[post.type] || post.type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            post.status === "posted" ? "bg-green-100 text-green-700" :
            post.status === "failed" ? "bg-red-100 text-red-700" :
            "bg-yellow-100 text-yellow-700"
          }`}>
            {post.status === "posted" ? "投稿済" : post.status === "failed" ? "失敗" : "下書き"}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(post.createdAt).toLocaleDateString("ja-JP")}
        </span>
      </div>

      {post.status === "draft" ? (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[100px] resize-y"
          />

          <div className="flex items-center justify-between text-xs">
            <span className={content.length > 280 ? "text-red-500" : "text-gray-400"}>
              {content.length}/280文字
            </span>
          </div>

          {/* 安全チェック結果 */}
          {safetyResult && (
            <div className="space-y-1">
              {safetyResult.checks.map((check) => (
                <div key={check.name} className="flex items-center gap-2 text-xs">
                  <span className={check.passed ? "text-green-500" : "text-red-500"}>
                    {check.passed ? "OK" : "NG"}
                  </span>
                  <span className="text-gray-500">{check.name}:</span>
                  <span className={check.passed ? "text-gray-600" : "text-red-600"}>
                    {check.message}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* スパム警告 */}
          {spamWarnings.length > 0 && (
            <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
              {spamWarnings.map((w, i) => (
                <p key={i} className="text-xs text-yellow-700">{w}</p>
              ))}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { deleteXPost(post.id); onDelete(); }}
              className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700"
            >
              削除
            </button>
            <button
              onClick={handleSave}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              保存
            </button>
            <button
              onClick={handlePost}
              disabled={posting || content.length > 280 || content.trim().length === 0}
              className="px-4 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
            >
              {posting ? "投稿中..." : "Xに投稿"}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground whitespace-pre-wrap">{post.content}</p>
          {post.status === "posted" && post.tweetId && (
            <div className="flex items-center gap-4 text-xs text-gray-400">
              {post.impressions != null && <span>閲覧: {post.impressions}</span>}
              {post.likes != null && <span>いいね: {post.likes}</span>}
              {post.retweets != null && <span>RT: {post.retweets}</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== メインページ =====
export default function XPostsPage() {
  const searchParams = useSearchParams();
  const [posts, setPosts] = useState<XPostLocal[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [filter, setFilter] = useState<"all" | "draft" | "posted">("all");
  const [loaded, setLoaded] = useState(false);

  const actionParam = searchParams.get("action");
  const typeParam = searchParams.get("type") as GenerateType | null;

  useEffect(() => {
    setPosts(getXPosts());
    setLoaded(true);
    if (actionParam === "generate") {
      setViewMode("generate");
    }
  }, [actionParam]);

  const refreshPosts = () => setPosts(getXPosts());

  const filteredPosts = posts.filter((p) => {
    if (filter === "draft") return p.status === "draft";
    if (filter === "posted") return p.status === "posted";
    return true;
  });

  if (!loaded) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground">投稿管理</h1>
        <p className="text-sm text-gray-400 mt-1">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">投稿管理</h1>
          <p className="text-sm text-gray-500 mt-1">X投稿の作成・編集・投稿</p>
        </div>
        <div className="flex gap-2">
          <Link href="/x-automation" className="text-sm text-gray-500 hover:text-gray-700">
            ← ダッシュボード
          </Link>
        </div>
      </div>

      {/* タブ切り替え */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode("generate")}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
            viewMode === "generate"
              ? "border-accent bg-accent/10 text-accent"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          AI生成
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
            viewMode === "list"
              ? "border-accent bg-accent/10 text-accent"
              : "border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
        >
          投稿一覧 ({posts.length})
        </button>
      </div>

      {viewMode === "generate" ? (
        <GeneratePanel
          initialType={typeParam || undefined}
          onDraftCreated={() => {
            refreshPosts();
            setViewMode("list");
          }}
        />
      ) : (
        <>
          {/* フィルター */}
          <div className="flex gap-2">
            {(["all", "draft", "posted"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                  filter === f
                    ? "border-gray-800 bg-gray-800 text-white"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {f === "all" ? "全て" : f === "draft" ? "下書き" : "投稿済"}
              </button>
            ))}
          </div>

          {/* 投稿一覧 */}
          <div className="space-y-3">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400 mb-3">投稿がありません</p>
                <button
                  onClick={() => setViewMode("generate")}
                  className="text-sm text-accent hover:underline"
                >
                  AIで投稿を生成 →
                </button>
              </div>
            ) : (
              filteredPosts.map((post) => (
                <PostEditor
                  key={post.id}
                  post={post}
                  onUpdate={refreshPosts}
                  onDelete={refreshPosts}
                />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
