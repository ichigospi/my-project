// モックデータ（YouTube API連携後は実データに置き換え）

export interface ChannelData {
  id: string;
  name: string;
  subscribers: number;
  totalViews: number;
  videoCount: number;
  avgViews: number;
  uploadFrequency: string;
  category: string;
  thumbnailUrl: string;
  recentGrowth: number;
  topVideos: VideoData[];
}

export interface VideoData {
  id: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  duration: string;
  thumbnailUrl: string;
  tags: string[];
  engagementRate: number;
}

export interface TrendKeyword {
  keyword: string;
  searchVolume: number;
  competition: "low" | "medium" | "high";
  trend: "rising" | "stable" | "declining";
  relatedTopics: string[];
  monthlyChange: number;
}

export interface TitlePattern {
  pattern: string;
  examples: string[];
  avgViews: number;
  frequency: number;
}

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  structure: ScriptSection[];
}

export interface ScriptSection {
  name: string;
  duration: string;
  description: string;
  placeholder: string;
}

// --- モックチャンネルデータ ---
export const mockChannels: ChannelData[] = [
  {
    id: "ch1",
    name: "奇跡のタロットチャンネル",
    subscribers: 245000,
    totalViews: 48500000,
    videoCount: 523,
    avgViews: 92800,
    uploadFrequency: "毎日",
    category: "タロットリーディング",
    thumbnailUrl: "",
    recentGrowth: 12.5,
    topVideos: [
      {
        id: "v1", title: "今日の運勢 - 宇宙があなたに伝えたいこと",
        views: 385000, likes: 12400, comments: 2100, publishedAt: "2026-03-25",
        duration: "15:32", thumbnailUrl: "", tags: ["タロット", "今日の運勢", "宇宙のメッセージ"],
        engagementRate: 3.77,
      },
      {
        id: "v2", title: "3月の星座占い - この星座に大きな変化が！",
        views: 298000, likes: 9800, comments: 1650, publishedAt: "2026-03-01",
        duration: "22:15", thumbnailUrl: "", tags: ["星座占い", "3月", "12星座"],
        engagementRate: 3.84,
      },
    ],
  },
  {
    id: "ch2",
    name: "スピリチュアルヒーリングルーム",
    subscribers: 189000,
    totalViews: 32100000,
    videoCount: 312,
    avgViews: 102900,
    uploadFrequency: "週3回",
    category: "スピリチュアルヒーリング",
    thumbnailUrl: "",
    recentGrowth: 18.3,
    topVideos: [
      {
        id: "v3", title: "ネガティブエネルギー浄化 - 10分間の誘導瞑想",
        views: 520000, likes: 18200, comments: 3400, publishedAt: "2026-03-20",
        duration: "12:45", thumbnailUrl: "", tags: ["瞑想", "エネルギー浄化", "ヒーリング"],
        engagementRate: 4.15,
      },
    ],
  },
  {
    id: "ch3",
    name: "運命のオラクル",
    subscribers: 156000,
    totalViews: 25800000,
    videoCount: 445,
    avgViews: 57978,
    uploadFrequency: "週5回",
    category: "数秘術・オラクル",
    thumbnailUrl: "",
    recentGrowth: 8.7,
    topVideos: [
      {
        id: "v4", title: "あなたの誕生数が2026年を暴く - 徹底解説",
        views: 412000, likes: 15600, comments: 2800, publishedAt: "2026-01-05",
        duration: "28:10", thumbnailUrl: "", tags: ["数秘術", "2026年", "誕生数"],
        engagementRate: 4.47,
      },
    ],
  },
  {
    id: "ch4",
    name: "天使のメッセージ毎日配信",
    subscribers: 98000,
    totalViews: 15200000,
    videoCount: 678,
    avgViews: 22420,
    uploadFrequency: "毎日",
    category: "エンジェルナンバー",
    thumbnailUrl: "",
    recentGrowth: 22.1,
    topVideos: [
      {
        id: "v5", title: "1111を見た？天使が送る強力なメッセージとは",
        views: 289000, likes: 11200, comments: 1900, publishedAt: "2026-03-15",
        duration: "11:20", thumbnailUrl: "", tags: ["エンジェルナンバー", "1111", "スピリチュアルサイン"],
        engagementRate: 4.53,
      },
    ],
  },
  {
    id: "ch5",
    name: "チャクラバランスTV",
    subscribers: 134000,
    totalViews: 21300000,
    videoCount: 289,
    avgViews: 73700,
    uploadFrequency: "週2回",
    category: "チャクラ・エネルギー",
    thumbnailUrl: "",
    recentGrowth: 15.4,
    topVideos: [
      {
        id: "v6", title: "第三の目を開く瞑想 - 直感力を解放する",
        views: 445000, likes: 16800, comments: 2600, publishedAt: "2026-02-28",
        duration: "18:55", thumbnailUrl: "", tags: ["第三の目", "チャクラ", "直感"],
        engagementRate: 4.36,
      },
    ],
  },
];

