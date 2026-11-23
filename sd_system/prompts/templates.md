# すぐ使えるプロンプト集（WAI-illustrious 基準）

使い方: ポジティブ/ネガティブをそのまま ComfyUI の ②/③ ノードに貼り、サイズ・Steps・CFG を合わせる。
`{ }` の部分は好みで差し替え。すべて **成人女性** 前提。実在人物は使わない。

共通ネガティブ（全テンプレ共通。以下「共通NEG」と表記）:
```
bad quality, worst quality, worst detail, sketch, censor, lowres, bad anatomy, bad hands, extra digits, missing fingers, text, signature, watermark, loli, shota, child
```

---

## T1. 健全・SNSアイコン向け（レーティング general）
```
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, general,
1girl, solo, mature female, {long black hair}, {brown eyes}, gentle smile, looking at viewer,
{white blouse}, upper body, simple background, soft lighting, depth of field
```
NEG: 共通NEG + `nsfw, cleavage`
サイズ 832×1216 / Steps 28 / CFG 5.5

## T2. 際どい・グラビア風（sensitive）
```
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, sensitive,
1girl, solo, mature female, curvy, {blonde hair, wavy hair}, {blue eyes}, seductive smile, blush, looking at viewer,
{black lingerie, garter straps, thighhighs}, cleavage, sitting on bed, leaning forward,
bedroom, dim lighting, window light, cowboy shot
```
NEG: 共通NEG
サイズ 832×1216 / Steps 28 / CFG 5.5

## T3. ヌード・一人（nsfw）
```
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, nsfw, uncensored,
1girl, solo, mature female, {medium breasts}, nipples, {brown hair, ponytail}, {green eyes},
completely nude, embarrassed, blush, covering breasts, looking at viewer,
sitting, bathroom, steam, wet, soft lighting, cowboy shot
```
NEG: 共通NEG + `censored, mosaic censoring, bar censor, clothes`
サイズ 832×1216 / Steps 28 / CFG 5.5

## T4. 性行為・男女（explicit / 正常位・主観）
```
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, explicit, uncensored,
1girl, 1boy, hetero, mature female, {large breasts}, {silver hair, long hair}, {red eyes},
completely nude, sex, vaginal, missionary, spread legs, pov, faceless male,
heavy breathing, half-closed eyes, open mouth, blush, sweat, looking at viewer,
on bed, white sheets, bedroom, dim lighting, from above
```
NEG: 共通NEG + `censored, mosaic censoring, bar censor, multiple boys, 2girls`
サイズ 1216×832（横）/ Steps 30 / CFG 5.5

## T5. 性行為・後背位（explicit）
```
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, explicit, uncensored,
1girl, 1boy, hetero, mature female, curvy, wide hips, {black hair, short hair},
sex from behind, doggystyle, all fours, bent over, looking back, ass focus,
torogao, tongue out, drooling, sweat, trembling, motion lines,
faceless male, dark-skinned male, hotel room, neon lights, from behind, dutch angle
```
NEG: 共通NEG + `censored, mosaic censoring, bar censor`
サイズ 1216×832 / Steps 30 / CFG 5.5

## T6. 事後（after sex）
```
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, explicit, uncensored,
1girl, solo, mature female, {medium breasts}, {pink hair, messy hair}, half-closed eyes, satisfied expression, blush,
completely nude, lying, on back, spread legs, after sex, after vaginal, cum, cumdrip, sweat, steam,
rumpled sheets, bedroom, morning, sunlight, window light, from above
```
NEG: 共通NEG + `censored, mosaic censoring, bar censor, 1boy, male`
サイズ 1216×832 / Steps 28 / CFG 5.5

## T7. 百合（2girls / yuri）
```
masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, nsfw, uncensored,
2girls, yuri, mature female, {blonde hair} and {black hair}, completely nude, breasts, nipples,
hug, kiss, french kiss, breast press, symmetrical docking, blush, closed eyes,
on bed, bedroom, soft lighting, cowboy shot, from side
```
NEG: 共通NEG + `censored, 1boy, male, 3girls`
サイズ 1024×1024 / Steps 30 / CFG 5.5

## T8. コスチューム系（オフィス/制服/メイド）
差し替え用パーツ。T2〜T6 の服装部分に入れる。
- OL: `office lady, pencil skirt, white shirt, black pantyhose, glasses, open shirt, skirt lift`
- メイド: `maid, maid headdress, maid apron, naked apron, thighhighs, frills`
- 巫女: `miko, hakama, wide sleeves, clothes lift`
- ナース: `nurse, nurse cap, white dress, see-through`
- 競泳水着: `competition swimsuit, one-piece swimsuit, wet, swimsuit pull, highleg`
- バニー: `playboy bunny, rabbit ears, fishnet pantyhose, fake tail, wrist cuffs`
- 和装: `kimono, obi, off shoulder, kimono pull, bare shoulders`

## T9. 塗り・画風の差し替え
- 今風アニメ塗り: `newest, anime screencap, cel shading, thick outlines`
- 厚塗り・イラスト調: `newest, painterly, detailed, soft shading, volumetric lighting`
- セミリアル: `semi-realistic, realistic skin texture, detailed eyes, film grain`
- 90年代: `1990s \(style\), retro artstyle, old` （ネガティブから `old` を外す）

---

## 作業手順の型（効率が良い順）

1. **T1〜T7 のどれかをコピー** → `randomize` で 4〜8 枚出して構図を選ぶ
2. 良い構図の Seed を控え、`fixed` に変更
3. 髪・服・表情・ライティングを 1 要素ずつ変えて詰める
4. 決まったら `02_hires_fix` に同じプロンプトと Seed を入れて高画質版を出す
5. 公開するならモザイク加工 → `logs/` にプロンプトと Seed を記録
