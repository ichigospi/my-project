"""
通知モジュール
LINE Notify / Chatwork への通知送信
"""

import requests


class Notifier:
    """LINE / Chatwork 通知"""

    def __init__(self, config: dict):
        self.config = config
        self.line_conf = config.get("notifications", {}).get("line", {})
        self.chatwork_conf = config.get("notifications", {}).get("chatwork", {})

    # --------------------------------------------------
    # LINE Notify
    # --------------------------------------------------
    def send_line(self, message: str) -> bool:
        """LINE Notifyで通知を送信"""
        if not self.line_conf.get("enabled"):
            return False

        token = self.line_conf.get("access_token", "")
        if not token:
            print("  [LINE] アクセストークンが未設定です")
            return False

        url = "https://notify-api.line.me/api/notify"
        headers = {"Authorization": f"Bearer {token}"}
        data = {"message": message}

        try:
            resp = requests.post(url, headers=headers, data=data, timeout=10)
            if resp.status_code == 200:
                return True
            else:
                print(f"  [LINE] 送信失敗: {resp.status_code} {resp.text}")
                return False
        except requests.RequestException as e:
            print(f"  [LINE] 通信エラー: {e}")
            return False

    # --------------------------------------------------
    # Chatwork
    # --------------------------------------------------
    def send_chatwork(self, message: str) -> bool:
        """Chatworkに通知を送信"""
        if not self.chatwork_conf.get("enabled"):
            return False

        token = self.chatwork_conf.get("api_token", "")
        room_id = self.chatwork_conf.get("room_id", "")
        if not token or not room_id:
            print("  [Chatwork] APIトークンまたはルームIDが未設定です")
            return False

        url = f"https://api.chatwork.com/v2/rooms/{room_id}/messages"
        headers = {"X-ChatWorkToken": token}
        data = {"body": message}

        try:
            resp = requests.post(url, headers=headers, data=data, timeout=10)
            if resp.status_code == 200:
                return True
            else:
                print(f"  [Chatwork] 送信失敗: {resp.status_code} {resp.text}")
                return False
        except requests.RequestException as e:
            print(f"  [Chatwork] 通信エラー: {e}")
            return False

    # --------------------------------------------------
    # 共通
    # --------------------------------------------------
    def notify(self, message: str) -> dict:
        """有効な全チャンネルに通知を送信"""
        results = {}

        if self.line_conf.get("enabled"):
            results["line"] = self.send_line(message)

        if self.chatwork_conf.get("enabled"):
            results["chatwork"] = self.send_chatwork(message)

        if not results:
            print("  通知先が未設定です。config.yaml で設定してください。")

        return results

    def notify_buzz(self, tweet_text: str, metrics: dict, url: str) -> dict:
        """バズ検知通知のフォーマット済み送信"""
        message = (
            f"\n{'='*30}\n"
            f"[バズ検知]\n"
            f"{'='*30}\n\n"
            f"{tweet_text[:100]}{'...' if len(tweet_text) > 100 else ''}\n\n"
            f"いいね: {metrics.get('like_count', 0)}\n"
            f"RT: {metrics.get('retweet_count', 0)}\n"
            f"リプライ: {metrics.get('reply_count', 0)}\n"
            f"インプレッション: {metrics.get('impression_count', 0)}\n\n"
            f"URL: {url}"
        )
        return self.notify(message)
