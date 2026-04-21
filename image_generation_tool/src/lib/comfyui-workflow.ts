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

export type ControlNetType = "openpose" | "depth" | "canny" | "lineart" | "scribble";

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
  /** ControlNet ポーズ参照画像ファイル名（worker-comfyui input.images で渡した名前）。 */
  poseRefImageName?: string;
  /** ControlNet タイプ（Union モデルで切替）。 */
  controlnetType?: ControlNetType;
  /** ControlNet 強度 (0.0〜1.5、推奨 0.6〜0.8)。 */
  controlnetStrength?: number;
  /** ControlNet を効かせる denoise 終端 (0〜1、推奨 0.7〜0.9)。 */
  controlnetEndAt?: number;
  /** ControlNet モデルファイル名（Network Volume /models/controlnet/ 下の名前）。 */
  controlnetModelName?: string;
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
    poseRefImageName,
    controlnetType = "openpose",
    controlnetStrength = 0.7,
    controlnetEndAt = 0.8,
    controlnetModelName = "xinsir-union-sdxl.safetensors",
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

  // ControlNet チェーン（poseRefImageName がある時だけ）
  //   LoadImage → 各 preprocessor → ControlNetLoader → SetUnionControlNetType
  //   → ControlNetApplyAdvanced → (positive, negative) を書き換えて KSampler へ
  //
  // Union モデル使用前提。type (openpose/depth/canny/...) で preprocessor を分岐。
  // 参照画像を加工せず直接 ControlNet に食わせたい時は preprocess="none" 相当だが、
  // ここでは精度重視で常に preprocessor をかける設計。
  let positiveSrc: [string, number] = ["6", 0];
  let negativeSrc: [string, number] = ["7", 0];

  if (poseRefImageName && poseRefImageName.trim().length > 0) {
    // 1. 画像ロード
    wf["300"] = {
      class_type: "LoadImage",
      inputs: { image: poseRefImageName },
    };

    // 2. type に応じた preprocessor
    let preprocessorSrc: [string, number] = ["300", 0];
    if (controlnetType === "openpose") {
      wf["310"] = {
        class_type: "DWPreprocessor",
        inputs: {
          image: ["300", 0],
          detect_hand: "enable",
          detect_body: "enable",
          detect_face: "enable",
          resolution: 1024,
          bbox_detector: "yolox_l.onnx",
          pose_estimator: "dw-ll_ucoco_384_bs5.torchscript.pt",
        },
      };
      preprocessorSrc = ["310", 0];
    } else if (controlnetType === "depth") {
      wf["310"] = {
        class_type: "DepthAnythingV2Preprocessor",
        inputs: {
          image: ["300", 0],
          ckpt_name: "depth_anything_v2_vitl_fp32.safetensors",
          resolution: 1024,
        },
      };
      preprocessorSrc = ["310", 0];
    } else if (controlnetType === "canny") {
      wf["310"] = {
        class_type: "CannyEdgePreprocessor",
        inputs: {
          image: ["300", 0],
          low_threshold: 100,
          high_threshold: 200,
          resolution: 1024,
        },
      };
      preprocessorSrc = ["310", 0];
    } else if (controlnetType === "lineart") {
      wf["310"] = {
        class_type: "LineArtPreprocessor",
        inputs: {
          image: ["300", 0],
          coarse: "disable",
          resolution: 1024,
        },
      };
      preprocessorSrc = ["310", 0];
    } else if (controlnetType === "scribble") {
      wf["310"] = {
        class_type: "ScribblePreprocessor",
        inputs: {
          image: ["300", 0],
          resolution: 1024,
        },
      };
      preprocessorSrc = ["310", 0];
    }

    // 3. ControlNet モデルをロード
    wf["320"] = {
      class_type: "ControlNetLoader",
      inputs: { control_net_name: controlnetModelName },
    };

    // 4. Union モデルのタイプを指定
    wf["330"] = {
      class_type: "SetUnionControlNetType",
      inputs: {
        control_net: ["320", 0],
        type: controlnetType,
      },
    };

    // 5. conditioning に ControlNet を適用
    wf["340"] = {
      class_type: "ControlNetApplyAdvanced",
      inputs: {
        positive: ["6", 0],
        negative: ["7", 0],
        control_net: ["330", 0],
        image: preprocessorSrc,
        strength: controlnetStrength,
        start_percent: 0.0,
        end_percent: controlnetEndAt,
      },
    };
    positiveSrc = ["340", 0];
    negativeSrc = ["340", 1];
  }

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
      positive: positiveSrc,
      negative: negativeSrc,
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
