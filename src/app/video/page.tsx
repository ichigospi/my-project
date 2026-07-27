"use client";

// 動画作成ページ: 台本(/create)からシーン構成を生成し、
// AI素材(OpenAI画像 / Sora動画 / LitVideo動画)や手持ち素材を割り当てて、
// テロップ・BGM付きでレンダリングする。
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getProjects, ScriptProject } from "@/lib/project-store";
import { getApiKey } from "@/lib/channel-store";
import { getAiModel } from "@/lib/ai-model";
import {
  VideoProject,
  VideoScene,
  VideoAspect,
  AssetProvider,
  getVideoProjects,
  saveVideoProject,
  deleteVideoProject,
  createVideoProject,
  genVideoId,
} from "@/lib/video-store";

const PROVIDER_OPTIONS: { id: AssetProvider; label: string; needs: string }[] = [
  { id: "openai_image", label: "AI画像 (gpt-image-1)", needs: "OpenAIキー" },
  { id: "litvideo_video", label: "AI動画 (LitVideo)", needs: "LitMediaキー" },
  { id: "sora_video", label: "AI動画 (Sora)", needs: "OpenAIキー" },
  { id: "upload", label: "手持ち素材", needs: "" },
  { id: "none", label: "背景色のみ", needs: "" },
];

interface PlanScene {
  section?: string;
  narration?: string;
  duration?: number;
  telops?: { text: string; start?: number; end?: number }[];
  visualPrompt?: string;
}

