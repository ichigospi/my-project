import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 共有設定の取得
// 注: shared_projects は別エンドポイント (/api/projects) に分離済み。
// ここで束ねるとリクエスト/レスポンスが肥大化し "Failed to fetch" の原因になるため、
// 重い可能性のあるキーは含めない。
const SHARED_KEYS = [
  "shared_yt_api_key", "shared_ai_api_key", "shared_openai_api_key", "shared_channels", "shared_hooks",
  "shared_ctas", "shared_thumbnail_words", "shared_titles", "shared_profile",
  "shared_profiles_list", "shared_winning_patterns", "shared_presets",
  "shared_tasks", "shared_members", "shared_my_channel",
  "shared_analysis_logs", "shared_weekly_snapshots", "shared_performance_records",
  "shared_ideas", "shared_idea_rules", "shared_idea_rules_list",
  "shared_my_channels", "shared_my_channel_data_list",
  "shared_winning_patterns_list", "shared_ai_insights",
];

export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    // キーごとに個別取得。巨大化した1キー(shared_projects等)が読めなくても、
    // APIキー・チャンネル等の重要な設定は確実に返す。
    const map: Record<string, string> = {};
    const skipped: { key: string; error: string }[] = [];
    for (const key of SHARED_KEYS) {
      try {
        const row = await prisma.appSetting.findUnique({ where: { key } });
        if (row) map[key] = row.value;
      } catch (e) {
        console.error(`GET /api/shared-settings: key "${key}" failed to read`, e);
        skipped.push({ key, error: String(e).slice(0, 200) });
      }
    }

    // 値が壊れていても全体を落とさないための安全パース
    const parse = <T,>(key: string, fallback: T): T => {
      const v = map[key];
      if (!v) return fallback;
      try { return JSON.parse(v) as T; } catch { return fallback; }
    };

    return NextResponse.json({
      yt_api_key: map["shared_yt_api_key"] || "",
      ai_api_key: map["shared_ai_api_key"] || "",
      openai_api_key: map["shared_openai_api_key"] || "",
      channels: parse("shared_channels", [] as unknown[]),
      hooks: parse("shared_hooks", [] as unknown[]),
      ctas: parse("shared_ctas", [] as unknown[]),
      thumbnailWords: parse("shared_thumbnail_words", [] as unknown[]),
      titles: parse("shared_titles", [] as unknown[]),
      profile: parse("shared_profile", null),
      profilesList: map["shared_profiles_list"]
        ? parse("shared_profiles_list", [] as unknown[])
        : (map["shared_profile"] ? [parse("shared_profile", null)] : []),
      winningPatterns: parse("shared_winning_patterns", null),
      presets: parse("shared_presets", [] as unknown[]),
      // projects は /api/projects に分離（巨大ブロブを防ぐため）。
      // 後方互換のためフィールド自体は残し、空配列を返す。
      projects: [] as unknown[],
      tasks: parse("shared_tasks", [] as unknown[]),
      members: parse("shared_members", [] as unknown[]),
      myChannel: parse("shared_my_channel", null),
      analysisLogs: parse("shared_analysis_logs", [] as unknown[]),
      weeklySnapshots: parse("shared_weekly_snapshots", [] as unknown[]),
      performanceRecords: parse("shared_performance_records", [] as unknown[]),
      ideas: parse("shared_ideas", [] as unknown[]),
      ideaRules: parse("shared_idea_rules", null),
      ideaRulesList: map["shared_idea_rules_list"]
        ? parse("shared_idea_rules_list", [] as unknown[])
        : (map["shared_idea_rules"] ? [parse("shared_idea_rules", null)] : []),
      myChannels: parse("shared_my_channels", [] as unknown[]),
      myChannelDataList: map["shared_my_channel_data_list"]
        ? parse("shared_my_channel_data_list", [] as unknown[])
        : (map["shared_my_channel"] ? [parse("shared_my_channel", null)] : []),
      winningPatternsList: map["shared_winning_patterns_list"]
        ? parse("shared_winning_patterns_list", [] as unknown[])
        : (map["shared_winning_patterns"] ? [parse("shared_winning_patterns", null)] : []),
      aiInsights: parse("shared_ai_insights", [] as unknown[]),
      _skipped: skipped,
    });
  } catch (e) {
    console.error("GET /api/shared-settings error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 共有設定の保存
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const updates: { key: string; value: string }[] = [];

    if (body.yt_api_key !== undefined) updates.push({ key: "shared_yt_api_key", value: body.yt_api_key });
    if (body.ai_api_key !== undefined) updates.push({ key: "shared_ai_api_key", value: body.ai_api_key });
    if (body.openai_api_key !== undefined) updates.push({ key: "shared_openai_api_key", value: body.openai_api_key });
    if (body.channels !== undefined) updates.push({ key: "shared_channels", value: JSON.stringify(body.channels) });
    if (body.hooks !== undefined) updates.push({ key: "shared_hooks", value: JSON.stringify(body.hooks) });
    if (body.ctas !== undefined) updates.push({ key: "shared_ctas", value: JSON.stringify(body.ctas) });
    if (body.thumbnailWords !== undefined) updates.push({ key: "shared_thumbnail_words", value: JSON.stringify(body.thumbnailWords) });
    if (body.titles !== undefined) updates.push({ key: "shared_titles", value: JSON.stringify(body.titles) });
    if (body.profile !== undefined) updates.push({ key: "shared_profile", value: JSON.stringify(body.profile) });
    if (body.profilesList !== undefined) updates.push({ key: "shared_profiles_list", value: JSON.stringify(body.profilesList) });
    if (body.winningPatterns !== undefined) updates.push({ key: "shared_winning_patterns", value: JSON.stringify(body.winningPatterns) });
    if (body.presets !== undefined) updates.push({ key: "shared_presets", value: JSON.stringify(body.presets) });
    // projects は /api/projects で個別保存するため、ここでは書き込まない（巨大ブロブ防止）
    if (body.tasks !== undefined) updates.push({ key: "shared_tasks", value: JSON.stringify(body.tasks) });
    if (body.members !== undefined) updates.push({ key: "shared_members", value: JSON.stringify(body.members) });
    if (body.myChannel !== undefined) updates.push({ key: "shared_my_channel", value: JSON.stringify(body.myChannel) });
    if (body.analysisLogs !== undefined) updates.push({ key: "shared_analysis_logs", value: JSON.stringify(body.analysisLogs) });
    if (body.weeklySnapshots !== undefined) updates.push({ key: "shared_weekly_snapshots", value: JSON.stringify(body.weeklySnapshots) });
    if (body.performanceRecords !== undefined) updates.push({ key: "shared_performance_records", value: JSON.stringify(body.performanceRecords) });
    if (body.ideas !== undefined) updates.push({ key: "shared_ideas", value: JSON.stringify(body.ideas) });
    if (body.ideaRules !== undefined) updates.push({ key: "shared_idea_rules", value: JSON.stringify(body.ideaRules) });
    if (body.myChannels !== undefined) updates.push({ key: "shared_my_channels", value: JSON.stringify(body.myChannels) });
    if (body.myChannelDataList !== undefined) updates.push({ key: "shared_my_channel_data_list", value: JSON.stringify(body.myChannelDataList) });
    if (body.winningPatternsList !== undefined) updates.push({ key: "shared_winning_patterns_list", value: JSON.stringify(body.winningPatternsList) });
    if (body.ideaRulesList !== undefined) updates.push({ key: "shared_idea_rules_list", value: JSON.stringify(body.ideaRulesList) });
    if (body.aiInsights !== undefined) updates.push({ key: "shared_ai_insights", value: JSON.stringify(body.aiInsights) });

    // キーごとに独立して書き込む。1つが失敗（容量超過等）しても残りは同期する。
    const failed: { key: string; size: number; error: string }[] = [];
    for (const { key, value } of updates) {
      try {
        await prisma.appSetting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        });
      } catch (e) {
        console.error(`POST /api/shared-settings: key "${key}" failed (size=${value.length})`, e);
        failed.push({ key, size: value.length, error: String(e).slice(0, 300) });
      }
    }

    return NextResponse.json({
      ok: failed.length === 0,
      updated: updates.length - failed.length,
      failed,
    });
  } catch (e) {
    console.error("POST /api/shared-settings error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
