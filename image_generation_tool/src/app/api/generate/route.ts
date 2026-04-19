// 画像生成エンドポイント。
// batchSize > 1 の場合は ComfyUI の EmptyLatentImage.batch_size を上げて
// 1 回のジョブで複数枚生成し、返ってきた画像ごとに Generation レコードを作る。
// 同じ runpodJobId を全レコードが共有するので、履歴画面で「同じバッチ」の
// グループ化も後から可能。

import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { runJobToCompletion } from "@/lib/runpod";
import { buildBasicT2IWorkflow } from "@/lib/comfyui-workflow";

export const runtime = "nodejs";
export const maxDuration = 900;

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
}

const STORAGE_DIR = path.join(process.cwd(), "storage", "images");
const MAX_BATCH_SIZE = 8;

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
    });

    await Promise.all(
      records.map((r) =>
        prisma.generation.update({
          where: { id: r.id },
          data: { status: "in_queue" },
        }),
      ),
    );

    const result = await runJobToCompletion(workflow);

    if (result.status !== "COMPLETED") {
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
        { error: "generation failed", status: result.status, detail: result.error },
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
