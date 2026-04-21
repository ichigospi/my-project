// 画像生成エンドポイント。
// batchSize > 1 の場合は ComfyUI の EmptyLatentImage.batch_size を上げて
// 1 回のジョブで複数枚生成し、返ってきた画像ごとに Generation レコードを作る。
// 同じ runpodJobId を全レコードが共有するので、履歴画面で「同じバッチ」の
// グループ化も後から可能。
//
// 顔参照（IP-Adapter）モード:
//   - `useFaceRef: true` かつ `characterIds` に紐づく ReferenceImage.isFaceRef=true の
//     画像が 1 枚以上ある場合、IP-Adapter 対応の別 endpoint にルーティングする。
//   - 画像はディスクから読み込んで base64 で RunPod に送信。

import { NextResponse } from "next/server";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";

import { prisma } from "@/lib/prisma";
import { runJobToCompletion, type ComfyUIInputImage, type RunPodEndpointKind } from "@/lib/runpod";
import { buildBasicT2IWorkflow } from "@/lib/comfyui-workflow";

export const runtime = "nodejs";
// 高解像度 + IP-Adapter + バッチだと 15 分超えるケースがあるので 20 分に
export const maxDuration = 1200;

interface LoraInput {
  name?: string;
  strength?: number;
}

interface GenerateRequestBody {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number | string;
  batchSize?: number;
  loras?: LoraInput[];
  /** 顔参照（IP-Adapter）で固定したいキャラの ID 群。 */
  characterIds?: string[];
  /** 明示的に顔参照を OFF にしたいとき false を送る。未指定時は faceRef 画像が見つかれば自動 ON。 */
  useFaceRef?: boolean;
  /** IP-Adapter の強度。未指定時は 0.6。 */
  faceRefStrength?: number;
  /** IP-Adapter を効かせる denoise 終端 (0..1)。未指定時は 0.6。 */
  faceRefEndAt?: number;
  /** ControlNet ポーズ参照画像の base64（data: プレフィクス付き or 裸 base64）。 */
  poseRefImage?: string;
  /** ControlNet タイプ。 */
  controlnetType?: "openpose" | "depth" | "canny" | "lineart" | "scribble";
  /** ControlNet 強度 (0〜1.5)。未指定時は 0.7。 */
  controlnetStrength?: number;
  /** ControlNet を効かせる denoise 終端 (0〜1)。未指定時は 0.8。 */
  controlnetEndAt?: number;
}

const STORAGE_DIR = path.join(process.cwd(), "storage", "images");
const MAX_BATCH_SIZE = 8;
const MAX_FACE_REF_IMAGES = 6;
// RunPod Serverless の /run エンドポイントはリクエスト body 10MiB 上限がある。
// 顔参照画像をそのまま base64 で送ると簡単に超えるので、長辺 768px・JPEG 85% に
// リサイズしてから送る（IP-Adapter は内部で 224×224 に畳んで CLIP Vision に食わせる
// ため、これ以上の解像度は無意味で帯域を食うだけ）。
const FACE_REF_MAX_EDGE = 768;
const FACE_REF_JPEG_QUALITY = 85;
// ControlNet の参照画像は preprocessor が高解像度を欲しがるので、顔参照より少し大きめに。
const POSE_REF_MAX_EDGE = 1024;
const POSE_REF_JPEG_QUALITY = 90;

