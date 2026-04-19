// ComfyUI ワークフロー JSON ビルダー
//
// Lora を 0..N 個チェーンする:
//   CheckpointLoader(4) → LoraLoader(100) → LoraLoader(101) → ... → KSampler(3)
//                                                                    CLIPTextEncode(6/7)
// LoraLoader は MODEL/CLIP の 2 線をどちらも書き換えるので、
// 末尾の Lora の出力を KSampler.model と CLIPTextEncode.clip につなぐ。

import type { ComfyUIWorkflow } from "./runpod";

export interface LoraSpec {
  /** /workspace/models/loras/ 配下のファイル名（拡張子付き） */
  name: string;
  /** 0.0〜2.0 推奨 0.8 */
  strength: number;
}

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
  loras?: LoraSpec[];
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
    loras = [],
  } = params;

  // ファイル名が無い Lora は無視（誤発注防止）
  const validLoras = loras.filter(
    (l) => typeof l.name === "string" && l.name.trim().length > 0,
  );

  // 共通ノード
  const wf: ComfyUIWorkflow = {
    "4": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: model },
    },
    "5": {
      class_type: "EmptyLatentImage",
      inputs: { width, height, batch_size: batchSize },
    },
  };

  // Lora チェーン構築
  let modelSrc: [string, number] = ["4", 0];
  let clipSrc: [string, number] = ["4", 1];

  validLoras.forEach((lora, i) => {
    const id = String(100 + i);
    wf[id] = {
      class_type: "LoraLoader",
      inputs: {
        lora_name: lora.name,
        strength_model: lora.strength,
        strength_clip: lora.strength,
        model: modelSrc,
        clip: clipSrc,
      },
    };
    modelSrc = [id, 0];
    clipSrc = [id, 1];
  });

  wf["6"] = {
    class_type: "CLIPTextEncode",
    inputs: { text: prompt, clip: clipSrc },
  };
  wf["7"] = {
    class_type: "CLIPTextEncode",
    inputs: { text: negativePrompt, clip: clipSrc },
  };
  wf["3"] = {
    class_type: "KSampler",
    inputs: {
      seed: Number(seed),
      steps,
      cfg,
      sampler_name: sampler,
      scheduler,
      denoise: 1.0,
      model: modelSrc,
      positive: ["6", 0],
      negative: ["7", 0],
      latent_image: ["5", 0],
    },
  };
  wf["8"] = {
    class_type: "VAEDecode",
    inputs: { samples: ["3", 0], vae: ["4", 2] },
  };
  wf["9"] = {
    class_type: "SaveImage",
    inputs: { filename_prefix: "t2i", images: ["8", 0] },
  };

  return wf;
}
