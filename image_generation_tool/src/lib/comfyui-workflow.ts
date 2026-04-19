// ComfyUI ワークフロー JSON ビルダー

import type { ComfyUIWorkflow } from "./runpod";

export interface BasicT2IParams {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg?: number;
  sampler?: string;
  scheduler?: string;
  seed: number | bigint;
  batchSize?: number;
}

const DEFAULT_NEGATIVE = "lowres, bad quality, worst quality, bad anatomy, deformed";

export function buildBasicT2IWorkflow(params: BasicT2IParams): ComfyUIWorkflow {
  const {
    prompt,
    negativePrompt = DEFAULT_NEGATIVE,
    model = "waiIllustriousSDXL_v160.safetensors",
    width = 832,
    height = 1216,
    steps = 28,
    cfg = 5.0,
    sampler = "euler_ancestral",
    scheduler = "normal",
    seed,
    batchSize = 1,
  } = params;

  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed: Number(seed),
        steps,
        cfg,
        sampler_name: sampler,
        scheduler,
        denoise: 1.0,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: model },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: batchSize },
    },
    "6": {
      class_type: "CLIPTextEncode",
      inputs: { text: prompt, clip: ["4", 1] },
    },
    "7": {
      class_type: "CLIPTextEncode",
      inputs: { text: negativePrompt, clip: ["4", 1] },
    },
    "8": {
      class_type: "VAEDecode",
      inputs: { samples: ["3", 0], vae: ["4", 2] },
    },
    "9": {
      class_type: "SaveImage",
      inputs: { filename_prefix: "t2i", images: ["8", 0] },
    },
  };
}
