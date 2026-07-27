import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { assetPath, importAssetFromUrl, saveAsset, assetUrl, assetStoreDir } from "@/lib/video-assets";
import { createJob, getJob, completeJob, failJob } from "@/lib/video-render-jobs";

export const maxDuration = 300;

const execFileAsync = promisify(execFile);

const IMAGE_EXTS = ["png", "jpg", "jpeg", "webp"];
const SIZES: Record<string, { width: number; height: number }> = {
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
};

interface RenderTelop {
  text: string;
  start?: number;
  end?: number;
  style?: string;
}
interface RenderScene {
  assetUrl?: string;
  color?: string;
  duration: number;
  mute?: boolean;
  fadeIn?: number;
  fadeOut?: number;
  zoom?: boolean;
  narrationUrl?: string;
  telops?: RenderTelop[];
}
interface RenderRequest {
  aspect?: string;
  fps?: number;
  scenes?: RenderScene[];
  bgm?: { url: string; volume?: number; fadeOut?: number } | null;
}

// 素材URLをローカルパスに解決する(自前の素材ストア or 外部URL取り込み)
async function resolveAsset(url: string): Promise<{ path: string; isImage: boolean }> {
  let localPath: string | null = null;
  const m = url.match(/^\/api\/video\/assets\/([^/?#]+)$/);
  if (m) {
    localPath = assetPath(decodeURIComponent(m[1]));
  } else if (/^https?:\/\//.test(url)) {
    const id = await importAssetFromUrl(url, "mp4");
    localPath = assetPath(id);
  }
  if (!localPath) throw new Error(`素材URLを解決できません: ${url}`);
  const ext = (localPath.split(".").pop() || "").toLowerCase();
  return { path: localPath, isImage: IMAGE_EXTS.includes(ext) };
}

// 実際のレンダリング処理(ジョブとしてバックグラウンド実行される)
async function runRender(body: RenderRequest): Promise<{ url: string; sizeMb: number; duration: number }> {
  const { aspect = "9:16", fps = 30, scenes, bgm } = body;
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error("scenes が空です");
  const size = SIZES[aspect] || SIZES["9:16"];

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "video-render-"));

    const timelineScenes = [];
    for (const scene of scenes) {
      const duration = Math.min(Math.max(Number(scene.duration) || 5, 1), 180);
      const telops = (scene.telops || [])
        .filter((t) => t.text?.trim())
        .map((t) => ({
          text: String(t.text).slice(0, 200),
          style: t.style === "title" || t.style === "note" ? t.style : "caption",
          ...(t.start != null ? { start: Number(t.start) } : {}),
          ...(t.end != null ? { end: Number(t.end) } : {}),
        }));

      let narration: { src: string; volume?: number } | undefined;
      if (scene.narrationUrl) {
        const { path } = await resolveAsset(scene.narrationUrl);
        narration = { src: path };
      }

      if (scene.assetUrl) {
        const { path, isImage } = await resolveAsset(scene.assetUrl);
        timelineScenes.push({
          type: isImage ? "image" : "video",
          src: path,
          duration,
          ...(isImage && scene.zoom !== false ? { zoom: true } : {}),
          ...(scene.mute ? { mute: true } : {}),
          ...(scene.fadeIn ? { fade_in: Number(scene.fadeIn) } : {}),
          ...(scene.fadeOut ? { fade_out: Number(scene.fadeOut) } : {}),
          ...(narration ? { narration } : {}),
          telops,
        });
      } else {
        timelineScenes.push({
          type: "color",
          color: scene.color || "#1a1a2e",
          duration,
          ...(scene.fadeIn ? { fade_in: Number(scene.fadeIn) } : {}),
          ...(scene.fadeOut ? { fade_out: Number(scene.fadeOut) } : {}),
          ...(narration ? { narration } : {}),
          telops,
        });
      }
    }

    const totalDuration = timelineScenes.reduce((s, sc) => s + (sc.duration as number), 0);

    const timeline: Record<string, unknown> = {
      output: "output/final.mp4",
      width: size.width,
      height: size.height,
      fps: Math.min(Math.max(Number(fps) || 30, 24), 60),
      font: "auto",
      // 長尺はエンコード時間を優先して veryfast にする(画質差は軽微)
      preset: totalDuration > 240 ? "veryfast" : "medium",
      // 変更のないシーンを再エンコードしないためのキャッシュ(修正→再書き出しの高速化)
      cache_dir: join(assetStoreDir(), "scene-cache"),
      scenes: timelineScenes,
    };
    if (bgm?.url) {
      const { path } = await resolveAsset(bgm.url);
      timeline.bgm = {
        src: path,
        volume: Math.min(Math.max(Number(bgm.volume ?? 0.15), 0), 1),
        fade_out: Number(bgm.fadeOut ?? 2),
      };
    }

    const timelinePath = join(workDir, "timeline.json");
    await writeFile(timelinePath, JSON.stringify(timeline, null, 2), "utf-8");

    const script = join(process.cwd(), "video_system", "scripts", "render_video.py");
    try {
      // 20分動画のエンコードを見込んで最大60分
      await execFileAsync("python3", [script, timelinePath], {
        timeout: 3600_000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string; message?: string };
      const detail = (err.stderr || err.stdout || err.message || "").slice(-1500);
      throw new Error(`レンダリング失敗: ${detail}`);
    }

    const outBuf = await readFile(join(workDir, "output", "final.mp4"));
    const id = await saveAsset(outBuf, "mp4");
    return {
      url: assetUrl(id),
      sizeMb: Math.round((outBuf.length / (1024 * 1024)) * 10) / 10,
      duration: totalDuration,
    };
  } finally {
    if (workDir) rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

// レンダリング開始 → jobId を返す。進捗は GET ?jobId= でポーリング
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RenderRequest;
    if (!Array.isArray(body.scenes) || body.scenes.length === 0) {
      return NextResponse.json({ error: "scenes が空です" }, { status: 400 });
    }
    const job = createJob();
    void runRender(body)
      .then((result) => completeJob(job.id, result))
      .catch((e) => {
        console.error("POST /api/video/render job failed", e);
        failJob(job.id, String(e instanceof Error ? e.message : e));
      });
    return NextResponse.json({ jobId: job.id });
  } catch (e) {
    console.error("POST /api/video/render", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId") || "";
  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { error: "ジョブが見つかりません(サーバー再起動で消えた可能性があります。再度書き出してください)" },
      { status: 404 },
    );
  }
  return NextResponse.json({
    status: job.status,
    url: job.url,
    sizeMb: job.sizeMb,
    duration: job.duration,
    error: job.error,
  });
}
