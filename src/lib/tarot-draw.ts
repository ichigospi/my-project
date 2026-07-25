// タロットカードのサーバー側抽選。
// AIに選ばせると毎回「太陽・星・運命の輪」等の定番に収束するため、
// 本物の乱数で実際に引いた結果をプロンプトに渡し、差し替えを禁止する。

const MAJOR_ARCANA = [
  "愚者", "魔術師", "女教皇", "女帝", "皇帝", "法王", "恋人", "戦車",
  "力", "隠者", "運命の輪", "正義", "吊るされた男", "死神", "節制",
  "悪魔", "塔", "星", "月", "太陽", "審判", "世界",
];

// 3枚目（常識破壊＋仮想敵批判の役割）用のネガティブ寄りカード
const NEGATIVE_LEANING = ["塔", "死神", "悪魔", "月", "吊るされた男"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// 5枚を抽選し、プロンプトへ注入するテキストブロックを返す。
// 呼ばれるたびに引き直される（＝骨組みを再生成すればカードが変わる）。
export function buildTarotDrawBlock(): string {
  const deck = [...MAJOR_ARCANA];
  // 3枚目はネガティブ寄りから抽選（常識破壊の役割を成立させるため）
  const negCard = rand(NEGATIVE_LEANING);
  deck.splice(deck.indexOf(negCard), 1);
  const others: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * deck.length);
    others.push(deck.splice(idx, 1)[0]);
  }
  const orient = () => (Math.random() < 0.2 ? "逆位置" : "正位置");
  const slots = [
    `1枚目: ${others[0]}（${orient()}）`,
    `2枚目: ${others[1]}（${orient()}）`,
    `3枚目: ${negCard}（正位置）`,
    `4枚目: ${others[2]}（${orient()}）`,
    `5枚目: ${others[3]}（${orient()}）`,
  ];
  const proofPos = 1 + Math.floor(Math.random() * 3);

  return `【今回の抽選カード（サーバーの乱数で実際に引いた結果。必ずこの5枚を、この順番で使うこと）】
${slots.join("\n")}
- カードの差し替え・入れ替え・追加は禁止。この5枚で構成する
- 各カードは正統な意味を正確に読み解いた上で、そのスロットの役割（祝福→五感具体化→常識破壊→強さ/方向性→もう来てる 等、ルールの役割構成）とテーマに紐付ける。役割に合わせて意味を捏造しない（正統な意味の中から役割に通じる側面を選ぶ）
- 「塔」「死神」「悪魔」等の一見怖いカードが出ても差し替えない。正統な意味（破壊と再生・終わりと始まり・執着からの解放 等）を踏まえ、最終的に視聴者の希望へ繋がるリーディングにする

【後追い証明（「このカードが出ることは分かっていました」の的中演出）の位置】
- 元ネタ分析から、元ネタが後追い証明を行っているカード位置が分かる場合は、その位置に合わせる
- 不明な場合は、今回は${proofPos}枚目で行うこと。毎回1枚目に固定しない`;
}
