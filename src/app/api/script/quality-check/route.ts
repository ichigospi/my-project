import { NextRequest, NextResponse } from "next/server";

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

const SYSTEM_PROMPT = `あなたは占い・スピリチュアル系YouTube台本の品質チェック専門家です。
与えられた台本を5つの観点で厳しく評価し、必ず指定されたJSON形式のみで回答してください。
JSON以外のテキスト（説明文、マークダウン、コードブロック記法）は一切出力しないでください。

【評価観点】
A. ルール遵守: チャンネル共通ルール / NG表現 / カテゴリ別プリセットルール / 目標文字数 を守れているか
   ※「同じ語尾の連続使用の制限」は、ヒーリングパート・アファメーションパートには適用しない。
     そこは繰り返しが演出として有効なため、語尾が連続していても減点しない（それ以外のパートでは制限を評価する）
   ※A内の項目には2種類ある:
     ・【内容直結ルール】NG表現の使用 / LINE誘導や放置危険性などの必須要素の有無 / 収益化導線の欠落 等
       → これらは台本の役割に直結するため厳しく fail/warn を付ける
     ・【フォーマット系ルール】1行○文字 / 改行位置 / 記号(##・---)の有無 / 目標文字数の±20%以内の超過/不足 / 語尾の連続 等
       → これらは内容の良し悪しではなく書式の話。違反があっても基本 warn 止まりにし、fail にはしない。
         総合スコア(overallScore)を算出するときも、フォーマット系の違反は軽く扱う（大きく減点しない）
B. 元ネタとの比較: 訴求ポイント / フック / 伸びた要因 / 「理想の未来」「最悪の未来」が
   元ネタと同等以上に具体的かつ感情を揺さぶる内容になっているか
   ※特に「具体的金額(3億円など)」「具体的シチュエーション(口座に振込通知)」が
     抽象化されてないか厳しくチェック
C. 勝ちパターン適用: チャンネルの勝ちパターン (bestHookPattern等) に沿っているか
D. 構成密度: 台本ルールで定義された構成 (フック→展開→クライマックス→CTA等) を遵守してるか
   足りない要素・余計な要素がないか / 冒頭15秒のフック / 中盤離脱対策 / CTA の自然さ
E. タイトル整合性: タイトルのテーマと中身が合致しているか
   (例: 「宝くじが当たる」というタイトルで延々と金運の抽象論しか無い場合は重大NG)

【出力JSONフォーマット - これ以外何も出力しない】
{
  "categories": [
    {
      "name": "A. ルール遵守",
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
    { "name": "B. 元ネタとの比較", "passed": ..., "items": [...] },
    { "name": "C. 勝ちパターン適用", "passed": ..., "items": [...] },
    { "name": "D. 構成密度", "passed": ..., "items": [...] },
    { "name": "E. タイトル整合性", "passed": ..., "items": [...] }
  ],
  "overallScore": 7.5,
  "topPriority": "最優先で直すべき事項を1〜2文で"
}

passed は items 全部が "pass" のときのみ true。
status は厳しめにつけるが、A内の【フォーマット系ルール】の違反は warn 止まりにし fail を付けない。

【overallScore の算出方針】
- 重みは B(元ネタとの比較) + E(タイトル整合性) + D(構成密度・CTAの自然さ) を最重視
- A内の【内容直結ルール】（NG表現・必須要素の欠落・収益化導線等）も重視
- A内の【フォーマット系ルール】（文字数・改行・記号・語尾連続 等）は違反があっても overallScore を大きく下げない
- 内容の核心が良ければフォーマットの軽微な違反だけでスコアを 7 未満に落とさない`;

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

async function callAnthropic(aiApiKey: string, userPrompt: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": aiApiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt + "\n\nJSONのみ出力してください。{ から始めてください。" }],
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
    return data.content?.[0]?.text || "";
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
    const raw = isAnthropic ? await callAnthropic(aiApiKey, userPrompt) : await callOpenAI(aiApiKey, userPrompt);
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
