import { NextRequest, NextResponse } from "next/server";
import { resolveAiModel, anthropicHeaders, anthropicExtraBody } from "@/lib/ai-model";

// 8観点+比較マトリクスの生成は出力が大きく時間がかかるため、関数のタイムアウトを延長
export const maxDuration = 300;

interface RefAnalysis {
  videoTitle?: string;
  views?: number;
  analysisResult?: unknown;
  transcript?: string;
}

interface ChannelProfile {
  channelName?: string;
  concept?: string;
  commonRules?: string;
  ngExpressions?: string;
}

interface ScriptRulePreset {
  name?: string;
  rules?: string;
  hookPattern?: string;
  ctaPattern?: string;
  targetWordCount?: number;
}

interface WinningPatterns {
  bestHookPattern?: string;
  bestStructure?: string;
  bestDuration?: string;
  avoidPatterns?: string[];
}

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTubeチャンネルの台本を、現役のプロのマーケター視点で評価する専門家です。
最終ゴールは「視聴離脱を最大限防止し、LINE無料鑑定への登録(リストイン)に確実に繋げる台本」かどうかを判定すること。
与えられた台本を以下の8観点で厳しく評価し、必ず指定されたJSON形式のみで回答してください。
JSON以外のテキスト（説明文、マークダウン、コードブロック記法）は一切出力しないでください。

【評価観点 / 8カテゴリ】

A. 元ネタでハマっていた伸び要素の継承
   元ネタ動画(再生数を伸ばした参考動画)で機能していた以下の要素が、台本にちゃんと組み込まれているかをチェックする。
   - ファン化要素(視聴者との一体感、リーダーへの信頼、繰り返し見たくなる構造)
   - 競合排除(「ここだけ」「この人だけ」「他で似た話する人もいるけど」型の囲い込み)
   - 離脱防止仕掛け(「ここから本番」「最後に重要な話」「もう少しだけ」などのオープンループ・予告)
   - 理想の未来と最悪の未来のギャップ(獲得しないと失うものvs獲得すると得られる未来の落差)
   - 信頼獲得(具体性のある体験談・権威性提示・断言の自信表明)
   - 選民訴求(「あなただけ」「呼ばれた」「偶然じゃない」)
   元ネタにあった主要な伸び要素が抜けていれば fail、薄ければ warn。完全にカバーで pass。
   ※フレーズ単位のパクリは禁止(構造を引き継ぐのはOK、語句のコピーは不可)。
   流用が1つあれば warn、複数あれば fail。

B. 台本ルール外のオリジナル構成パートの混入
   チャンネル共通ルール・カテゴリ別プリセットで定義されていない構成パートが、長尺で台本に追加されていないか。
   AIが勝手に追加した余計な解説・前置き・冗長な感想パートは、視聴離脱の最大要因。
   - 200字以上の独立した未定義パートが1つでもあれば warn
   - 複数あれば fail
   - 必要な短い接続文(50〜100字程度)は許容

C. 文字数(5000字以内)
   本文(マークダウン記法等を除く純粋テキスト)の文字数が 5000字以内に収まっているか。
   - 5000字以内: pass
   - 5001〜5500字: warn(目標やや超過)
   - 5500字超: fail(離脱率上昇の致命傷)
   コメントに実測の文字数を必ず含める。

D. CTAロジックの自然な連結
   高評価/コメント/チャンネル登録/守護画像/LINE鑑定 等のCTAが、ロジックとして自然に繋がっているか。
   - 各CTAの「解決する課題」が別物になっているか(被ったら fail)
   - 前のCTAで「解決した」と言った課題を、後のCTAで「未解決」として再利用していたら重大NG(fail)
   - 同じCTA(特にチャンネル登録)を複数回要求していないか(くどい重複は warn〜fail)
   - 「損失提示→アクション提示→達成される結果」が1セットで繋がっているか(損失だけ/アクションだけは warn)
   - 体験談の「」内が本人の一人称セリフで統一されているか(又聞き口調の混在は fail)

