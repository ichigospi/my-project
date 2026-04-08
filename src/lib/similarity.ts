// タイトル類似率計算（N-gram方式）

export function calcSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const normalize = (s: string) => s.toLowerCase().replace(/[【】「」『』（）\(\)\[\]！？!?、。・\s]/g, "");
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  // 2-gramセットを生成
  const ngrams = (s: string, n: number = 2): Set<string> => {
    const set = new Set<string>();
    for (let i = 0; i <= s.length - n; i++) {
      set.add(s.substring(i, i + n));
    }
    return set;
  };

  const gramsA = ngrams(na);
  const gramsB = ngrams(nb);
  let intersection = 0;
  gramsA.forEach((g) => { if (gramsB.has(g)) intersection++; });
  const union = gramsA.size + gramsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}
