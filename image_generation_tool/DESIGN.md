# 画像生成ツール 設計書

自分専用の高機能画像生成ツール。Next.js + RunPod Serverless ComfyUI(SDXL)構成。

## 1. 目的とスコープ

- **使う人**: 自分専用(ローカル起動)
- **コンテンツ**: アニメ・イラスト系、NSFW対応必須
- **保存**: ローカル(`./storage/`)
- **予算**: 月3万円以下で量産可能
- **配置**: `my-project/image_generation_tool/` サブフォルダ(既存アプリと完全独立)

## 2. 技術スタック

| 層 | 採用 | 理由 |
|---|---|---|
| フロント/サーバー | Next.js App Router(自前 Node 起動) | 既存環境と同系統、ローカル起動容易 |
| DB | SQLite + Prisma | ローカル運用、スキーマ管理が楽 |
| 推論バックエンド | RunPod Serverless ComfyUI | NSFW制限なし・SDXL自由・低単価($0.0013〜/枚) |
| ベースモデル | Illustrious XL v1.0 / NoobAI XL(主)+ Pony V6(副) | アニメ系最強、Lora資産豊富、タグ精度◎ |
| Lora学習 | RunPod Serverless + kohya_ss | ツール内ボタン1つで完結 |
| 3Dポーズ | three.js → OpenPose画像 → ControlNet | リグ付き人体モデル使用 |
| 画像エディタ | Fabric.js | テキスト・吹き出し合成 |
| プロンプト最適化 | Claude API | 日本語入力からタグ整形 |
| 背景透過 | BRIA RMBG-2.0 / BiRefNet(ComfyUIノード) | αチャンネル付きPNG |
| モザイク除去 | YOLO検出 + Inpainting | 自動&手動マスク両対応 |

## 3. ベースモデル選定

- **Illustrious XL v1.0 / NoobAI XL** 第一候補:Danbooruタグネイティブ、NSFW品質◎、絵師タグ認識が強い
- **Pony Diffusion V6 XL** 第二候補:Lora資産最多、柔軟
- 両対応(ベースモデル切替UI実装、Lora互換性が分かれるため)

## 4. コスト試算

| 項目 | 単価 | 月間目安 |
|---|---|---|
| SDXL 1024x1024 生成(RTX 4090, 約4秒) | $0.0018/枚 | 月10万枚相当まで $200 |
| Lora学習(RunPod Pod 30分) | $0.35/キャラ | 10〜20キャラで $7 |
| Network Volume(100GB) | $7/月 | 固定 |
| Warm維持(任意) | $10〜20/月 | Cold Start対策 |
| **想定実費** | | **月$20〜50(¥3,000〜7,500)** |

予算3万円に対して大幅余裕あり。


## 5. 機能一覧

### 5.1 生成系
- 日本語テキスト→画像生成(t2i)
- 画像→画像編集(i2i)
- Inpainting(部位指定修正)
- ControlNet(ポーズ・構図適用)
- 差分出力(同条件で部分変更)
- アップスケール(Clarity Upscaler / 4x-Ultrasharp 等)
- 背景透過(αチャンネル付きPNG出力)
- モザイク除去(自動検出 + 手動マスク Inpainting ハイブリッド)

### 5.2 記憶・登録系
- **キャラクター記憶**(Lora学習 + プロフィール詳細)
- **絵柄記憶**(Lora学習 / Civitai取り込み / タグ指定)
- **身体パーツ記憶**(顔・髪・目・唇等。テキスト+画像で固定。種別追加可)
- **服装・髪型プリセット**(ボタン切替・追加可)
- **行為プリセット**(SFW/NSFW、ボタン切替・追加可)
- **場所(Location)保存**(背景画像・タグ・参照3モード)
- **ポーズ保存**(3Dエディタで作成・キャラ別保存)
- **お気に入り組合せ保存**(6W1Hの組合せ)
- **プロンプトテンプレート**

### 5.3 補助
- プロンプト最適化(Claude API)
- 履歴・ギャラリー(検索・再生成・ダウンロード)
- 画像エディタ(テキスト・吹き出し・効果音アセット合成)
- アセットライブラリ(吹き出し・効果音画像)