E. LINE無料鑑定CTAの強度(「今じゃないとダメな理由」+「受けた人と受けなかった人の格差」)
   LINE無料鑑定への誘導CTAが、ターゲットに刺さる強度を持っているか厳しくチェック。
   - 「今じゃないとダメな理由」が明確か
     (期間限定/枠限定/エネルギーが強い今だけ/お呼びがある今だけ 等の緊急性)
     → ない or 曖昧なら fail
   - 「受けた人と受けなかった人との格差」が具体的に描写されているか
     (受けた人の具体的な成果 vs 受けなかった人が取り残される未来。
      「天と地ほどの差」等の抽象表現だけでなく、具体的金額・時期・状態の対比)
     → 抽象的だけなら warn、欠落なら fail
   - ターゲット(チャンネルの想定視聴者)の心に刺さる言葉選びになっているか
     (例: 金運チャンネルなら「お金で苦しんできた経験」を踏まえた言葉、恋愛系なら孤独感に寄り添う言葉)
     → ジェネリックな煽りだけだと warn

F. 同じ内容の文・パートの重複
   同じ意味の文・近似する内容のパートが複数回現れていないか。
   - 全く同じ表現の重複: fail
   - 言い回しを変えただけの同内容パート: warn
   - 強調目的の意図的繰り返し(アファメーション部等)は許容
   重複している箇所をすべて引用してコメントに記載すること。

G. 内容の矛盾
   台本内の主張・前提・約束に矛盾がないか。
   - パート間で主張が食い違っていないか
     (例:「高評価が受け取るサイン」と「コメントが受け取るサイン」が同一台本内に並存)
   - 時系列・登場人物・体験談の数字に矛盾はないか
   - 因果関係が壊れていないか(「A→B」と言いつつ後で「A→Bにならない」と言う等)
   発見したら fail。

H. プロのマーケター視点での総合評価(離脱防止 × リストイン)
   現役のプロマーケターとして、この台本を読み上げたら視聴者は最後まで離脱せずにリストイン(LINE登録)するか。
   - 冒頭15秒のフックの強度(初期離脱の主因)
   - 中盤(50%地点)の離脱対策(オープンループの仕込み・パターン破壊)
   - クライマックスの確信度
   - LINE登録への動機の自然さと強さ
   - 全体として「これは登録するしかない」と思わせる流れになっているか
   pass: 強い離脱防止 + 確度の高いリストイン期待
   warn: 一部弱点はあるが許容範囲
   fail: 構造的欠陥で離脱率高い or 登録動機弱い

【出力JSONフォーマット - これ以外何も出力しない】
{
  "categories": [
    {
      "name": "A. 元ネタの伸び要素の継承",
      "passed": true,
      "items": [
        {
          "name": "項目名（短く）",
          "status": "pass" | "warn" | "fail",
          "comment": "具体的な評価内容（該当箇所引用）",
          "suggestion": "改善案（warn/failのみ）"
        }
      ]
    },
    { "name": "B. 台本ルール外のオリジナル混入", "passed": ..., "items": [...] },
    { "name": "C. 文字数(5000字以内)", "passed": ..., "items": [...] },
    { "name": "D. CTAロジックの自然な連結", "passed": ..., "items": [...] },
    { "name": "E. LINE無料鑑定CTAの強度", "passed": ..., "items": [...] },
    { "name": "F. 同じ内容の重複", "passed": ..., "items": [...] },
    { "name": "G. 内容の矛盾", "passed": ..., "items": [...] },
    { "name": "H. プロマーケター総合評価", "passed": ..., "items": [...] }
  ],
  "comparison": [
    {
      "element": "ハマり要素名（例: 選民訴求 / 離脱防止 / ファン化(共感深掘り) / 理想の未来 / 最悪の未来(恐怖) / 信頼獲得(権威性) / 競合排除 / 予祝コメント / 体験談の具体金額 / 成功率の数値フック など）",
      "source": "元ネタ台本での充足度。「◎」「○」「△」「×」のいずれか + 短い補足（例: 「◎（圧倒的）」「○（強め）」「×」）",
      "generated": "生成台本での充足度。同じく ◎/○/△/× + 短い補足（例: 「◎（社家100年/20年10000人）」「△」「×」）",
      "verdict": "good" | "warn" | "bad",
      "note": "評価コメント（例: 「ここが弱い」「きん婆の強み」「もう一段強められる」。良ければ空でも可）"
    }
  ],
  "overallScore": 7.5,
  "topPriority": "最優先で直すべき事項を1〜2文で"
}

passed は items 全部が "pass" のときのみ true。

