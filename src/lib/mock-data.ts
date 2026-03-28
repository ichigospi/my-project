// Mock data for development (replace with YouTube API integration)

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
  recentGrowth: number; // percentage
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

// --- Mock Channel Data ---
export const mockChannels: ChannelData[] = [
  {
    id: "ch1",
    name: "Miracle Fortune Channel",
    subscribers: 245000,
    totalViews: 48500000,
    videoCount: 523,
    avgViews: 92800,
    uploadFrequency: "Daily",
    category: "Tarot Reading",
    thumbnailUrl: "",
    recentGrowth: 12.5,
    topVideos: [
      {
        id: "v1", title: "Today's Fortune - What the Universe Wants to Tell You",
        views: 385000, likes: 12400, comments: 2100, publishedAt: "2026-03-25",
        duration: "15:32", thumbnailUrl: "", tags: ["tarot", "daily fortune", "universe message"],
        engagementRate: 3.77,
      },
      {
        id: "v2", title: "March Horoscope - Big Changes Coming for These Signs",
        views: 298000, likes: 9800, comments: 1650, publishedAt: "2026-03-01",
        duration: "22:15", thumbnailUrl: "", tags: ["horoscope", "march", "zodiac"],
        engagementRate: 3.84,
      },
    ],
  },
  {
    id: "ch2",
    name: "Spiritual Healing Room",
    subscribers: 189000,
    totalViews: 32100000,
    videoCount: 312,
    avgViews: 102900,
    uploadFrequency: "3x/week",
    category: "Spiritual Healing",
    thumbnailUrl: "",
    recentGrowth: 18.3,
    topVideos: [
      {
        id: "v3", title: "Cleansing Negative Energy - 10 Minute Guided Meditation",
        views: 520000, likes: 18200, comments: 3400, publishedAt: "2026-03-20",
        duration: "12:45", thumbnailUrl: "", tags: ["meditation", "energy cleanse", "healing"],
        engagementRate: 4.15,
      },
    ],
  },
  {
    id: "ch3",
    name: "Destiny Oracle",
    subscribers: 156000,
    totalViews: 25800000,
    videoCount: 445,
    avgViews: 57978,
    uploadFrequency: "5x/week",
    category: "Numerology & Oracle",
    thumbnailUrl: "",
    recentGrowth: 8.7,
    topVideos: [
      {
        id: "v4", title: "Your Birth Number Reveals Your 2026 - Detailed Analysis",
        views: 412000, likes: 15600, comments: 2800, publishedAt: "2026-01-05",
        duration: "28:10", thumbnailUrl: "", tags: ["numerology", "2026", "birth number"],
        engagementRate: 4.47,
      },
    ],
  },
  {
    id: "ch4",
    name: "Angel Message Daily",
    subscribers: 98000,
    totalViews: 15200000,
    videoCount: 678,
    avgViews: 22420,
    uploadFrequency: "Daily",
    category: "Angel Numbers",
    thumbnailUrl: "",
    recentGrowth: 22.1,
    topVideos: [
      {
        id: "v5", title: "Seeing 1111? Here's the Powerful Message Angels Send You",
        views: 289000, likes: 11200, comments: 1900, publishedAt: "2026-03-15",
        duration: "11:20", thumbnailUrl: "", tags: ["angel numbers", "1111", "spiritual signs"],
        engagementRate: 4.53,
      },
    ],
  },
  {
    id: "ch5",
    name: "Chakra Balance TV",
    subscribers: 134000,
    totalViews: 21300000,
    videoCount: 289,
    avgViews: 73700,
    uploadFrequency: "2x/week",
    category: "Chakra & Energy",
    thumbnailUrl: "",
    recentGrowth: 15.4,
    topVideos: [
      {
        id: "v6", title: "Third Eye Opening Meditation - Unlock Your Intuition",
        views: 445000, likes: 16800, comments: 2600, publishedAt: "2026-02-28",
        duration: "18:55", thumbnailUrl: "", tags: ["third eye", "chakra", "intuition"],
        engagementRate: 4.36,
      },
    ],
  },
];

