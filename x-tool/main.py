#!/usr/bin/env python3
"""
X自動運用ツール - メインCLI
競合分析 → ポスト生成 → 予約投稿 → バズ監視 → リサイクル → 改善提案
"""

import os
import sys
import yaml
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

# モジュールインポート
from x_client import XClient
from competitor import CompetitorAnalyzer
from generator import PostGenerator
from scheduler import PostScheduler
from buzz_monitor import BuzzMonitor
from recycler import ContentRecycler
from insights import InsightsEngine
from notifier import Notifier

console = Console()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")


def load_config() -> dict:
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def check_api_keys(config: dict) -> bool:
    """APIキーが設定されているかチェック"""
    x_api = config.get("x_api", {})
    missing = []

    if not x_api.get("bearer_token"):
        missing.append("x_api.bearer_token")
    if not x_api.get("api_key"):
        missing.append("x_api.api_key")
    if not config.get("openai", {}).get("api_key"):
        missing.append("openai.api_key")

    if missing:
        console.print(f"[yellow]未設定のAPIキー: {', '.join(missing)}[/yellow]")
        console.print(f"[yellow]config.yaml を編集してください: {CONFIG_PATH}[/yellow]")
        return False
    return True


# ============================================================
# CLI グループ
# ============================================================
@click.group()
def cli():
    """X自動運用ツール - 競合分析からポスト生成・予約投稿まで"""
    pass


# ============================================================
# 競合分析
# ============================================================
@cli.group()
def competitor():
    """競合アカウントの分析"""
    pass


@competitor.command("collect")
@click.option("--days", default=7, help="何日分を収集するか")
def competitor_collect(days):
    """競合のポストを収集"""
    config = load_config()
    if not check_api_keys(config):
        return

    console.print(Panel("競合ポスト収集", style="bold blue"))

    x = XClient(config)
    analyzer = CompetitorAnalyzer(x, config)
    data = analyzer.collect_all(days_back=days)

    # 結果表示
    table = Table(title="収集結果", box=box.ROUNDED)
    table.add_column("アカウント", style="cyan")
    table.add_column("フォロワー", justify="right")
    table.add_column("取得件数", justify="right")
    table.add_column("平均エンゲージメント", justify="right")

    for username, info in data.items():
        if "error" in info:
            table.add_row(f"@{username}", "-", f"[red]エラー[/red]", "-")
        else:
            posts = info.get("posts", [])
            avg = sum(p["engagement"] for p in posts) / len(posts) if posts else 0
            table.add_row(
                f"@{username}",
                f"{info.get('followers', 0):,}",
                str(len(posts)),
                f"{avg:.1f}",
            )

    console.print(table)


@competitor.command("analyze")
def competitor_analyze():
    """収集済みデータを分析"""
    config = load_config()
    x = XClient(config)
    analyzer = CompetitorAnalyzer(x, config)
    results = analyzer.analyze()

    if "error" in results:
        console.print(f"[red]{results['error']}[/red]")
        return

    # サマリー
    console.print(Panel("競合分析レポート", style="bold blue"))

    table = Table(title="アカウント比較", box=box.ROUNDED)
    table.add_column("アカウント", style="cyan")
    table.add_column("フォロワー", justify="right")
    table.add_column("投稿数", justify="right")
    table.add_column("平均エンゲージメント", justify="right")
    table.add_column("最高エンゲージメント", justify="right")

    for username, info in results.get("summary", {}).items():
        table.add_row(
            f"@{username}",
            f"{info['followers']:,}",
            str(info["post_count"]),
            f"{info['avg_engagement']:.1f}",
            str(info["top_post_engagement"]),
        )

    console.print(table)

    # トップポスト
    console.print("\n[bold]バズ投稿 TOP10[/bold]")
    for i, post in enumerate(results.get("top_posts", [])[:10], 1):
        text_preview = post["text"][:80].replace("\n", " ")
        console.print(
            f"  {i:2d}. [@{post.get('username', '?')}] "
            f"({post['likes']}いいね, {post['retweets']}RT) "
            f"{text_preview}..."
        )

    # ハッシュタグ
    if results.get("common_hashtags"):
        console.print("\n[bold]よく使われるハッシュタグ[/bold]")
        for tag, count in results["common_hashtags"][:10]:
            console.print(f"  #{tag} ({count}回)")


# ============================================================
# ポスト生成
# ============================================================
@cli.group()
def generate():
    """ポストの自動生成"""
    pass


