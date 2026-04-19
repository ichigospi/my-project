# 引き継ぎ書（新セッション用・コピペ対応）

> このファイルは「セッションが途中で止まった時に、新しいセッションへ丸ごと渡すための要約」です。
> 進捗があるたびに更新されます。**更新日時: 2026-04-19**

---

## 新セッションへの指示（コピペ用冒頭文）

```
画像生成ツール（my-project/image_generation_tool/）の続きをやっています。
以下の引き継ぎ書を読んで、末尾の「現在の作業」から再開してください。

- 引き継ぎ書: image_generation_tool/HANDOVER.md
- 設計書: image_generation_tool/DESIGN.md
- 状況サマリ: image_generation_tool/README.md
- 開発ブランチ: claude/resume-section-work-cN8J2
```

---

## プロジェクト概要

- **目的**: 自分専用の高機能画像生成Webアプリ（アニメ/イラスト/NSFW）
- **形態**: my-project 内の **完全独立サブフォルダ**（`image_generation_tool/`）
- **スタック**: Next.js App Router + SQLite/Prisma + RunPod Serverless ComfyUI
- **ベースモデル**: Illustrious XL（メイン）＋ Pony V6（サブ）
- **想定用途**: 自分用ローカル運用・非公開

詳細は `DESIGN.md`（484行）参照。

---

## 主要な意思決定（確定済み）

| 項目 | 決定 | 理由 |
|---|---|---|
| バックエンド | RunPod Serverless ComfyUI | fal.ai は NSFW/SDXL制限が厳しい |
| ベースモデル | Illustrious XL + Pony V6 両対応 | 絵師タグ/Lora資産 両方活用 |
| Lora学習 | RunPod Serverless + kohya_ss | ツール内完結・学習データローカル保管 |
| 配置 | my-project/image_generation_tool/ | 他アプリと完全分離（サブフォルダ方式） |
| DB | SQLite + Prisma | ローカル・自分用のためシンプルに |
| 画像保存 | `./storage/images/` | ローカルファイル |
| UI | 6W1H ボタン（タイピング最小化） | いつ/誰が/誰と/どこで/格好/アングル/何を |

---

## 絶対遵守の設計原則

1. **キャラクターの特徴は確実に把握し、そこにオリジナル要素を入れてはいけない**
   → ツールが勝手に解釈・改変しない。登録された特徴通りに生成する。
2. **初心者でもわかる設計**（難しそうな部分には必ず説明書を添える）
3. **タイピングは最小限**（ボタン選択で8割生成可能に）
4. **自分専用・非公開前提**（SNS公開・販売を想定しない）

---

## 機能リスト（設計確定）

### 生成系
- **日本語テキスト→画像**（内部でタグ変換）
- **画像→画像編集/修正**（i2i）
- **Inpainting**（部位修正・差分）
- **カメラアングル調整**（6W1H のアングルカード）
- **ControlNet**（3Dポーズ→OpenPose画像）
- **アップスケール**（Real-ESRGAN / Clarity）
- **背景透過**（RMBG-2.0 / BiRefNet。αチャンネル付きPNG出力）
- **モザイク除去**（自動検出 + Inpainting / 手動マスク両対応）
- **らくらく差分出力**（人物だけ/髪型だけ/目線だけ/表情だけ/動きだけ、の微修正ボタン）
- **画像ダウンロード**（PC にワンクリック保存）
- **バッチ生成**（seed違いで複数枚）
- **パラメータ調整**: モデル選択 / サイズ / 枚数 / seed / 絵柄参照強度（Lora scale）/ steps / cfg / sampler

### 管理系
- **キャラクター**（プロフィール + Lora + キャラごとの専用プロンプト指定）
- **キャラプロフィール項目（性別別）**
  - 女性: 顔 / 髪型 / 服装 / 身長(cm手入力) / 胸と乳輪 / 女性器 / 陰毛(あり/なし)
  - 男性: 顔 / 髪型 / 身長(cm手入力) / 男性器（服装はオプション扱い）
- **身体パーツ記憶**（顔/唇/目/髪型/身長など。テキスト入力or画像アップで固定。**ユーザーが項目自体を追加可能**）
- **絵柄**（4方式: 絵師タグ直打ち / Civitai Lora取込 / 自作Lora / IP-Adapter Style）
- **絵柄ブレンド**（複数 Lora 同時適用・強度個別指定・組合せ保存）
- **Civitai 連携**（検索バー / ベースモデルフィルタ / NSFW切替 / ワンクリックDL → Network Volume同期）
- **服装/髪型プリセット**（ボタン切替: 制服/カジュアル/ドレス/水着/下着/半裸/全裸 等）
- **行為プリセット**（ユーザー追加・編集可能）
- **場所ライブラリ**（生成背景を保存→ 3モード再利用: プロンプト注入 / IP-Adapter参照 / 背景固定合成）
- **ポーズライブラリ**（3Dビューアで**キャラごと**に保存）
- **アセット**（効果音画像・吹き出し画像を登録しておき、画像エディタでいつでも呼出）
- **プロンプトテンプレート**（記憶・呼出）