// --- Mock Trend Keywords ---
export const mockTrendKeywords: TrendKeyword[] = [
  { keyword: "Twin Flame 2026", searchVolume: 48000, competition: "medium", trend: "rising", relatedTopics: ["Twin Soul", "Spiritual Connection", "Soulmate"], monthlyChange: 35 },
  { keyword: "Tarot Daily Reading", searchVolume: 125000, competition: "high", trend: "stable", relatedTopics: ["Card Reading", "Daily Fortune", "Divination"], monthlyChange: 5 },
  { keyword: "Angel Number 444", searchVolume: 89000, competition: "medium", trend: "rising", relatedTopics: ["Angel Message", "Number Signs", "Spiritual Awakening"], monthlyChange: 22 },
  { keyword: "Mercury Retrograde March 2026", searchVolume: 67000, competition: "low", trend: "rising", relatedTopics: ["Astrology", "Planet Influence", "Retrograde Guide"], monthlyChange: 180 },
  { keyword: "Energy Cleansing Method", searchVolume: 34000, competition: "low", trend: "rising", relatedTopics: ["Sage Burning", "Crystal Healing", "Negativity Removal"], monthlyChange: 28 },
  { keyword: "Past Life Reading", searchVolume: 56000, competition: "medium", trend: "stable", relatedTopics: ["Reincarnation", "Akashic Records", "Soul Journey"], monthlyChange: 3 },
  { keyword: "Full Moon Ritual", searchVolume: 41000, competition: "low", trend: "rising", relatedTopics: ["Moon Phase", "Manifestation", "Lunar Energy"], monthlyChange: 45 },
  { keyword: "Chakra Healing Music", searchVolume: 93000, competition: "high", trend: "stable", relatedTopics: ["Meditation Music", "Frequency Healing", "528Hz"], monthlyChange: 2 },
  { keyword: "Spiritual Awakening Signs", searchVolume: 78000, competition: "medium", trend: "rising", relatedTopics: ["Ascension", "Consciousness Shift", "Awakening Symptoms"], monthlyChange: 18 },
  { keyword: "Manifestation Technique 2026", searchVolume: 52000, competition: "medium", trend: "rising", relatedTopics: ["Law of Attraction", "Scripting", "369 Method"], monthlyChange: 42 },
];

// --- Mock Title Patterns ---
export const mockTitlePatterns: TitlePattern[] = [
  {
    pattern: "[Urgency] + [Zodiac/Topic] + [Time Period]",
    examples: ["Must Watch! Aries - Major Life Shift in April", "Warning! Pisces Big Change Coming This Week"],
    avgViews: 185000,
    frequency: 34,
  },
  {
    pattern: "[Question] + [Emotional Hook]",
    examples: ["Why Are You Feeling This Way? The Universe Has a Message", "Is Your Twin Flame Thinking of You Right Now?"],
    avgViews: 142000,
    frequency: 28,
  },
  {
    pattern: "[Number] + [Topic] + [Benefit]",
    examples: ["5 Signs Your Third Eye Is Opening", "3 Angel Numbers That Mean Money Is Coming"],
    avgViews: 167000,
    frequency: 22,
  },
  {
    pattern: "[Pick a Card] + [Topic]",
    examples: ["Pick a Card - What's Coming Next for Your Love Life", "Choose a Crystal - Your Message from Spirit Guides"],
    avgViews: 210000,
    frequency: 18,
  },
  {
    pattern: "[Timeframe] + [Reading Type]",
    examples: ["March 2026 - Full Month Tarot Reading", "This Week's Energy - All Signs"],
    avgViews: 128000,
    frequency: 25,
  },
];

