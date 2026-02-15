"""
改善提案モジュール
エンゲージメントデータをもとに改善提案を生成
"""

import json
import os
from datetime import datetime
from collections import Counter
from openai import OpenAI

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
ANALYTICS_FILE = os.path.join(DATA_DIR, "analytics.json")


class InsightsEngine:
    """エンゲージメント分析 & 改善提案"""

    def __init__(self, x_client, config: dict, competitor_analyzer=None):
        self.x = x_client
        self.config = config
        self.competitor = competitor_analyzer

        openai_conf = config.get("openai", {})
        self.openai_client = OpenAI(api_key=openai_conf.get("api_key", ""))
        self.model = openai_conf.get("model", "gpt-4o-mini")

        insights_conf = config.get("insights", {})
        self.analysis_period = insights_conf.get("analysis_period_days", 30)
        os.makedirs(DATA_DIR, exist_ok=True)

    # --------------------------------------------------
    # データ分析
    # --------------------------------------------------
    def analyze_my_performance(self) -> dict:
        """自分のポストのパフォーマンスを分析"""
        print("  自分の投稿パフォーマンスを分析中...")

        try:
            tweets = self.x.get_my_tweets(
                max_results=100, days_back=self.analysis_period
            )
        except Exception as e:
            return {"error": f"データ取得エラー: {e}"}

        if not tweets:
            return {"error": "分析対象の投稿がありません"}

        posts = []
        for tw in tweets:
            metrics = tw.public_metrics or {}
            engagement = (
                metrics.get("like_count", 0)
                + metrics.get("retweet_count", 0)
                + metrics.get("reply_count", 0)
            )
            posts.append({
                "text": tw.text,
                "created_at": tw.created_at.isoformat() if tw.created_at else "",
                "likes": metrics.get("like_count", 0),
                "retweets": metrics.get("retweet_count", 0),
                "replies": metrics.get("reply_count", 0),
                "impressions": metrics.get("impression_count", 0),
                "engagement": engagement,
                "hour": tw.created_at.hour if tw.created_at else 0,
            })

        # 集計
        total_posts = len(posts)
        avg_likes = sum(p["likes"] for p in posts) / total_posts
        avg_retweets = sum(p["retweets"] for p in posts) / total_posts
        avg_replies = sum(p["replies"] for p in posts) / total_posts
        avg_engagement = sum(p["engagement"] for p in posts) / total_posts

        # トップ / ワースト
        posts_sorted = sorted(posts, key=lambda x: x["engagement"], reverse=True)
        top_5 = posts_sorted[:5]
        worst_5 = posts_sorted[-5:]

        # 時間帯別パフォーマンス
        hour_data = {}
        for p in posts:
            h = p["hour"]
            if h not in hour_data:
                hour_data[h] = {"count": 0, "total_engagement": 0}
            hour_data[h]["count"] += 1
            hour_data[h]["total_engagement"] += p["engagement"]

        best_hours = sorted(
            [
                {"hour": h, "avg_engagement": d["total_engagement"] / d["count"]}
                for h, d in hour_data.items()
                if d["count"] >= 2
            ],
            key=lambda x: x["avg_engagement"],
            reverse=True,
        )

        # ハッシュタグ効果
        hashtag_engagement = {}
        for p in posts:
            tags = [
                w.strip("#＃")
                for w in p["text"].split()
                if w.startswith("#") or w.startswith("＃")
            ]
            for tag in tags:
                if tag not in hashtag_engagement:
                    hashtag_engagement[tag] = {"count": 0, "total_engagement": 0}
                hashtag_engagement[tag]["count"] += 1
                hashtag_engagement[tag]["total_engagement"] += p["engagement"]

        effective_hashtags = sorted(
            [
                {"tag": tag, "avg_engagement": d["total_engagement"] / d["count"], "count": d["count"]}
                for tag, d in hashtag_engagement.items()
                if d["count"] >= 2
            ],
            key=lambda x: x["avg_engagement"],
            reverse=True,
        )[:10]

        return {
            "period_days": self.analysis_period,
            "total_posts": total_posts,
            "averages": {
                "likes": round(avg_likes, 1),
                "retweets": round(avg_retweets, 1),
                "replies": round(avg_replies, 1),
                "engagement": round(avg_engagement, 1),
            },
            "top_5": top_5,
            "worst_5": worst_5,
            "best_hours": best_hours[:5],
            "effective_hashtags": effective_hashtags,
        }

    # --------------------------------------------------
    # AI改善提案
    # --------------------------------------------------
    def generate_suggestions(self, performance: dict = None) -> str:
        """パフォーマンスデータをもとにAIで改善提案を生成"""
        if performance is None:
            performance = self.analyze_my_performance()

        if "error" in performance:
            return performance["error"]

        # 競合データも取得
        competitor_summary = ""
        if self.competitor:
            comp_data = self.competitor.analyze()
            if "summary" in comp_data:
                competitor_summary = json.dumps(comp_data["summary"], ensure_ascii=False, indent=2)

        # トレンド取得
        trends_text = ""
        try:
            trends = self.x.get_trends()
            if trends:
                trends_text = "現在のXトレンド（日本）:\n" + "\n".join(
                    f"- {t['name']}" for t in trends[:15]
                )
        except Exception:
            pass

        # プロンプト構築
        niche = self.config.get("account", {}).get("niche", "")
        prompt = (
            "あなたはSNSマーケティングの専門家です。以下のデータを分析して、具体的な改善提案をしてください。\n\n"
            f"【アカウントのジャンル】\n{niche}\n\n"
            f"【過去{performance['period_days']}日間のパフォーマンス】\n"
            f"- 投稿数: {performance['total_posts']}\n"
            f"- 平均いいね: {performance['averages']['likes']}\n"
            f"- 平均RT: {performance['averages']['retweets']}\n"
            f"- 平均リプライ: {performance['averages']['replies']}\n"
            f"- 平均エンゲージメント: {performance['averages']['engagement']}\n\n"
            f"【トップ5投稿の共通点】\n"
        )

        for i, p in enumerate(performance.get("top_5", [])[:5], 1):
            prompt += f"{i}. ({p['likes']}いいね) {p['text'][:80]}...\n"

        prompt += f"\n【ワースト5投稿】\n"
        for i, p in enumerate(performance.get("worst_5", [])[:5], 1):
            prompt += f"{i}. ({p['likes']}いいね) {p['text'][:80]}...\n"

        if performance.get("best_hours"):
            prompt += f"\n【反応が良い投稿時間帯】\n"
            for h in performance["best_hours"][:3]:
                prompt += f"- {h['hour']}時台 (平均エンゲージメント: {h['avg_engagement']:.1f})\n"

        if performance.get("effective_hashtags"):
            prompt += f"\n【効果的なハッシュタグ】\n"
            for t in performance["effective_hashtags"][:5]:
                prompt += f"- #{t['tag']} (平均エンゲージメント: {t['avg_engagement']:.1f}, 使用回数: {t['count']})\n"

        if competitor_summary:
            prompt += f"\n【競合アカウントの状況】\n{competitor_summary}\n"

        if trends_text:
            prompt += f"\n{trends_text}\n"

        prompt += (
            "\n以下の観点で具体的に提案してください:\n"
            "1. コンテンツの方向性（何をもっと投稿すべきか / 減らすべきか）\n"
            "2. 投稿のタイミング（いつ投稿すると効果的か）\n"
            "3. ハッシュタグ戦略\n"
            "4. エンゲージメントを上げるための具体的なテクニック\n"
            "5. 今のトレンドに乗っかる方法（あれば）\n"
            "6. 競合との差別化ポイント（競合データがあれば）\n"
        )

        response = self.openai_client.chat.completions.create(
            model=self.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )

        return response.choices[0].message.content

    # --------------------------------------------------
    # レポート生成
    # --------------------------------------------------
    def generate_weekly_report(self) -> str:
        """週次レポートを生成"""
        performance = self.analyze_my_performance()
        if "error" in performance:
            return performance["error"]

        suggestions = self.generate_suggestions(performance)

        report = (
            f"{'='*50}\n"
            f" X運用 週次レポート ({datetime.now().strftime('%Y/%m/%d')})\n"
            f"{'='*50}\n\n"
            f"[サマリー]\n"
            f"  投稿数: {performance['total_posts']}\n"
            f"  平均いいね: {performance['averages']['likes']}\n"
            f"  平均RT: {performance['averages']['retweets']}\n"
            f"  平均エンゲージメント: {performance['averages']['engagement']}\n\n"
            f"[トップ投稿]\n"
        )

        for i, p in enumerate(performance.get("top_5", [])[:3], 1):
            report += f"  {i}. ({p['likes']}いいね) {p['text'][:60]}...\n"

        report += f"\n[改善提案]\n{suggestions}\n"

        return report