@generate.command("create")
@click.option("--topic", "-t", default="", help="テーマ（任意）")
@click.option("--count", "-n", default=3, help="生成数")
@click.option("--no-competitor", is_flag=True, help="競合データを使わない")
@click.option("--instruction", "-i", default="", help="追加の指示")
def generate_create(topic, count, no_competitor, instruction):
    """ポストを生成"""
    config = load_config()
    if not check_api_keys(config):
        return

    console.print(Panel("ポスト生成", style="bold green"))

    x = XClient(config)
    comp = CompetitorAnalyzer(x, config) if not no_competitor else None
    gen = PostGenerator(config, comp)

    with console.status("生成中..."):
        posts = gen.generate(
            topic=topic,
            count=count,
            use_competitor_data=not no_competitor,
            custom_instruction=instruction,
        )

    console.print(f"\n[green]{len(posts)}案 生成完了[/green]\n")

    for i, post in enumerate(posts, 1):
        console.print(Panel(
            post["text"],
            title=f"案{i} ({post['char_count']}文字)",
            border_style="green" if post["char_count"] <= 280 else "red",
        ))

    # 予約キューに追加するか
    if posts and click.confirm("\nこの中から予約キューに追加しますか？"):
        choice = click.prompt(
            "何番目を追加？(カンマ区切りで複数可。例: 1,3)",
            type=str,
        )
        scheduler = PostScheduler(x, config)
        for idx_str in choice.split(","):
            idx = int(idx_str.strip()) - 1
            if 0 <= idx < len(posts):
                entry = scheduler.add_to_queue(posts[idx]["text"])
                console.print(
                    f"  [green]案{idx+1}を予約キューに追加[/green] "
                    f"(予定: {entry['scheduled_time']})"
                )


@generate.command("list")
def generate_list():
    """生成済みポストを一覧表示"""
    config = load_config()
    gen = PostGenerator(config)
    posts = gen.load_generated()

    if not posts:
        console.print("[yellow]生成済みポストはありません[/yellow]")
        return

    table = Table(title=f"生成済みポスト ({len(posts)}件)", box=box.ROUNDED)
    table.add_column("#", style="dim", width=4)
    table.add_column("テーマ", width=12)
    table.add_column("内容", max_width=60)
    table.add_column("文字数", justify="right", width=6)
    table.add_column("状態", width=8)

    for i, post in enumerate(posts[-20:], 1):
        text_preview = post["text"][:60].replace("\n", " ")
        table.add_row(
            str(i),
            post.get("topic", "-")[:12],
            text_preview,
            str(post["char_count"]),
            post.get("status", "draft"),
        )

    console.print(table)


# ============================================================
# 予約投稿
# ============================================================
@cli.group()
def schedule():
    """予約投稿の管理"""
    pass


@schedule.command("add")
@click.argument("text")
@click.option("--time", "-t", default="", help="投稿時間 (例: 2024-01-15 19:30)")
def schedule_add(text, time):
    """ポストを予約キューに追加"""
    config = load_config()
    x = XClient(config)
    scheduler = PostScheduler(x, config)

    entry = scheduler.add_to_queue(text, scheduled_time=time)
    console.print(f"[green]予約追加完了[/green]")
    console.print(f"  ID: {entry['id']}")
    console.print(f"  時間: {entry['scheduled_time']}")
    console.print(f"  内容: {entry['text'][:80]}...")


@schedule.command("list")
def schedule_list():
    """予約キューを一覧表示"""
    config = load_config()
    x = XClient(config)
    scheduler = PostScheduler(x, config)

    queue = scheduler.get_queue()
    if not queue:
        console.print("[yellow]予約キューは空です[/yellow]")
        return

    table = Table(title="予約キュー", box=box.ROUNDED)
    table.add_column("ID", style="dim", width=4)
    table.add_column("予定時刻", width=18)
    table.add_column("内容", max_width=50)
    table.add_column("状態", width=10)

    for entry in queue:
        status_color = {
            "queued": "cyan",
            "posted": "green",
            "failed": "red",
            "cancelled": "dim",
        }.get(entry["status"], "white")

        table.add_row(
            str(entry["id"]),
            entry["scheduled_time"],
            entry["text"][:50].replace("\n", " "),
            f"[{status_color}]{entry['status']}[/{status_color}]",
        )

    console.print(table)


