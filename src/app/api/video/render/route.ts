import { NextRequest, NextResponse } from "next/server";
import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { assetPath, importAssetFromUrl, saveAsset, assetUrl } from "@/lib/video-assets";

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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { aspect = "9:16", fps = 30, scenes, bgm } = body as {
    aspect?: string;
    fps?: number;
    scenes?: RenderScene[];
    bgm?: { url: string; volume?: number; fadeOut?: number } | null;
  };

  if (!Array.isArray(scenes) || scenes.length === 0) {
    return NextResponse.json({ error: "scenes が空です" }, { status: 400 });
  }
  const size = SIZES[aspect] || SIZES["9:16"];

  let workDir: string | null = null;
  try {
    workDir = await mkdtemp(join(tmpdir(), "video-render-"));

    const timelineScenes = [];
    for (const scene of scenes) {
      const duration = Math.min(Math.max(Number(scene.duration) || 5, 1), 60);
      const telops = (scene.telops || [])
        .filter((t) => t.text?.trim())
        .map((t) => ({
          text: String(t.text).slice(0, 200),
          style: t.style === "title" || t.style === "note" ? t.style : "caption",
          ...(t.start != null ? { start: Number(t.start) } : {}),
          ...(t.end != null ? { end: Number(t.end) } : {}),
        }));

      // シーン単位ナレーション
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

    const timeline: Record<string, unknown> = {
      output: "output/final.mp4",
      width: size.width,
      height: size.height,
      fps: Math.min(Math.max(Number(fps) || 30, 24), 60),
      font: "auto",
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
      await execFileAsync("python3", [script, timelinePath], {
        timeout: 280_000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (e) {
      const err = e as { stderr?: string; stdout?: string; message?: string };
      const detail = (err.stderr || err.stdout || err.message || "").slice(-1500);
      console.error("POST /api/video/render ffmpeg failed:", detail);
      return NextResponse.json({ error: `レンダリング失敗: ${detail}` }, { status: 500 });
    }

    const outBuf = await readFile(join(workDir, "output", "final.mp4"));
    const id = await saveAsset(outBuf, "mp4");
    const totalDuration = timelineScenes.reduce((s, sc) => s + (sc.duration as number), 0);
    return NextResponse.json({
      url: assetUrl(id),
      sizeMb: Math.round((outBuf.length / (1024 * 1024)) * 10) / 10,
      duration: totalDuration,
    });
  } catch (e) {
    console.error("POST /api/video/render", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    if (workDir) rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
