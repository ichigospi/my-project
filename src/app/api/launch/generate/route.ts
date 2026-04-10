import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const CONTENT_TYPES: Record<string, { label: string; instruction: string }> = {
  posts_phase1: {
    label: "Phase 1 投稿（Day 1-5）",
    instruction: `Phase 1（Day 1-5）教育・興味づけの投稿15本を生成してください。
1日3本×5日。商品のことはまだ匂わせない。概念を植え付ける教育フェーズです。
投稿タイプ配分: 教育4本、問題提起3本、属人性ストーリー3本、短文2本、日常1本、CTA2本。`,
  },
  posts_phase2: {
    label: "Phase 2 投稿（Day 6-10）",
    instruction: `Phase 2（Day 6-10）信頼構築・選択肢を絞るの投稿15本を生成してください。
1日3本×5日。仮想敵を倒し「あなたの方法が最適解」→「あなたにお願いしたい」へ。
投稿タイプ配分: 仮想敵批判3本、再現性3本、差別化2本、属人性ストーリー2本、短文2本、CTA2本、テイザー1本。
Day 8にコラム②企画、Day 10にコラム③企画を含む。`,
  },
  posts_phase3: {
    label: "Phase 3 投稿（Day 11-14）",
    instruction: `Phase 3（Day 11-14）予告・販売の投稿12本＋コラム企画3本を生成してください。
1日3本×4日。オファーを出して売る。
Day 11: 正式告知+商品説明+理想の未来+短文テイザー
Day 12: 欲求喚起+FAQ+反論処理+「迷ってる人へ」
Day 13: 販売開始告知+リアルタイム報告+反論処理
Day 14: 残り枠+最後の欲求喚起+締め切り+感謝投稿`,
  },
  columns: {
    label: "コラム3本",
    instruction: `コラム3本（企画告知ポスト付き）を生成してください。
3本が「問題→解決策→自分ごと化」と連鎖する構造。
コラム①（Day 4）: 問題に気づかせる → 末尾で②を予告
コラム②（Day 8）: 解決策と証拠を見せる → 末尾で③を予告
コラム③（Day 10）: 自分ごと化させる → 末尾で告知を予告
各コラム2,500〜4,000字。企画告知ポストもセットで。`,
  },
  letter: {
    label: "セールスレター",
    instruction: `セールスレター1本を生成してください。3,000〜5,000字。
構造: ①スクリーニング → ②共感 → ③問題提起・原因特定 → ④解決策 → ⑤社会的証明 → ⑥差別化 → ⑦商品内容・ブレット → ⑧理想の未来 → ⑨価格・申込方法 → ⑩限定性・緊急性 → ⑪最後のメッセージ`,
  },
  line: {
    label: "LINE配信11通",
    instruction: `LINE配信メッセージ全11通を生成してください。
①登録直後あいさつ+コラム①配布、②登録翌日フォロー、③Day6頃教育+コラム②予告、
④Day8コラム②配布、⑤Day9フォロー+期待感、⑥Day10コラム③配布、
⑦Day11告知予告、⑧Day11-12セールスレター配信、⑨Day13リマインド、
⑩Day14締め切り、⑪購入後お礼。各200〜500字。`,
  },
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { contentType, design, aiApiKey } = body;

  if (!aiApiKey) {
    return NextResponse.json(
      { error: "AI APIキーが設定されていません。設定ページから登録してください。" },
      { status: 400 }
    );
  }

  const config = CONTENT_TYPES[contentType];
  if (!config) {
    return NextResponse.json(
      { error: `不明なコンテンツタイプ: ${contentType}` },
      { status: 400 }
    );
  }

  const isAnthropic = aiApiKey.startsWith("sk-ant-");

  const systemPrompt = `あなたはSNSマーケティングのプロフェッショナルなコンテンツライターです。
商品ローンチのためのコンテンツを生成します。

## 重要ルール
- テンプレ禁止: 同じ構文の繰り返しをしない
- 刷り込みKWを自然に含める（1投稿にメインKW最低1つ）
- 同じKWを3投稿連続で使わない
- フェーズの教育段階に沿った内容にする
- 「売り感」が出すぎないよう、教育・ストーリーの文脈に溶け込ませる
- Phase 1-2で商品を直接売らない

## コンプライアンス
- 個人の体験談には「※個人の感想です」等の免責表示を付記
- 「全員」「必ず」「確実に」等の断定表現を避ける
- 精神的・身体的改善を断定しない
- 他社否定をしない（自社の姿勢強調に留める）
- 独自用語には定義注釈を入れる`;

  const designText = Object.entries(design)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  // 学習済み実例をDBから取得（同じtypeのものを最新5件）
  let examplesText = "";
  try {
    const examples = await prisma.launchExample.findMany({
      where: { type: contentType },
      orderBy: { createdAt: "desc" },
      take: 5,
    });
    if (examples.length > 0) {
      examplesText = `\n\n## 過去の良い実例（このトーン・構造を参考にしてください）\n\n${examples
        .map((ex, i) => `### 実例${i + 1}${ex.title ? `: ${ex.title}` : ""}${ex.note ? `\n（メモ: ${ex.note}）` : ""}\n\n${ex.content}`)
        .join("\n\n---\n\n")}`;
    }
  } catch {
    // DBエラーは無視して続行
  }

  const userPrompt = `## ローンチ設計書
${designText}

## 生成指示
${config.instruction}
${examplesText}

上記の設計書に基づいて、コンテンツを生成してください。
各投稿/コンテンツには以下を含めてください:
- 本文
- 狙い（どの教育段階か）
- 使用した刷り込みKW`;

  try {
    if (isAnthropic) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": aiApiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json(
          { error: error.error?.message || "Claude APIエラー" },
          { status: res.status }
        );
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      return NextResponse.json({ text, label: config.label });
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${aiApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 8192,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        return NextResponse.json(
          { error: error.error?.message || "OpenAI APIエラー" },
          { status: res.status }
        );
      }

      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || "";
      return NextResponse.json({ text, label: config.label });
    }
  } catch {
    return NextResponse.json({ error: "コンテンツ生成に失敗しました" }, { status: 500 });
  }
}