【comparison（元ネタ比較マトリクス）の作り方 - 必須出力】
- 元ネタ台本(参考にした動画の台本)と、いま評価している生成台本を、ハマり要素ごとに横並びで採点する表。
- 行(element)は最低でも以下を含める:
  選民訴求 / 離脱防止 / ファン化(共感深掘り) / 理想の未来 / 最悪の未来(恐怖) /
  信頼獲得(権威性) / 競合排除 / 予祝コメント / 体験談の具体金額 / 成功率の数値フック
  ※元ネタやチャンネルの特性に応じて要素を増やしてよい。
- source(元ネタ)と generated(生成台本)はそれぞれ ◎(圧倒的)/○(あり)/△(弱い)/×(なし) で採点し、簡潔な補足を付ける。
- verdict は generated 側の評価に基づく:
  ・generated が ◎ or ○ で十分 → "good"
  ・generated が △ で要改善 → "warn"
  ・generated が × で欠落、または元ネタにあったのに生成で抜けた → "bad"
- note には「ここが弱い」「○○の強み」「もう一段強められる」等、一目でわかる短評を入れる。
- 元ネタ情報が与えられていない場合は generated 側のみ採点し、source は "—" とする。

【overallScore の算出方針】
- 最重視: H(プロマーケター総合) と E(LINE鑑定CTA強度)
- 次に重視: A(元ネタ要素継承), D(CTAロジック), G(矛盾)
- 中程度: B(オリジナル混入), F(重複)
- 軽め: C(文字数)
- 「H/E/A/D/G のいずれかが fail」なら overallScore は 5 以下になる
- 全カテゴリ pass なら 9 以上
- 細かいフォーマット問題だけで 7 を割らない

