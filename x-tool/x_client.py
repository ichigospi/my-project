"""
X (Twitter) API クライアント
tweepy を使った全API操作の共通ラッパー
"""

import tweepy
import time
from datetime import datetime, timedelta
from typing import Optional


class XClient:
    """X API v2 クライアント"""

    def __init__(self, config: dict):
        self.config = config
        api_conf = config["x_api"]

        # OAuth 1.0a (投稿用)
        self.auth = tweepy.OAuth1UserHandler(
            api_conf["api_key"],
            api_conf["api_secret"],
            api_conf["access_token"],
            api_conf["access_token_secret"],
        )

        # v2 Client (メイン)
        self.client = tweepy.Client(
            bearer_token=api_conf["bearer_token"],
            consumer_key=api_conf["api_key"],
            consumer_secret=api_conf["api_secret"],
            access_token=api_conf["access_token"],
            access_token_secret=api_conf["access_token_secret"],
            wait_on_rate_limit=True,
        )

        # v1.1 API (メディアアップロード用)
        self.api_v1 = tweepy.API(self.auth, wait_on_rate_limit=True)

    # --------------------------------------------------
    # 投稿
    # --------------------------------------------------
    def post_tweet(self, text: str, reply_to: Optional[str] = None) -> dict:
        """ツイートを投稿"""
        params = {"text": text}
        if reply_to:
            params["in_reply_to_tweet_id"] = reply_to
        response = self.client.create_tweet(**params)
        return response.data

    def delete_tweet(self, tweet_id: str) -> bool:
        """ツイートを削除"""
        self.client.delete_tweet(tweet_id)
        return True

    # --------------------------------------------------
    # ユーザー情報
    # --------------------------------------------------
    def get_user_by_username(self, username: str) -> dict:
        """ユーザー名からユーザー情報を取得"""
        response = self.client.get_user(
            username=username,
            user_fields=["public_metrics", "description", "created_at"],
        )
        return response.data

    def get_my_user(self) -> dict:
        """自分のユーザー情報を取得"""
        response = self.client.get_me(
            user_fields=["public_metrics", "description", "created_at"]
        )
        return response.data

    # --------------------------------------------------
    # タイムライン・ツイート取得
    # --------------------------------------------------
    def get_user_tweets(
        self, user_id: str, max_results: int = 100, days_back: int = 7
    ) -> list:
        """指定ユーザーの最近のツイートを取得"""
        start_time = datetime.utcnow() - timedelta(days=days_back)

        tweets = []
        paginator = tweepy.Paginator(
            self.client.get_users_tweets,
            id=user_id,
            max_results=min(max_results, 100),
            start_time=start_time.isoformat() + "Z",
            tweet_fields=[
                "public_metrics",
                "created_at",
                "context_annotations",
                "entities",
            ],
            exclude=["retweets"],
        )

        for page in paginator:
            if page.data:
                tweets.extend(page.data)
            if len(tweets) >= max_results:
                break

        return tweets[:max_results]

    def get_my_tweets(self, max_results: int = 100, days_back: int = 30) -> list:
        """自分のツイートを取得"""
        me = self.get_my_user()
        return self.get_user_tweets(me.id, max_results, days_back)

    def get_tweet_metrics(self, tweet_id: str) -> dict:
        """ツイートのメトリクスを取得"""
        response = self.client.get_tweet(
            tweet_id, tweet_fields=["public_metrics", "created_at", "text"]
        )
        return response.data

    # --------------------------------------------------
    # 検索
    # --------------------------------------------------
    def search_recent(
        self, query: str, max_results: int = 100, sort_order: str = "relevancy"
    ) -> list:
        """最近のツイートを検索"""
        tweets = []
        paginator = tweepy.Paginator(
            self.client.search_recent_tweets,
            query=query,
            max_results=min(max_results, 100),
            sort_order=sort_order,
            tweet_fields=[
                "public_metrics",
                "created_at",
                "author_id",
                "context_annotations",
            ],
        )

        for page in paginator:
            if page.data:
                tweets.extend(page.data)
            if len(tweets) >= max_results:
                break

        return tweets[:max_results]

    # --------------------------------------------------
    # トレンド
    # --------------------------------------------------
    def get_trends(self, woeid: int = 23424856) -> list:
        """トレンドを取得 (デフォルト: 日本)"""
        trends = self.api_v1.get_place_trends(woeid)
        return trends[0]["trends"] if trends else []

    # --------------------------------------------------
    # レートリミット対応ユーティリティ
    # --------------------------------------------------
    @staticmethod
    def safe_call(func, *args, max_retries: int = 3, **kwargs):
        """レートリミットを考慮したAPI呼び出し"""
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except tweepy.TooManyRequests:
                wait = 2 ** (attempt + 1)
                print(f"  レートリミット。{wait}秒待機...")
                time.sleep(wait)
            except tweepy.TwitterServerError:
                wait = 2 ** (attempt + 1)
                print(f"  サーバーエラー。{wait}秒待機...")
                time.sleep(wait)
        raise Exception("APIリトライ上限に達しました")