export async function POST(req: Request) {
  let body: GenerateRequestBody;
  try {
    body = (await req.json()) as GenerateRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  if (!body.prompt || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const seed =
    body.seed !== undefined
      ? BigInt(body.seed)
      : BigInt(Math.floor(Math.random() * 2 ** 31));
  const width = body.width ?? 832;
  const height = body.height ?? 1216;
  const steps = body.steps ?? 28;
  const cfg = body.cfg ?? 5.0;
  const batchSize = Math.max(1, Math.min(MAX_BATCH_SIZE, Number(body.batchSize) || 1));

  // Lora 配列の正規化（空名は除外、強度は 0.0..2.0 にクランプ）
  const loras = Array.isArray(body.loras)
    ? body.loras
        .map((l) => ({
          name: typeof l.name === "string" ? l.name.trim() : "",
          strength: Math.max(0, Math.min(2, Number(l.strength ?? 0.8))),
        }))
        .filter((l) => l.name.length > 0)
    : [];

  // 顔参照画像の収集。useFaceRef === false なら強制 OFF、
  // 未指定 / true なら DB を見て isFaceRef=true が見つかれば自動的に使う。
  const characterIds = Array.isArray(body.characterIds) ? body.characterIds : [];
  const faceRefWanted = body.useFaceRef !== false;
  const faceRefRecords =
    faceRefWanted && characterIds.length > 0
      ? await prisma.referenceImage.findMany({
          where: { characterId: { in: characterIds }, isFaceRef: true },
          orderBy: { createdAt: "asc" },
          take: MAX_FACE_REF_IMAGES,
        })
      : [];

  const faceRefImages: ComfyUIInputImage[] = [];
  for (let i = 0; i < faceRefRecords.length; i += 1) {
    const rec = faceRefRecords[i];
    const abs = path.join(process.cwd(), rec.path);
    try {
      const buf = await readFile(abs);
      // 長辺 FACE_REF_MAX_EDGE 以内に縮小 + JPEG 化して payload を絞る
      const resized = await sharp(buf)
        .rotate() // EXIF 方向を正す
        .resize(FACE_REF_MAX_EDGE, FACE_REF_MAX_EDGE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: FACE_REF_JPEG_QUALITY })
        .toBuffer();
      faceRefImages.push({
        name: `face_${i}.jpg`,
        image: resized.toString("base64"),
      });
    } catch {
      // ディスクから消えてる / デコード失敗の画像は無視して続行
    }
  }

  // ControlNet ポーズ参照画像（base64 で受け取って resize + JPEG 化して送る）
  let poseRefImage: ComfyUIInputImage | null = null;
  if (body.poseRefImage && typeof body.poseRefImage === "string") {
    try {
      const b64 = body.poseRefImage.includes(",")
        ? body.poseRefImage.split(",")[1]
        : body.poseRefImage;
      const raw = Buffer.from(b64, "base64");
      const resized = await sharp(raw)
        .rotate()
        .resize(POSE_REF_MAX_EDGE, POSE_REF_MAX_EDGE, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: POSE_REF_JPEG_QUALITY })
        .toBuffer();
      poseRefImage = {
        name: "pose_ref.jpg",
        image: resized.toString("base64"),
      };
    } catch {
      // デコード失敗は無視（ControlNet なしで続行）
    }
  }

  const controlnetType = body.controlnetType ?? "openpose";
  const controlnetStrength =
    typeof body.controlnetStrength === "number"
      ? Math.max(0, Math.min(1.5, body.controlnetStrength))
      : 0.7;
  const controlnetEndAt =
    typeof body.controlnetEndAt === "number"
      ? Math.max(0, Math.min(1, body.controlnetEndAt))
      : 0.8;

  // 顔参照 or ポーズ参照どちらかがあれば IP-Adapter 対応 endpoint
  // （ControlNet_Aux も IP-Adapter と同じカスタムイメージに入れてあるため）
  const endpointKind: RunPodEndpointKind =
    faceRefImages.length > 0 || poseRefImage ? "ipadapter" : "default";
  const faceRefStrength =
    typeof body.faceRefStrength === "number"
      ? Math.max(0, Math.min(1.5, body.faceRefStrength))
      : 0.6;
  const faceRefEndAt =
    typeof body.faceRefEndAt === "number"
      ? Math.max(0, Math.min(1, body.faceRefEndAt))
      : 0.6;

  // バッチ枚数分あらかじめ Generation レコードを作っておく
  // seed は先頭から +1 ずつ（ComfyUI KSampler のバッチ挙動に合わせる）
  const records = await Promise.all(
    Array.from({ length: batchSize }, (_, i) =>
      prisma.generation.create({
        data: {
          prompt: body.prompt,
          negativePrompt: body.negativePrompt ?? null,
          model: "waiIllustriousSDXL_v160.safetensors",
          width,
          height,
          steps,
          cfg,
          sampler: "euler_ancestral",
          scheduler: "normal",
          seed: seed + BigInt(i),
          status: "pending",
        },
      }),
    ),
  );

  try {
    const workflow = buildBasicT2IWorkflow({
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      width,
      height,
      steps,
      cfg,
      seed,
      batchSize,
      loras,
      faceRefImageNames: faceRefImages.map((f) => f.name),
      faceRefStrength,
      faceRefEndAt,
      poseRefImageName: poseRefImage?.name,
      controlnetType,
      controlnetStrength,
      controlnetEndAt,
    });

    await Promise.all(
      records.map((r) =>
        prisma.generation.update({
          where: { id: r.id },
          data: { status: "in_queue" },
        }),
      ),
    );

    // 顔参照 + ポーズ参照を 1 本の input.images に合流して送信
    const allInputImages: ComfyUIInputImage[] = [...faceRefImages];
    if (poseRefImage) allInputImages.push(poseRefImage);

    const result = await runJobToCompletion(workflow, {
      kind: endpointKind,
      images: allInputImages.length > 0 ? allInputImages : undefined,
    });

    if (result.status !== "COMPLETED") {
      // RunPod が返した生のエラー内容を server log に吐いておく（画面では畳まれるので後追い困難）
      console.error("[generate] RunPod job not completed", {
        jobId: result.id,
        status: result.status,
        error: result.error,
        output: result.output,
        endpointKind,
        faceRefCount: faceRefImages.length,
      });
      await Promise.all(
        records.map((r) =>
          prisma.generation.update({
            where: { id: r.id },
            data: {
              status: "failed",
              runpodJobId: result.id,
              errorMessage: result.error ?? `status=${result.status}`,
            },
          }),
        ),
      );
      return NextResponse.json(
        {
          error: "generation failed",
          status: result.status,
          detail: result.error,
          output: result.output,
        },
        { status: 502 },
      );
    }

    const images = result.output?.images ?? [];
    if (images.length === 0) {
      await Promise.all(
        records.map((r) =>
          prisma.generation.update({
            where: { id: r.id },
            data: {
              status: "failed",
              runpodJobId: result.id,
              errorMessage: "no images in output",
            },
          }),
        ),
      );
      return NextResponse.json({ error: "no images in output" }, { status: 502 });
    }

    await mkdir(STORAGE_DIR, { recursive: true });

    const responseItems: Array<{
      id: string;
      imageUrl: string;
      seed: string;
    }> = [];

    for (let i = 0; i < records.length; i += 1) {
      const rec = records[i];
      const img = images[i];

      if (!img?.data) {
        await prisma.generation.update({
          where: { id: rec.id },
          data: {
            status: "failed",
            runpodJobId: result.id,
            errorMessage: "missing image for batch index",
          },
        });
        continue;
      }

      const filename = `${Date.now()}_${randomUUID().slice(0, 8)}_${i}.png`;
      const filepath = path.join(STORAGE_DIR, filename);
      await writeFile(filepath, Buffer.from(img.data, "base64"));

      const updated = await prisma.generation.update({
        where: { id: rec.id },
        data: {
          status: "completed",
          runpodJobId: result.id,
          delayTimeMs: result.delayTime ?? null,
          executionTimeMs: result.executionTime ?? null,
          imagePath: `storage/images/${filename}`,
        },
      });

      responseItems.push({
        id: updated.id,
        imageUrl: `/api/image/${filename}`,
        seed: updated.seed.toString(),
      });
    }

    return NextResponse.json({
      images: responseItems,
      delayTimeMs: result.delayTime,
      executionTimeMs: result.executionTime,
      endpointKind,
      faceRefCount: faceRefImages.length,
      poseRefUsed: !!poseRefImage,
      controlnetType: poseRefImage ? controlnetType : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await Promise.all(
      records.map((r) =>
        prisma.generation.update({
          where: { id: r.id },
          data: { status: "failed", errorMessage: message },
        }),
      ),
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
