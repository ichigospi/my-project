// AI分析: 集計データをClaudeに渡してボトルネック診断と改善提案を生成する
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./prisma";
import { getSetting } from "./settings";
import { aggregate } from "./aggregate";
import { categoryLabel, templateTypeLabel, sourceLabel } from "./domain";

const MODEL = "claude-opus-4-8";

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return fmtDate(d);
}

// 分析に渡す全データを収集する（この入力はレポートと一緒に保存し、再現・検証に使う）
export async function buildAnalysisInput(): Promise<Record<string, unknown>> {
  const accounts = await prisma.account.findMany({ where: { archived: false } });

  const [all, last30, prev30] = await Promise.all([
    aggregate(null, null, null),
    aggregate(daysAgo(30), null, null),
    aggregate(daysAgo(60), daysAgo(31), null),
  ]);

  const perAccount = await Promise.all(
    accounts.map(async (a) => ({
      name: a.name,
      last30: await aggregate(daysAgo(30), null, a.id),
      prev30: await aggregate(daysAgo(60), daysAgo(31), a.id),
    }))
  );

  // テンプレ成績（バージョン別）
  const templates = await prisma.template.findMany({
    where: { archived: false },
    include: { account: { select: { name: true } }, versions: true },
  });
  const [sendGroups, saleGroups] = await Promise.all([
    prisma.funnelEvent.groupBy({
      by: ["templateVersionId"],
      where: { templateVersionId: { not: null } },
      _sum: { count: true },
    }),
    prisma.sale.groupBy({
      by: ["templateVersionId", "category"],
      where: { templateVersionId: { not: null } },
      _sum: { amount: true, quantity: true },
    }),
  ]);
  const sends: Record<string, number> = {};
  for (const g of sendGroups) if (g.templateVersionId) sends[g.templateVersionId] = g._sum.count ?? 0;
  const vSales: Record<string, { category: string; amount: number; quantity: number }[]> = {};
  for (const g of saleGroups) {
    if (!g.templateVersionId) continue;
    (vSales[g.templateVersionId] ??= []).push({
      category: categoryLabel(g.category),
      amount: g._sum.amount ?? 0,
      quantity: g._sum.quantity ?? 0,
    });
  }
  const templateStats = templates.map((t) => ({
    account: t.account.name,
    type: templateTypeLabel(t.type),
    name: t.name,
    versions: t.versions.map((v) => ({
      label: v.label,
      abGroup: v.abGroup,
      activeFrom: fmtDate(v.activeFrom),
      activeTo: v.activeTo ? fmtDate(v.activeTo) : null,
      sends: sends[v.id] ?? 0,
      sales: vSales[v.id] ?? [],
    })),
  }));

  // ローンチ実績
  const launches = await prisma.launch.findMany({
    orderBy: { startOn: "desc" },
    take: 10,
    include: { account: { select: { name: true } } },
  });
  const launchStats = await Promise.all(
    launches.map(async (l) => ({
      account: l.account.name,
      name: l.name,
      product: l.productName,
      period: `${l.startOn}〜${l.endOn}`,
      goalAmount: l.goalAmount,
      result: await aggregate(l.startOn, l.endOn, l.accountId),
      memo: l.memo,
    }))
  );

  // 過去のAI分析レポート + ユーザーのフィードバック（学習ループの核）
  const pastReports = await prisma.aiReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { createdAt: true, content: true, feedback: true },
  });

  return {
    generatedAt: new Date().toISOString(),
    funnel: { all, last30, prev30 },
    perAccount,
    sourceLabels: Object.fromEntries(["threads", "insta", "x", "youtube", "other"].map((s) => [s, sourceLabel(s)])),
    templates: templateStats,
    launches: launchStats,
    pastReports: pastReports.map((r) => ({
      date: fmtDate(r.createdAt),
      // 過去レポートは要点だけ渡す（長すぎるとノイズになるため先頭を抜粋）
      excerpt: r.content.slice(0, 2000),
      userFeedback: r.feedback || "(フィードバックなし)",
    })),
  };
}

const SYSTEM_PROMPT = `あなたはスピリチュアル系（占い・鑑定）ビジネスを専門とする一流のマーケティングコンサルタントです。
LINE公式アカウントを軸にした「リストイン→無料鑑定→有料鑑定→アップセル→講座」のファネル設計、エバーグリーン配信、ローンチ、リピーター施策に精通しています。

渡されたJSONデータ（ファネル実績・媒体別リストイン・テンプレ別成績・ローンチ実績・過去の分析レポートとそれに対するユーザーのフィードバック）を分析し、以下の構成で日本語のレポートを書いてください:

## 総評
現状を2〜3文で。数字を引用すること。

## ボトルネック診断
ファネルのどの段階が最も弱いか。直近30日と前30日の比較、業界の一般的な水準との比較も交えて。根拠となる数値を必ず示す。

## 優先改善アクション（上位3つ）
インパクトの大きい順に。それぞれ「何を・なぜ・どうやるか」と期待効果の目安。占い・スピリチュアル業界の顧客心理を踏まえた具体的な施策にすること。

## テンプレ・配信の改善提案
テンプレ別成績（送付→成約率）から、伸ばすべきテンプレ・差し替えるべきテンプレ・次に試すべきABテストを提案。

## ローンチ振り返り（データがあれば）
直近ローンチの評価と次回への示唆。

## 前回からの変化（過去レポートがあれば）
過去の提案とフィードバックを踏まえ、実行された施策の効果を数値で検証し、続けるべきこと・やめるべきことを述べる。

ルール:
- 数値の引用は正確に。データにない数字を作らない
- ユーザーのフィードバックがある場合は最優先で反映する（例: 「この提案は現実的でなかった」→ 同種の提案は避ける）
- 具体的で、明日から実行できる粒度で書く`;

export async function runAnalysis(): Promise<{ ok: boolean; content?: string; error?: string; input?: string }> {
  const apiKey = (await getSetting("ai_api_key")) || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "AI APIキーが未設定です。AI分析ページで設定してください" };
  }

  const input = await buildAnalysisInput();
  const inputJson = JSON.stringify(input, null, 1);

  const client = new Anthropic({ apiKey });
  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `以下が最新の実績データです。分析してください。\n\n${inputJson}`,
        },
      ],
    });
    const message = await stream.finalMessage();

    if (message.stop_reason === "refusal") {
      return { ok: false, error: "AIが分析を実行できませんでした。もう一度お試しください" };
    }

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return { ok: true, content: text, input: inputJson };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "APIキーが無効です。AI分析ページで確認してください" };
    }
    if (e instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "APIのレート制限に達しました。しばらくしてから再実行してください" };
    }
    if (e instanceof Anthropic.APIError) {
      return { ok: false, error: `AI APIエラー: ${e.message}` };
    }
    return { ok: false, error: "分析の実行中にエラーが発生しました" };
  }
}
