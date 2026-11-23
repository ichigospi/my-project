# Illustrious系モデル プロンプト指南（WAI-illustrious / Illustrious XL / NoobAI-XL）

Illustrious系は **Danbooruタグ**（英語の短いタグをカンマ区切り）で学習されている。
自然文（「a beautiful woman standing in...」）より、タグの羅列のほうが圧倒的に素直に効く。

---

## 0. 絶対ルール（生成前に必ず確認）

| ルール | 理由 |
|---|---|
| **登場人物は成人のみ**。ポジティブに `mature female` / `adult` 等を入れ、ネガティブに `loli, shota, child, kid, toddler, aged down` を常に入れる | アニメ絵は年齢が曖昧に出やすい。未成年に見える性的画像は日本法でも違法・即アウト |
| **実在人物の名前・顔は使わない** | ディープフェイク/肖像権。芸能人・VTuberの中の人・知人など全て不可 |
| **公開・販売するなら性器にモザイク必須** | 日本では無修正の陳列・頒布は刑法175条（わいせつ物）に該当。個人で見るだけなら問題なし |
| 第三者の著作キャラで**商用**は避ける | キャラ名タグは強力だが、二次創作ガイドライン・商標の問題がある |
| プラットフォームの規約を確認（X / FANZA / Fantia / Pixiv 等で可否が違う） | アカウント停止リスク |

---

## 1. プロンプトの基本構造（この順番で並べる）

```
[品質タグ] , [人数・性別] , [キャラ/作品名] , [絵師タグ(任意)] ,
[年齢・体型] , [髪・目・顔] , [服装・露出状態] , [ポーズ・行為] ,
[表情] , [背景・場所] , [ライティング・画風] , [構図・カメラ]
```

前にあるタグほど強く効く。**一番大事なものを前へ**。

### 品質タグ（先頭に固定）

| モデル | ポジティブ先頭 | ネガティブ |
|---|---|---|
| **WAI-illustrious**（推奨） | `masterpiece, best quality, amazing quality, very aesthetic, absurdres` | `bad quality, worst quality, worst detail, sketch, censor` |
| Illustrious XL 公式 | `masterpiece, best quality, very aesthetic, absurdres` | `lowres, bad quality, worst quality, bad anatomy, sketch, jpeg artifacts, signature, watermark, old, oldest` |
| NoobAI-XL | `masterpiece, best quality, newest, absurdres, highres` | `worst quality, old, early, low quality, lowres, signature, username, logo, bad hands, mutated hands, mammal, anthro, furry` |

全モデル共通で付け足すネガティブ:
`lowres, bad anatomy, bad hands, extra digits, missing fingers, text, signature, watermark, loli, shota, child`

### 年代タグ（絵柄が変わる）
`newest`（2021〜、今風の塗り） / `recent` / `mid` / `early` / `old`（2000年代の絵柄）
今風にしたいなら `newest` をポジティブ、`old, early` をネガティブ。

### レーティングタグ（NSFW度の指定）
`general`（健全） → `sensitive`（際どい） → `nsfw` → `explicit`（性行為・性器描写）
NSFWを出すときはポジティブに `nsfw` または `explicit` を入れる。健全絵を出すときはネガティブに `nsfw` を入れる。

---

## 2. タグ辞典（よく使うもの）

### 人数・性別
`1girl, solo` / `1boy, 1girl, hetero` / `2girls, yuri` / `multiple girls` / `faceless male`（男を描き込まず女性に集中）/ `dark-skinned male` / `pov`（主観視点）

### 年齢・体型（成人指定）
`mature female, adult, 25 years old` / `curvy, wide hips, thick thighs` / `slender` / `muscular female` / `tall female` / `office lady` / `milf`

### 髪
`long hair, short hair, medium hair, twintails, ponytail, braid, bob cut, wavy hair, messy hair, wet hair, hair over one eye`
色: `black hair, brown hair, blonde hair, silver hair, pink hair, blue hair`

### 目・顔
`blue eyes, red eyes, heterochromia, half-closed eyes, glowing eyes` / `mole under eye, freckles, glasses, eyelashes, parted lips, tongue out`

### 表情
`smile, seductive smile, naughty face, blush, embarrassed, heavy breathing, open mouth, moaning, ahegao, torogao, closed eyes, looking back, looking at viewer, eye contact`

### 服装・露出（段階的）
- 着衣: `school uniform, office lady, maid, nurse, bikini, kimono, yukata, dress, sweater, turtleneck, pantyhose, thighhighs, garter straps, high heels`
- 際どい: `cleavage, sideboob, underboob, see-through, wet clothes, lingerie, bra, panties, open shirt, unbuttoned, skirt lift, panty pull, no bra, nipples visible through clothes`
- 脱衣: `topless, bottomless, nude, completely nude, naked shirt, naked apron, clothes down, undressing`

### 体の部位（NSFW）
`breasts, large breasts, medium breasts, small breasts, huge breasts, nipples, puffy nipples, ass, pussy, spread pussy, anus, thighs, navel, armpits, collarbone, sweat, wet`

### ポーズ・行為（NSFW）
- ポーズ: `lying, on back, on side, on stomach, spread legs, m legs, legs up, all fours, bent over, squatting, arched back, arms up, hands on own chest, presenting`
- 自慰: `masturbation, female masturbation, fingering, sex toy, dildo, vibrator`
- 性行為: `sex, vaginal, anal, missionary, doggystyle, cowgirl position, reverse cowgirl position, spooning, standing sex, sex from behind, mating press, suspended congress`
- 口: `fellatio, deepthroat, irrumatio, licking penis, cum in mouth`
- その他: `paizuri, handjob, footjob, thigh sex, grinding`
- 射精: `cum, cum on body, cum on breasts, cum on face, cumdrip, facial, creampie, cum in pussy, ejaculation, bukkake, excessive cum`
- 状態: `after sex, after vaginal, used condom, trembling, orgasm, female ejaculation, saliva, drooling, sweat, steam, motion lines`