## 6. メイン UI(6W1H + 絵柄)

タイピング最小化が原則。ボタン選択で 8 割の生成が完結。

```
┌─────────────────────────────────────────────────────┐
│ 🎨 絵柄: [wlop風 × 自作アニメ調] [変更▼]           │
├─────────────────────────────────────────────────────┤
│ 🕐 いつ        👤 誰が          👥 誰と             │
│ [夕方 ▼]       [花子 ▼]         [+太郎 +ジロー]     │
│                                                      │
│ 📍 どこで      👗 格好          📷 アングル         │
│ [教室 ▼]       [制服]           [女性視点]          │
│                                                      │
│ 💫 何をしてる                                        │
│ [SFW][NSFW] [キス][正常位][騎乗位]...                │
│ ⚪ゴムあり 🔘ゴムなし 🔘指定なし                     │
│                                                      │
│ ☐ 背景透過  ☐ 自動アップスケール                    │
│                                                      │
│ [▶ 詳細プロンプトを見る] [⭐ 組合せ保存]             │
│                                                      │
│         [🎨 生成する]  [🔀 この条件で差分]           │
└─────────────────────────────────────────────────────┘
```

### 6.1 アングルプリセット(デフォルト)

| 表示 | タグ |
|---|---|
| 女性視点 | `pov, female pov` |
| 男性視点 | `pov, male pov` |
| 第三者視点 | `third person view` |
| 天井から | `from above, overhead shot` |
| 前から | `from front` |
| 横から | `from side, profile view` |
| 後ろから | `from behind` |
| 下から | `from below, low angle` |
| 全身 | `full body` |
| 上半身 | `upper body, cowboy shot` |
| 下半身 | `lower body` |
| 顔ドアップ | `close-up, face focus, portrait` |

### 6.2 NSFW行為プリセット(デフォルト)

| 表示 | タグ |
|---|---|
| キス | `kissing, french kiss` |
| ハグ | `hugging, embrace` |
| 手コキ | `handjob` |
| 手マン | `fingering, pussy juice` |
| フェラ | `fellatio, oral` |
| クンニ | `cunnilingus, oral` |
| 正常位 | `missionary` |
| バック | `doggystyle, from behind` |
| 立ちバック | `standing sex, from behind` |
| 種付けプレス | `mating press` |
| 騎乗位 | `cowgirl position, girl on top` |
| 駅弁 | `carry fuck, suspended congress` |
| 対面座位 | `sitting sex, face-to-face` |
| キスハメ | `kissing, sex, french kiss` |
| シックスナイン | `69, sixtynine` |
| 事後 | `after sex, afterglow, cum` |

### 6.3 ゴムトグル

| 状態 | プロンプト | ネガティブ |
|---|---|---|
| ゴムあり | `condom, wearing condom` | — |
| ゴムなし | `bareback, no condom` | `condom` |
| 指定なし | (何も足さない・デフォルト) | — |

## 7. キャラプロフィール

### 7.1 共通項目
- name(名前)
- gender(女性 / 男性 / その他)
- heightCm(身長:手入力 cm)
- loraUrl, loraScale, triggerWord
- referenceImages[]

### 7.2 女性プロフィール
- **顔**(プリセット + 画像参照 + タグ)
- **髪型**
- **デフォルト服装**(生成時上書き可)
- **胸と乳輪**(サイズ・形・乳輪・乳首)
- **女性器**(形状・小陰唇・色・状態)
- **陰毛**(あり/なし、量、形)

### 7.3 男性プロフィール
- 顔
- 髪型
- デフォルト服装(任意)
- **男性器**(サイズ・状態・形・皮)

### 7.4 身長 → タグ自動変換

| 身長 | 自動付与タグ |
|---|---|
| 〜145cm | `petite, very short` |
| 146〜155cm | `short, shortstack` |
| 156〜165cm | `average height` |
| 166〜172cm | `tall` |
| 173cm〜 | `very tall, tall female/male` |

