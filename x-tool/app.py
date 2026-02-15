#!/usr/bin/env python3
"""
X自動運用ツール - Webダッシュボード
Flask で管理画面を提供する
"""

import os
import json
import yaml
import threading
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for

from x_client import XClient
from competitor import CompetitorAnalyzer
from generator import PostGenerator
from scheduler import PostScheduler
from buzz_monitor import BuzzMonitor
from recycler import ContentRecycler
from insights import InsightsEngine
from notifier import Notifier

app = Flask(__name__)

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

# デーモンスレッド管理
_daemons = {"buzz": None, "scheduler": None}


def load_config():
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_config(config):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False)


def api_ready(config):
    x = config.get("x_api", {})
    return bool(x.get("bearer_token") and x.get("api_key"))


# ============================================================
# ページルーティング
# ============================================================

@app.route("/")
def index():
    """ダッシュボード（トップ）"""
    config = load_config()
    stats = _get_stats(config)
    return render_template("dashboard.html", page="dashboard", config=config, stats=stats)


@app.route("/competitor")
def competitor_page():
    """競合分析ページ"""
    config = load_config()
    data = _load_json("competitors.json")
    return render_template("dashboard.html", page="competitor", config=config, comp_data=data)


@app.route("/generate")
def generate_page():
    """ポスト生成ページ"""
    config = load_config()
    posts = _load_json("posts.json", default=[])
    return render_template("dashboard.html", page="generate", config=config, posts=posts)


@app.route("/schedule")
def schedule_page():
    """予約投稿ページ"""
    config = load_config()
    queue = _load_json("schedule.json", default=[])
    return render_template("dashboard.html", page="schedule", config=config, queue=queue)


@app.route("/buzz")
def buzz_page():
    """バズ監視ページ"""
    config = load_config()
    history = _load_json("buzz_log.json", default=[])
    return render_template("dashboard.html", page="buzz", config=config, buzz_history=history)


@app.route("/recycle")
def recycle_page():
    """リサイクルページ"""
    config = load_config()
    analytics = _load_json("analytics.json")
    return render_template("dashboard.html", page="recycle", config=config, analytics=analytics)


@app.route("/insights")
def insights_page():
    """改善提案ページ"""
    config = load_config()
    return render_template("dashboard.html", page="insights", config=config)


@app.route("/settings")
def settings_page():
    """設定ページ"""
    config = load_config()
    return render_template("dashboard.html", page="settings", config=config)


# ============================================================
# API エンドポイント
# ============================================================

@app.route("/api/competitor/collect", methods=["POST"])
def api_competitor_collect():
    """競合ポスト収集"""
    config = load_config()
    if not api_ready(config):
        return jsonify({"error": "APIキーが未設定です"}), 400

    days = request.json.get("days", 7) if request.is_json else 7

    try:
        x = XClient(config)
        analyzer = CompetitorAnalyzer(x, config)
        data = analyzer.collect_all(days_back=days)

        result = {}
        for username, info in data.items():
            if "error" in info:
                result[username] = {"error": info["error"]}
            else:
                posts = info.get("posts", [])
                result[username] = {
                    "followers": info.get("followers", 0),
                    "post_count": len(posts),
                    "avg_engagement": round(
                        sum(p["engagement"] for p in posts) / len(posts), 1
                    ) if posts else 0,
                }

        return jsonify({"success": True, "data": result})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/competitor/analyze", methods=["POST"])
def api_competitor_analyze():
    """競合分析"""
    config = load_config()
    try:
        x = XClient(config)
        analyzer = CompetitorAnalyzer(x, config)
        results = analyzer.analyze()
        return jsonify({"success": True, "data": results})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate", methods=["POST"])