function VideoPageInner() {
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<VideoProject[]>([]);
  const [current, setCurrent] = useState<VideoProject | null>(null);
  const [scriptProjects, setScriptProjects] = useState<ScriptProject[]>([]);
  const [planning, setPlanning] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [uploadingSceneId, setUploadingSceneId] = useState<string | null>(null);
  const [uploadingBgm, setUploadingBgm] = useState(false);
  const currentRef = useRef<VideoProject | null>(null);
  currentRef.current = current;

  // 初期ロード: 動画プロジェクト一覧 + 台本プロジェクト。?projectId= 付きなら自動作成/選択
  useEffect(() => {
    const vids = getVideoProjects();
    setVideos(vids);
    const scripts = getProjects().filter((p) => p.generatedScript || (p.scriptSegments || []).length > 0);
    setScriptProjects(scripts);

    const scriptProjectId = searchParams.get("projectId");
    if (scriptProjectId) {
      const existing = vids.find((v) => v.scriptProjectId === scriptProjectId);
      if (existing) {
        setCurrent(existing);
      } else {
        const sp = scripts.find((p) => p.id === scriptProjectId);
        if (sp) {
          const v = createVideoProject({ title: sp.title || "無題の動画", scriptProjectId: sp.id });
          setVideos(saveVideoProject(v));
          setCurrent(v);
        }
      }
    } else if (vids.length > 0) {
      setCurrent(vids[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback((patch: Partial<VideoProject>) => {
    const cur = currentRef.current;
    if (!cur) return;
    const next = { ...cur, ...patch };
    setCurrent(next);
    setVideos(saveVideoProject(next));
  }, []);

  const updateScene = useCallback((sceneId: string, patch: Partial<VideoScene>) => {
    const cur = currentRef.current;
    if (!cur) return;
    const scenes = cur.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s));
    const next = { ...cur, scenes };
    setCurrent(next);
    setVideos(saveVideoProject(next));
  }, []);

  // ---- 台本 → シーン構成 ----
  const handlePlan = async () => {
    if (!current) return;
    const aiApiKey = getApiKey("ai_api_key");
    if (!aiApiKey) {
      setError("設定ページでAI APIキーを設定してください");
      return;
    }
    const sp = scriptProjects.find((p) => p.id === current.scriptProjectId);
    const script = sp
      ? sp.generatedScript || (sp.scriptSegments || []).map((s) => s.script).join("\n\n")
      : "";
    if (!script) {
      setError("台本が見つかりません。台本プロジェクトを選択してください");
      return;
    }
    setPlanning(true);
    setError("");
    try {
      const res = await fetch("/api/video/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script,
          aiApiKey,
          aiModel: getAiModel("generate"),
          aspect: current.aspect,
          targetSeconds: 60,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "シーン構成の生成に失敗しました");
      const litmediaKey = getApiKey("litmedia_api_key");
      const openaiKey = getApiKey("openai_api_key");
      const defaultProvider: AssetProvider = litmediaKey
        ? "litvideo_video"
        : openaiKey
          ? "openai_image"
          : "none";
      const scenes: VideoScene[] = (data.scenes as PlanScene[]).map((s) => ({
        id: genVideoId(),
        section: s.section || "",
        narration: s.narration || "",
        duration: Math.min(Math.max(Number(s.duration) || 6, 2), 30),
        telops: (s.telops || []).filter((t) => t.text),
        visualPrompt: s.visualPrompt || "",
        provider: defaultProvider,
        assetStatus: "none",
      }));
      update({ scenes });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setPlanning(false);
    }
  };

  // ---- 素材生成 ----
  const generateAsset = useCallback(async (scene: VideoScene) => {
    const cur = currentRef.current;
    if (!cur) return;
    const openaiApiKey = getApiKey("openai_api_key");
    const litmediaApiKey = getApiKey("litmedia_api_key");
    updateScene(scene.id, { assetStatus: "generating", assetError: undefined, assetUrl: undefined });
    try {
      const res = await fetch("/api/video/generate-asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: scene.provider,
          prompt: scene.visualPrompt,
          aspect: cur.aspect,
          duration: scene.duration,
          openaiApiKey,
          litmediaApiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "素材生成に失敗しました");
      if (data.status === "ready") {
        updateScene(scene.id, { assetStatus: "ready", assetUrl: data.url });
      } else {
        updateScene(scene.id, { assetStatus: "generating", assetTaskId: data.taskId });
      }
    } catch (e) {
      updateScene(scene.id, { assetStatus: "error", assetError: String(e instanceof Error ? e.message : e) });
    }
  }, [updateScene]);

  const handleGenerateAll = async () => {
    const cur = currentRef.current;
    if (!cur) return;
    for (const scene of cur.scenes) {
      if (
        (scene.provider === "openai_image" || scene.provider === "sora_video" || scene.provider === "litvideo_video") &&
        scene.assetStatus !== "ready" &&
        scene.assetStatus !== "generating" &&
        scene.visualPrompt
      ) {
        await generateAsset(scene);
      }
    }
  };

  // 生成中タスクのポーリング(20秒間隔)
  useEffect(() => {
    const timer = setInterval(async () => {
      const cur = currentRef.current;
      if (!cur) return;
      const pending = cur.scenes.filter((s) => s.assetStatus === "generating" && s.assetTaskId);
      for (const scene of pending) {
        try {
          const res = await fetch("/api/video/asset-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              provider: scene.provider,
              taskId: scene.assetTaskId,
              openaiApiKey: getApiKey("openai_api_key"),
              litmediaApiKey: getApiKey("litmedia_api_key"),
            }),
          });
          const data = await res.json();
          if (data.status === "ready") {
            updateScene(scene.id, { assetStatus: "ready", assetUrl: data.url, assetTaskId: undefined });
          } else if (data.status === "error" || (!res.ok && data.error)) {
            updateScene(scene.id, { assetStatus: "error", assetError: data.error, assetTaskId: undefined });
          }
        } catch {
          // 一時的な通信エラーは次回のポーリングに任せる
        }
      }
    }, 20000);
    return () => clearInterval(timer);
  }, [updateScene]);

  // ---- 手持ち素材アップロード ----
  const handleUpload = async (sceneId: string, file: File) => {
    setUploadingSceneId(sceneId);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/video/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");
      updateScene(sceneId, { provider: "upload", assetStatus: "ready", assetUrl: data.url, assetError: undefined });
    } catch (e) {
      updateScene(sceneId, { assetStatus: "error", assetError: String(e instanceof Error ? e.message : e) });
    } finally {
      setUploadingSceneId(null);
    }
  };

  const handleBgmUpload = async (file: File) => {
    setUploadingBgm(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/video/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "アップロードに失敗しました");
      update({ bgmUrl: data.url, bgmName: data.name });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setUploadingBgm(false);
    }
  };

  // ---- レンダリング ----
  const handleRender = async () => {
    const cur = currentRef.current;
    if (!cur || cur.scenes.length === 0) return;
    setRendering(true);
    setError("");
    try {
      const res = await fetch("/api/video/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aspect: cur.aspect,
          scenes: cur.scenes.map((s) => ({
            assetUrl: s.assetStatus === "ready" ? s.assetUrl : undefined,
            duration: s.duration,
            mute: s.mute,
            telops: s.telops,
          })),
          bgm: cur.bgmUrl ? { url: cur.bgmUrl, volume: cur.bgmVolume } : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "レンダリングに失敗しました");
      update({ renderUrl: data.url, renderSizeMb: data.sizeMb });
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setRendering(false);
    }
  };

  // ---- シーン操作 ----
  const addScene = () => {
    if (!current) return;
    const scene: VideoScene = {
      id: genVideoId(),
      section: "",
      narration: "",
      duration: 6,
      telops: [],
      visualPrompt: "",
      provider: "none",
      assetStatus: "none",
    };
    update({ scenes: [...current.scenes, scene] });
  };

  const removeScene = (sceneId: string) => {
    if (!current) return;
    update({ scenes: current.scenes.filter((s) => s.id !== sceneId) });
  };

  const moveScene = (sceneId: string, dir: -1 | 1) => {
    if (!current) return;
    const scenes = [...current.scenes];
    const idx = scenes.findIndex((s) => s.id === sceneId);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= scenes.length) return;
    [scenes[idx], scenes[to]] = [scenes[to], scenes[idx]];
    update({ scenes });
  };

  const totalDuration = current?.scenes.reduce((s, sc) => s + sc.duration, 0) || 0;
  const generatingCount = current?.scenes.filter((s) => s.assetStatus === "generating").length || 0;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">動画作成</h1>
          <p className="text-gray-500 mt-1 text-sm">台本からシーン構成を作り、AI素材・テロップ・BGMを付けて書き出します</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={current?.id || ""}
            onChange={(e) => {
              const v = videos.find((x) => x.id === e.target.value);
              if (v) setCurrent(v);
            }}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            {videos.length === 0 && <option value="">動画プロジェクトなし</option>}
            {videos.map((v) => (
              <option key={v.id} value={v.id}>{v.title}</option>
            ))}
          </select>
          {current && (
            <button
              onClick={() => {
                if (!confirm(`「${current.title}」を削除しますか？`)) return;
                const rest = deleteVideoProject(current.id);
                setVideos(rest);
                setCurrent(rest[0] || null);
              }}
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:text-danger hover:border-danger/40"
            >
              削除
            </button>
          )}
        </div>
      </div>

      {/* 新規作成: 台本プロジェクトから */}
      <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <h2 className="font-semibold mb-3">台本から動画を作る</h2>
        {scriptProjects.length === 0 ? (
          <p className="text-sm text-gray-400">
            台本がまだありません。まず「台本作成」で台本を完成させてください。
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="script-project-select"
              className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white flex-1 min-w-48"
              defaultValue=""
            >
              <option value="" disabled>台本プロジェクトを選択...</option>
              {scriptProjects.map((p) => (
                <option key={p.id} value={p.id}>{p.title || "(無題)"}</option>
              ))}
            </select>
            <button
              onClick={() => {
                const sel = document.getElementById("script-project-select") as HTMLSelectElement;
                const sp = scriptProjects.find((p) => p.id === sel?.value);
                if (!sp) return;
                const v = createVideoProject({ title: sp.title || "無題の動画", scriptProjectId: sp.id });
                setVideos(saveVideoProject(v));
                setCurrent(v);
              }}
              className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90"
            >
              動画プロジェクトを作成
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-danger">{error}</div>
      )}

      {current && (
        <>
          {/* 設定 + シーン構成生成 */}
          <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={current.title}
                onChange={(e) => update({ title: e.target.value })}
                className="flex-1 min-w-48 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none text-sm font-medium"
              />
              <select
                value={current.aspect}
                onChange={(e) => update({ aspect: e.target.value as VideoAspect })}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
              >
                <option value="9:16">縦 9:16(ショート)</option>
                <option value="16:9">横 16:9</option>
                <option value="1:1">正方形 1:1</option>
              </select>
              <button
                onClick={handlePlan}
                disabled={planning}
                className="px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                {planning ? "シーン構成を生成中..." : current.scenes.length > 0 ? "シーン構成を作り直す" : "台本からシーン構成を生成"}
              </button>
            </div>
            {current.scenes.length > 0 && (
              <p className="text-xs text-gray-500 mt-3">
                {current.scenes.length}シーン / 合計 約{totalDuration}秒
                {generatingCount > 0 && ` / 素材生成中: ${generatingCount}件(数分かかります)`}
              </p>
            )}
          </div>

          {/* シーン一覧 */}
          {current.scenes.map((scene, i) => (
            <div key={scene.id} className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium">
                    シーン{i + 1}
                  </span>
                  <input
                    value={scene.section}
                    onChange={(e) => updateScene(scene.id, { section: e.target.value })}
                    placeholder="セクション名"
                    className="px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-accent outline-none text-sm font-medium bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <button onClick={() => moveScene(scene.id, -1)} className="px-2 py-1 hover:text-accent" title="上へ">↑</button>
                  <button onClick={() => moveScene(scene.id, 1)} className="px-2 py-1 hover:text-accent" title="下へ">↓</button>
                  <button onClick={() => removeScene(scene.id)} className="px-2 py-1 hover:text-danger" title="削除">✕</button>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">ナレーション / 内容</label>
                    <textarea
                      value={scene.narration}
                      onChange={(e) => updateScene(scene.id, { narration: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">テロップ(1行=1テロップ)</label>
                    <textarea
                      value={scene.telops.map((t) => t.text).join("\n")}
                      onChange={(e) => {
                        const lines = e.target.value.split("\n");
                        const dur = scene.duration;
                        const per = lines.length > 0 ? dur / lines.length : dur;
                        updateScene(scene.id, {
                          telops: lines
                            .map((text, j) => ({
                              text,
                              start: Math.round(j * per * 10) / 10,
                              end: Math.round(Math.min((j + 1) * per, dur) * 10) / 10,
                            }))
                            .filter((t) => t.text.trim()),
                        });
                      }}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm mt-1"
                      placeholder="表示するテロップを行ごとに入力"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500">尺(秒)</label>
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={scene.duration}
                      onChange={(e) => updateScene(scene.id, { duration: Number(e.target.value) || 6 })}
                      className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm"
                    />
                    <label className="text-xs text-gray-500 flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={!!scene.mute}
                        onChange={(e) => updateScene(scene.id, { mute: e.target.checked })}
                      />
                      素材の音を消す
                    </label>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500">素材</label>
                    <div className="flex items-center gap-2 mt-1">
                      <select
                        value={scene.provider}
                        onChange={(e) => updateScene(scene.id, { provider: e.target.value as AssetProvider })}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white flex-1"
                      >
                        {PROVIDER_OPTIONS.map((o) => (
                          <option key={o.id} value={o.id}>{o.label}</option>
                        ))}
                      </select>
                      {(scene.provider === "openai_image" || scene.provider === "sora_video" || scene.provider === "litvideo_video") && (
                        <button
                          onClick={() => generateAsset(scene)}
                          disabled={scene.assetStatus === "generating" || !scene.visualPrompt}
                          className="px-4 py-2 rounded-lg border border-accent text-accent text-sm hover:bg-accent hover:text-white transition-colors disabled:opacity-50"
                        >
                          {scene.assetStatus === "generating" ? "生成中..." : scene.assetStatus === "ready" ? "再生成" : "生成"}
                        </button>
                      )}
                      {scene.provider === "upload" && (
                        <label className="px-4 py-2 rounded-lg border border-accent text-accent text-sm hover:bg-accent hover:text-white transition-colors cursor-pointer">
                          {uploadingSceneId === scene.id ? "アップロード中..." : "ファイル選択"}
                          <input
                            type="file"
                            accept="video/*,image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUpload(scene.id, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                  {(scene.provider === "openai_image" || scene.provider === "sora_video" || scene.provider === "litvideo_video") && (
                    <div>
                      <label className="text-xs text-gray-500">生成プロンプト(英語推奨)</label>
                      <textarea
                        value={scene.visualPrompt}
                        onChange={(e) => updateScene(scene.id, { visualPrompt: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-accent outline-none text-sm mt-1 font-mono"
                      />
                    </div>
                  )}
                  {scene.assetStatus === "error" && (
                    <p className="text-xs text-danger">{scene.assetError}</p>
                  )}
                  {scene.assetStatus === "ready" && scene.assetUrl && (
                    <div className="rounded-lg overflow-hidden bg-gray-900 max-w-50">
                      {/\.(png|jpg|jpeg|webp)$/i.test(scene.assetUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={scene.assetUrl} alt="素材プレビュー" className="w-full h-auto" />
                      ) : (
                        <video src={scene.assetUrl} controls muted className="w-full h-auto" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {current.scenes.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <button
                onClick={addScene}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-accent hover:text-accent"
              >
                + シーンを追加
              </button>
              <button
                onClick={handleGenerateAll}
                className="px-4 py-2 rounded-lg border border-accent text-accent text-sm hover:bg-accent hover:text-white transition-colors"
              >
                未生成のAI素材を一括生成
              </button>
            </div>
          )}

          {/* BGM + レンダリング */}
          {current.scenes.length > 0 && (
            <div className="bg-card-bg rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
              <h2 className="font-semibold mb-3">BGMと書き出し</h2>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <label className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-accent hover:text-accent cursor-pointer">
                  {uploadingBgm ? "アップロード中..." : current.bgmName ? `BGM: ${current.bgmName}` : "BGMファイルを選択"}
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleBgmUpload(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {current.bgmUrl && (
                  <>
                    <label className="text-xs text-gray-500">音量</label>
                    <input
                      type="range"
                      min={0}
                      max={0.5}
                      step={0.05}
                      value={current.bgmVolume}
                      onChange={(e) => update({ bgmVolume: Number(e.target.value) })}
                    />
                    <span className="text-xs text-gray-500">{Math.round(current.bgmVolume * 100)}%</span>
                    <button
                      onClick={() => update({ bgmUrl: undefined, bgmName: undefined })}
                      className="text-xs text-gray-400 hover:text-danger"
                    >
                      BGMを外す
                    </button>
                  </>
                )}
              </div>
              <button
                onClick={handleRender}
                disabled={rendering || generatingCount > 0}
                className="px-6 py-3 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
              >
                {rendering ? "レンダリング中...(数分かかります)" : "動画を書き出す"}
              </button>
              {generatingCount > 0 && (
                <p className="text-xs text-amber-600 mt-2">AI素材の生成完了を待っています({generatingCount}件)</p>
              )}
              {current.renderUrl && !rendering && (
                <div className="mt-4">
                  <video
                    src={current.renderUrl}
                    controls
                    className={`rounded-lg bg-gray-900 ${current.aspect === "9:16" ? "max-h-96" : "max-w-lg w-full"}`}
                  />
                  <div className="flex items-center gap-3 mt-2">
                    <a
                      href={current.renderUrl}
                      download={`${current.title || "video"}.mp4`}
                      className="px-4 py-2 rounded-lg border border-accent text-accent text-sm hover:bg-accent hover:text-white transition-colors"
                    >
                      ダウンロード({current.renderSizeMb}MB)
                    </a>
                    <span className="text-xs text-gray-400">
                      ※書き出した動画・素材はサーバー再起動で消えます。完成したら必ずダウンロードしてください
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function VideoPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">読み込み中...</div>}>
      <VideoPageInner />
    </Suspense>
  );
}