@schedule.command("post-now")
@click.argument("entry_id", type=int)
def schedule_post_now(entry_id):
    """指定IDのポストを今すぐ投稿"""
    config = load_config()
    if not check_api_keys(config):
        return

    x = XClient(config)
    scheduler = PostScheduler(x, config)

    result = scheduler.post_now(entry_id)
    if result.get("success"):
        console.print(f"[green]投稿完了！[/green]")
        console.print(f"  ツイートID: {result['entry'].get('tweet_id', '-')}")
    else:
        console.print(f"[red]投稿失敗: {result.get('error', '不明')}[/red]")


@schedule.command("remove")
@click.argument("entry_id", type=int)
def schedule_remove(entry_id):
    """予約を削除"""
    config = load_config()
    x = XClient(config)
    scheduler = PostScheduler(x, config)
    scheduler.remove_from_queue(entry_id)
    console.print(f"[green]ID {entry_id} を削除しました[/green]")


@schedule.command("daemon")
def schedule_daemon():
    """予約投稿デーモンを起動（常駐）"""
    config = load_config()
    if not check_api_keys(config):
        return

    x = XClient(config)
    scheduler = PostScheduler(x, config)
    scheduler.start_daemon()


# ============================================================
# バズ監視
# ============================================================
@cli.group()
def buzz():
    """バズ監視・通知"""
    pass


@buzz.command("check")
def buzz_check():
    """今すぐバズをチェック"""
    config = load_config()
    if not check_api_keys(config):
        return

    console.print(Panel("バズチェック", style="bold magenta"))

    x = XClient(config)
    notifier = Notifier(config)
    monitor = BuzzMonitor(x, notifier, config)

    buzzing = monitor.check_now()

    if buzzing:
        console.print(f"\n[bold magenta]{len(buzzing)}件のバズを検知！[/bold magenta]")
        for b in buzzing:
            m = b["metrics"]
            console.print(Panel(
                f"{b['text'][:100]}...\n\n"
                f"いいね: {m['like_count']}  RT: {m['retweet_count']}  "
                f"リプ: {m['reply_count']}  インプ: {m['impression_count']}",
                title="バズ検知",
                border_style="magenta",
            ))
    else:
        console.print("[dim]バズは検知されませんでした[/dim]")


@buzz.command("daemon")
def buzz_daemon():
    """バズ監視デーモンを起動（常駐）"""
    config = load_config()
    if not check_api_keys(config):
        return

    x = XClient(config)
    notifier = Notifier(config)
    monitor = BuzzMonitor(x, notifier, config)
    monitor.start_daemon()


@buzz.command("threshold")
@click.option("--likes", type=int, help="いいね閾値")
@click.option("--retweets", type=int, help="RT閾値")
@click.option("--replies", type=int, help="リプライ閾値")
@click.option("--impressions", type=int, help="インプレッション閾値")
def buzz_threshold(likes, retweets, replies, impressions):
    """バズ検知の閾値を変更"""
    config = load_config()

    thresholds = config.get("buzz_monitor", {}).get("thresholds", {})
    if likes is not None:
        thresholds["likes"] = likes
    if retweets is not None:
        thresholds["retweets"] = retweets
    if replies is not None:
        thresholds["replies"] = replies
    if impressions is not None:
        thresholds["impressions"] = impressions

    config["buzz_monitor"]["thresholds"] = thresholds

    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False)

    console.print(f"[green]閾値を更新しました[/green]")
    for k, v in thresholds.items():
        console.print(f"  {k}: {v}")


@buzz.command("history")
def buzz_history():
    """バズ検知履歴を表示"""
    config = load_config()
    x = XClient(config)
    notifier = Notifier(config)
    monitor = BuzzMonitor(x, notifier, config)

    history = monitor.get_buzz_history()
    if not history:
        console.print("[yellow]バズ検知履歴はありません[/yellow]")
        return

    table = Table(title="バズ検知履歴", box=box.ROUNDED)
    table.add_column("検知日時", width=18)
    table.add_column("内容", max_width=50)
    table.add_column("いいね", justify="right")
    table.add_column("RT", justify="right")
    table.add_column("理由")

    for entry in history[-20:]:
        m = entry.get("metrics", {})
        table.add_row(
            entry.get("detected_at", "")[:16],
            entry.get("text", "")[:50].replace("\n", " "),
            str(m.get("like_count", 0)),
            str(m.get("retweet_count", 0)),
            ", ".join(entry.get("reasons", [])),
        )

    console.print(table)


# ============================================================
# コンテンツリサイクル
# ============================================================
@cli.group()
def recycle():
    """過去のバズ投稿をリサイクル"""
    pass