### モザイク制御
- 無修正にする: ポジティブ `uncensored`、ネガティブ `censored, mosaic censoring, bar censor`
- 公開用にモザイクを掛ける: ポジティブ `mosaic censoring` （画像編集ソフトで後掛けのほうが確実）

### 背景・場所
`bedroom, on bed, white sheets, hotel room, love hotel, bathroom, bathtub, shower, onsen, beach, classroom, office, kitchen, train interior, car interior, outdoors, night, city lights`
背景を捨てて人物集中: `simple background, white background, grey background`

### ライティング・画風
`soft lighting, cinematic lighting, dramatic lighting, backlighting, rim lighting, sunlight, window light, dim lighting, candlelight, neon lights, volumetric lighting`
`anime screencap, flat color, watercolor, sketch, oil painting, realistic, semi-realistic, cel shading, detailed background, depth of field, film grain, chromatic aberration`

### 構図・カメラ
`portrait, upper body, cowboy shot（腰上）, full body, close-up, face focus, breast focus, ass focus, from above, from below, from behind, from side, dutch angle, wide shot, dynamic angle, foreshortening, fisheye`

---

## 3. 強調と重み付け（ComfyUI記法）

- `(tag:1.2)` で1.2倍、`(tag:0.8)` で弱める。**1.3を超えると崩れやすい**
- 複数強調は2〜3個まで。全部強調すると意味がない
- ネガティブは短めでも効く。ネガティブを盛りすぎると色が濁る

---

## 4. 生成パラメータ（ComfyUI）

| 項目 | WAI-illustrious | Illustrious XL 公式 | NoobAI-XL |
|---|---|---|---|
| Sampler | `euler_ancestral`（Euler a） | `euler_ancestral` | `euler_ancestral` |
| Scheduler | `normal` | `normal` | `normal` |
| Steps | 25〜30 | 25〜30 | 25〜30 |
| CFG | 5〜7（5.5が無難） | 5〜7 | 5〜6 |
| サイズ | 832×1216（縦）/ 1216×832（横）/ 1024×1024 | 同左。v2.0は1536まで可 | 同左 |
| Denoise | 1.0（txt2img） | 1.0 | 1.0 |

### Hires fix（高画質化）
1回目: 832×1216 → 1.5倍に拡大 → 2回目: Steps 20・**Denoise 0.4〜0.5**。
0.6以上にすると顔や構図が変わる。`02_hires_fix` ワークフローがこの設定。

### Seed の使い方
- `randomize`: 毎回違う絵。構図探しの段階
- `fixed`: 同じ構図のままプロンプトを微調整する段階。良い絵が出たら Seed をメモ

---

## 5. よくある崩れと対処

| 症状 | 対処 |
|---|---|
| 手・指が崩れる | Hires fix を使う。ネガティブに `bad hands, extra digits, missing fingers`。手が目立たない構図（`hands behind back`, `arms up`）に逃げる |
| 人数が増える・混ざる | `1girl, solo` を品質タグ直後に。ネガティブに `multiple girls, 2girls`。男を消したいなら `faceless male` か `pov` |
| 顔が幼く見える | `mature female, adult` をポジティブに。`(loli:1.3), child, flat chest` 等をネガティブに。`large breasts, wide hips, tall` で大人体型を補強 |
| 全体が白っぽい・霧がかかる | CFG を下げる（4〜5.5）。モデル違い（v-pred版モデルは専用設定が必要。models.txt の通常版を使う） |
| 色が濃すぎ・焼ける | CFG を下げる。Steps を減らす |
| モザイクが勝手に掛かる | ネガティブに `censored, mosaic censoring, bar censor`、ポジティブに `uncensored` |
| 服が脱げない | `nude` に加えて `completely nude, no clothes`、ネガティブに `clothes, clothed, shirt, bra, panties` |
| 文字・サインが出る | ネガティブに `text, signature, watermark, username, logo, artist name` |
| 背景がうるさい | `simple background` または `depth of field, blurry background` |
| 画風が古い | ポジティブ `newest`、ネガティブ `old, early, oldest` |

---

## 6. キャラクター・絵師タグ

- **キャラ**: `hatsune miku` のように Danbooru の正式タグ名（スペース区切り、小文字）。作品名も添える: `hatsune miku, vocaloid`
- **絵師**: `by xxx` ではなく絵師名タグそのまま。Illustrious系は絵師タグが非常に強く効く。複数混ぜて画風を作るのが定石（例: 2〜3名を `(artist_a:0.8), (artist_b:0.6)` で混ぜる）。公開作品に実在絵師名を使うのは倫理・炎上リスクあり。画風タグ（`flat color, anime screencap, thick outlines` 等）で寄せる手もある
- タグが分からないとき: Danbooru でそのキャラ/絵師のページを開き、タグ名をそのまま使う（アンダースコアはスペースに置き換え）

---

## 7. LoRA の使い方

1. Civitai で `Illustrious` または `NoobAI` ベースの LoRA を探す（Pony / SD1.5 用は動かない）
2. `~/ComfyUI/models/loras/` に入れる
3. `03_lora` ワークフローで LoRA を選び、強度 0.6〜1.0（まず 0.8）
4. LoRAページの「Trigger Words」をプロンプトに入れる
5. 複数LoRAは LoraLoader ノードを数珠つなぎに（強度は合計1.5以下を目安）
