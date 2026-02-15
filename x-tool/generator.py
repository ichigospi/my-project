"""
ポスト自動生成モジュール
競合分析 + アカウントの口調でポストを生成する
"""

import json
import os
from datetime import datetime
from openai import OpenAI

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
POSTS_FILE = os.path.join(DATA_DIR, "posts.json")


class PostGenerator:
    """競合分析をもとにポストを自動生成"""

    def __init__(self, config: dict, competitor_analyzer=None):
        self.config = config
        self.competitor = competitor_analyzer

        openai_conf = config.get("openai", {})
        self.openai_client = OpenAI(api_key=openai_conf.get("api_key", ""))
        self.model = openai_conf.get("model", "gpt-4o-mini")

        self.account = config.get("account", {})
        os.makedirs(DATA_DIR, exist_ok=True)

    # --------------------------------------------------
    # ポスト生成
    # --------------------------------------------------
    def generate(
        self,
        topic: str = "",
        count: int = 3,
        use_competitor_data: bool = True,
        custom_instruction: str = "",
    ) -> list:
        """ポストを生成"""

        # 競合のトップポストを参考情報として取得
        reference_posts = ""
        if use_competitor_data and self.competitor:
            top_posts = self.competitor.get_top_posts_for_generation(n=10)
            if top_posts:
                reference_posts = "\n\n".join(
                    f"[@{p['username']}] (いいね:{p['likes']}, RT:{p['retweets']})\n{p['text']}"
                    for p in top_posts[:10]
                )

        # システムプロンプト
        system_prompt = self._build_system_prompt()

        # ユーザープロンプト
        user_prompt = self._build_user_prompt(
            topic, count, reference_posts, custom_instruction
        )

        # API呼び出し
        response = self.openai_client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.8,
        )

        raw_text = response.choices[0].message.content
        posts = self._parse_posts(raw_text)

        # 保存
        self._save_generated(posts, topic)

        return posts

    def generate_from_recycled(self, original_post: dict) -> list:
        """過去のバズ投稿をリサイクルして新しいポストを生成"""
        system_prompt = self._build_system_prompt()

        user_prompt = (
            "以下は過去にバズった投稿です。これをベースに、内容を新鮮にアレンジした新しいポストを3案作ってください。\n"
            "同じことを言いつつも、表現や切り口を変えて新鮮に見えるようにしてください。\n\n"
            f"--- 元のポスト ---\n{original_post['text']}\n"
            f"(いいね: {original_post.get('likes', 0)}, RT: {original_post.get('retweets', 0)})\n\n"
            "---\n"
            "各ポストは280文字以内で、「---」で区切って出力してください。"
        )

        response = self.openai_client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.8,
        )

        raw_text = response.choices[0].message.content
        return self._parse_posts(raw_text)

    # --------------------------------------------------
    # プロンプト構築
    # --------------------------------------------------
    def _build_system_prompt(self) -> str:
        tone = self.account.get("tone", "")
        niche = self.account.get("niche", "")
        hashtags = self.account.get("default_hashtags", [])

        return (
            "あなたはX (Twitter) のポストを作成するプロの運用担当者です。\n\n"
            f"【アカウント情報】\n"
            f"- ジャンル: {niche}\n"
            f"- 口調・トーン: {tone}\n"
            f"- 定型ハッシュタグ: {', '.join('#' + t for t in hashtags)}\n\n"
            "【ルール】\n"
            "- 280文字以内で書く\n"
            "- 改行を適切に使い読みやすくする\n"
            "- ハッシュタグは自然に2〜4個入れる\n"
            "- エンゲージメントが高くなるよう工夫する（共感・問いかけ・有益な情報）\n"
            "- 競合の投稿を参考にしつつ、パクリにならないようオリジナリティを出す\n"
            "- 各ポストは「---」で区切る\n"
        )

    def _build_user_prompt(
        self,
        topic: str,
        count: int,
        reference_posts: str,
        custom_instruction: str,
    ) -> str:
        parts = [f"{count}案のポストを作成してください。"]

        if topic:
            parts.append(f"\n【テーマ】\n{topic}")

        if reference_posts:
            parts.append(
                f"\n【競合の人気ポスト（参考）】\n{reference_posts}\n\n"
                "上記を参考に、同じジャンルでバズりやすい内容を考えてください。"
                "ただし、内容をコピーせず、オリジナルの切り口で書いてください。"
            )

        if custom_instruction:
            parts.append(f"\n【追加指示】\n{custom_instruction}")

        parts.append(
            "\n各ポストは280文字以内にして、「---」で区切って出力してください。"
        )

        return "\n".join(parts)

    # --------------------------------------------------
    # パース
    # --------------------------------------------------
    @staticmethod
    def _parse_posts(raw_text: str) -> list:
        """生成テキストを個別ポストに分割"""
        # 「---」区切り or 番号付きリスト対応
        if "---" in raw_text:
            parts = raw_text.split("---")
        else:
            parts = [raw_text]

        posts = []
        for part in parts:
            text = part.strip()
            # 番号プレフィックス除去
            for prefix in ["1.", "2.", "3.", "4.", "5.", "案1", "案2", "案3", "案4", "案5"]:
                if text.startswith(prefix):
                    text = text[len(prefix):].strip()

            if text and len(text) > 10:
                posts.append({
                    "text": text,
                    "char_count": len(text),
                    "generated_at": datetime.now().isoformat(),
                    "status": "draft",
                })

        return posts

    # --------------------------------------------------
    # 保存
    # --------------------------------------------------
    def _save_generated(self, posts: list, topic: str):
        existing = []
        if os.path.exists(POSTS_FILE):
            with open(POSTS_FILE, "r", encoding="utf-8") as f:
                existing = json.load(f)

        for p in posts:
            p["topic"] = topic
        existing.extend(posts)

        with open(POSTS_FILE, "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)

    def load_generated(self) -> list:
        """生成済みポスト一覧を読み込み"""
        if os.path.exists(POSTS_FILE):
            with open(POSTS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        return []
