"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getXArticles, addXArticle, updateXArticle, deleteXArticle, getAiApiKey, type XArticleLocal } from "@/lib/x-store";

type ArticleType = "from_script" | "trend" | "curated";

function ArticleGeneratePanel({ onCreated }: { onCreated: () => void }) {
  const [articleType, setArticleType] = useState<ArticleType>("from_script");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState("");
  const [scriptTitle, setScriptTitle] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [trendKeyword, setTrendKeyword] = useState("");
  const [curatedTopic, setCuratedTopic] = useState("");

  const handleGenerate = async () => {
    const aiApiKey = getAiApiKey();
    if (!aiApiKey) { setError("AI APIキーが未設定です。設定ページで登録してください。"); return; }
    setLoading(true); setError(""); setGenerated("");
    const context: Record<string, string> = {};
    if (articleType === "from_script") { context.scriptTitle = scriptTitle; context.scriptContent = scriptContent; }
    else if (articleType === "trend") { context.trendKeyword = trendKeyword; }
    else { context.topic = curatedTopic; }

    try {
      const res = await fetch("/api/x/article", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: articleType, aiApiKey, context }) });
      const data = await res.json();
      if (data.error) setError(data.error); else setGenerated(data.content);
    } catch { setError("記事生成に失敗しました"); } finally { setLoading(false); }
  };

  const handleSave = () => {
    if (!generated) return;
    const titleMatch = generated.match(/^#+ (.+)/m);
    const title = titleMatch?.[1] || `${articleType === "from_script" ? scriptTitle : articleType === "trend" ? trendKeyword : curatedTopic} - 記事`;
    addXArticle({ title, content: generated, sourceType: articleType, format: "markdown", status: "draft" });
    onCreated(); setGenerated("");
  };

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">記事をAI生成</h2>
      <div className="flex gap-2 mb-4 flex-wrap">
        {([["from_script", "台本→記事変換"], ["trend", "トレンド記事"], ["curated", "まとめ記事"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setArticleType(k)} className={`px-3 py-1.5 text-sm rounded-lg border ${articleType === k ? "border-accent bg-accent/10 text-accent" : "border-gray-200 text-gray-600"}`}>{l}</button>
        ))}
      </div>
      <div className="space-y-3 mb-4">
        {articleType === "from_script" && (<><input type="text" value={scriptTitle} onChange={(e) => setScriptTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="台本タイトル" /><textarea value={scriptContent} onChange={(e) => setScriptContent(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[200px] resize-y" placeholder="台本の内容を貼り付け..." /></>)}
        {articleType === "trend" && <input type="text" value={trendKeyword} onChange={(e) => setTrendKeyword(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="トレンドキーワード（例: 水星逆行）" />}
        {articleType === "curated" && <input type="text" value={curatedTopic} onChange={(e) => setCuratedTopic(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="まとめトピック" />}
      </div>
      <button onClick={handleGenerate} disabled={loading} className="w-full py-2.5 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">{loading ? "生成中..." : "AIで記事を生成"}</button>
      {error && <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
      {generated && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-medium text-gray-500">プレビュー</h3><button onClick={handleSave} className="px-4 py-1.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90">下書き保存</button></div>
          <div className="p-4 bg-white border border-gray-200 rounded-lg max-h-[500px] overflow-y-auto"><pre className="whitespace-pre-wrap text-sm text-foreground font-sans">{generated}</pre></div>
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article, onUpdate, onDelete }: { article: XArticleLocal; onUpdate: () => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(article.title);
  const [content, setContent] = useState(article.content);
  const sourceLabels: Record<string, string> = { from_script: "台本変換", trend: "トレンド", curated: "まとめ" };

  return (
    <div className="bg-card-bg rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-600">{sourceLabels[article.sourceType] || article.sourceType}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${article.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{article.status === "published" ? "公開済" : "下書き"}</span>
        </div>
        <span className="text-xs text-gray-400">{new Date(article.updatedAt).toLocaleDateString("ja-JP")}</span>
      </div>
      {editing ? (
        <div className="space-y-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm min-h-[300px] resize-y font-mono" />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-500">キャンセル</button>
            <button onClick={() => { updateXArticle(article.id, { title, content }); setEditing(false); onUpdate(); }} className="px-4 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90">保存</button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="font-semibold text-foreground mb-2">{article.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-3 mb-3">{article.content.replace(/^#+\s.+\n*/gm, "").slice(0, 200)}...</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { deleteXArticle(article.id); onDelete(); }} className="px-3 py-1.5 text-xs text-red-500 hover:text-red-700">削除</button>
            <button onClick={() => { navigator.clipboard.writeText(content); alert("コピーしました"); }} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">コピー</button>
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50">編集</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<XArticleLocal[]>([]);
  const [showGenerate, setShowGenerate] = useState(true);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { setArticles(getXArticles()); setLoaded(true); }, []);
  const refresh = () => setArticles(getXArticles());

  if (!loaded) return <div className="p-8"><h1 className="text-2xl font-bold">記事作成</h1><p className="text-sm text-gray-400 mt-1">読み込み中...</p></div>;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-2xl font-bold text-foreground">記事作成</h1><p className="text-sm text-gray-500 mt-1">台本やトレンドからブログ・note記事を自動生成</p></div><Link href="/" className="text-sm text-gray-500 hover:text-gray-700">← ダッシュボード</Link></div>
      <button onClick={() => setShowGenerate(!showGenerate)} className="text-sm text-accent hover:underline">{showGenerate ? "生成パネルを閉じる" : "新規記事を生成 →"}</button>
      {showGenerate && <ArticleGeneratePanel onCreated={() => { refresh(); setShowGenerate(false); }} />}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">記事一覧 ({articles.length})</h2>
        {articles.length === 0 ? (
          <div className="text-center py-12 bg-card-bg rounded-xl border border-gray-100"><p className="text-sm text-gray-400 mb-3">記事がありません</p><button onClick={() => setShowGenerate(true)} className="text-sm text-accent hover:underline">AIで記事を生成 →</button></div>
        ) : (
          <div className="space-y-4">{articles.map((a) => <ArticleCard key={a.id} article={a} onUpdate={refresh} onDelete={refresh} />)}</div>
        )}
      </div>
    </div>
  );
}