複数キャラ登場時は **height difference** タグを自動計算。
タグマッピングは設定画面で編集可能。

⚠ **150cm未満は警告ダイアログ**(成人キャラ確認)

### 7.5 露出タグ制御ロジック
- 服装が「全裸/半裸」 → 体の詳細タグを自動付与
- 服装が「制服」等 → 体の詳細タグは付与しない(服優先)
- 上級設定:常に体タグを含めるトグル

## 8. 絵柄機能

### 8.1 3つの指定方法

| 方法 | 特徴 | 精度 |
|---|---|---|
| A. 絵師タグ直打ち | Illustrious/NoobAIは Danbooru絵師名を認識 | ○〜◎ |
| B. スタイルLora | Civitai取得 / 自作 / アップロード | ◎ |
| C. 参照画像(IP-Adapter) | 1枚から雰囲気転送 | △〜○ |

### 8.2 Civitai連携
- Civitai API キー登録(ツール内)
- 検索・サムネ表示・ワンクリックでローカルDL → RunPod Network Volume へ同期
- ベースモデルでフィルタ(Illustrious / Pony / SDXL)
- NSFWコンテンツ含むフィルタ切替

### 8.3 絵柄ブレンド
複数絵柄を強度指定で重ね掛け、組合せ保存可能。

```
[絵柄A: wlop風]        強度 [0.7]
[絵柄B: kuvshinov風]   強度 [0.4]
[絵柄C: 自作アニメ調]  強度 [0.9]
```

### 8.4 メタデータ自動埋め込み
生成画像に使用 Lora 名・絵柄を自動埋め込み(後追跡用・自衛)。

## 9. 少素材からのキャラ登録(差分ブースト)

```
Step 1: 素材アップ(1〜3枚でもOK)
   ↓
Step 2: 自動で多様な差分を生成(20〜40枚)
   ├─ IP-Adapter Plus Face(顔特徴保持)
   ├─ ControlNet Pose(ポーズ固定)
   └─ プロンプト自動組み合わせ:
       ├─ アングル(正面/横/背後/俯瞰/煽り)
       ├─ 表情(無表情/笑顔/怒り/泣き/驚き/恥じらい)
       ├─ ポーズ(立ち絵/座り/歩く/振り向き)
       ├─ 服装(元/私服/水着/下着 オプション)
       └─ 光源(順光/逆光/夕日/室内光)
   ↓
Step 3: 生成画像をグリッド表示 → ユーザーがチェックで取捨選択
   ↓
Step 4: 選ばれた画像 + 元画像 をセットで Lora 学習 → キャラ登録完了
```

## 10. モザイク除去

| 方法 | 精度 | 速度 | 用途 |
|---|---|---|---|
| A. 自動検出(YOLOv8) + Inpainting | ○ | 速い | 通常運用 |
| B. 手動マスク + Inpainting | ◎ | 普通 | 細かく調整 |
| C. 専用モデル(DeepMosaics系) | △〜○ | 遅い | 補助 |

**A + B ハイブリッド** を採用。自動が不満なら手動マスクで再実行。
ツール内に法的注意書き表示。

## 11. アーキテクチャ

```
Next.js App Router(自分専用・ローカル起動)
├─ API Routes
│   ├─ /api/generate/t2i              → RunPod Serverless ComfyUI
│   ├─ /api/generate/i2i              → 同上
│   ├─ /api/generate/inpaint          → 同上(部位修正・差分)
│   ├─ /api/generate/controlnet       → 同上(ポーズ適用)
│   ├─ /api/upscale                   → Clarity / 4x-Ultrasharp
│   ├─ /api/bg-remove                 → RMBG-2.0 ワークフロー
│   ├─ /api/mosaic-remove             → 検出 + Inpainting
│   ├─ /api/character/boost           → 差分ブースト
│   ├─ /api/lora/train                → kohya_ss(Serverless)
│   ├─ /api/lora/status               → ジョブ状態取得
│   ├─ /api/civitai/import            → Civitai DL & 同期
│   └─ /api/optimize-prompt           → Claude API
│
├─ RunPod Serverless Endpoints
│   ├─ ComfyUI 推論(t2i/i2i/inpaint/controlnet/rmbg/mosaic-remove)
│   ├─ kohya_ss 学習
│   └─ IP-Adapter 差分生成
│
├─ Network Volume(RunPod)
│   ├─ checkpoints/(Illustrious / Pony / NoobAI)
│   ├─ loras/characters/
│   ├─ loras/styles/
│   ├─ controlnet/
│   ├─ ip-adapter/
│   └─ vae/
│
├─ DB: SQLite + Prisma(./prisma/dev.db)
├─ ローカル保存: ./storage/images/, ./storage/training_data/
├─ 3D ポーズ: three.js + リグ付き .glb
├─ 画像エディタ: Fabric.js
└─ ドキュメント: ./docs/
```

