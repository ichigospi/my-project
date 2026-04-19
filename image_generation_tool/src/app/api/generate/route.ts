import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

import { prisma } from "@/lib/prisma";
import { runJobToCompletion } from "@/lib/runpod";
import { buildBasicT2IWorkflow } from "@/lib/comfyui-workflow";

export const runtime = "nodejs";
export const maxDuration = 600;

interface GenerateRequestBody {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  seed?: number | string;
}

const STORAGE_DIR = path.join(process.cwd(), "storage", "images");

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

  const seed = body.seed !== undefined ? BigInt(body.seed) : BigInt(Math.floor(Math.random() * 2 ** 31));
  const width = body.width ?? 832;
  const height = body.height ?? 1216;
  const steps = body.steps ?? 28;
  const cfg = body.cfg ?? 5.0;

  const generation = await prisma.generation.create({
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
      seed,
      status: "pending",
    },
  });

  try {
    const workflow = buildBasicT2IWorkflow({
      prompt: body.prompt,
      negativePrompt: body.negativePrompt,
      width,
      height,
      steps,
      cfg,
      seed,
    });

    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "in_queue" },
    });

    const result = await runJobToCompletion(workflow);

    if (result.status !== "COMPLETED") {
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "failed",
          runpodJobId: result.id,
          errorMessage: result.error ?? `status=${result.status}`,
        },
      });
      return NextResponse.json(
        { error: "generation failed", status: result.status, detail: result.error },
        { status: 502 },
      );
    }

    const firstImage = result.output?.images?.[0];
    if (!firstImage?.data) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "failed",
          runpodJobId: result.id,
          errorMessage: "no image in output",
        },
      });
      return NextResponse.json({ error: "no image in output" }, { status: 502 });
    }

    await mkdir(STORAGE_DIR, { recursive: true });
    const filename = `${Date.now()}_${randomUUID().slice(0, 8)}.png`;
    const filepath = path.join(STORAGE_DIR, filename);
    await writeFile(filepath, Buffer.from(firstImage.data, "base64"));

    const updated = await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: "completed",
        runpodJobId: result.id,
        delayTimeMs: result.delayTime ?? null,
        executionTimeMs: result.executionTime ?? null,
        imagePath: `storage/images/${filename}`,
      },
    });

    return NextResponse.json({
      id: updated.id,
      imageUrl: `/api/image/${filename}`,
      imageBase64: firstImage.data,
      delayTimeMs: result.delayTime,
      executionTimeMs: result.executionTime,
      seed: seed.toString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "failed", errorMessage: message },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
