// ローンチツール — localStorage ベースのデータ管理

export interface LaunchDesign {
  productName: string;
  productContent: string;
  price: string;
  priceJustification: string;
  salesMethod: string;
  limit: string;
  limitReason: string;
  differentiation: string;
  // 課題解決ロジック
  pain: string;
  cause: string;
  solution: string;
  idealFuture: string;
  strength: string;
  productDetail: string;
  enemies: string;
  // 刷り込みKW
  kw1: string;
  kw2: string;
  kw3: string;
  kw4: string;
  kw5: string;
  subKw1: string;
  subKw2: string;
  subKw3: string;
  // フェーズコンセプト
  phase1Concept: string;
  phase2Concept: string;
  phase3Concept: string;
}

const STORAGE_KEY = "launch_design";
const GENERATED_KEY = "launch_generated";

export function getDefaultDesign(): LaunchDesign {
  return {
    productName: "",
    productContent: "",
    price: "",
    priceJustification: "",
    salesMethod: "",
    limit: "",
    limitReason: "",
    differentiation: "",
    pain: "",
    cause: "",
    solution: "",
    idealFuture: "",
    strength: "",
    productDetail: "",
    enemies: "",
    kw1: "",
    kw2: "",
    kw3: "",
    kw4: "",
    kw5: "",
    subKw1: "",
    subKw2: "",
    subKw3: "",
    phase1Concept: "",
    phase2Concept: "",
    phase3Concept: "",
  };
}

export function saveLaunchDesign(design: LaunchDesign): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
  }
}

export function loadLaunchDesign(): LaunchDesign {
  if (typeof window === "undefined") return getDefaultDesign();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return getDefaultDesign();
  try {
    return { ...getDefaultDesign(), ...JSON.parse(stored) };
  } catch {
    return getDefaultDesign();
  }
}

export interface GeneratedContent {
  type: string;
  content: string;
  generatedAt: string;
}

export function saveGeneratedContent(type: string, content: string): void {
  if (typeof window === "undefined") return;
  const all = loadAllGenerated();
  all[type] = { type, content, generatedAt: new Date().toISOString() };
  localStorage.setItem(GENERATED_KEY, JSON.stringify(all));
}

export function loadAllGenerated(): Record<string, GeneratedContent> {
  if (typeof window === "undefined") return {};
  const stored = localStorage.getItem(GENERATED_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

export function loadGeneratedContent(type: string): GeneratedContent | null {
  const all = loadAllGenerated();
  return all[type] || null;
}
