# AI素材生成ガイド

Claude Code 自体は画像・映像・音声を生成できないため、外部APIをコマンドライン（curl / python）から叩いて素材を生成し、`projects/<名前>/assets/` に保存する。

## 前提: APIキーの設定

使うサービスのAPIキーを環境変数に設定してもらう（`.env` はコミットしない）:

```bash
export FAL_KEY="..."           # fal.ai（画像・動画生成のハブ。おすすめ）
export REPLICATE_API_TOKEN="..." # Replicate（同上）
export OPENAI_API_KEY="..."    # gpt-image-1（画像）
export ELEVENLABS_API_KEY="..." # ElevenLabs（ナレーション音声）
```

キーが未設定の場合は、どのサービスのキーが必要かをユーザーに伝えて設定を待つ。**キーなしで生成はできないので、代替（ffmpeg生成のタイトルカード・手持ち素材・フリー素材）を提案する。**

## 1. 静止画の生成

### fal.ai (FLUX) の例

```bash
curl -s -X POST "https://fal.run/fal-ai/flux/schnell" \
  -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
  -d '{"prompt": "serene japanese shrine at dawn, cinematic, photorealistic", "image_size": {"width": 1080, "height": 1920}}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['images'][0]['url'])"
# → 返ってきたURLを curl -o assets/scene3.png でダウンロード
```

- 縦動画用は最初から 1080x1920 で生成する（後からのクロップは画質が落ちる）
- 日本語プロンプトより英語プロンプトの方が精度が高いモデルが多い

## 2. 映像（動画クリップ）の生成

fal.ai / Replicate 経由で Kling・Veo・Wan 等の動画生成モデルが使える。生成には数十秒〜数分かかるので、非同期（queue）APIの場合はポーリングする。

### fal.ai (画像→動画) の例

```bash
# 1で生成した画像を動かす (image-to-video)。モデルは fal.ai のダッシュボードで最新を確認
curl -s -X POST "https://queue.fal.run/fal-ai/kling-video/v1.6/standard/image-to-video" \
  -H "Authorization: Key $FAL_KEY" -H "Content-Type: application/json" \
  -d '{"prompt": "slow camera push in, gentle wind", "image_url": "https://...", "duration": "5"}'
# → request_id が返る → status URL をポーリング → 完了したら video URL をダウンロード
```

- **費用がかかる**ため、生成前に「何秒×何本、おおよその料金」をユーザーに伝えて了承を得る
- 5〜10秒クリップを複数作って timeline で繋ぐのが基本。1本の長尺生成は高くつく

## 3. ナレーション音声

### ElevenLabs の例

```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/<voice_id>" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{"text": "台本のナレーション文", "model_id": "eleven_multilingual_v2"}' \
  -o assets/voice.mp3
```

### 無料の代替: VOICEVOX（ローカル）

ローカルPCで作業する場合は VOICEVOX エンジンを起動して REST API で合成できる（商用利用可のキャラクターあり・クレジット表記必要）。

## 4. BGM

- BGMのAI生成（Suno等）は現状API提供が限定的なので、**フリーBGMサイトを第一候補**にする:
  - DOVA-SYNDROME / 甘茶の音楽工房 / BGMer など（利用規約を確認し、出典を script.md にメモ）
- ユーザーが音源ファイルを持っている場合は `assets_library/bgm/` に置いて使い回す

## 5. 生成後のチェック

```bash
ffprobe -v error -show_entries stream=width,height,duration -of default=nw=1 assets/xxx.mp4
```

- 解像度・長さを確認してから timeline.json に組み込む
- 生成に使ったプロンプト・モデル名・費用は `script.md` の「素材メモ・出典」に記録する

## 注意事項

- 生成コンテンツの商用利用可否は各サービスの規約に従う
- 実在人物・他者のキャラクター・ロゴを含む生成はしない
- モデル名・エンドポイントは頻繁に変わるため、エラーになったら各サービスのドキュメントで最新のモデルIDを確認する