### 6W1H プリセット（ボタンUI）
- **カード**: いつ / 誰が / 誰と（複数指定＋役割タグ）/ どこで / 格好 / アングル / 何をしてる
- **アングル（12種デフォ）**: 女性視点/男性視点/第三者視点/天井から/前から/横から/後ろから/下から/全身/上半身/下半身/顔ドアップ
- **SFW/NSFW タブ切替**
- **NSFW行為（16種デフォ）**: キス/ハグ/手コキ/手マン/フェラ/クンニ/正常位/バック/立ちバック/種付けプレス/騎乗位/駅弁/対面座位/キスハメ/シックスナイン/事後
- **ゴム有無トグル**: あり/なし/指定なし（「行為」カード直下に独立配置）
- **お気に入り組合せ保存**（ワンクリックで再現）

### 差分ブースト（少素材でキャラ登録）
素材 1〜3枚 → IP-Adapter Face + ControlNet Pose で **アングル/表情/ポーズ/服装/光源**を組み合わせ 20〜40枚自動生成 → グリッド表示で選別 → 選ばれた画像を Lora学習素材に使用

### 画像エディタ（後処理）
- Fabric.js ベース
- **テキスト入力**: フォント / 色 / 縁取り 指定
- **セリフ・効果音**を自由配置
- **登録アセット（効果音画像・吹き出し）の呼出・配置**

### その他
- **プロンプト最適化**（Claude API で日本語→英タグ変換）
- **プロンプト記憶**（テンプレート化）
- **履歴/ギャラリー**（全生成履歴、検索、再生成、ダウンロード）
- **自衛機能**: 生成画像の PNG メタデータに使用 Lora 名を自動埋め込み

### 初心者向け設計（全ツール共通）
- デフォルト値を常に用意（何も触らずに動く）
- 各画面に **？マーク**（クリックで説明書ポップアップ）
- **初回起動時のツアー**
- 専門用語は避けるか並記（例:「LoRA weight」→「キャラ再現度(0〜2, 推奨1.0)」）
- エラーは**日本語で原因と対処**を表示
- 重要操作（学習開始・削除）は**確認ダイアログ**
- 各設定に「**推奨 / 詳細**」タブ（上級者領域を分離）

### 説明書（`/docs/` 配下）
- `setup.md` — 初回セットアップ（RunPod アカウント作成・APIキー取得）
- `character-training.md` — キャラ登録・Lora学習の手順
- `prompt-basics.md` — プロンプトの仕組み（タイピング最小化UIの裏側）
- `troubleshooting.md` — よくあるエラーと対処

---

## フェーズ計画

| Phase | 内容 | 期間目安 |
|---|---|---|
| Phase 1（MVP） | 環境構築/基本生成/キャラ登録+差分ブースト/Lora学習/6W1H UI/履歴 | 2〜3週 |
| Phase 2 | 場所保存/服装行為プリセット/Inpainting/背景透過/モザイク除去 | 1〜2週 |
| Phase 3 | 3Dポーズ/画像エディタ/アップスケール/プロンプト最適化 | 2週 |
| Phase 4 | UX磨き/ヘルプ充実/お気に入り組合せ | 継続 |

---

## RunPod 環境情報

**秘密情報（コミットしない・.env.local に保存）:**
- `RUNPOD_API_KEY`: 保存済み（`rpa_LJW...`）※チャット履歴に漏れた経緯あり、無効化&再作成推奨
- Civitai API Key: Civicomfy 設定に保存済み（Network Volume内）

**公開情報（このファイルに書いてOK）:**

| 項目 | 値 |
|---|---|
| Data Center | `EU-RO-1` |
| Network Volume 名 | `image-gen-models` |
| Network Volume ID | `xpsphpa6vo` |
| Volume サイズ | 100GB（月$7） |
| Serverless Endpoint 名 | `image-gen-comfyui` |
| Serverless Endpoint ID | `onlq54amynaf6v` |
| Worker | `runpod-workers/worker-comfyui` v5.8.5 |
| 対応GPU（Serverless） | 24GB PRO / 32GB PRO / 48GB |
| Pod 用 GPU（検証済） | RTX PRO 4500（$0.64/hr） |