// --- Script Templates ---
export const mockScriptTemplates: ScriptTemplate[] = [
  {
    id: "t1",
    name: "Daily Tarot Reading",
    description: "Short daily reading for all viewers",
    category: "Tarot",
    structure: [
      { name: "Hook / Opening", duration: "0:00-0:30", description: "Grab attention with today's energy theme", placeholder: "Hello everyone! Today's energy is really special. The cards have an important message for you..." },
      { name: "Card Reveal", duration: "0:30-3:00", description: "Reveal and interpret the cards", placeholder: "The first card I drew is [Card Name]. This card tells us that..." },
      { name: "Detailed Interpretation", duration: "3:00-8:00", description: "Deep dive into the meaning and how it applies", placeholder: "What this means for your life right now is..." },
      { name: "Actionable Advice", duration: "8:00-10:00", description: "Practical advice viewers can apply", placeholder: "Here's what I recommend you do today..." },
      { name: "Closing & CTA", duration: "10:00-11:00", description: "Wrap up and encourage engagement", placeholder: "If this message resonated with you, please leave a comment. Subscribe and hit the bell..." },
    ],
  },
  {
    id: "t2",
    name: "Pick a Card Reading",
    description: "Interactive pick-a-card style video",
    category: "Interactive",
    structure: [
      { name: "Introduction", duration: "0:00-1:00", description: "Explain the pick-a-card concept and choices", placeholder: "Welcome! Today we have 3 piles for you to choose from. Take a moment, close your eyes, and pick the pile that calls to you..." },
      { name: "Pile 1 Reading", duration: "1:00-5:00", description: "Reading for the first pile", placeholder: "If you chose Pile 1, your cards are... The message here is about..." },
      { name: "Pile 2 Reading", duration: "5:00-9:00", description: "Reading for the second pile", placeholder: "Pile 2 energy is very different. Your cards show..." },
      { name: "Pile 3 Reading", duration: "9:00-13:00", description: "Reading for the third pile", placeholder: "For Pile 3, we have a powerful message..." },
      { name: "Closing", duration: "13:00-14:00", description: "Summary and engagement prompt", placeholder: "Let me know in the comments which pile you chose and if it resonated..." },
    ],
  },
  {
    id: "t3",
    name: "Zodiac Monthly Forecast",
    description: "Monthly horoscope for specific zodiac signs",
    category: "Astrology",
    structure: [
      { name: "Monthly Overview", duration: "0:00-2:00", description: "General energy for the month and key planetary transits", placeholder: "Welcome to your [Month] forecast! This month we have [Planet] moving into [Sign], which means..." },
      { name: "Love & Relationships", duration: "2:00-5:00", description: "Love life predictions", placeholder: "In love, [Sign] can expect..." },
      { name: "Career & Finance", duration: "5:00-8:00", description: "Work and money predictions", placeholder: "Career-wise, the stars are aligning for..." },
      { name: "Health & Wellness", duration: "8:00-10:00", description: "Health and self-care guidance", placeholder: "For your wellbeing this month, focus on..." },
      { name: "Key Dates & Summary", duration: "10:00-12:00", description: "Important dates and final advice", placeholder: "Mark these dates on your calendar: [Date] for... The overall theme this month is..." },
    ],
  },
  {
    id: "t4",
    name: "Spiritual Topic Deep Dive",
    description: "Educational content about spiritual topics",
    category: "Education",
    structure: [
      { name: "Hook", duration: "0:00-0:45", description: "Provocative question or statement to grab attention", placeholder: "Have you ever experienced [phenomenon]? What if I told you it means something incredibly powerful..." },
      { name: "What It Is", duration: "0:45-3:00", description: "Define and explain the topic", placeholder: "[Topic] is a spiritual concept that..." },
      { name: "Signs & Symptoms", duration: "3:00-7:00", description: "How to recognize it in your life", placeholder: "Here are the key signs that [topic] is happening to you: First..." },
      { name: "How to Work With It", duration: "7:00-11:00", description: "Practical guidance and exercises", placeholder: "Here's how you can harness this energy: Step 1..." },
      { name: "Personal Story & Closing", duration: "11:00-13:00", description: "Share experience and call to action", placeholder: "I personally experienced this when... If you want to learn more, check out..." },
    ],
  },
];

// --- Utility functions ---
export function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
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
