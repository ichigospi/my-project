"use client";

import { useState, useEffect } from "react";
import {
  getKnowledgeSources,
  addKnowledgeSource,
  deleteKnowledgeSource,
  KnowledgeSource,
} from "@/lib/knowledge-store";

const SOURCE_TYPE_BADGE: Record<
  KnowledgeSource["sourceType"],
  { label: string; cls: string }
> = {
  pdf: { label: "PDF", cls: "bg-blue-100 text-blue-700" },
  text: { label: "テキスト", cls: "bg-green-100 text-green-700" },
  image: { label: "画像OCR", cls: "bg-yellow-100 text-yellow-700" },
  url: { label: "URL", cls: "bg-purple-100 text-purple-700" },
};

type UploadTab = "text" | "url" | "image";

export default function KnowledgePage() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  // Upload form state
  const [activeTab, setActiveTab] = useState<UploadTab>("text");
  const [title, setTitle] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSources(getKnowledgeSources());
  }, []);

  const reload = () => setSources(getKnowledgeSources());

  const resetForm = () => {
    setTitle("");
    setTagsInput("");
    setTextContent("");
    setUrlInput("");
    setImageFile(null);
    setError("");
    setActiveTab("text");
  };

  const parseTags = (input: string): string[] =>
    input
      .split(/[,、]/)
      .map((t) => t.trim())
      .filter(Boolean);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("タイトルを入力してください");
      return;
    }

    setSubmitting(true);
    setError("");
    const tags = parseTags(tagsInput);

    try {
      if (activeTab === "text") {
        if (!textContent.trim()) {
          setError("コンテンツを入力してください");
          setSubmitting(false);
          return;
        }
        addKnowledgeSource({
          title: title.trim(),
          sourceType: "text",
          tags,
          content: textContent,
        });
      } else if (activeTab === "url") {
        if (!urlInput.trim()) {
          setError("URLを入力してください");
          setSubmitting(false);
          return;
        }
        const res = await fetch("/api/knowledge/extract-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlInput.trim() }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "URLからのコンテンツ取得に失敗しました");
          setSubmitting(false);
          return;
        }
        addKnowledgeSource({
          title: title.trim(),
          sourceType: "url",
          tags,
          content: data.content || "",
          description: urlInput.trim(),
        });
      } else if (activeTab === "image") {
        if (!imageFile) {
          setError("画像ファイルを選択してください");
          setSubmitting(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", imageFile);
        const res = await fetch("/api/knowledge/ocr", {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setError(data.error || "OCR処理に失敗しました");
          setSubmitting(false);
          return;
        }
        addKnowledgeSource({
          title: title.trim(),
          sourceType: "image",
          fileName: imageFile.name,
          tags,
          content: data.content || data.text || "",
        });
      }

      reload();
      resetForm();
      setShowModal(false);
    } catch {
      setError("エラーが発生しました。もう一度お試しください。");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    deleteKnowledgeSource(id);
    reload();
  };

  // Derive unique tags
  const allTags = Array.from(new Set(sources.flatMap((s) => s.tags))).sort();

  // Filter sources
  const filtered = sources.filter((s) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      s.title.toLowerCase().includes(q) ||
      s.tags.some((t) => t.toLowerCase().includes(q));
    const matchesTag = !activeTagFilter || s.tags.includes(activeTagFilter);
    return matchesSearch && matchesTag;
  });

  const tabs: { key: UploadTab; label: string }[] = [
    { key: "text", label: "テキスト" },
    { key: "url", label: "URL" },
    { key: "image", label: "画像OCR" },
  ];

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            教材・ナレッジベース
          </h1>
          <p className="text-gray-500 mt-1">
            台本生成に活用する教材やナレッジを管理します。テキスト・URL・画像から知識を登録できます。
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors shrink-0"
        >
          + 新規登録
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="タイトルやタグで検索..."
          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
        />
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTagFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeTagFilter === null
                ? "bg-accent text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            すべて
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() =>
                setActiveTagFilter(activeTagFilter === tag ? null : tag)
              }
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTagFilter === tag
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Source list */}
      {filtered.length === 0 ? (
        <div className="bg-card-bg rounded-xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 text-sm">
            {sources.length === 0
              ? "まだナレッジが登録されていません。「+ 新規登録」から追加してください。"
              : "検索条件に一致するナレッジがありません。"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((source) => (
            <div
              key={source.id}
              className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 flex items-start justify-between gap-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-foreground truncate">
                    {source.title}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${
                      SOURCE_TYPE_BADGE[source.sourceType].cls
                    }`}
                  >
                    {SOURCE_TYPE_BADGE[source.sourceType].label}
                  </span>
                </div>
                {source.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {source.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[11px] font-medium"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{source.totalChunks} チャンク</span>
                  <span>
                    {new Date(source.createdAt).toLocaleDateString("ja-JP")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDelete(source.id, source.title)}
                className="text-gray-300 hover:text-danger text-lg leading-none shrink-0 mt-1"
                title="削除"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-card-bg rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground">
                  ナレッジを登録
                </h2>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-foreground text-xl leading-none"
                >
                  &times;
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 mb-5">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setError("");
                    }}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? "border-accent text-accent"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Common fields */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    タイトル
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例: マーケティング基礎知識"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    タグ（カンマ区切り）
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="例: マーケティング, 基礎, SEO"
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm"
                  />
                </div>

                {/* Tab-specific fields */}
                {activeTab === "text" && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      コンテンツ
                    </label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="ナレッジの内容をここに入力..."
                      rows={8}
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm resize-y"
                    />
                  </div>
                )}

                {activeTab === "url" && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      URL
                    </label>
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/article"
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-mono"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      指定URLのコンテンツを自動取得します
                    </p>
                  </div>
                )}

                {activeTab === "image" && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      画像ファイル
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        setImageFile(e.target.files?.[0] || null)
                      }
                      className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-accent/10 file:text-accent hover:file:bg-accent/20"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      画像内のテキストをOCRで抽出します
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-danger">{error}</p>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowModal(false);
                      resetForm();
                    }}
                    className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-5 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
                  >
                    {submitting ? "処理中..." : "登録する"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
