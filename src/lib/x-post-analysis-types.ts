// 分析結果の型とパーサ（クライアント・サーバ両方で使う）
// 注意: このファイルは fs/promises 等のサーバ専用APIを使わないこと。
//       サーバonlyのプロンプト構築は x-post-prompts.ts に置く。

export interface AnalysisResult {
  summary: string;
  structureTypes: { type: string; count: number; evidence: string }[];
  commonHooks: { type: string; description: string; examples: string[] }[];
  reinforcementElements: { element: string; description: string; examples: string[] }[];
  educationTypes: { type: string; description: string; evidence: string }[];
  powerWords: string[];
  applicationHints: string[];
}

export function emptyAnalysisResult(): AnalysisResult {
  return {
    summary: "",
    structureTypes: [],
    commonHooks: [],
    reinforcementElements: [],
    educationTypes: [],
    powerWords: [],
    applicationHints: [],
  };
}

// AI出力の生テキストをパース。失敗したらフォールバック
export function parseAnalysisResult(raw: string): { result: AnalysisResult; parseError: boolean } {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    const result: AnalysisResult = {
      summary: typeof parsed.summary === "string" ? parsed.summary : "",
      structureTypes: Array.isArray(parsed.structureTypes) ? parsed.structureTypes : [],
      commonHooks: Array.isArray(parsed.commonHooks) ? parsed.commonHooks : [],
      reinforcementElements: Array.isArray(parsed.reinforcementElements) ? parsed.reinforcementElements : [],
      educationTypes: Array.isArray(parsed.educationTypes) ? parsed.educationTypes : [],
      powerWords: Array.isArray(parsed.powerWords) ? parsed.powerWords : [],
      applicationHints: Array.isArray(parsed.applicationHints) ? parsed.applicationHints : [],
    };
    return { result, parseError: false };
  } catch {
    const fallback = emptyAnalysisResult();
    fallback.summary = raw.slice(0, 500);
    return { result: fallback, parseError: true };
  }
}
