#!/bin/bash
# サンプル用のデモ素材を ffmpeg だけで生成する（外部素材・APIキー不要）
set -e
cd "$(dirname "$0")"
mkdir -p assets

# 映像素材1: グラデーション風の動く背景（8秒）
ffmpeg -y -hide_banner -loglevel error -f lavfi -t 8 \
  -i "gradients=s=1080x1920:speed=0.05:c0=0x1a2a6c:c1=0xb21f1f:c2=0xfdbb2d" \
  -c:v libx264 -pix_fmt yuv420p -r 30 assets/bg_gradient.mp4

# 映像素材2: テストパターン映像（6秒・手持ち素材の代わり）
ffmpeg -y -hide_banner -loglevel error -f lavfi -t 6 \
  -i "testsrc2=s=1080x1920:r=30" \
  -c:v libx264 -pix_fmt yuv420p assets/footage_demo.mp4

# 画像素材: まとめ用の静止画
ffmpeg -y -hide_banner -loglevel error -f lavfi \
  -i "color=c=0x16213e:s=1080x1920" -frames:v 1 assets/matome.png

# BGM: 穏やかなコード進行風のトーン（30秒・デモ用）
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "sine=frequency=261.63:duration=30" \
  -f lavfi -i "sine=frequency=329.63:duration=30" \
  -f lavfi -i "sine=frequency=392.00:duration=30" \
  -filter_complex "[0:a][1:a][2:a]amix=inputs=3:normalize=1,volume=0.6,tremolo=f=0.5:d=0.3" \
  assets/bgm_demo.mp3

echo "デモ素材の生成完了: $(ls assets/)"
