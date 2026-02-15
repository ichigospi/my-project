"""
バズ監視モジュール
自分のポストのエンゲージメントを監視し、閾値を超えたら通知
"""

import json
import os
import time
import schedule as schedule_lib
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
BUZZ_LOG_FILE = os.path.join(DATA_DIR, "buzz_log.json")


class BuzzMonitor:
    """バズ検知 & 通知"""

    def __init__(self, x_client, notifier, config: dict):
        self.x = x_client
        self.notifier = notifier
        self.config = config

        buzz_conf = config.get("buzz_monitor", {})
        self.check_interval = buzz_conf.get("check_interval_minutes", 15)
        self.thresholds = buzz_conf.get("thresholds", {
            "likes": 100,
            "retweets": 30,
            "replies": 20,
            "impressions": 10000,
        })
        self.monitor_window = buzz_conf.get("monitor_window_hours", 24)

        # 既に通知済みのツイートIDを管理
        self.notified_ids = set()
        os.makedirs(DATA_DIR, exist_ok=True)
        self._load_notified()

    # --------------------------------------------------
    # 単発チェック
    # --------------------------------------------------
    def check_now(self) -> list:
        """現在のポストをチェックし、バズを検出"""
        print(f"  バズチェック中... (閾値: いいね>{self.thresholds['likes']}, "
              f"RT>{self.thresholds['retweets']}, "
              f"リプ>{self.thresholds['replies']})")

        try:
            my_tweets = self.x.get_my_tweets(
                max_results=50,
                days_back=max(1, self.monitor_window // 24)
            )
        except Exception as e:
            print(f"  ツイート取得エラー: {e}")
            return []

        buzzing = []
        for tw in my_tweets:
            if str(tw.id) in self.notified_ids:
                continue

            metrics = tw.public_metrics or {}
            reasons = self._check_thresholds(metrics)

            if reasons:
                buzz_info = {
                    "tweet_id": str(tw.id),
                    "text": tw.text,
                    "metrics": {
                        "like_count": metrics.get("like_count", 0),
                        "retweet_count": metrics.get("retweet_count", 0),
                        "reply_count": metrics.get("reply_count", 0),
                        "impression_count": metrics.get("impression_count", 0),
                    },
                    "reasons": reasons,
                    "detected_at": datetime.now().isoformat(),
                }

                buzzing.append(buzz_info)

                # 通知送信
                username = self.config.get("account", {}).get("username", "")
                url = f"https://x.com/{username}/status/{tw.id}"
                self.notifier.notify_buzz(tw.text, buzz_info["metrics"], url)

                # 通知済みに記録
                self.notified_ids.add(str(tw.id))

                print(f"  [バズ検知] {tw.text[:50]}...")
                for r in reasons:
                    print(f"    -> {r}")

        # ログ保存
        if buzzing:
            self._save_buzz_log(buzzing)
            self._save_notified()

        if not buzzing:
            print("  バズ検知なし")

        return buzzing

    def _check_thresholds(self, metrics: dict) -> list:
        """閾値チェック。超えた項目のリストを返す"""
        reasons = []

        if metrics.get("like_count", 0) >= self.thresholds.get("likes", 100):
            reasons.append(f"いいね: {metrics['like_count']} (閾値: {self.thresholds['likes']})")

        if metrics.get("retweet_count", 0) >= self.thresholds.get("retweets", 30):
            reasons.append(f"RT: {metrics['retweet_count']} (閾値: {self.thresholds['retweets']})")

        if metrics.get("reply_count", 0) >= self.thresholds.get("replies", 20):
            reasons.append(f"リプライ: {metrics['reply_count']} (閾値: {self.thresholds['replies']})")

        if metrics.get("impression_count", 0) >= self.thresholds.get("impressions", 10000):
            reasons.append(f"インプ: {metrics['impression_count']} (閾値: {self.thresholds['impressions']})")

        return reasons

    # --------------------------------------------------
    # 閾値変更
    # --------------------------------------------------
    def update_thresholds(self, likes: int = None, retweets: int = None,
                          replies: int = None, impressions: int = None):
        """閾値を動的に変更"""
        if likes is not None:
            self.thresholds["likes"] = likes
        if retweets is not None:
            self.thresholds["retweets"] = retweets
        if replies is not None:
            self.thresholds["replies"] = replies
        if impressions is not None:
            self.thresholds["impressions"] = impressions

        print(f"  閾値更新: {self.thresholds}")

    # --------------------------------------------------
    # デーモン
    # --------------------------------------------------
    def start_daemon(self):
        """定期的にバズチェックするデーモンを起動"""
        print(f"バズ監視デーモンを起動しました（{self.check_interval}分間隔）")
        print(f"閾値: {self.thresholds}")
        print("Ctrl+C で停止。\n")

        # 初回即実行
        self.check_now()

        schedule_lib.every(self.check_interval).minutes.do(self.check_now)

        try:
            while True:
                schedule_lib.run_pending()
                time.sleep(30)
        except KeyboardInterrupt:
            print("\nバズ監視を停止しました。")

    # --------------------------------------------------
    # 履歴
    # --------------------------------------------------
    def get_buzz_history(self) -> list:
        """過去のバズ検知履歴を取得"""
        if os.path.exists(BUZZ_LOG_FILE):
            with open(BUZZ_LOG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    # --------------------------------------------------
    # 保存・読込
    # --------------------------------------------------
    def _save_buzz_log(self, new_entries: list):
        existing = self.get_buzz_history()
        existing.extend(new_entries)
        with open(BUZZ_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

    def _save_notified(self):
        path = os.path.join(DATA_DIR, "notified_ids.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(list(self.notified_ids), f)

    def _load_notified(self):
        path = os.path.join(DATA_DIR, "notified_ids.json")
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                self.notified_ids = set(json.load(f))
