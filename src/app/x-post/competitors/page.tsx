// 競合管理 + ポスト収集
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useXPostGenre, X_POST_GENRES } from "@/lib/x-post-genre";
import type {
  XCompetitor,
  XCollectedPost,
  XFolderWithCount,
} from "@/lib/x-post-types";
import { getApiKey } from "@/lib/channel-store";
import CompetitorEditModal from "@/components/x-post/CompetitorEditModal";
import PostCollectModal from "@/components/x-post/PostCollectModal";
import HotFetchModal from "@/components/x-post/HotFetchModal";

type SortKey = "collectedAt" | "postedAt" | "likes" | "retweets" | "impressions";

interface FolderItemRecord { folderId: string; itemId: string; }

export default function CompetitorsPage() {
  const [genre] = useXPostGenre();
  const genreLabel = X_POST_GENRES.find((g) => g.value === genre)?.label ?? "";

  const [competitors, setCompetitors] = useState<XCompetitor[]>([]);
  const [posts, setPosts] = useState<XCollectedPost[]>([]);
  const [folders, setFolders] = useState<XFolderWithCount[]>([]);
  const [folderItems, setFolderItems] = useState<FolderItemRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // モーダル状態
  const [editingCompetitor, setEditingCompetitor] = useState<XCompetitor | "new" | null>(null);
  const [showHotFetch, setShowHotFetch] = useState(false);
  const [collectingFor, setCollectingFor] = useState<XCompetitor | null>(null);
  const [editingPost, setEditingPost] = useState<XCollectedPost | null>(null);

  // フィルタ
  const [filterCompetitorId, setFilterCompetitorId] = useState<string>("all");
  const [filterFolderId, setFilterFolderId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("likes");

  // シーケンス抽出モード（複数選択）
  const [sequenceMode, setSequenceMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [extractingSequence, setExtractingSequence] = useState(false);
  const [sequenceMsg, setSequenceMsg] = useState<string | null>(null);

  const togglePostSelect = (id: string) => {
    setSelectedPostIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleSequenceMode = () => {
    setSequenceMode((m) => !m);
    setSelectedPostIds([]);
    setSequenceMsg(null);
  };

  const extractSequence = async () => {
    if (selectedPostIds.length < 2) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      alert("AI APIキーが未設定です。");
      return;
    }
    setExtractingSequence(true);
    setSequenceMsg(null);
    try {
      const res = await fetch("/api/x-post/extract-sequence-pattern", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: selectedPostIds, aiApiKey, save: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSequenceMsg(`エラー: ${data.error || res.statusText}`);
        return;
      }
      setSequenceMsg(`✓ 「${data.pattern?.name ?? "(無題)"}」をシーケンスパターンに保存`);
      setSelectedPostIds([]);
      setSequenceMode(false);
    } finally {
      setExtractingSequence(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes, fRes, fiRes] = await Promise.all([
        fetch(`/api/x-post/competitors?genre=${genre}`),
        fetch(`/api/x-post/posts?genre=${genre}`),
        fetch(`/api/x-post/folders?genre=${genre}`),
        fetch(`/api/x-post/folder-items`),
      ]);
      const cData: XCompetitor[] = await cRes.json();
      const pData: XCollectedPost[] = await pRes.json();
      const fData: XFolderWithCount[] = await fRes.json();
      const fiData: FolderItemRecord[] = await fiRes.json();

      // 自アカ（isSelf）は /x-post/analytics 側で管理するのでここでは除外
      const competitorsOnly = cData.filter((c) => !c.isSelf);
      const selfIds = new Set(cData.filter((c) => c.isSelf).map((c) => c.id));
      setCompetitors(competitorsOnly);
      setPosts(pData.filter((p) => !selfIds.has(p.competitorId)));
      setFolders(fData);
      // ポストID集合に絞ってfolder-itemsを保持
      const postIds = new Set(pData.map((p) => p.id));
      setFolderItems(fiData.filter((fi) => postIds.has(fi.itemId)));
    } finally {
      setLoading(false);
    }
  }, [genre]);

  useEffect(() => { load(); }, [load]);

  const filteredPosts = useMemo(() => {
    let list = posts;
    if (filterCompetitorId !== "all") {
      list = list.filter((p) => p.competitorId === filterCompetitorId);
    }
    if (filterFolderId !== "all") {
      const folderItemIds = new Set(
        folderItems.filter((fi) => fi.folderId === filterFolderId).map((fi) => fi.itemId)
      );
      list = list.filter((p) => folderItemIds.has(p.id));
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.content.toLowerCase().includes(s) ||
          p.competitor.handle.toLowerCase().includes(s) ||
          p.competitor.name.toLowerCase().includes(s)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "collectedAt") return new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime();
      if (sortBy === "postedAt") {
        const ta = a.postedAt ? new Date(a.postedAt).getTime() : 0;
        const tb = b.postedAt ? new Date(b.postedAt).getTime() : 0;
        return tb - ta;
      }
      return b[sortBy] - a[sortBy];
    });
  }, [posts, folderItems, filterCompetitorId, filterFolderId, search, sortBy]);

  return (
    <main className="px-4 md:px-6 py-6 max-w-6xl mx-auto">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>👥</span>
          競合管理 + ポスト収集
          <span className="text-base font-normal text-gray-500">（{genreLabel}）</span>
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          競合アカウントを登録して伸びてるポストを収集。手動ペーストで素早く保存できます。
        </p>
      </div>

      {/* 上段: 競合一覧 */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h3 className="text-base font-bold text-gray-900">競合アカウント（{competitors.length}件）</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowHotFetch(true)}
              disabled={competitors.length === 0}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-sm font-medium rounded-md"
              title="全競合からX APIで一括取得 → 閾値超えのみ保存"
            >
              🔥 ホット取得
            </button>
            <button
              onClick={() => setEditingCompetitor("new")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md"
            >
              + 競合を追加
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">読み込み中...</div>
        ) : competitors.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
            <div className="text-4xl mb-2">👥</div>
            <p className="text-gray-500 text-sm">まだ競合アカウントが登録されていません</p>
            <p className="text-xs text-gray-400 mt-1">「+ 競合を追加」から登録してください</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {competitors.map((c) => (
              <CompetitorCard
                key={c.id}
                competitor={c}
                onCollect={() => setCollectingFor(c)}
                onEdit={() => setEditingCompetitor(c)}
                onFetched={load}
              />
            ))}
          </div>
        )}
      </section>

      {/* 下段: 収集ポスト */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-base font-bold text-gray-900">収集済みポスト（{posts.length}件）</h3>
          <div className="flex items-center gap-2">
            {sequenceMsg && (
              <span className={`text-xs ${sequenceMsg.startsWith("✓") ? "text-emerald-700" : "text-red-700"}`}>
                {sequenceMsg}
              </span>
            )}
            <button
              onClick={toggleSequenceMode}
              className={`text-sm px-3 py-1.5 rounded transition-colors ${
                sequenceMode
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-purple-50 text-purple-700 hover:bg-purple-100"
              }`}
            >
              {sequenceMode ? "✕ 抽出モード解除" : "🧬 シーケンス抽出"}
            </button>
          </div>
        </div>

        {sequenceMode && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-3 text-xs text-purple-900 flex items-center justify-between flex-wrap gap-2">
            <span>
              連投シーケンスにしたいポストを2〜8件、時系列順（古→新）に選択してください。選択中: <strong>{selectedPostIds.length}</strong>件
            </span>
            <button
              onClick={extractSequence}
              disabled={selectedPostIds.length < 2 || extractingSequence}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white text-sm font-medium rounded"
            >
              {extractingSequence ? "抽出中..." : `🧬 ${selectedPostIds.length}件から抽出`}
            </button>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3 flex flex-wrap gap-2 items-center">
          <select
            value={filterCompetitorId}
            onChange={(e) => setFilterCompetitorId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">競合: 全て</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                @{c.handle}{c.name && `（${c.name}）`}
              </option>
            ))}
          </select>
          <select
            value={filterFolderId}
            onChange={(e) => setFilterFolderId(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">フォルダ: 全て</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>📁 {f.name}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          >
            <option value="likes">いいね順</option>
            <option value="retweets">RT順</option>
            <option value="impressions">インプ順</option>
            <option value="postedAt">投稿日順</option>
            <option value="collectedAt">収集日順</option>
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 本文・@で検索"
            className="flex-1 min-w-[180px] px-3 py-1.5 border border-gray-300 rounded-md text-sm"
          />
        </div>

        {filteredPosts.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-12 text-center">
            <div className="text-4xl mb-2">📥</div>
            <p className="text-gray-500 text-sm">
              {posts.length === 0
                ? "まだポストが収集されていません"
                : "条件に合うポストがありません"}
            </p>
            {posts.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                上の競合カードから「📥 ポスト収集」を押してペースト追加
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredPosts.map((p) => (
              <PostListItem
                key={p.id}
                post={p}
                folderItemsForPost={folderItems.filter((fi) => fi.itemId === p.id)}
                folders={folders}
                sequenceMode={sequenceMode}
                selected={selectedPostIds.includes(p.id)}
                selectionIndex={selectedPostIds.indexOf(p.id)}
                onClick={() => {
                  if (sequenceMode) togglePostSelect(p.id);
                  else setEditingPost(p);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* モーダル群 */}
      {editingCompetitor && (
        <CompetitorEditModal
          competitor={editingCompetitor === "new" ? null : editingCompetitor}
          genre={genre}
          onClose={() => setEditingCompetitor(null)}
          onSaved={() => {
            setEditingCompetitor(null);
            load();
          }}
        />
      )}
      {collectingFor && (
        <PostCollectModal
          competitor={collectingFor}
          onClose={() => setCollectingFor(null)}
          onSaved={load}
        />
      )}
      {editingPost && (
        <PostCollectModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={load}
        />
      )}
      {showHotFetch && (
        <HotFetchModal
          genre={genre}
          onClose={() => setShowHotFetch(false)}
          onFetched={load}
        />
      )}
    </main>
  );
}

// ============================================================
// CompetitorCard
// ============================================================

function CompetitorCard({
  competitor,
  onCollect,
  onEdit,
  onFetched,
}: {
  competitor: XCompetitor;
  onCollect: () => void;
  onEdit: () => void;
  onFetched: () => void;
}) {
  const lastCollected = competitor.posts[0]?.collectedAt;
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);

  const autoFetch = async () => {
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetch(`/api/x-post/competitors/${competitor.id}/fetch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxResults: 20, sinceDays: 7 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchMsg(`エラー: ${data.error || res.statusText}`);
        return;
      }
      setFetchMsg(`✓ ${data.saved}件保存（${data.skipped}件は既存スキップ）`);
      onFetched();
    } catch (e) {
      setFetchMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
      setTimeout(() => setFetchMsg(null), 5000);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 hover:border-indigo-400 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-bold text-gray-900 truncate">
            @{competitor.handle}
          </div>
          {competitor.name && (
            <div className="text-xs text-gray-500 truncate">{competitor.name}</div>
          )}
        </div>
        <button
          onClick={onEdit}
          className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1"
          aria-label="編集"
        >
          ⋯
        </button>
      </div>
      {competitor.note && (
        <p className="text-xs text-gray-600 line-clamp-2 mb-2">{competitor.note}</p>
      )}
      <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
        <span>📥 {competitor._count.posts} 件収集</span>
        {lastCollected && (
          <span>最終: {new Date(lastCollected).toLocaleDateString()}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={onCollect}
          className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-medium rounded transition-colors"
        >
          📥 手動
        </button>
        <button
          onClick={autoFetch}
          disabled={fetching}
          className="px-3 py-2 bg-sky-50 hover:bg-sky-100 disabled:bg-sky-50/50 text-sky-700 text-sm font-medium rounded transition-colors"
          title="X API Bearer Token 必須（設定モーダルで登録）"
        >
          {fetching ? "取得中..." : "🔄 自動"}
        </button>
      </div>
      {fetchMsg && (
        <div className={`mt-2 text-xs ${fetchMsg.startsWith("✓") ? "text-emerald-700" : "text-red-700"}`}>
          {fetchMsg}
        </div>
      )}
    </div>
  );
}

// ============================================================
// PostListItem
// ============================================================

function PostListItem({
  post,
  folderItemsForPost,
  folders,
  sequenceMode,
  selected,
  selectionIndex,
  onClick,
}: {
  post: XCollectedPost;
  folderItemsForPost: FolderItemRecord[];
  folders: XFolderWithCount[];
  sequenceMode: boolean;
  selected: boolean;
  selectionIndex: number;
  onClick: () => void;
}) {
  const folderNames = folderItemsForPost
    .map((fi) => folders.find((f) => f.id === fi.folderId)?.name)
    .filter(Boolean) as string[];

  return (
    <div
      onClick={onClick}
      className={`bg-white border rounded-lg p-4 cursor-pointer transition ${
        sequenceMode
          ? selected
            ? "border-purple-500 ring-2 ring-purple-300 bg-purple-50/40"
            : "border-gray-200 hover:border-purple-300"
          : "border-gray-200 hover:border-indigo-400 hover:shadow-sm"
      }`}
    >
      {sequenceMode && selected && (
        <div className="mb-2 inline-flex items-center gap-1 text-xs bg-purple-600 text-white px-2 py-0.5 rounded">
          {selectionIndex + 1} 番目
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="text-xs text-gray-500 font-medium">
          @{post.competitor.handle}
          {post.competitor.name && (
            <span className="text-gray-400 ml-1">({post.competitor.name})</span>
          )}
          {post.isQuoteRt && (
            <span className="ml-2 inline-flex items-center text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">
              引用RT
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2 shrink-0">
          <span>👍 {post.likes}</span>
          <span>🔁 {post.retweets}</span>
          {post.replies > 0 && <span>💬 {post.replies}</span>}
          {post.impressions > 0 && <span>📊 {post.impressions.toLocaleString()}</span>}
        </div>
      </div>
      <p className="text-sm text-gray-800 line-clamp-3 whitespace-pre-wrap">{post.content}</p>
      {(folderNames.length > 0 || post.postedAt) && (
        <div className="mt-2 flex flex-wrap gap-1.5 items-center text-xs text-gray-500">
          {post.postedAt && (
            <span>📅 {new Date(post.postedAt).toLocaleDateString()}</span>
          )}
          {folderNames.length > 0 && (
            <span>📁 {folderNames.join(" / ")}</span>
          )}
        </div>
      )}
    </div>
  );
}
