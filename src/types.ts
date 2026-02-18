export interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author_id: string;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    impression_count?: number;
  };
  entities?: {
    hashtags?: { tag: string }[];
    urls?: { expanded_url: string; display_url: string }[];
    mentions?: { username: string }[];
  };
}

export interface User {
  id: string;
  name: string;
  username: string;
  description?: string;
  public_metrics?: {
    followers_count: number;
    following_count: number;
    tweet_count: number;
  };
}

export interface ApiResponse<T> {
  data?: T;
  includes?: {
    users?: User[];
  };
  meta?: {
    result_count: number;
    next_token?: string;
    newest_id?: string;
    oldest_id?: string;
  };
  errors?: { message: string; type: string }[];
}

export interface CollectOptions {
  max?: number;
  sinceId?: string;
  untilId?: string;
  startTime?: string;
  endTime?: string;
}

export interface SearchOptions extends CollectOptions {
  query: string;
}

export interface ExportFormat {
  type: "json" | "csv";
  path: string;
}
