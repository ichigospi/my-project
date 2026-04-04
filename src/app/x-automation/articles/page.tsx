"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  getXArticles,
  addXArticle,
  updateXArticle,
  deleteXArticle,
  type XArticleLocal,
} from "@/lib/x-store";
import { getApiKey } from "@/lib/channel-store";

type ArticleType = "from_script" | "trend" | "curated";

// ===== 記事生成パネル =====
function ArticleGeneratePanel({ onCreated }: { onCreated: () => void }) {
  const [articleType, setArticleType] = useState<ArticleType>("from_script");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generatedContent, setGeneratedContent] = useState("");

  // コンテキスト入力
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [trendKeyword, setTrendKeyword] = useState("");
  const [curatedTopic, setCuratedTopic] = useState("");

  const handleGenerate = async () => {
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      setError("AI APIキーが設定されていません。設定ページから登録してください。");
      return;
    }

    setLoading(true);
    setError("");
    setGeneratedContent("");

    const context: Record<string, string> = {};
    switch (articleType) {
      case "from_script":
        context.scriptTitle = scriptTitle;
        context.scriptContent = scriptContent;
        break;
      case "trend":
        context.trendKeyword = trendKeyword;
        break;
      case "curated":
        context.topic = curatedTopic;
        break;
    }

    try {
      const res = await fetch("/api/x/article", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: articleType, aiApiKey, context }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setGeneratedContent(data.content);
      }
    } catch {
      setError("記事生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!generatedContent) return;

    // タイトル抽出（最初のH1/H2行、またはデフォルト）
    const titleMatch = generatedContent.match(/^#+ (.+)/m);
    const title = titleMatch?.[1] || `${articleType === "from_script" ? scriptTitle : articleType === "trend" ? trendKeyword : curatedTopic} - 記事`;

    addXArticle({
      title,
      content: generatedContent,
      sourceType: articleType,
      format: "markdown",
      status: "draft",
    });
    onCreated();
    setGeneratedContent("");
  };

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">記事をAI生成</h2>

      {/* タイプ選択 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: "from_script", label: "台本→記事変換" },
          { key: "trend", label: "トレンド記事" },
          { key: "curated", label: "まとめ記事" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setArticleType(t.key as ArticleType)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              articleType === t.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* タイプ別入力 */}
      <div className="space-y-3 mb-4">
        {articleType === "from_script" && (
          <>
            <input
              type="text"
              value={scriptTitle}
              onChange={(e) => setScriptTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              placeholder="台本タイトル"
            />
            <textarea
              value={scriptContent}
              onChange={(e) => setScriptContent(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[200px] resize-y"
              placeholder="台本の内容を貼り付け..."
            />
          </>
        )}
        {articleType === "trend" && (
          <input
            type="text"
            value={trendKeyword}
            onChange={(e) => setTrendKeyword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="トレンドキーワード（例: 水星逆行, 満月）"
          />
        )}
        {articleType === "curated" && (
          <input
            type="text"
            value={curatedTopic}
            onChange={(e) => setCuratedTopic(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            placeholder="まとめトピック（例: 2024年下半期の運勢）"
          />
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? "生成中..." : "AIで記事を生成"}
      </button>

      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 生成結果プレビュー */}
      {generatedContent && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-500">プレビュー</h3>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90"
            >
              下書き保存
            </button>
          </div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg max-h-[500px] overflow-y-auto">
            <div className="prose prose-sm max-w-none">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
                {generatedContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== 記事カード =====
function ArticleCard({
  article,
  onUpdate,
  onDelete,
}: {
  article: XArticleLocal;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);

  const sourceLabels: Record<string, string> = {
    script: "台本変換",
    trend: "トレンド",
    curated: "まとめ",
  };

  const handleSave = () => {
    updateXArticle(article.id, { title, content });
    setEditing(false);
    onUpdate();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    alert("記事をクリップボードにコピーしました");
  };

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">
            {sourceLabels[article.sourceType] || article.sourceType}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${
            article.status === "published"
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}>
            {article.status === "published" ? "公開済" : "下書き"}
          </span>
        </div>
        <span className="text-xs text-gray-400">
          {new Date(article.updatedAt).toLocaleDateString("ja-JP")}
        </span>
      </div>

      {editing ? (
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold"
          />
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[300px] resize-y font-mono"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setEditing(false)}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90"
            >
              保存
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-3 mb-3">
            {article.content.replace(/^#+\s.+\n*/gm, "").slice(0, 200)}...
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { deleteXArticle(article.id); onDelete(); }}
              className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700"
            >
              削除
            </button>
            <button
              onClick={handleCopy}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              コピー
            </button>
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              編集
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ===== メインページ =====
export default function XArticlesPage() {
  const [articles, setArticles] = useState<XArticleLocal[]>([]);
  const [showGenerate, setShowGenerate] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setArticles(getXArticles());
    setLoaded(true);
  }, []);

  const refreshArticles = () => setArticles(getXArticles());

  if (!loaded) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground">記事作成</h1>
        <p className="text-sm text-gray-400 mt-1">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">記事作成</h1>
          <p className="text-sm text-gray-500 mt-1">
            台本やトレンドからブログ・note記事を自動生成
          </p>
        </div>
        <Link href="/x-automation" className="text-sm text-gray-500 hover:text-gray-700">
          ← ダッシュボード
        </Link>
      </div>

      {/* 生成パネルトグル */}
      <button
        onClick={() => setShowGenerate(!showGenerate)}
        className="text-sm text-accent hover:underline"
      >
        {showGenerate ? "生成パネルを閉じる" : "新規記事を生成 →"}
      </button>

      {showGenerate && (
        <ArticleGeneratePanel
          onCreated={() => {
            refreshArticles();
            setShowGenerate(false);
          }}
        />
      )}

      {/* 記事一覧 */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          記事一覧 ({articles.length})
        </h2>
        {articles.length === 0 ? (
          <div className="text-center py-12 bg-card-bg rounded-xl border border-gray-100">
            <p className="text-sm text-gray-400 mb-3">記事がありません</p>
            <button
              onClick={() => setShowGenerate(true)}
              className="text-sm text-accent hover:underline"
            >
              AIで記事を生成 →
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onUpdate={refreshArticles}
                onDelete={refreshArticles}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
