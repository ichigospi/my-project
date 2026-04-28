// 参考ポストタブ: フォルダサイドバー + ポスト一覧 + 追加/編集モーダル
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useXPostGenre } from "@/lib/x-post-genre";
import type { XReferencePost } from "@/lib/x-post-types";
import ArrayInput from "./ArrayInput";
import FolderSidebar, { SYSTEM_ALL, SYSTEM_UNFILED } from "./FolderSidebar";

const STRUCTURE_TYPES = [
  "", "フック型", "リスト型", "ストーリー型", "質問型", "対比型", "実績訴求型", "Before/After型",
];

interface ApiPost {
  id: string;
  genre: string;
  title: string;
  content: string;
  authorHandle: string;
  postUrl: string;
  likes: number;
  retweets: number;
  impressions: number;
  postedAt: string | null;
  structureType: string;
  hookAnalysis: string;
  bodyAnalysis: string;
  closingAnalysis: string;
  usedWords: string;
  applicationHint: string;
  tags: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

function parse(record: ApiPost): XReferencePost {
  let usedWords: string[] = [];
  let tags: string[] = [];
  try { usedWords = JSON.parse(record.usedWords || "[]"); } catch { usedWords = []; }
  try { tags = JSON.parse(record.tags || "[]"); } catch { tags = []; }
  return { ...record, usedWords, tags };
}

interface FolderItemRecord { folderId: string; itemId: string; }

export default function ReferencesTab() {
  const [genre] = useXPostGenre();
  const [items, setItems] = useState<XReferencePost[]>([]);
  const [folderItems, setFolderItems] = useState<FolderItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<XReferencePost | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string>(SYSTEM_ALL);
  const [sortBy, setSortBy] = useState<"updatedAt" | "likes" | "impressions">("updatedAt");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [postsRes, foldersRes] = await Promise.all([
        fetch(`/api/x-post/knowledge?genre=${genre}&type=reference_post`),
        fetch(`/api/x-post/folder-items`),
      ]);
      const posts: ApiPost[] = await postsRes.json();
      const fItems: FolderItemRecord[] = await foldersRes.json();
      setItems(posts.map(parse));
      // reference_post タイプだけ抽出（itemTypeフィルタはサーバ側にないので念のため）
      setFolderItems(fItems.filter((fi) => posts.some((p) => p.id === fi.itemId)));
    } finally {
      setLoading(false);
    }
  }, [genre]);

  useEffect(() => { load(); }, [load]);

  // 未分類のポストID（どのフォルダにも入っていないもの）
  const unfiledIds = useMemo(() => {
    const filed = new Set(folderItems.map((fi) => fi.itemId));
    return new Set(items.filter((p) => !filed.has(p.id)).map((p) => p.id));
  }, [items, folderItems]);

  // 選択中フォルダのポストID
  const visibleIds = useMemo(() => {
    if (selectedFolderId === SYSTEM_ALL) return new Set(items.map((p) => p.id));
    if (selectedFolderId === SYSTEM_UNFILED) return unfiledIds;
    const ids = folderItems.filter((fi) => fi.folderId === selectedFolderId).map((fi) => fi.itemId);
    return new Set(ids);
  }, [items, folderItems, unfiledIds, selectedFolderId]);

  // 検索＋フォルダフィルタ＋ソート
  const filtered = useMemo(() => {
    return items
      .filter((p) => visibleIds.has(p.id))
      .filter((p) =>
        !search ||
        p.content.toLowerCase().includes(search.toLowerCase()) ||
        p.authorHandle.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a, b) => {
        if (sortBy === "likes") return b.likes - a.likes;
        if (sortBy === "impressions") return b.impressions - a.impressions;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [items, visibleIds, search, sortBy]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4">
      {/* 左サイドバー: フォルダ */}
      <aside className="bg-white border border-gray-200 rounded-lg p-3 md:sticky md:top-32 md:self-start md:max-h-[calc(100vh-9rem)] md:overflow-y-auto">
        <FolderSidebar
          genre={genre}
          selectedFolderId={selectedFolderId}
          onSelectFolder={setSelectedFolderId}
          totalCount={items.length}
          unfiledCount={unfiledIds.size}
        />
      </aside>

      {/* 右: ポスト一覧 */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <button
            onClick={() => setEditing("new")}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
          >
            + 参考ポストを追加
          </button>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 本文・@・タグで検索"
            className="flex-1 min-w-[180px] px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "updatedAt" | "likes" | "impressions")}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="updatedAt">更新日順</option>
            <option value="likes">いいね順</option>
            <option value="impressions">インプ順</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
            <div className="text-4xl mb-2">📥</div>
            <p className="text-gray-500 text-sm">
              {items.length === 0 ? "まだ参考ポストが登録されていません" : "該当するポストがありません"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <PostCard
                key={p.id}
                post={p}
                folderItemsForPost={folderItems.filter((fi) => fi.itemId === p.id)}
                onClick={() => setEditing(p)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ReferenceModal
          item={editing === "new" ? null : editing}
          genre={genre}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// PostCard
// ============================================================

function PostCard({ post, folderItemsForPost, onClick }: {
  post: XReferencePost;
  folderItemsForPost: FolderItemRecord[];
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 hover:shadow-sm cursor-pointer transition"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="text-xs text-gray-500 font-medium">
          {post.authorHandle && `@${post.authorHandle.replace(/^@/, "")}`}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2 shrink-0">
          <span>👍 {post.likes}</span>
          <span>🔁 {post.retweets}</span>
          {post.impressions > 0 && <span>📊 {post.impressions.toLocaleString()}</span>}
        </div>
      </div>
      <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{post.content}</p>
      {(post.structureType || post.tags.length > 0 || folderItemsForPost.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1.5 items-center">
          {post.structureType && (
            <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded">
              {post.structureType}
            </span>
          )}
          {folderItemsForPost.length > 0 && (
            <span className="text-xs text-gray-500">
              📁 {folderItemsForPost.length}個のフォルダ
            </span>
          )}
          {post.tags.map((t) => (
            <span key={t} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Modal
// ============================================================

interface ModalProps {
  item: XReferencePost | null;
  genre: string;
  onClose: () => void;
  onSaved: () => void;
}

function ReferenceModal({ item, genre, onClose, onSaved }: ModalProps) {
  const [content, setContent] = useState(item?.content ?? "");
  const [authorHandle, setAuthorHandle] = useState(item?.authorHandle ?? "");
  const [postUrl, setPostUrl] = useState(item?.postUrl ?? "");
  const [likes, setLikes] = useState(String(item?.likes ?? 0));
  const [retweets, setRetweets] = useState(String(item?.retweets ?? 0));
  const [impressions, setImpressions] = useState(String(item?.impressions ?? 0));
  const [postedAt, setPostedAt] = useState(item?.postedAt ? item.postedAt.slice(0, 10) : "");
  const [structureType, setStructureType] = useState(item?.structureType ?? "");
  const [hookAnalysis, setHookAnalysis] = useState(item?.hookAnalysis ?? "");
  const [bodyAnalysis, setBodyAnalysis] = useState(item?.bodyAnalysis ?? "");
  const [closingAnalysis, setClosingAnalysis] = useState(item?.closingAnalysis ?? "");
  const [usedWords, setUsedWords] = useState<string[]>(item?.usedWords ?? []);
  const [applicationHint, setApplicationHint] = useState(item?.applicationHint ?? "");
  const [tags, setTags] = useState<string[]>(item?.tags ?? []);
  const [note, setNote] = useState(item?.note ?? "");
  const [folderIds, setFolderIds] = useState<string[]>([]);
  const [allFolders, setAllFolders] = useState<{ id: string; name: string; color: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // フォルダ一覧取得 + このアイテムが所属するフォルダ
  useEffect(() => {
    fetch(`/api/x-post/folders?genre=${genre}`)
      .then((r) => r.json())
      .then(setAllFolders);
    if (item) {
      fetch(`/api/x-post/folder-items?itemId=${item.id}`)
        .then((r) => r.json())
        .then((data: FolderItemRecord[]) => setFolderIds(data.map((d) => d.folderId)));
    }
  }, [genre, item]);

  const toggleFolder = (folderId: string) => {
    setFolderIds((prev) =>
      prev.includes(folderId) ? prev.filter((id) => id !== folderId) : [...prev, folderId]
    );
  };

  const save = async () => {
    if (!content.trim()) {
      alert("本文は必須です");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        genre,
        type: "reference_post",
        content,
        authorHandle,
        postUrl,
        likes: Number(likes) || 0,
        retweets: Number(retweets) || 0,
        impressions: Number(impressions) || 0,
        postedAt: postedAt || null,
        structureType,
        hookAnalysis,
        bodyAnalysis,
        closingAnalysis,
        usedWords: JSON.stringify(usedWords),
        applicationHint,
        tags: JSON.stringify(tags),
        note,
      };
      const res = await fetch(
        item ? `/api/x-post/knowledge/${item.id}` : "/api/x-post/knowledge",
        {
          method: item ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        alert(`保存失敗: ${e.error || res.statusText}`);
        return;
      }
      const saved = await res.json();
      const targetId = saved.id;

      // フォルダ紐付けの差分を反映
      const existing = item
        ? await fetch(`/api/x-post/folder-items?itemId=${targetId}`).then((r) => r.json() as Promise<FolderItemRecord[]>)
        : [];
      const existingFolderIds = existing.map((e) => e.folderId);
      const toAdd = folderIds.filter((id) => !existingFolderIds.includes(id));
      const toRemove = existingFolderIds.filter((id) => !folderIds.includes(id));

      await Promise.all([
        ...toAdd.map((folderId) =>
          fetch("/api/x-post/folder-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId, itemType: "reference_post", itemId: targetId }),
          })
        ),
        ...toRemove.map((folderId) =>
          fetch("/api/x-post/folder-items", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId, itemType: "reference_post", itemId: targetId }),
          })
        ),
      ]);

      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!confirm("この参考ポストを削除しますか？")) return;
    const res = await fetch(`/api/x-post/knowledge/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{item ? "参考ポストを編集" : "参考ポストを追加"}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">本文 <span className="text-red-500">*</span></label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">投稿者 (@)</label>
              <input
                type="text"
                value={authorHandle}
                onChange={(e) => setAuthorHandle(e.target.value)}
                placeholder="@xxx"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">投稿日</label>
              <input
                type="date"
                value={postedAt}
                onChange={(e) => setPostedAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
            <input
              type="text"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://x.com/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">いいね</label>
              <input type="number" value={likes} onChange={(e) => setLikes(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">RT</label>
              <input type="number" value={retweets} onChange={(e) => setRetweets(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">インプ</label>
              <input type="number" value={impressions} onChange={(e) => setImpressions(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">構造タイプ</label>
            <select
              value={structureType}
              onChange={(e) => setStructureType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {STRUCTURE_TYPES.map((t) => (
                <option key={t} value={t}>{t || "(未分類)"}</option>
              ))}
            </select>
          </div>

          <details className="bg-gray-50 rounded-md p-3">
            <summary className="text-sm font-medium cursor-pointer">構造分析（任意）</summary>
            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">フック</label>
                <input type="text" value={hookAnalysis} onChange={(e) => setHookAnalysis(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">展開</label>
                <input type="text" value={bodyAnalysis} onChange={(e) => setBodyAnalysis(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">締め</label>
                <input type="text" value={closingAnalysis} onChange={(e) => setClosingAnalysis(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">使われたワード</label>
                <ArrayInput values={usedWords} onChange={setUsedWords} placeholder="ワードを入力してEnter" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">自アカ転用ヒント</label>
                <textarea value={applicationHint} onChange={(e) => setApplicationHint(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
              </div>
            </div>
          </details>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">タグ</label>
            <ArrayInput values={tags} onChange={setTags} placeholder="タグを入力してEnter" />
          </div>

          {allFolders.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">フォルダ</label>
              <div className="flex flex-wrap gap-2">
                {allFolders.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFolder(f.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      folderIds.includes(f.id)
                        ? "bg-indigo-100 border-indigo-300 text-indigo-700"
                        : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    📁 {f.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">メモ</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between">
          <div>
            {item && (
              <button onClick={remove} className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded">🗑️ 削除</button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded">キャンセル</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded">
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
