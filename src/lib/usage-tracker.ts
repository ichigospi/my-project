// AI API使用量の記録（サーバー専用）。
// 日別（JST）× モデル別に AppSetting キー `ai_usage_YYYY-MM-DD` へ集計保存する。
// 1日1キーの小さなJSONなので同期肥大化の問題は起きない。
// 記録の失敗は本処理（生成・チェック）に一切影響させない（fire-and-forget）。
import { prisma } from "@/lib/prisma";

// 100万トークンあたりのUSD料金
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-fable-5": { input: 10, output: 50 },
  "gpt-4o": { input: 2.5, output: 10 },
};

interface AnthropicUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}
interface OpenAIUsage { prompt_tokens?: number; completion_tokens?: number }

export interface UsageModelEntry { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
export type UsageDay = Record<string, UsageModelEntry>;

function jstDateKey(): string {
  // sv-SE ロケールは YYYY-MM-DD 形式を返す
  return `ai_usage_${new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" })}`;
}

export function recordUsage(opts: { model: string; usage?: AnthropicUsage | OpenAIUsage | null }) {
  void (async () => {
    try {
      const u = (opts.usage || {}) as AnthropicUsage & OpenAIUsage;
      const input = u.input_tokens ?? u.prompt_tokens ?? 0;
      const output = u.output_tokens ?? u.completion_tokens ?? 0;
      const cacheRead = u.cache_read_input_tokens || 0;
      const cacheWrite = u.cache_creation_input_tokens || 0;
      if (input + output + cacheRead + cacheWrite === 0) return;

      const p = PRICING[opts.model] || PRICING["claude-sonnet-4-6"];
      const costUsd = (input * p.input + output * p.output + cacheRead * p.input * 0.1 + cacheWrite * p.input * 1.25) / 1_000_000;

      const key = jstDateKey();
      const row = await prisma.appSetting.findUnique({ where: { key } });
      let day: UsageDay = {};
      try { day = row?.value ? JSON.parse(row.value) : {}; } catch { day = {}; }
      const cur = day[opts.model] || { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
      day[opts.model] = {
        calls: cur.calls + 1,
        inputTokens: cur.inputTokens + input + cacheRead + cacheWrite,
        outputTokens: cur.outputTokens + output,
        costUsd: cur.costUsd + costUsd,
      };
      const value = JSON.stringify(day);
      await prisma.appSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
    } catch {
      // 使用量の記録失敗は無視（生成処理を止めない）
    }
  })();
}
