// Lora 学習データセットの生成。
// kohya_ss (sd-scripts) で SDXL/Illustrious ベースの Lora を学習するときの
// 標準的なディレクトリ構造と設定ファイルを生成する。
//
// zip 内容:
//   README.md                      手順書（日本語）
//   config.toml                    データセット設定
//   train.sh                       1 行で学習を開始するシェル
//   images/<N>_<trigger>/          学習画像フォルダ
//     img_001.png / img_001.txt
//     img_002.png / img_002.txt
//     ...
//
// 「N_」プレフィックスは kohya_ss 慣習の「1 エポック中にこの画像を何回見せるか」。
// 画像 30 枚 × N=10 = 300 steps/epoch、10 epoch → 3000 steps 程度。

import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";

export interface TrainingImage {
  filename: string; // 拡張子付き（img_001.png 等）
  absPath: string; // ディスク絶対パス
  caption: string; // キャプション本文
}

export interface TrainingParams {
  characterName: string;
  triggerWord: string;
  images: TrainingImage[];
  repeatsPerImage: number; // kohya の N_ に入る数値
  baseModelPath: string; // /workspace/models/checkpoints/xxx.safetensors
  outputName: string; // char_hanako_v1
  networkDim: number; // 32 推奨
  networkAlpha: number; // networkDim / 2 推奨
  maxEpochs: number; // 10 推奨
  resolution: number; // 1024
  learningRate: number; // 1e-4
}

export function defaultTrainingParams(
  partial: Pick<TrainingParams, "characterName" | "triggerWord" | "images" | "outputName">,
): TrainingParams {
  return {
    ...partial,
    repeatsPerImage: 10,
    baseModelPath:
      "/workspace/models/checkpoints/waiIllustriousSDXL_v160.safetensors",
    networkDim: 32,
    networkAlpha: 16,
    maxEpochs: 10,
    resolution: 1024,
    learningRate: 1e-4,
  };
}

function renderConfigToml(params: TrainingParams): string {
  return `# kohya_ss データセット設定
[general]
shuffle_caption = true
caption_extension = ".txt"
keep_tokens = 1
enable_bucket = true
bucket_reso_steps = 64
min_bucket_reso = 512
max_bucket_reso = 2048

[[datasets]]
resolution = ${params.resolution}
batch_size = 1

  [[datasets.subsets]]
  image_dir = "./images/${params.repeatsPerImage}_${params.triggerWord}"
  class_tokens = "${params.triggerWord}"
  num_repeats = ${params.repeatsPerImage}
`;
}

function renderTrainShell(params: TrainingParams): string {
  // kohya_ss (sd-scripts) の sdxl_train_network.py を想定
  return `#!/bin/bash
# ${params.characterName} の Lora 学習スクリプト
#
# 前提:
#   - Pod に kohya_ss (sd-scripts) をインストール済み
#     例: git clone https://github.com/kohya-ss/sd-scripts.git && cd sd-scripts && pip install -r requirements.txt
#   - ベースモデル ${params.baseModelPath} が存在
#   - /workspace/models/loras/ が存在
#
# 実行:
#   chmod +x train.sh && ./train.sh
#
# 完了後:
#   /workspace/models/loras/${params.outputName}.safetensors が生成される

set -e

cd "$(dirname "$0")"

echo "🎓 Lora 学習を開始: ${params.outputName}"
echo "ベースモデル: ${params.baseModelPath}"
echo "画像枚数: ${params.images.length}枚 × ${params.repeatsPerImage} repeats × ${params.maxEpochs} epochs"

# kohya_ss/sd-scripts が /workspace/sd-scripts にある想定
# もし別の場所なら適宜変更
SCRIPTS_DIR="\${SCRIPTS_DIR:-/workspace/sd-scripts}"

accelerate launch --num_cpu_threads_per_process 1 \\
  "$SCRIPTS_DIR/sdxl_train_network.py" \\
  --pretrained_model_name_or_path="${params.baseModelPath}" \\
  --dataset_config="./config.toml" \\
  --output_dir="/workspace/models/loras" \\
  --output_name="${params.outputName}" \\
  --network_module="networks.lora" \\
  --network_dim=${params.networkDim} \\
  --network_alpha=${params.networkAlpha} \\
  --learning_rate=${params.learningRate} \\
  --unet_lr=${params.learningRate} \\
  --text_encoder_lr=${params.learningRate * 0.5} \\
  --max_train_epochs=${params.maxEpochs} \\
  --save_every_n_epochs=5 \\
  --train_batch_size=1 \\
  --optimizer_type="AdamW8bit" \\
  --mixed_precision="bf16" \\
  --save_precision="fp16" \\
  --cache_latents \\
  --gradient_checkpointing \\
  --xformers \\
  --seed=42

echo ""
echo "✅ 学習完了: /workspace/models/loras/${params.outputName}.safetensors"
echo "   このファイルをツールの絵柄/キャラ設定で参照してください。"
`;
}

