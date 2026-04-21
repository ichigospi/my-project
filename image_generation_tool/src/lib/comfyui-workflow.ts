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
  /**
   * IP-Adapter の顔参照画像ファイル名（RunPod worker-comfyui の input.images で渡した名前）。
   * 空配列 or undefined だと IP-Adapter ノードは挿入されない。
   */
  faceRefImageNames?: string[];
  /** IP-Adapter の適用強度 (0.0〜1.5 推奨 0.75)。 */
  faceRefStrength?: number;
  /** IP-Adapter を効かせる denoise 終端 (0.0〜1.0)。後半も効かせすぎると構図が固まりすぎる。 */
  faceRefEndAt?: number;
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
    faceRefImageNames = [],
    faceRefStrength = 0.6,
    faceRefEndAt = 0.6,
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

  // IP-Adapter（顔参照）チェーン構築。
  //   Lora チェーン後の MODEL に対して IPAdapterUnifiedLoader → IPAdapterAdvanced
  //   を挟む。複数画像は ImageBatch で左畳み込みして 1 本の IMAGE に統合、
  //   IPAdapterAdvanced 側の combine_embeds="average" で平均顔を作る。
  const validFaces = faceRefImageNames.filter(
    (n) => typeof n === "string" && n.length > 0,
  );
  if (validFaces.length > 0) {
    const loaderId = "200";
    wf[loaderId] = {
      class_type: "IPAdapterUnifiedLoader",
      inputs: {
        model: modelSrc,
        preset: "PLUS FACE (portraits)",
      },
    };

    const loadIds: string[] = [];
    validFaces.forEach((name, i) => {
      const id = String(210 + i);
      wf[id] = {
        class_type: "LoadImage",
        inputs: { image: name },
      };
      loadIds.push(id);
    });

    let imageSrc: [string, number] = [loadIds[0], 0];
    for (let i = 1; i < loadIds.length; i += 1) {
      const batchId = String(250 + i);
      wf[batchId] = {
        class_type: "ImageBatch",
        inputs: {
          image1: imageSrc,
          image2: [loadIds[i], 0],
        },
      };
      imageSrc = [batchId, 0];
    }

    wf["280"] = {
      class_type: "IPAdapterAdvanced",
      inputs: {
        model: [loaderId, 0],
        ipadapter: [loaderId, 1],
        image: imageSrc,
        weight: faceRefStrength,
        weight_type: "linear",
        combine_embeds: "average",
        start_at: 0.0,
        end_at: faceRefEndAt,
        embeds_scaling: "V only",
      },
    };
    modelSrc = ["280", 0];
  }

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