## 12. データモデル(Prisma 主要)

```prisma
model Character {
  id              String   @id @default(cuid())
  name            String
  gender          Gender
  heightCm        Int
  loraUrl         String?
  loraScale       Float    @default(1.0)
  triggerWord     String?
  trainingStatus  String   @default("none") // none/training/ready/failed
  trainingJobId   String?
  referenceImages ReferenceImage[]
  // プロフィール参照
  faceId          String?
  hairstyleId     String?
  defaultOutfitId String?
  breastsId       String?
  fGenitalsId     String?
  mGenitalsId     String?
  pubicHair       Boolean  @default(true)
  pubicHairStyle  String?
  createdAt       DateTime @default(now())
}

enum Gender { FEMALE MALE OTHER }

model BodyPart {
  id          String  @id @default(cuid())
  typeId      String  // BodyPartType FK
  name        String
  tags        String  // カンマ区切り
  imageUrl    String?
  description String?
}

model BodyPartType {
  id        String @id @default(cuid())
  name      String // "顔" "髪型" "胸" "女性器" 等
  isBuiltin Boolean @default(false)
}

model ArtStyle {
  id             String   @id @default(cuid())
  name           String
  source         StyleSource
  loraUrl        String?
  loraScale      Float    @default(0.8)
  triggerWords   String?
  styleTags      String?
  civitaiId      Int?
  civitaiModelId Int?
  baseModel      String   // illustrious / pony / sdxl
  thumbnails     String[]
  memo           String?
  tags           String[]
}

enum StyleSource { CIVITAI UPLOADED TRAINED TAG_ONLY }

model ClothingPreset { id String @id @default(cuid()) name String tags String thumbnail String? category String? }
model HairstylePreset { id String @id @default(cuid()) name String tags String thumbnail String? }
model ViewAnglePreset { id String @id @default(cuid()) name String tags String thumbnail String? category String? isDefault Boolean @default(false) }
model ActionPreset {
  id        String  @id @default(cuid())
  name      String
  tags      String
  thumbnail String?
  isNSFW    Boolean @default(false)
  category  String?
  defaultCondomState String? // with / without / none
}
model TimePreset { id String @id @default(cuid()) name String tags String }

model Location {
  id             String  @id @default(cuid())
  name           String
  prompt         String
  referenceImage String?
  category       String?
  tags           String[]
}

model Pose {
  id           String  @id @default(cuid())
  characterId  String?
  name         String
  poseDataJson String  // three.js リグ姿勢
  previewImage String?
}

model PromptTemplate { id String @id @default(cuid()) name String body String tags String[] }
model Asset { id String @id @default(cuid()) kind String name String filePath String } // 吹き出し・効果音

model FavoriteCombination {
  id        String  @id @default(cuid())
  name      String
  payload   String  // 6W1H + 絵柄 のスナップショット JSON
  createdAt DateTime @default(now())
}

model Generation {
  id              String  @id @default(cuid())
  parentId        String? // 差分元
  inputJson       String  // 全入力(prompt/seed/loras/strength 等)
  outputImagePath String
  thumbnailPath   String?
  modelName       String
  seed            BigInt?
  createdAt       DateTime @default(now())
}

model ReferenceImage { id String @id @default(cuid()) characterId String filePath String }
```