function renderReadme(params: TrainingParams): string {
  return `# ${params.characterName} 学習データ

## 概要

これは ${params.characterName} の Lora（SDXL/Illustrious 向け）を学習するための
データセットです。kohya_ss (sd-scripts) 形式で梱包されています。

- トリガーワード: \`${params.triggerWord}\`
- 画像: ${params.images.length} 枚
- 1 epoch あたりのステップ数: ${params.images.length * params.repeatsPerImage}
- 総エポック: ${params.maxEpochs}

## 手順（RunPod Pod 上で実行）

### 1. Pod 起動
- GPU: **RTX 4090 / RTX PRO 4500（24GB VRAM 以上推奨）**
- Network Volume: \`image-gen-models\`
- Template: **ComfyUI (runpod/comfyui:latest)** または Python が入ってるやつなら何でも
- Container disk: 50GB（学習中に一時ファイルが出る）

### 2. kohya_ss のインストール（初回のみ、5 分）

Pod の Terminal で:

\`\`\`bash
cd /workspace
git clone https://github.com/kohya-ss/sd-scripts.git
cd sd-scripts
git checkout sd3   # SDXL/Illustrious 対応ブランチ
pip install -r requirements.txt
pip install bitsandbytes xformers
accelerate config default
\`\`\`

### 3. この zip を Pod にアップロード

JupyterLab のアップロードボタンで zip をアップ → 展開:

\`\`\`bash
cd /workspace
unzip ${params.outputName}-dataset.zip -d ${params.outputName}
cd ${params.outputName}
\`\`\`

### 4. 学習を実行

\`\`\`bash
chmod +x train.sh
./train.sh
\`\`\`

所要時間: **RTX 4090 で約 20〜40 分**。VRAM 24GB 推奨（足りない場合は
train.sh 内の \`--train_batch_size=1\` のままで、\`--mixed_precision=fp16\` に
変更したり \`--network_dim=16\` に下げたりで調整）

### 5. Lora が \`/workspace/models/loras/${params.outputName}.safetensors\` に保存される

### 6. Pod を Terminate（絶対忘れない）

### 7. ツールに戻って「✅ 学習完了をマーク」ボタン

これでキャラを選ぶだけで Lora が生成ワークフローに自動適用されます。

## キャプション方針の確認

各 \`.txt\` には以下のような英語タグがカンマ区切りで入っています:

\`\`\`
${params.triggerWord}, 1girl, brown hair, ponytail, school uniform, smile
\`\`\`

- トリガーワード \`${params.triggerWord}\` が**全画像の先頭**にある
- 書かれたタグ（髪色/服装/表情等）は **可変**
- 書かれていない顔・体型は **固定**（キャラの"芯"として学習される）

## トラブルシューティング

- **OOM (out of memory)**:
  - \`--train_batch_size=1\` 維持
  - \`--network_dim=16\` に下げる
  - \`--gradient_accumulation_steps=2\` 追加
- **学習が遅い / 過学習**:
  - \`--max_train_epochs\` を減らす（5〜8）
  - \`--learning_rate=5e-5\` に下げる
- **生成結果が過度に学習画像に似すぎる**:
  - キャプションに髪/服のタグが足りない可能性
  - epoch を減らす、または \`--network_dim\` を下げる
`;
}

export async function buildTrainingDatasetZip(params: TrainingParams): Promise<Buffer> {
  const zip = new JSZip();

  zip.file("README.md", renderReadme(params));
  zip.file("config.toml", renderConfigToml(params));
  zip.file("train.sh", renderTrainShell(params));

  const imagesDir = zip.folder(
    `images/${params.repeatsPerImage}_${params.triggerWord}`,
  );
  if (!imagesDir) throw new Error("failed to create images folder");

  for (const img of params.images) {
    const ext = path.extname(img.filename).replace(/^\./, "").toLowerCase();
    if (!["png", "jpg", "jpeg", "webp"].includes(ext)) continue;
    const buf = await readFile(img.absPath);
    const base = path.basename(img.filename, path.extname(img.filename));
    imagesDir.file(img.filename, buf);
    imagesDir.file(`${base}.txt`, img.caption);
  }

  return zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}