**ダウンロード済モデル:**
- `waiIllustriousSDXL_v160.safetensors`（6.46GB）※ Network Volume 上

**未DLモデル（Phase 1 で追加予定）:**
- Pony Diffusion V6 XL
- SDXL VAE
- ControlNet（OpenPose, Canny, Depth）
- Real-ESRGAN / 4x-UltraSharp（アップスケーラー）
- IP-Adapter Plus Face SDXL
- RMBG-2.0（背景透過）
- BRIA / anime mosaic remover（モザイク除去）

---

## 重要な学び（ハマりポイント）

### 1. Network Volume マウントパスの違い（🔥最重要）
- **Pod**: `/workspace/` にマウント
- **Serverless（worker-comfyui）**: `/runpod-volume/` にマウント
- worker-comfyui は `/runpod-volume/models/checkpoints/` を見る
- **正しい配置**: Pod 作業時は `/workspace/models/checkpoints/` に置く（= Serverless から見ると `/runpod-volume/models/checkpoints/`）
- **NG配置**: Civicomfy 初期値 `/runpod-volume/ComfyUI/checkpoints/` はダメ（ComfyUI サブフォルダがついてる）

### 2. テンプレート選択
- ❌ `ComfyUI - AI-Dock` → 認証まわりで 404 地獄
- ✅ `ComfyUI (runpod/comfyui:latest)` 公式 → 素直に動く
- ✅ `Runpod Pytorch 2.4.0` → ファイル操作だけなら軽くて良い

### 3. GPU 在庫
- EU-RO-1 は激安GPU（RTX 2000/4000 Ada, L4）が Unavailable になりがち
- 代替は RTX PRO 4500 ($0.64/hr) or RTX 4090
- CPU Pod は Provisioning で詰まることがある

### 4. コスト事故防止
- Pod は**作業完了直後に即 Terminate**（放置で $0.67/hr 課金継続）
- 今回1回事故済み（2日放置 → 負債化 → $20 追加チャージ）
- UI 完成後は Serverless のみ運用（アイドル時 $0）

### 5. スクショサイズ
- Claude Code Web はアップロード上限 **32MB**
- 長いスクショは分割するか、テキストコピペで渡す

### 6. Illustrious 生成パラメータ（検証済で動いた値）
- サイズ: 832x1216（縦長）
- ステップ: 28
- cfg: 5.0
- サンプラー: `euler_ancestral`
- スケジューラ: `normal`

---

## 進捗ログ（時系列）

### 2026-04-17 頃
- ✅ 要件ヒアリング → Sousaku API 検討 → fal.ai 検討 → **RunPod Serverless に決定**
- ✅ DESIGN.md 初版コミット（`bfa621f`）

### 2026-04-18 頃
- ✅ RunPod アカウント作成
- ✅ API Key 取得（Chrome 翻訳OFFで解決）
- ✅ $10 チャージ（auto-pay OFF）
- ✅ Network Volume 作成（`image-gen-models` / EU-RO-1 / 100GB）
- ✅ Pod 起動（runpod/comfyui:latest, RTX PRO 4500）
- ✅ Civicomfy で WAI-illustrious-SDXL v16.0 DL
- ✅ Pod 内テスト生成成功（桜並木の制服女子高生）
- ✅ README 更新コミット（`f13be30`）

### 2026-04-19
- ⚠️ 前 Pod 放置で残高枯渇 → $20 追加チャージ
- ✅ Serverless Endpoint 作成（`onlq54amynaf6v`, 24/32/48GB対応）
- ❌ Serverless 初回テスト失敗: `ckpt_name not in ['flux1-dev-fp8.safetensors']` エラー
  - 原因: Civicomfy が `/runpod-volume/ComfyUI/checkpoints/` に保存していた
  - 期待: worker-comfyui は `/runpod-volume/models/checkpoints/` を見る
- 🔄 Pod 再起動してファイル移動作業中
- ✅ 前セッション作業（DESIGN.md / README.md）を `claude/resume-section-work-cN8J2` にマージ
- ✅ HANDOVER.md 作成（このファイル）

---

## 現在の作業（⚡ここから再開）

### ブロッカー
Serverless Endpoint がモデルを見つけられない。Pod でファイル移動して解決する必要あり。

### 次のアクション

**Step 1: Pod 状況の確認**
ユーザーに聞く: 「いま Pod は起動してますか？停止/未起動ですか？」

