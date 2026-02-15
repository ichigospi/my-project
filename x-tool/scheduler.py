"""
予約投稿管理モジュール
ポストの予約・キュー管理・自動投稿
"""

import json
import os
import time
import schedule as schedule_lib
from datetime import datetime, timedelta

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
SCHEDULE_FILE = os.path.join(DATA_DIR, "schedule.json")


class PostScheduler:
    """予約投稿の管理・自動実行"""

    def __init__(self, x_client, config: dict):
        self.x = x_client
        self.config = config
        self.schedule_conf = config.get("scheduler", {})
        self.post_times = self.schedule_conf.get("post_times", [])
        os.makedirs(DATA_DIR, exist_ok=True)

    # --------------------------------------------------
    # キュー管理
    # --------------------------------------------------
    def add_to_queue(self, text: str, scheduled_time: str = "") -> dict:
        """ポストを予約キューに追加
        scheduled_time: "2024-01-15 19:30" 形式。空なら次の投稿枠に自動割り当て
        """
        queue = self._load_queue()

        if not scheduled_time:
            scheduled_time = self._next_available_slot(queue)

        entry = {
            "id": len(queue) + 1,
            "text": text,
            "scheduled_time": scheduled_time,
            "status": "queued",  # queued / posted / failed / cancelled
            "created_at": datetime.now().isoformat(),
            "posted_at": None,
            "tweet_id": None,
        }

        queue.append(entry)
        self._save_queue(queue)
        return entry

    def remove_from_queue(self, entry_id: int) -> bool:
        """キューからポストを削除"""
        queue = self._load_queue()
        queue = [e for e in queue if e["id"] != entry_id]
        self._save_queue(queue)
        return True

    def get_queue(self, status: str = None) -> list:
        """キュー内容を取得"""
        queue = self._load_queue()
        if status:
            queue = [e for e in queue if e["status"] == status]
        return sorted(queue, key=lambda x: x["scheduled_time"])

    def get_upcoming(self, hours: int = 24) -> list:
        """今後N時間以内の予約ポストを取得"""
        now = datetime.now()
        cutoff = now + timedelta(hours=hours)
        queue = self.get_queue(status="queued")

        return [
            e for e in queue
            if now <= self._parse_time(e["scheduled_time"]) <= cutoff
        ]

    # --------------------------------------------------
    # 投稿実行
    # --------------------------------------------------
    def post_now(self, entry_id: int) -> dict:
        """指定IDのポストを即座に投稿"""
        queue = self._load_queue()

        for entry in queue:
            if entry["id"] == entry_id:
                return self._execute_post(entry, queue)

        return {"error": f"ID {entry_id} が見つかりません"}

    def process_due_posts(self) -> list:
        """予約時刻が来たポストを自動投稿"""
        queue = self._load_queue()
        now = datetime.now()
        posted = []

        for entry in queue:
            if entry["status"] != "queued":
                continue

            scheduled = self._parse_time(entry["scheduled_time"])
            # 予約時刻を1分以内に過ぎていたら投稿
            if scheduled <= now <= scheduled + timedelta(minutes=1):
                result = self._execute_post(entry, queue)
                posted.append(result)

        return posted

    def _execute_post(self, entry: dict, queue: list) -> dict:
        """実際にXに投稿"""
        try:
            result = self.x.post_tweet(entry["text"])
            entry["status"] = "posted"
            entry["posted_at"] = datetime.now().isoformat()
            entry["tweet_id"] = result.get("id", "")
            self._save_queue(queue)
            return {"success": True, "entry": entry}
        except Exception as e:
            entry["status"] = "failed"
            entry["error"] = str(e)
            self._save_queue(queue)
            return {"success": False, "error": str(e), "entry": entry}

    # --------------------------------------------------
    # 自動投稿デーモン
    # --------------------------------------------------
    def start_daemon(self):
        """定期的に予約ポストをチェック・投稿するデーモンを起動"""
        print("予約投稿デーモンを起動しました。Ctrl+C で停止。")
        print(f"投稿時間帯: {', '.join(self.post_times)}")

        # 毎分チェック
        schedule_lib.every(1).minutes.do(self._check_and_post)

        try:
            while True:
                schedule_lib.run_pending()
                time.sleep(30)
        except KeyboardInterrupt:
            print("\nデーモンを停止しました。")

    def _check_and_post(self):
        """予約ポストの投稿チェック"""
        posted = self.process_due_posts()
        for p in posted:
            if p.get("success"):
                print(f"  [投稿完了] {p['entry']['text'][:50]}...")
            else:
                print(f"  [投稿失敗] {p.get('error', '不明なエラー')}")

    # --------------------------------------------------
    # スロット計算
    # --------------------------------------------------
    def _next_available_slot(self, queue: list) -> str:
        """次に空いている投稿スロットを返す"""
        if not self.post_times:
            # 投稿時間未設定なら1時間後
            return (datetime.now() + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M")

        booked = {
            e["scheduled_time"]
            for e in queue
            if e["status"] == "queued"
        }

        now = datetime.now()
        for day_offset in range(0, 14):
            date = now + timedelta(days=day_offset)
            for time_str in sorted(self.post_times):
                slot = f"{date.strftime('%Y-%m-%d')} {time_str}"
                slot_dt = self._parse_time(slot)

                if slot_dt > now and slot not in booked:
                    return slot

        # フォールバック
        return (now + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M")

    # --------------------------------------------------
    # ユーティリティ
    # --------------------------------------------------
    @staticmethod
    def _parse_time(time_str: str) -> datetime:
        for fmt in ("%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(time_str, fmt)
            except ValueError:
                continue
        return datetime.now()

    def _load_queue(self) -> list:
        if os.path.exists(SCHEDULE_FILE):
            with open(SCHEDULE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []

    def _save_queue(self, queue: list):
        with open(SCHEDULE_FILE, "w", encoding="utf-8") as f:
            json.dump(queue, f, ensure_ascii=False, indent=2)