@recycle.command("collect")
@click.option("--days", default=180, help="何日分を収集するか")
def recycle_collect(days):
    """自分の過去ポストを収集"""
    config = load_config()
    if not check_api_keys(config):
        return

    console.print(Panel("過去ポスト収集", style="bold yellow"))

    x = XClient(config)
    recycler = ContentRecycler(x, config)
    posts = recycler.collect_my_posts(days_back=days)

    console.print(f"[green]{len(posts)}件の投稿を収集・保存しました[/green]")


@recycle.command("suggest")
def recycle_suggest():
    """リサイクル候補を提案"""
    config = load_config()
    x = XClient(config)
    recycler = ContentRecycler(x, config)

    candidates = recycler.get_recycle_candidates()
    if not candidates:
        console.print("[yellow]リサイクル候補がありません。先に collect を実行してください。[/yellow]")
        return

    console.print(Panel(f"リサイクル候補 ({len(candidates)}件)", style="bold yellow"))

    for i, c in enumerate(candidates, 1):
        text_preview = c["text"][:80].replace("\n", " ")
        console.print(
            f"\n  [bold]{i}.[/bold] (スコア: {c['recycle_score']}, {c['days_ago']}日前)\n"
            f"     {text_preview}...\n"
            f"     いいね: {c['likes']}  RT: {c['retweets']}  リプ: {c['replies']}"
        )

    # リサイクル実行
    if candidates and click.confirm("\nリサイクル生成しますか？"):
        choice = click.prompt("何番目を元ネタにする？", type=int, default=1) - 1
        if 0 <= choice < len(candidates):
            gen = PostGenerator(config)
            with console.status("リサイクルポスト生成中..."):
                posts = gen.generate_from_recycled(candidates[choice])

            console.print(f"\n[green]{len(posts)}案 生成完了[/green]\n")
            for j, post in enumerate(posts, 1):
                console.print(Panel(
                    post["text"],
                    title=f"リサイクル案{j} ({post['char_count']}文字)",
                    border_style="yellow",
                ))

            recycler.mark_as_recycled(candidates[choice]["id"])


# ============================================================
# 改善提案
# ============================================================
@cli.group()
def insights():
    """パフォーマンス分析・改善提案"""
    pass


@insights.command("analyze")
def insights_analyze():
    """パフォーマンス分析を実行"""
    config = load_config()
    if not check_api_keys(config):
        return

    console.print(Panel("パフォーマンス分析", style="bold cyan"))

    x = XClient(config)
    comp = CompetitorAnalyzer(x, config)
    engine = InsightsEngine(x, config, comp)

    with console.status("分析中..."):
        perf = engine.analyze_my_performance()

    if "error" in perf:
        console.print(f"[red]{perf['error']}[/red]")
        return

    # サマリー表示
    avg = perf["averages"]
    console.print(f"\n[bold]過去{perf['period_days']}日間のサマリー[/bold]")
    console.print(f"  投稿数: {perf['total_posts']}")
    console.print(f"  平均いいね: {avg['likes']}")
    console.print(f"  平均RT: {avg['retweets']}")
    console.print(f"  平均エンゲージメント: {avg['engagement']}")

    if perf.get("best_hours"):
        console.print(f"\n[bold]反応が良い時間帯[/bold]")
        for h in perf["best_hours"][:3]:
            console.print(f"  {h['hour']}時台 (平均エンゲージメント: {h['avg_engagement']:.1f})")

    if perf.get("effective_hashtags"):
        console.print(f"\n[bold]効果的なハッシュタグ[/bold]")
        for t in perf["effective_hashtags"][:5]:
            console.print(f"  #{t['tag']} (平均エンゲージメント: {t['avg_engagement']:.1f})")


@insights.command("suggest")
def insights_suggest():
    """AIによる改善提案を取得"""
    config = load_config()
    if not check_api_keys(config):
        return

    console.print(Panel("AI改善提案", style="bold cyan"))

    x = XClient(config)
    comp = CompetitorAnalyzer(x, config)
    engine = InsightsEngine(x, config, comp)

    with console.status("分析・提案生成中..."):
        suggestions = engine.generate_suggestions()

    console.print(Panel(suggestions, title="改善提案", border_style="cyan"))


@insights.command("report")
def insights_report():
    """週次レポートを生成"""
    config = load_config()
    if not check_api_keys(config):
        return

    x = XClient(config)
    comp = CompetitorAnalyzer(x, config)
    engine = InsightsEngine(x, config, comp)

    with console.status("レポート生成中..."):
        report = engine.generate_weekly_report()

    console.print(report)


