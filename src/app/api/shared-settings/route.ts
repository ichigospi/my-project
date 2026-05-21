import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";

// 共有設定の取得
export async function GET() {
  try {
    const auth = await requireAuth();
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const settings = await prisma.appSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    return NextResponse.json({
      yt_api_key: map["shared_yt_api_key"] || "",
      ai_api_key: map["shared_ai_api_key"] || "",
      channels: map["shared_channels"] ? JSON.parse(map["shared_channels"]) : [],
      hooks: map["shared_hooks"] ? JSON.parse(map["shared_hooks"]) : [],
      ctas: map["shared_ctas"] ? JSON.parse(map["shared_ctas"]) : [],
      thumbnailWords: map["shared_thumbnail_words"] ? JSON.parse(map["shared_thumbnail_words"]) : [],
      titles: map["shared_titles"] ? JSON.parse(map["shared_titles"]) : [],
      profile: map["shared_profile"] ? JSON.parse(map["shared_profile"]) : null,
      profilesList: map["shared_profiles_list"]
        ? JSON.parse(map["shared_profiles_list"])
        : (map["shared_profile"] ? [JSON.parse(map["shared_profile"])] : []),
      winningPatterns: map["shared_winning_patterns"] ? JSON.parse(map["shared_winning_patterns"]) : null,
      presets: map["shared_presets"] ? JSON.parse(map["shared_presets"]) : [],
      projects: map["shared_projects"] ? JSON.parse(map["shared_projects"]) : [],
      tasks: map["shared_tasks"] ? JSON.parse(map["shared_tasks"]) : [],
      members: map["shared_members"] ? JSON.parse(map["shared_members"]) : [],
      myChannel: map["shared_my_channel"] ? JSON.parse(map["shared_my_channel"]) : null,
      analysisLogs: map["shared_analysis_logs"] ? JSON.parse(map["shared_analysis_logs"]) : [],
      weeklySnapshots: map["shared_weekly_snapshots"] ? JSON.parse(map["shared_weekly_snapshots"]) : [],
      performanceRecords: map["shared_performance_records"] ? JSON.parse(map["shared_performance_records"]) : [],
      ideas: map["shared_ideas"] ? JSON.parse(map["shared_ideas"]) : [],
      ideaRules: map["shared_idea_rules"] ? JSON.parse(map["shared_idea_rules"]) : null,
      ideaRulesList: map["shared_idea_rules_list"]
        ? JSON.parse(map["shared_idea_rules_list"])
        : (map["shared_idea_rules"] ? [JSON.parse(map["shared_idea_rules"])] : []),
      myChannels: map["shared_my_channels"] ? JSON.parse(map["shared_my_channels"]) : [],
      myChannelDataList: map["shared_my_channel_data_list"]
        ? JSON.parse(map["shared_my_channel_data_list"])
        : (map["shared_my_channel"] ? [JSON.parse(map["shared_my_channel"])] : []),
      winningPatternsList: map["shared_winning_patterns_list"]
        ? JSON.parse(map["shared_winning_patterns_list"])
        : (map["shared_winning_patterns"] ? [JSON.parse(map["shared_winning_patterns"])] : []),
      aiInsights: map["shared_ai_insights"] ? JSON.parse(map["shared_ai_insights"]) : [],
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
    if (body.channels !== undefined) updates.push({ key: "shared_channels", value: JSON.stringify(body.channels) });
    if (body.hooks !== undefined) updates.push({ key: "shared_hooks", value: JSON.stringify(body.hooks) });
    if (body.ctas !== undefined) updates.push({ key: "shared_ctas", value: JSON.stringify(body.ctas) });
    if (body.thumbnailWords !== undefined) updates.push({ key: "shared_thumbnail_words", value: JSON.stringify(body.thumbnailWords) });
    if (body.titles !== undefined) updates.push({ key: "shared_titles", value: JSON.stringify(body.titles) });
    if (body.profile !== undefined) updates.push({ key: "shared_profile", value: JSON.stringify(body.profile) });
    if (body.profilesList !== undefined) updates.push({ key: "shared_profiles_list", value: JSON.stringify(body.profilesList) });
    if (body.winningPatterns !== undefined) updates.push({ key: "shared_winning_patterns", value: JSON.stringify(body.winningPatterns) });
    if (body.presets !== undefined) updates.push({ key: "shared_presets", value: JSON.stringify(body.presets) });
    if (body.projects !== undefined) updates.push({ key: "shared_projects", value: JSON.stringify(body.projects) });
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
