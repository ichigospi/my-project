// X（Twitter）自動化ストア - localStorage ベース

export interface XAccountLocal {
  username: string;
  displayName: string;
  connected: boolean;
  connectedAt?: string;
}

export interface XPostLocal {
  id: string;
  content: string;
  type: "promotion" | "trend" | "daily" | "reply" | "thread" | "engagement";
  status: "draft" | "scheduled" | "posted" | "failed";
  scheduledAt?: string;
  postedAt?: string;
  tweetId?: string;
  impressions?: number;
  engagements?: number;
  likes?: number;
  retweets?: number;
  createdAt: string;
}

export interface XArticleLocal {
  id: string;
  title: string;
  content: string;
  sourceType: "script" | "trend" | "curated" | "from_script";
  format: "markdown" | "html";
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

export interface XSafetyConfigLocal {
  maxDailyPosts: number;
  minIntervalMinutes: number;
  maxDailyLinks: number;
  similarityThreshold: number;
  autoPostEnabled: boolean;
}

// ストレージキー
const KEYS = {
  account: "x_automation_account",
  posts: "x_automation_posts",
  articles: "x_automation_articles",
  safety: "x_automation_safety",
  apiKey: "x_api_bearer_token",
  clientId: "x_oauth_client_id",
  clientSecret: "x_oauth_client_secret",
} as const;

// ===== ユーティリティ =====
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// ===== アカウント =====
export function getXAccount(): XAccountLocal | null {
  if (!isBrowser()) return null;
  const stored = localStorage.getItem(KEYS.account);
  return stored ? JSON.parse(stored) : null;
}

export function saveXAccount(account: XAccountLocal): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.account, JSON.stringify(account));
}

export function removeXAccount(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(KEYS.account);
}

// ===== X API認証情報 =====
export function getXApiCredentials(): { clientId: string; clientSecret: string } {
  if (!isBrowser()) return { clientId: "", clientSecret: "" };
  return {
    clientId: localStorage.getItem(KEYS.clientId) || "",
    clientSecret: localStorage.getItem(KEYS.clientSecret) || "",
  };
}

export function setXApiCredentials(clientId: string, clientSecret: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.clientId, clientId);
  localStorage.setItem(KEYS.clientSecret, clientSecret);
}

export function getXBearerToken(): string {
  if (!isBrowser()) return "";
  return localStorage.getItem(KEYS.apiKey) || "";
}

export function setXBearerToken(token: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.apiKey, token);
}

// ===== 投稿管理 =====
export function getXPosts(): XPostLocal[] {
  if (!isBrowser()) return [];
  const stored = localStorage.getItem(KEYS.posts);
  return stored ? JSON.parse(stored) : [];
}

export function saveXPosts(posts: XPostLocal[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.posts, JSON.stringify(posts));
}

export function addXPost(post: Omit<XPostLocal, "id" | "createdAt">): XPostLocal {
  const posts = getXPosts();
  const newPost: XPostLocal = {
    ...post,
    id: genId(),
    createdAt: new Date().toISOString(),
  };
  posts.unshift(newPost);
  saveXPosts(posts);
  return newPost;
}

export function updateXPost(id: string, data: Partial<XPostLocal>): XPostLocal | null {
  const posts = getXPosts();
  const idx = posts.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  posts[idx] = { ...posts[idx], ...data };
  saveXPosts(posts);
  return posts[idx];
}

export function deleteXPost(id: string): void {
  const posts = getXPosts().filter((p) => p.id !== id);
  saveXPosts(posts);
}

// ===== 記事管理 =====
export function getXArticles(): XArticleLocal[] {
  if (!isBrowser()) return [];
  const stored = localStorage.getItem(KEYS.articles);
  return stored ? JSON.parse(stored) : [];
}

export function saveXArticles(articles: XArticleLocal[]): void {
  if (!isBrowser()) return;
  localStorage.setItem(KEYS.articles, JSON.stringify(articles));
}

export function addXArticle(article: Omit<XArticleLocal, "id" | "createdAt" | "updatedAt">): XArticleLocal {
  const articles = getXArticles();
  const now = new Date().toISOString();
  const newArticle: XArticleLocal = {
    ...article,
    id: genId(),
    createdAt: now,
    updatedAt: now,
  };
  articles.unshift(newArticle);
  saveXArticles(articles);
  return newArticle;
}

export function updateXArticle(id: string, data: Partial<XArticleLocal>): XArticleLocal | null {
  const articles = getXArticles();
  const idx = articles.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  articles[idx] = { ...articles[idx], ...data, updatedAt: new Date().toISOString() };
  saveXArticles(articles);
  return articles[idx];
}

export function deleteXArticle(id: string): void {
  const articles = getXArticles().filter((a) => a.id !== id);
  saveXArticles(articles);
}

// ===== 安全設定 =====
const DEFAULT_SAFETY: XSafetyConfigLocal = {
  maxDailyPosts: 10,
  minIntervalMinutes: 30,
  maxDailyLinks: 3,
  similarityThreshold: 0.8,
  autoPostEnabled: false,
};

export function getXSafetyConfig(): XSafetyConfigLocal {
  if (!isBrowser()) return DEFAULT_SAFETY;
  const stored = localStorage.getItem(KEYS.safety);
  return stored ? { ...DEFAULT_SAFETY, ...JSON.parse(stored) } : DEFAULT_SAFETY;
}

export function saveXSafetyConfig(config: Partial<XSafetyConfigLocal>): void {
  if (!isBrowser()) return;
  const current = getXSafetyConfig();
  localStorage.setItem(KEYS.safety, JSON.stringify({ ...current, ...config }));
}

// ===== 統計ヘルパー =====
export function getTodayPostCount(): number {
  const posts = getXPosts();
  const today = new Date().toISOString().slice(0, 10);
  return posts.filter(
    (p) => p.status === "posted" && p.postedAt && p.postedAt.slice(0, 10) === today
  ).length;
}

export function getLastPostTime(): Date | null {
  const posts = getXPosts().filter((p) => p.status === "posted" && p.postedAt);
  if (posts.length === 0) return null;
  posts.sort((a, b) => new Date(b.postedAt!).getTime() - new Date(a.postedAt!).getTime());
  return new Date(posts[0].postedAt!);
}