# ============================================================
# 一括実行（全自動フロー）
# ============================================================
@cli.command("auto")
@click.option("--topic", "-t", default="", help="テーマ")
@click.option("--count", "-n", default=3, help="生成数")
def auto_flow(topic, count):
    """全自動フロー: 競合収集 → 分析 → ポスト生成 → 予約"""
    config = load_config()
    if not check_api_keys(config):
        return

    console.print(Panel(
        "[bold]全自動フロー[/bold]\n"
        "1. 競合ポスト収集\n"
        "2. 分析\n"
        "3. ポスト生成\n"
        "4. 予約キュー追加",
        style="bold white",
    ))

    x = XClient(config)
    notifier = Notifier(config)

    # Step 1: 競合収集
    console.print("\n[bold blue]Step 1: 競合ポスト収集[/bold blue]")
    comp = CompetitorAnalyzer(x, config)
    data = comp.collect_all(days_back=7)

    # Step 2: 分析
    console.print("\n[bold blue]Step 2: 分析[/bold blue]")
    analysis = comp.analyze(data)
    top_posts = analysis.get("top_posts", [])[:5]
    for i, p in enumerate(top_posts, 1):
        console.print(f"  {i}. ({p['likes']}いいね) {p['text'][:60].replace(chr(10), ' ')}...")

    # Step 3: 生成
    console.print(f"\n[bold green]Step 3: ポスト生成 ({count}案)[/bold green]")
    gen = PostGenerator(config, comp)
    with console.status("生成中..."):
        posts = gen.generate(topic=topic, count=count)

    for i, post in enumerate(posts, 1):
        console.print(Panel(
            post["text"],
            title=f"案{i} ({post['char_count']}文字)",
            border_style="green",
        ))

    # Step 4: 予約
    if posts and click.confirm("\n予約キューに追加しますか？"):
        scheduler = PostScheduler(x, config)
        choice = click.prompt(
            "何番目を追加？(カンマ区切り可。allで全部)",
            type=str,
            default="all",
        )

        if choice.strip().lower() == "all":
            indices = range(len(posts))
        else:
            indices = [int(s.strip()) - 1 for s in choice.split(",")]

        for idx in indices:
            if 0 <= idx < len(posts):
                entry = scheduler.add_to_queue(posts[idx]["text"])
                console.print(
                    f"  [green]案{idx+1} -> 予約完了[/green] ({entry['scheduled_time']})"
                )

    console.print("\n[bold green]完了！[/bold green]")


# ============================================================
# ステータス
# ============================================================
@cli.command("status")
def show_status():
    """ツール全体のステータス表示"""
    config = load_config()

    console.print(Panel("[bold]X自動運用ツール - ステータス[/bold]", style="bold white"))

    # API接続状態
    x_api = config.get("x_api", {})
    openai_conf = config.get("openai", {})
    line_conf = config.get("notifications", {}).get("line", {})
    chatwork_conf = config.get("notifications", {}).get("chatwork", {})

    table = Table(title="接続設定", box=box.ROUNDED)
    table.add_column("サービス", width=20)
    table.add_column("状態", width=12)

    def status_icon(configured):
        return "[green]設定済み[/green]" if configured else "[red]未設定[/red]"

    table.add_row("X API", status_icon(bool(x_api.get("bearer_token"))))
    table.add_row("OpenAI API", status_icon(bool(openai_conf.get("api_key"))))
    table.add_row("LINE通知", status_icon(line_conf.get("enabled")))
    table.add_row("Chatwork通知", status_icon(chatwork_conf.get("enabled")))

    console.print(table)

    # 競合アカウント
    competitors = config.get("competitors", [])
    console.print(f"\n[bold]監視対象競合: {len(competitors)}アカウント[/bold]")
    for c in competitors:
        console.print(f"  @{c['username']} - {c.get('note', '')}")

    # 予約投稿時間
    post_times = config.get("scheduler", {}).get("post_times", [])
    console.print(f"\n[bold]投稿時間帯: {', '.join(post_times)}[/bold]")

    # バズ閾値
    thresholds = config.get("buzz_monitor", {}).get("thresholds", {})
    console.print(f"\n[bold]バズ検知閾値[/bold]")
    for k, v in thresholds.items():
        console.print(f"  {k}: {v}")

    # データファイル確認
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    console.print(f"\n[bold]データディレクトリ: {data_dir}[/bold]")
    if os.path.exists(data_dir):
        for f in os.listdir(data_dir):
            fpath = os.path.join(data_dir, f)
            size = os.path.getsize(fpath)
            console.print(f"  {f} ({size:,} bytes)")


if __name__ == "__main__":
    cli()