// --- モックトレンドキーワード ---
export const mockTrendKeywords: TrendKeyword[] = [
  { keyword: "ツインレイ 2026", searchVolume: 48000, competition: "medium", trend: "rising", relatedTopics: ["ツインソウル", "魂の繋がり", "運命の相手"], monthlyChange: 35 },
  { keyword: "タロット 今日の運勢", searchVolume: 125000, competition: "high", trend: "stable", relatedTopics: ["カードリーディング", "毎日占い", "占術"], monthlyChange: 5 },
  { keyword: "エンジェルナンバー 444", searchVolume: 89000, competition: "medium", trend: "rising", relatedTopics: ["天使のメッセージ", "数字のサイン", "スピリチュアル覚醒"], monthlyChange: 22 },
  { keyword: "水星逆行 2026年3月", searchVolume: 67000, competition: "low", trend: "rising", relatedTopics: ["占星術", "惑星の影響", "逆行の過ごし方"], monthlyChange: 180 },
  { keyword: "エネルギー浄化 方法", searchVolume: 34000, competition: "low", trend: "rising", relatedTopics: ["セージ焚き", "クリスタルヒーリング", "邪気払い"], monthlyChange: 28 },
  { keyword: "前世リーディング", searchVolume: 56000, competition: "medium", trend: "stable", relatedTopics: ["転生", "アカシックレコード", "魂の旅"], monthlyChange: 3 },
  { keyword: "満月の儀式", searchVolume: 41000, competition: "low", trend: "rising", relatedTopics: ["月のフェーズ", "引き寄せ", "月のエネルギー"], monthlyChange: 45 },
  { keyword: "チャクラヒーリング音楽", searchVolume: 93000, competition: "high", trend: "stable", relatedTopics: ["瞑想音楽", "周波数ヒーリング", "528Hz"], monthlyChange: 2 },
  { keyword: "スピリチュアル覚醒 サイン", searchVolume: 78000, competition: "medium", trend: "rising", relatedTopics: ["アセンション", "意識の変容", "覚醒の兆候"], monthlyChange: 18 },
  { keyword: "引き寄せの法則 2026", searchVolume: 52000, competition: "medium", trend: "rising", relatedTopics: ["引き寄せ", "スクリプティング", "369メソッド"], monthlyChange: 42 },
];

// --- モックタイトルパターン ---
export const mockTitlePatterns: TitlePattern[] = [
  {
    pattern: "【緊急性】+ 星座/テーマ + 時期",
    examples: ["【必見】牡羊座 - 4月に人生が激変します", "【警告】魚座 今週大きな変化が来ます"],
    avgViews: 185000,
    frequency: 34,
  },
  {
    pattern: "疑問文 + 感情フック",
    examples: ["なぜ最近こう感じるの？宇宙からのメッセージです", "ツインレイは今あなたを想っている？"],
    avgViews: 142000,
    frequency: 28,
  },
  {
    pattern: "数字 + テーマ + メリット",
    examples: ["第三の目が開いている5つのサイン", "お金が来るエンジェルナンバー3選"],
    avgViews: 167000,
    frequency: 22,
  },
  {
    pattern: "カードを選んで + テーマ",
    examples: ["カードを選んで - 恋愛の未来は？", "クリスタルを選んで - スピリットガイドからのメッセージ"],
    avgViews: 210000,
    frequency: 18,
  },
  {
    pattern: "時期 + 占いの種類",
    examples: ["2026年3月 - 月間タロットリーディング", "今週のエネルギー - 全星座"],
    avgViews: 128000,
    frequency: 25,
  },
];