## 13. プロンプト組み立て順序(内部)

```
1. 絵柄 Lora トリガー
2. キャラ Lora トリガー + triggerWord(複数キャラなら全員)
3. 身長タグ(自動変換)+ 複数キャラ間の身長差
4. 顔タグ
5. 髪型タグ
6. 胸・乳輪タグ(露出時のみ or 常時:設定)
7. 女性器/男性器タグ(露出時のみ)
8. 陰毛タグ
9. アングルタグ
10. 時間・季節タグ
11. 場所タグ or 参照画像
12. 服装タグ(全裸/半裸なら優先)
13. 行為タグ
14. ゴム状態タグ
15. 品質タグ: masterpiece, best quality, ultra detailed
```

ネガティブ:`low quality, worst quality, bad anatomy`(+ ゴムなし時 `condom`)

## 14. 画面構成

1. **生成画面(メイン)** — 6W1H + 絵柄 + プレビュー + 履歴
2. **キャラ管理** — 登録、プロフィール、参照画像、Lora 学習
3. **絵柄管理** — Civitai取り込み、自作Lora、タグ指定
4. **パーツ管理** — 種別追加含む
5. **服装・髪型プリセット管理**
6. **行為プリセット管理**(SFW/NSFW タブ)
7. **アングルプリセット管理**
8. **場所ライブラリ**(背景画像、参照3モード)
9. **ポーズエディタ**(3D)
10. **画像エディタ**(テキスト・吹き出し合成、アセット呼出)
11. **差分モード**(元画像選択→変更項目チェック)
12. **ギャラリー / 履歴**(検索・再生成・DL)
13. **アセット管理**(吹き出し・効果音)
14. **設定**(APIキー、保存先、使用モデル、タグマッピング編集)

## 15. 初心者向け設計方針

- デフォルト値を常に用意(無設定で動く)
- 各画面に **?ヘルプ** ポップアップ
- 初回起動ツアー
- 専門用語を避ける or 並記
  - ❌「LoRA weight」 → ⭕「キャラ再現度(0〜2、推奨1.0)」
- エラーは日本語で原因+対処を表示
- 重要操作(学習開始・削除)は確認ダイアログ
- 「推奨」「詳細」タブで上級設定を分離
- ツールチップを全ボタンに

### ドキュメント配置

- `./docs/setup.md` — 初回セットアップ(RunPod・APIキー)
- `./docs/character-training.md` — キャラ登録・学習
- `./docs/prompt-basics.md` — プロンプト仕組み
- `./docs/troubleshooting.md` — エラー対処

## 16. フェーズ計画

| Phase | 内容 | 期間目安 |
|---|---|---|
| **Phase 1(MVP)** | 環境構築 / 基本t2i・i2i / キャラ登録(差分ブースト含む) / Lora学習 / 6W1H + 絵柄 ボタン UI / 履歴 / 場所保存 | 2〜3週 |
| **Phase 2** | Inpainting / ControlNet(ポーズ) / 背景透過 / モザイク除去 / 服装・髪型・行為プリセット完成 / 差分モード | 1〜2週 |
| **Phase 3** | 3D ポーズエディタ / 画像エディタ(テキスト) / アップスケール / プロンプト最適化 / お気に入り組合せ | 2週 |
| **Phase 4** | UX 磨き込み / ヘルプ充実 / アセット拡充 / Civitai連携深掘り | 継続 |

## 17. セキュリティ・自衛

- APIキー類は `.env.local`(gitignore 済み)
- 生成画像メタデータに使用 Lora 名・絵柄を埋め込み(後追跡)
- 完全個人利用前提、SNS公開・販売は想定外
- モザイク除去には法的注意書きをツール内表示

## 18. 未確定事項 / 後で詰める

- ComfyUI Serverless の Docker イメージ選定(blib-la/runpod-worker-comfy 系 or 自作)
- Network Volume サイズ確定(初期 100GB 想定)
- Cold Start 対策の Warm 設定値
- kohya_ss Serverless 化の具体構成(自前 Docker 化が必要)
- 3D リグ付きモデル素材の入手元
