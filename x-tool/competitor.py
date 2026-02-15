"""
競合分析モジュール
競合アカウントのポストを収集・分析する
"""

import json
import os
from datetime import datetime
from collections import Counter

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
COMPETITORS_FILE = os.path.join(DATA_DIR, "competitors.json")


class CompetitorAnalyzer:
    """競合のポストを収集・分析"""

    def __init__(self, x_client, config: dict):
        self.x = x_client
        self.config = config
        self.competitors = config.get("competitors", [])
        os.makedirs(DATA_DIR, exist_ok=True)

    # --------------------------------------------------
    # 収集
    # --------------------------------------------------
    def collect_all(self, days_back: int = 7, max_per_account: int = 50) -> dict:
        """全競合アカウントのポストを収集"""
        all_data = {}

        for comp in self.competitors:
            username = comp["username"]
            print(f"  収集中: @{username} ...")

            try:
                user = self.x.get_user_by_username(username)
                tweets = self.x.get_user_tweets(
                    user.id, max_results=max_per_account, days_back=days_back
                )

                posts = []
                for tw in tweets:
                    metrics = tw.public_metrics or {}
                    posts.append({
                        "id": str(tw.id),
                        "text": tw.text,
                        "created_at": tw.created_at.isoformat() if tw.created_at else "",
                        "likes": metrics.get("like_count", 0),
                        "retweets": metrics.get("retweet_count", 0),
                        "replies": metrics.get("reply_count", 0),
                        "impressions": metrics.get("impression_count", 0),
                        "engagement": (
                            metrics.get("like_count", 0)
                            + metrics.get("retweet_count", 0)
                            + metrics.get("reply_count", 0)
                        ),
                    })

                all_data[username] = {
                    "user_id": str(user.id),
                    "note": comp.get("note", ""),
                    "followers": user.public_metrics.get("followers_count", 0) if user.public_metrics else 0,
                    "collected_at": datetime.now().isoformat(),
                    "posts": sorted(posts, key=lambda x: x["engagement"], reverse=True),
                }

                print(f"    -> {len(posts)}件取得 (フォロワー: {all_data[username]['followers']:,})")

            except Exception as e:
                print(f"    -> エラー: {e}")
                all_data[username] = {"error": str(e)}

        # 保存
        self._save(all_data)
        return all_data

    # --------------------------------------------------
    # 分析
    # --------------------------------------------------
    def analyze(self, data: dict = None) -> dict:
        """収集済みデータを分析"""
        if data is None:
            data = self._load()

        if not data:
            return {"error": "データがありません。先に collect を実行してください。"}

        results = {
            "summary": {},
            "top_posts": [],
            "common_hashtags": [],
            "posting_patterns": {},
            "content_themes": [],
        }

        all_posts = []
        for username, info in data.items():
            if "error" in info:
                continue

            posts = info.get("posts", [])
            if not posts:
                continue

            avg_engagement = sum(p["engagement"] for p in posts) / len(posts) if posts else 0
            avg_likes = sum(p["likes"] for p in posts) / len(posts) if posts else 0

            results["summary"][username] = {
                "followers": info.get("followers", 0),
                "post_count": len(posts),
                "avg_engagement": round(avg_engagement, 1),
                "avg_likes": round(avg_likes, 1),
                "top_post_engagement": posts[0]["engagement"] if posts else 0,
            }

            for p in posts:
                p["username"] = username
            all_posts.extend(posts)

        # 全体のトップポスト
        all_posts.sort(key=lambda x: x["engagement"], reverse=True)
        results["top_posts"] = all_posts[:20]

        # ハッシュタグ分析
        hashtag_counter = Counter()
        for p in all_posts:
            text = p.get("text", "")
            tags = [
                word.strip("#＃")
                for word in text.split()
                if word.startswith("#") or word.startswith("＃")
            ]
            hashtag_counter.update(tags)
        results["common_hashtags"] = hashtag_counter.most_common(20)

        # 投稿時間帯分析
        hour_counter = Counter()
        for p in all_posts:
            if p.get("created_at"):
                try:
                    dt = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))
                    hour_counter[dt.hour] += 1
                except ValueError:
                    pass
        results["posting_patterns"] = dict(sorted(hour_counter.items()))

        return results

    def get_top_posts_for_generation(self, n: int = 10, data: dict = None) -> list:
        """ポスト生成の参考にするトップポストを取得"""
        if data is None:
            data = self._load()

        all_posts = []
        for username, info in data.items():
            if "error" in info:
                continue
            for p in info.get("posts", []):
                p["username"] = username
                all_posts.append(p)

        all_posts.sort(key=lambda x: x["engagement"], reverse=True)
        return all_posts[:n]

    # --------------------------------------------------
    # 保存・読込
    # --------------------------------------------------
    def _save(self, data: dict):
        with open(COMPETITORS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load(self) -> dict:
        if os.path.exists(COMPETITORS_FILE):
            with open(COMPETITORS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}