**Step 2（Pod 起動中の場合）: Terminal で以下を実行**
```bash
mkdir -p /workspace/models/checkpoints /workspace/models/loras /workspace/models/vae /workspace/models/controlnet /workspace/models/upscale_models /workspace/models/embeddings /workspace/models/clip /workspace/models/clip_vision /workspace/models/ipadapter && mv /workspace/runpod-slim/ComfyUI/models/checkpoints/*.safetensors /workspace/models/checkpoints/ 2>/dev/null; ls -la /workspace/models/checkpoints/
```

期待結果: `waiIllustriousSDXL_v160.safetensors`(約6.9GB) が `/workspace/models/checkpoints/` に表示される

**Step 2の結果がテキストで返ってきたら → Step 3**

**Step 3: Pod を即 Terminate（コスト防止）**

**Step 4: Serverless Endpoint で再テスト**
RunPod Serverless → Endpoint `image-gen-comfyui` → Requests タブで以下の JSON 投入:

```json
{
  "input": {
    "workflow": {
      "3": {
        "class_type": "KSampler",
        "inputs": {
          "seed": 12345, "steps": 28, "cfg": 5.0,
          "sampler_name": "euler_ancestral", "scheduler": "normal",
          "denoise": 1.0,
          "model": ["4", 0], "positive": ["6", 0],
          "negative": ["7", 0], "latent_image": ["5", 0]
        }
      },
      "4": {
        "class_type": "CheckpointLoaderSimple",
        "inputs": {"ckpt_name": "waiIllustriousSDXL_v160.safetensors"}
      },
      "5": {
        "class_type": "EmptyLatentImage",
        "inputs": {"width": 832, "height": 1216, "batch_size": 1}
      },
      "6": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "text": "masterpiece, best quality, 1girl, school uniform, smile, cherry blossoms",
          "clip": ["4", 1]
        }
      },
      "7": {
        "class_type": "CLIPTextEncode",
        "inputs": {
          "text": "lowres, bad quality, worst quality, bad anatomy",
          "clip": ["4", 1]
        }
      },
      "8": {
        "class_type": "VAEDecode",
        "inputs": {"samples": ["3", 0], "vae": ["4", 2]}
      },
      "9": {
        "class_type": "SaveImage",
        "inputs": {"filename_prefix": "api_test", "images": ["8", 0]}
      }
    }
  }
}
```

**Step 5: 成功したら次フェーズ**
- 追加モデル DL（Pony V6, ControlNet, VAE, Upscaler, IP-Adapter, RMBG）
- `image_generation_tool/` の Next.js 初期化（Phase 1 実装開始）

---

## 未解決/要確認事項

- [ ] 漏洩した API Key の無効化＆再作成（セキュリティ）
- [ ] Civicomfy の Global Download Root を `/workspace` に変更（次回DL用、Pod から）
- [ ] Serverless 用の `extra_model_paths.yaml` 同梱有無（worker-comfyui の仕様次第）
- [ ] Phase 1 タスク分解の詳細化
- [ ] Next.js プロジェクト構造（app/ の階層設計）
- [ ] 画像生成ツール用の package.json を my-project ルートと別にするか、monorepo 的に統合するか

---

## ファイル構成（現状）

```
my-project/
├─ image_generation_tool/      ← このツール専用フォルダ
│   ├─ DESIGN.md               ← 詳細設計書（484行）
│   ├─ README.md               ← 進捗サマリ
│   ├─ HANDOVER.md             ← このファイル
│   └─ .env.local              ← gitignore（APIキー等）※ブランチによっては未生成
└─ ...（他は既存アプリ）
```

---

## 更新ルール

新セッションで進捗があったら、**メインアシスタントは毎ターン以下を更新**:

1. 「進捗ログ（時系列）」に 1行追記
2. 「現在の作業」を最新の次アクションに書き換え
3. ブロッカーが解決したら「未解決/要確認事項」から削除
4. 新しいハマりポイントが見つかったら「重要な学び」に追記
5. 新しい要件追加があったら「機能リスト」「設計原則」を更新
6. コミット時のメッセージ: `docs(handover): YYYY-MM-DD <短い説明>`

---

## 閲覧方法

- **ローカル**: `my-project/image_generation_tool/HANDOVER.md`
- **Git リポジトリ**（ブラウザ）: `claude/resume-section-work-cN8J2` ブランチの同パス
- **Claude Code セッション内**: 「HANDOVER 見せて」と言えば表示
- **新セッション開始時**: このファイル冒頭の「コピペ用冒頭文」を貼るだけで文脈が引き継がれる