【出力量の制約 - 必ず厳守（応答が長すぎるとタイムアウトする）】
- 各カテゴリの items は「warn / fail の項目を優先」して列挙する。pass の項目は最大2件まで、comment も「問題なし」程度に短く。
- 各 item の comment は要点のみ、最大60字。長い原文引用はしない（該当箇所は短い抜粋のみ）。
- suggestion は warn / fail の項目だけ、1文・最大50字。
- comparison の source / generated の補足は最大15字、note は最大12字。
- 全体としてコンパクトな応答を保つこと。冗長な説明は不要。`;

function buildUserPrompt(p: {
  script: string;
  title: string;
  profile?: ChannelProfile;
  preset?: ScriptRulePreset;
  winningPatterns?: WinningPatterns;
  referenceAnalyses: RefAnalysis[];
}): string {
  const lines: string[] = [];
  lines.push("【チェック対象の生成台本】");
  lines.push(`タイトル: ${p.title || "(未設定)"}`);
  lines.push(`文字数(概算): ${p.script.replace(/\s/g, "").length}`);
  lines.push("");
  lines.push("--- 台本本文 ---");
  lines.push(p.script);
  lines.push("--- ここまで ---");
  lines.push("");

  if (p.profile) {
    lines.push("【チャンネルプロフィール】");
    if (p.profile.channelName) lines.push(`名前: ${p.profile.channelName}`);
    if (p.profile.concept) lines.push(`コンセプト: ${p.profile.concept}`);
    if (p.profile.commonRules) {
      lines.push("共通ルール:");
      lines.push(p.profile.commonRules);
    }
    if (p.profile.ngExpressions) {
      lines.push("NG表現:");
      lines.push(p.profile.ngExpressions);
    }
    lines.push("");
  }

  if (p.preset) {
    lines.push("【カテゴリ別プリセット】");
    if (p.preset.name) lines.push(`名前: ${p.preset.name}`);
    if (p.preset.rules) lines.push(`ルール: ${p.preset.rules}`);
    if (p.preset.hookPattern) lines.push(`期待されるフック: ${p.preset.hookPattern}`);
    if (p.preset.ctaPattern) lines.push(`期待されるCTA: ${p.preset.ctaPattern}`);
    if (p.preset.targetWordCount) lines.push(`目標文字数: ${p.preset.targetWordCount}`);
    lines.push("");
  }

  if (p.winningPatterns) {
    lines.push("【チャンネルの勝ちパターン】");
    if (p.winningPatterns.bestHookPattern) lines.push(`勝ちフックパターン: ${p.winningPatterns.bestHookPattern}`);
    if (p.winningPatterns.bestStructure) lines.push(`勝ち構成: ${p.winningPatterns.bestStructure}`);
    if (p.winningPatterns.bestDuration) lines.push(`最適長さ: ${p.winningPatterns.bestDuration}`);
    if (p.winningPatterns.avoidPatterns?.length) lines.push(`避けるパターン: ${p.winningPatterns.avoidPatterns.join(" / ")}`);
    lines.push("");
  }

  if (p.referenceAnalyses.length > 0) {
    lines.push("【参考にした元ネタ動画】");
    p.referenceAnalyses.forEach((a, i) => {
      lines.push(`--- 元ネタ${i + 1} ---`);
      lines.push(`タイトル: ${a.videoTitle || "(不明)"}`);
      lines.push(`再生数: ${a.views ? a.views.toLocaleString() + "回" : "不明"}`);
      if (a.analysisResult) {
        try {
          const ar = a.analysisResult as Record<string, unknown>;
          const summary = (ar.summary as string) || "";
          const overallPattern = (ar.overallPattern as string) || "";
          const hooks = (ar.hooks as string[]) || [];
          const ctas = (ar.ctas as string[]) || [];
          const appealPoints = (ar.appealPoints as string[]) || [];
          const growthFactors = (ar.growthFactors as string[]) || [];
          const targetEmotion = (ar.targetEmotion as string) || "";
          if (summary) lines.push(`概要: ${summary}`);
          if (overallPattern) lines.push(`構成パターン: ${overallPattern}`);
          if (hooks.length) lines.push(`フック: ${hooks.join(" / ")}`);
          if (ctas.length) lines.push(`CTA: ${ctas.join(" / ")}`);
          if (appealPoints.length) lines.push(`訴求ポイント: ${appealPoints.join(" / ")}`);
          if (growthFactors.length) lines.push(`伸びた要因: ${growthFactors.join(" / ")}`);
          if (targetEmotion) lines.push(`ターゲット感情: ${targetEmotion}`);
        } catch { /* ignore */ }
      }
      if (a.transcript) {
        lines.push(`元ネタ台本(冒頭1500字):`);
        lines.push(a.transcript.substring(0, 1500));
      }
      lines.push("");
    });
  }

  lines.push("上記のデータを根拠に、台本を5観点で評価してください。指定したJSONフォーマットのみで回答してください。");
  return lines.join("\n");
}

function parseJSON(text: string): Record<string, unknown> | null {
  try { return JSON.parse(text.trim()); } catch {}
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  // 最初の { から最後の } までを抜き出す
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

async function callAnthropic(aiApiKey: string, userPrompt: string, aiModel: ReturnType<typeof resolveAiModel>): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: anthropicHeaders(aiApiKey, aiModel),
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt + "\n\nJSONのみ出力してください。{ から始めてください。" }],
        ...anthropicExtraBody(aiModel),
      }),
    });
    if (res.status === 429 || res.status === 529) {
      if (attempt === 2) throw new Error("AIが混雑しています。少し時間をおいて再実行してください");
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error (${res.status})`);
    }
    const data = await res.json();
    return ((data.content || []) as { type?: string; text?: string }[]).filter((b) => b.type === "text").map((b) => b.text || "").join("");
  }
  throw new Error("リトライ上限");
}

async function callOpenAI(aiApiKey: string, userPrompt: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiApiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 8000,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error (${res.status})`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, title, profile, preset, winningPatterns, referenceAnalyses, aiApiKey } = body as {
      script: string;
      title: string;
      profile?: ChannelProfile;
      preset?: ScriptRulePreset;
      winningPatterns?: WinningPatterns;
      referenceAnalyses?: RefAnalysis[];
      aiApiKey: string;
    };

    if (!aiApiKey) return NextResponse.json({ error: "AI APIキーを設定してください" }, { status: 400 });
    if (!script?.trim()) return NextResponse.json({ error: "台本がありません" }, { status: 400 });

    const userPrompt = buildUserPrompt({
      script,
      title: title || "",
      profile,
      preset,
      winningPatterns,
      referenceAnalyses: referenceAnalyses || [],
    });

    const isAnthropic = aiApiKey.startsWith("sk-ant-");
    const aiModel = resolveAiModel((body as { aiModel?: string }).aiModel);
    const raw = isAnthropic ? await callAnthropic(aiApiKey, userPrompt, aiModel) : await callOpenAI(aiApiKey, userPrompt);
    const parsed = parseJSON(raw);
    if (!parsed) {
      return NextResponse.json({ error: "AI応答の解析に失敗しました", raw }, { status: 500 });
    }
    return NextResponse.json(parsed);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "品質チェックに失敗しました";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