def api_generate():
    """ポスト生成"""
    config = load_config()
    if not config.get("openai", {}).get("api_key"):
        return jsonify({"error": "OpenAI APIキーが未設定です"}), 400

    data = request.json or {}
    topic = data.get("topic", "")
    count = data.get("count", 3)
    instruction = data.get("instruction", "")
    use_competitor = data.get("use_competitor", True)

    try:
        x = XClient(config) if api_ready(config) else None
        comp = CompetitorAnalyzer(x, config) if x and use_competitor else None
        gen = PostGenerator(config, comp)

        posts = gen.generate(
            topic=topic,
            count=count,
            use_competitor_data=use_competitor and comp is not None,
            custom_instruction=instruction,
        )

        return jsonify({"success": True, "posts": posts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/generate/recycle", methods=["POST"])
def api_generate_recycle():
    """リサイクルポスト生成"""
    config = load_config()
    data = request.json or {}
    original = data.get("original_post", {})

    try:
        gen = PostGenerator(config)
        posts = gen.generate_from_recycled(original)
        return jsonify({"success": True, "posts": posts})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/add", methods=["POST"])
def api_schedule_add():
    """予約キューに追加"""
    config = load_config()
    data = request.json or {}
    text = data.get("text", "")
    scheduled_time = data.get("scheduled_time", "")

    if not text:
        return jsonify({"error": "テキストが空です"}), 400

    try:
        x = XClient(config) if api_ready(config) else None
        scheduler = PostScheduler(x, config)
        entry = scheduler.add_to_queue(text, scheduled_time=scheduled_time)
        return jsonify({"success": True, "entry": entry})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/remove", methods=["POST"])
def api_schedule_remove():
    """予約を削除"""
    config = load_config()
    data = request.json or {}
    entry_id = data.get("id")

    try:
        x = XClient(config) if api_ready(config) else None
        scheduler = PostScheduler(x, config)
        scheduler.remove_from_queue(entry_id)
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/schedule/post-now", methods=["POST"])
def api_schedule_post_now():
    """今すぐ投稿"""
    config = load_config()
    if not api_ready(config):
        return jsonify({"error": "X APIキーが未設定です"}), 400

    data = request.json or {}
    entry_id = data.get("id")

    try:
        x = XClient(config)
        scheduler = PostScheduler(x, config)
        result = scheduler.post_now(entry_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/buzz/check", methods=["POST"])
def api_buzz_check():
    """バズチェック"""
    config = load_config()
    if not api_ready(config):
        return jsonify({"error": "X APIキーが未設定です"}), 400

    try:
        x = XClient(config)
        notifier = Notifier(config)
        monitor = BuzzMonitor(x, notifier, config)
        buzzing = monitor.check_now()
        return jsonify({"success": True, "buzzing": buzzing})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/buzz/threshold", methods=["POST"])
def api_buzz_threshold():
    """バズ閾値を更新"""
    config = load_config()
    data = request.json or {}

    thresholds = config.get("buzz_monitor", {}).get("thresholds", {})
    for key in ["likes", "retweets", "replies", "impressions"]:
        if key in data:
            thresholds[key] = int(data[key])

    config.setdefault("buzz_monitor", {})["thresholds"] = thresholds
    save_config(config)

    return jsonify({"success": True, "thresholds": thresholds})


@app.route("/api/recycle/collect", methods=["POST"])
def api_recycle_collect():
    """過去ポスト収集"""
    config = load_config()
    if not api_ready(config):
        return jsonify({"error": "X APIキーが未設定です"}), 400

    try:
        x = XClient(config)
        recycler = ContentRecycler(x, config)
        posts = recycler.collect_my_posts()
        return jsonify({"success": True, "count": len(posts)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/recycle/suggest", methods=["POST"])
def api_recycle_suggest():
    """リサイクル候補取得"""
    config = load_config()
    try:
        x = XClient(config) if api_ready(config) else None
        recycler = ContentRecycler(x, config)
        candidates = recycler.get_recycle_candidates()
        return jsonify({"success": True, "candidates": candidates})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/insights/analyze", methods=["POST"])
def api_insights_analyze():
    """パフォーマンス分析"""
    config = load_config()
    if not api_ready(config):
        return jsonify({"error": "X APIキーが未設定です"}), 400

    try:
        x = XClient(config)
        engine = InsightsEngine(x, config)
        perf = engine.analyze_my_performance()
        return jsonify({"success": True, "data": perf})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/insights/suggest", methods=["POST"])
def api_insights_suggest():
    """AI改善提案"""
    config = load_config()
    if not api_ready(config):
        return jsonify({"error": "APIキーが未設定です"}), 400

    try:
        x = XClient(config)
        comp = CompetitorAnalyzer(x, config)
        engine = InsightsEngine(x, config, comp)
        suggestions = engine.generate_suggestions()
        return jsonify({"success": True, "suggestions": suggestions})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/settings/save", methods=["POST"])
def api_settings_save():
    """設定を保存"""
    config = load_config()
    data = request.json or {}

    # X API
    if "x_api" in data:
        config["x_api"] = {**config.get("x_api", {}), **data["x_api"]}

    # OpenAI
    if "openai" in data:
        config["openai"] = {**config.get("openai", {}), **data["openai"]}

    # アカウント情報
    if "account" in data:
        config["account"] = {**config.get("account", {}), **data["account"]}

    # 競合
    if "competitors" in data:
        config["competitors"] = data["competitors"]

    # 通知
    if "notifications" in data:
        config["notifications"] = {**config.get("notifications", {}), **data["notifications"]}

    # スケジュール
    if "scheduler" in data:
        config["scheduler"] = {**config.get("scheduler", {}), **data["scheduler"]}

    save_config(config)
    return jsonify({"success": True})


@app.route("/api/auto", methods=["POST"])
def api_auto_flow():
    """全自動フロー"""
    config = load_config()
    if not api_ready(config):
        return jsonify({"error": "X APIキーが未設定です"}), 400

    data = request.json or {}
    topic = data.get("topic", "")
    count = data.get("count", 3)

    results = {"steps": []}

    try:
        x = XClient(config)

        # Step 1: 競合収集
        comp = CompetitorAnalyzer(x, config)
        comp_data = comp.collect_all(days_back=7)
        results["steps"].append({
            "name": "競合収集",
            "status": "success",
            "accounts": len(comp_data),
        })

        # Step 2: 分析
        analysis = comp.analyze(comp_data)
        results["steps"].append({
            "name": "分析",
            "status": "success",
            "top_posts": len(analysis.get("top_posts", [])),
        })

        # Step 3: 生成
        gen = PostGenerator(config, comp)
        posts = gen.generate(topic=topic, count=count)
        results["steps"].append({
            "name": "ポスト生成",
            "status": "success",
            "posts": posts,
        })

        # Step 4: キュー追加
        scheduler = PostScheduler(x, config)
        scheduled = []
        for post in posts:
            entry = scheduler.add_to_queue(post["text"])
            scheduled.append(entry)
        results["steps"].append({
            "name": "予約登録",
            "status": "success",
            "scheduled": scheduled,
        })

        results["success"] = True
        return jsonify(results)

    except Exception as e:
        results["error"] = str(e)
        return jsonify(results), 500


# ============================================================
# デーモン管理
# ============================================================

@app.route("/api/daemon/start", methods=["POST"])
def api_daemon_start():
    """バズ監視 or 予約投稿デーモンを起動"""
    config = load_config()
    data = request.json or {}
    daemon_type = data.get("type", "buzz")

    if _daemons.get(daemon_type) and _daemons[daemon_type].is_alive():
        return jsonify({"error": f"{daemon_type}デーモンは既に起動中です"})

    if not api_ready(config):
        return jsonify({"error": "X APIキーが未設定です"}), 400

    x = XClient(config)

    if daemon_type == "buzz":
        notifier = Notifier(config)
        monitor = BuzzMonitor(x, notifier, config)
        thread = threading.Thread(target=monitor.start_daemon, daemon=True)
    elif daemon_type == "scheduler":
        scheduler = PostScheduler(x, config)
        thread = threading.Thread(target=scheduler.start_daemon, daemon=True)
    else:
        return jsonify({"error": "不明なデーモンタイプ"}), 400

    thread.start()
    _daemons[daemon_type] = thread

    return jsonify({"success": True, "message": f"{daemon_type}デーモンを起動しました"})


@app.route("/api/daemon/status", methods=["GET"])
def api_daemon_status():
    """デーモン状態を取得"""
    return jsonify({
        "buzz": _daemons.get("buzz") is not None and _daemons["buzz"].is_alive(),
        "scheduler": _daemons.get("scheduler") is not None and _daemons["scheduler"].is_alive(),
    })


# ============================================================
# ヘルパー
# ============================================================

def _load_json(filename, default=None):
    path = os.path.join(DATA_DIR, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    return default if default is not None else {}


def _get_stats(config):
    posts = _load_json("posts.json", default=[])
    queue = _load_json("schedule.json", default=[])
    buzz = _load_json("buzz_log.json", default=[])

    return {
        "generated_posts": len(posts),
        "queued": len([q for q in queue if q.get("status") == "queued"]),
        "posted": len([q for q in queue if q.get("status") == "posted"]),
        "buzz_detected": len(buzz),
        "api_configured": api_ready(config),
        "openai_configured": bool(config.get("openai", {}).get("api_key")),
    }


if __name__ == "__main__":
    os.makedirs(DATA_DIR, exist_ok=True)
    print("X自動運用ツール - Web Dashboard")
    print("http://localhost:5000 でブラウザから操作できます")
    app.run(debug=True, port=5000)
