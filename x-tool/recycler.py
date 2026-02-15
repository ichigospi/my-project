"""
コンテンツリサイクラーモジュール
過去の高エンゲージメント投稿を分析し、再投稿候補を提案
"""

import json
import os
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
ANALYTICS_FILE = os.path.join(DATA_DIR, "analytics.json")
RECYCLE_LOG_FILE = os.path.join(DATA_DIR, "recycle_log.json")


class ContentRecycler:
    """過去のバズ投稿をリサイクル"""

    def __init__(self, x_client, config: dict):
        self.x = x_client
        self.config = config

        recycler_conf = config.get("recycler", {})
        self.min_days_ago = recycler_conf.get("min_days_ago", 90)
        self.top_n = recycler_conf.get("top_n", 20)
        self.reuse_cooldown = recycler_conf.get("reuse_cooldown_days", 60)
        os.makedirs(DATA_DIR, exist_ok=True)

    # --------------------------------------------------
    # 自分の投稿を収集・保存
    # --------------------------------------------------
    def collect_my_posts(self, days_back: int = 180, max_results: int = 200) -> list:
        """自分の過去の投稿を収集してローカルに保存"""
        print(f"  過去{days_back}日分の投稿を収集中...")

        try:
            tweets = self.x.get_my_tweets(max_results=max_results, days_back=days_back)
        except Exception as e:
            print(f"  取得エラー: {e}")
            return []

        posts = []
        for tw in tweets:
            metrics = tw.public_metrics or {}
            engagement = (
                metrics.get("like_count", 0)
                + metrics.get("retweet_count", 0)
                + metrics.get("reply_count", 0)
            )
            posts.append({
                "id": str(tw.id),
                "text": tw.text,
                "created_at": tw.created_at.isoformat() if tw.created_at else "",
                "likes": metrics.get("like_count", 0),
                "retweets": metrics.get("retweet_count", 0),
                "replies": metrics.get("reply_count", 0),
                "impressions": metrics.get("impression_count", 0),
                "engagement": engagement,
            })

        # 保存
        analytics = self._load_analytics()
        analytics["my_posts"] = posts
        analytics["collected_at"] = datetime.now().isoformat()
        self._save_analytics(analytics)

        print(f"  -> {len(posts)}件取得・保存しました")
        return posts

    # --------------------------------------------------
    # リサイクル候補を抽出
    # --------------------------------------------------
    def get_recycle_candidates(self) -> list:
        """リサイクル候補を取得"""
        analytics = self._load_analytics()
        posts = analytics.get("my_posts", [])

        if not posts:
            print("  データがありません。先に collect を実行してください。")
            return []

        now = datetime.now()
        recycle_log = self._load_recycle_log()
        recycled_ids = {
            entry["original_id"]
            for entry in recycle_log
            if (now - datetime.fromisoformat(entry["recycled_at"])).days < self.reuse_cooldown
        }

        candidates = []
        for post in posts:
            # 投稿日チェック（古すぎないか & 新しすぎないか）
            if not post.get("created_at"):
                continue

            try:
                post_date = datetime.fromisoformat(post["created_at"].replace("Z", "+00:00"))
                days_ago = (now - post_date.replace(tzinfo=None)).days
            except (ValueError, TypeError):
                continue

            if days_ago < self.min_days_ago:
                continue  # まだ新しすぎる

            # 再利用クールダウンチェック
            if post["id"] in recycled_ids:
                continue

            candidates.append({
                **post,
                "days_ago": days_ago,
                "recycle_score": self._calc_recycle_score(post, days_ago),
            })

        # スコア順にソート
        candidates.sort(key=lambda x: x["recycle_score"], reverse=True)
        return candidates[:self.top_n]

    def _calc_recycle_score(self, post: dict, days_ago: int) -> float:
        """リサイクルスコアを計算（高いほどリサイクル向き）"""
        engagement = post.get("engagement", 0)
        likes = post.get("likes", 0)

        # エンゲージメントが高いほど高スコア
        score = engagement * 1.0

        # いいねが多いほどボーナス
        score += likes * 0.5

        # 適度に古いほうがリサイクル向き（3-6ヶ月前がベスト）
        if 90 <= days_ago <= 180:
            score *= 1.2
        elif days_ago > 365:
            score *= 0.7

        return round(score, 1)

    def mark_as_recycled(self, original_id: str):
        """リサイクル使用済みとしてマーク"""
        log = self._load_recycle_log()
        log.append({
            "original_id": original_id,
            "recycled_at": datetime.now().isoformat(),
        })
        self._save_recycle_log(log)

    # --------------------------------------------------
    # 保存・読込
    # --------------------------------------------------
    def _load_analytics(self) -> dict:
        if os.path.exists(ANALYTICS_FILE):
            with open(ANALYTICS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return {}

    def _save_analytics(self, data: dict):
        with open(ANALYTICS_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_recycle_log(self) -> list:
        if os.path.exists(RECYCLE_LOG_FILE):
            with open(RECYCLE_LOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def _save_recycle_log(self, data: list):
        with open(RECYCLE_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