// --- 台本テンプレート ---
export const mockScriptTemplates: ScriptTemplate[] = [
  {
    id: "t1",
    name: "デイリータロットリーディング",
    description: "視聴者全員向けの毎日の短いリーディング",
    category: "タロット",
    structure: [
      { name: "フック・オープニング", duration: "0:00-0:30", description: "今日のエネルギーテーマで注目を集める", placeholder: "皆さんこんにちは！今日のエネルギーはとても特別です。カードがあなたに大切なメッセージを届けています..." },
      { name: "カード公開", duration: "0:30-3:00", description: "カードを公開し、解釈する", placeholder: "最初に引いたカードは【カード名】です。このカードが伝えているのは..." },
      { name: "詳細な解釈", duration: "3:00-8:00", description: "意味を深掘りし、生活への適用方法を説明", placeholder: "今のあなたの人生にとって、これが意味することは..." },
      { name: "具体的なアドバイス", duration: "8:00-10:00", description: "視聴者が実践できるアドバイス", placeholder: "今日おすすめしたいのは..." },
      { name: "クロージング・CTA", duration: "10:00-11:00", description: "まとめとエンゲージメント促進", placeholder: "このメッセージが響いた方は、ぜひコメントで教えてください。チャンネル登録とベルマークもお願いします..." },
    ],
  },
  {
    id: "t2",
    name: "カードを選んでリーディング",
    description: "視聴者参加型のピックアカード動画",
    category: "参加型",
    structure: [
      { name: "イントロダクション", duration: "0:00-1:00", description: "ピックアカードの説明と選択肢の紹介", placeholder: "こんにちは！今日は3つの山を用意しました。一瞬目を閉じて、直感で呼ばれる山を選んでください..." },
      { name: "山1のリーディング", duration: "1:00-5:00", description: "1つ目の山のリーディング", placeholder: "山1を選んだ方、あなたのカードは...ここでのメッセージは..." },
      { name: "山2のリーディング", duration: "5:00-9:00", description: "2つ目の山のリーディング", placeholder: "山2のエネルギーはまったく違います。カードが示すのは..." },
      { name: "山3のリーディング", duration: "9:00-13:00", description: "3つ目の山のリーディング", placeholder: "山3の方、パワフルなメッセージが来ています..." },
      { name: "クロージング", duration: "13:00-14:00", description: "まとめとエンゲージメント促進", placeholder: "どの山を選びましたか？コメントで教えてください。響いたかどうかもぜひ..." },
    ],
  },
  {
    id: "t3",
    name: "星座別マンスリー予報",
    description: "特定の星座の月間ホロスコープ",
    category: "占星術",
    structure: [
      { name: "月のオーバービュー", duration: "0:00-2:00", description: "月全体のエネルギーと主要な惑星の動き", placeholder: "【月】の予報へようこそ！今月は【惑星】が【星座】に移動するため..." },
      { name: "恋愛・人間関係", duration: "2:00-5:00", description: "恋愛運の予測", placeholder: "恋愛面では、【星座】の方は..." },
      { name: "仕事・お金", duration: "5:00-8:00", description: "仕事運・金運の予測", placeholder: "仕事面では、星の配置が..." },
      { name: "健康・セルフケア", duration: "8:00-10:00", description: "健康運とセルフケアのガイダンス", placeholder: "今月の健康面では、特に..." },
      { name: "重要な日付・まとめ", duration: "10:00-12:00", description: "重要な日付と最終アドバイス", placeholder: "カレンダーに入れてほしい日：【日付】は...今月の全体的なテーマは..." },
    ],
  },
  {
    id: "t4",
    name: "スピリチュアルトピック解説",
    description: "スピリチュアルテーマの教育コンテンツ",
    category: "教育系",
    structure: [
      { name: "フック", duration: "0:00-0:45", description: "注目を集める問いかけや発言", placeholder: "【現象】を経験したことはありますか？もしそうなら、それは驚くほどパワフルな意味があるんです..." },
      { name: "テーマの説明", duration: "0:45-3:00", description: "テーマの定義と解説", placeholder: "【テーマ】とは、スピリチュアルな概念で..." },
      { name: "サイン・兆候", duration: "3:00-7:00", description: "自分の人生でどう認識するか", placeholder: "【テーマ】があなたに起きているサインはこちら：まず..." },
      { name: "実践方法", duration: "7:00-11:00", description: "具体的なガイダンスとエクササイズ", placeholder: "このエネルギーを活用する方法：ステップ1..." },
      { name: "体験談・クロージング", duration: "11:00-13:00", description: "体験をシェアしCTAへ", placeholder: "私自身もこれを経験したのは...もっと知りたい方は..." },
    ],
  },
];

// --- ユーティリティ関数 ---
export function formatNumber(num: number): string {
  if (num >= 10000) return (num / 10000).toFixed(1) + "万";
  if (num >= 1000) return (num / 1000).toFixed(1) + "K";
  return num.toString();
}

export function getTrendColor(trend: string): string {
  switch (trend) {
    case "rising": return "text-success";
    case "stable": return "text-warning";
    case "declining": return "text-danger";
    default: return "text-foreground";
  }
}

export function getCompetitionColor(comp: string): string {
  switch (comp) {
    case "low": return "bg-green-100 text-green-800";
    case "medium": return "bg-yellow-100 text-yellow-800";
    case "high": return "bg-red-100 text-red-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

export function getTrendLabel(trend: string): string {
  switch (trend) {
    case "rising": return "上昇中";
    case "stable": return "安定";
    case "declining": return "下降中";
    default: return trend;
  }
}

export function getCompetitionLabel(comp: string): string {
  switch (comp) {
    case "low": return "低";
    case "medium": return "中";
    case "high": return "高";
    default: return comp;
  }
}
