"""
ローンチコンテンツ生成プロンプトコンパイラ

Claude Code以外のAIツール（ChatGPT等）でコンテンツを生成したい場合に使う。
Claude Codeでは直接「launch_design.md に基づいて投稿を作って」と指示すれば
このスクリプトは不要。

使い方:
  python generate_launch.py [content_type]
  python generate_launch.py --parallel

content_type:
  posts      - 14日間のローンチ投稿プロンプトを生成
  posts1     - Phase 1（Day 1-5）投稿プロンプトを生成
  posts2     - Phase 2（Day 6-10）投稿プロンプトを生成
  posts3     - Phase 3（Day 11-14）投稿プロンプトを生成
  columns    - コラム3本のプロンプトを生成
  letter     - セールスレターのプロンプトを生成
  line       - LINE配信メッセージのプロンプトを生成
  all        - 全コンテンツのプロンプトを一括生成（デフォルト）
  --parallel - 6バッチに分割して並列生成用プロンプトを一括出力
  help       - このヘルプを表示

出力:
  prompt_[content_type].md がこのフォルダに生成される。
  Claude/ChatGPTに貼って使う。
"""

import json
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
POST_SYSTEM_DIR = os.path.join(SCRIPT_DIR, '..', 'custom_post_system')
TEMPLATES_FILE = os.path.join(SCRIPT_DIR, 'launch_templates.md')


def load_md(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()


def load_json(path):
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def build_character_section():
    char_profile_path = os.path.join(POST_SYSTEM_DIR, 'character_profile.json')
    if not os.path.exists(char_profile_path):
        return "（character_profile.json が見つからないため、口調・口癖は手動で指定してください）\n"

    c = load_json(char_profile_path).get('character', {})
    lines = []
    lines.append("## キャラクター設計\n")
    lines.append(f"- 名前: {c.get('name', '未設定')}")
    lines.append(f"- ジャンル: {c.get('genre', '未設定')}")

    ci = c.get('core_identity', {})
    lines.append(f"- 肩書き: {ci.get('title', '未設定')}")
    lines.append(f"- 口調: {ci.get('tone', '未設定')}")
    lines.append(f"- ブランド絵文字: {ci.get('brand_emoji', '未設定')}")

    cp = c.get('catchphrases', {})
    for cat, phrases in cp.items():
        if cat.startswith('_'):
            continue
        if isinstance(phrases, list):
            valid = [p for p in phrases if not str(p).startswith('[')]
            if valid:
                lines.append(f"- 口癖（{cat}）: {' / '.join(valid[:3])}")

    tl = c.get('temperature_levels', {})
    for level_key in ['level_1', 'level_2', 'level_3']:
        level = tl.get(level_key, {})
        if level:
            lines.append(f"- {level.get('name', level_key)}: {level.get('tone', '')}")

    return '\n'.join(lines) + '\n'


def extract_section(templates_content, section_title):
    """launch_templates.md から特定セクションを抽出する"""
    lines = templates_content.split('\n')
    result = []
    capturing = False
    depth = 0

    for line in lines:
        if section_title in line and line.startswith('#'):
            capturing = True
            depth = len(line) - len(line.lstrip('#'))
            result.append(line)
            continue

        if capturing:
            if line.startswith('#'):
                current_depth = len(line) - len(line.lstrip('#'))
                if current_depth <= depth:
                    break
            result.append(line)

    return '\n'.join(result)


def generate_posts_prompt():
    design = load_md(os.path.join(SCRIPT_DIR, 'launch_design.md'))
    templates = load_md(TEMPLATES_FILE)
    example = load_md(os.path.join(SCRIPT_DIR, 'example_launch_posts.md'))

    schedule_section = extract_section(templates, '14日間ローンチスケジュール')

    prompt = "# ローンチ投稿生成プロンプト\n\n"
    prompt += "以下の設計書に基づいて、14日間×3投稿＝42本＋コラム企画投稿3本を生成してください。\n\n"
    prompt += build_character_section()
    prompt += f"\n## ローンチ設計書\n\n{design}\n"
    prompt += f"\n## 14日間スケジュール\n\n{schedule_section}\n"
    prompt += f"\n## お手本（このトーン・構造を参考に）\n\n{example[:3000]}...\n"
    return prompt


PHASE_CONFIG = {
    1: {"days": "Day 1-5", "count": 15, "title": "Phase 1: 教育・興味づけ", "section": "Phase 1"},
    2: {"days": "Day 6-10", "count": 15, "title": "Phase 2: 信頼構築・選択肢を絞る", "section": "Phase 2"},
    3: {"days": "Day 11-14", "count": 12, "title": "Phase 3: 予告・販売", "section": "Phase 3"},
}


def generate_posts_phase_prompt(phase_num):
    cfg = PHASE_CONFIG[phase_num]
    design = load_md(os.path.join(SCRIPT_DIR, 'launch_design.md'))
    templates = load_md(TEMPLATES_FILE)
    example = load_md(os.path.join(SCRIPT_DIR, 'example_launch_posts.md'))

    phase_section = extract_section(templates, cfg["section"])

    prompt = f"# ローンチ投稿生成プロンプト — {cfg['title']}（{cfg['days']}）\n\n"
    prompt += f"以下の設計書に基づいて、{cfg['title']}（{cfg['days']}）の投稿{cfg['count']}本を生成してください。\n\n"
    prompt += build_character_section()
    prompt += f"\n## ローンチ設計書\n\n{design}\n"
    prompt += f"\n## {cfg['title']} スケジュール\n\n{phase_section}\n"
    prompt += f"\n## お手本（このトーン・構造を参考に）\n\n{example[:2000]}...\n"
    return prompt


def generate_columns_prompt():
    design = load_md(os.path.join(SCRIPT_DIR, 'launch_design.md'))
    templates = load_md(TEMPLATES_FILE)

    column_section = extract_section(templates, 'コラム3本連鎖テンプレート')

    prompt = "# コラム3本生成プロンプト\n\n"
    prompt += "以下の設計書に基づいて、コラム3本（企画告知ポスト付き）を生成してください。\n\n"
    prompt += build_character_section()
    prompt += f"\n## ローンチ設計書\n\n{design}\n"
    prompt += f"\n## コラム構造テンプレート＋完成例\n\n{column_section}\n"
    return prompt


def generate_letter_prompt():
    design = load_md(os.path.join(SCRIPT_DIR, 'launch_design.md'))
    templates = load_md(TEMPLATES_FILE)

    letter_section = extract_section(templates, 'セールスレター構造テンプレート')

    prompt = "# セールスレター生成プロンプト\n\n"
    prompt += build_character_section()
    prompt += f"\n## ローンチ設計書\n\n{design}\n"
    prompt += f"\n## レター構造テンプレート＋完成例\n\n{letter_section}\n"
    return prompt


def generate_line_prompt():
    design = load_md(os.path.join(SCRIPT_DIR, 'launch_design.md'))
    templates = load_md(TEMPLATES_FILE)

    line_section = extract_section(templates, 'LINE配信メッセージ構造テンプレート')

    prompt = "# LINE配信メッセージ生成プロンプト\n\n"
    prompt += build_character_section()
    prompt += f"\n## ローンチ設計書\n\n{design}\n"
    prompt += f"\n## LINE配信構造テンプレート＋完成例\n\n{line_section}\n"
    return prompt


def write_prompt(filename, gen_func, *args):
    """プロンプトを生成してファイルに書き出す"""
    prompt = gen_func(*args) if args else gen_func()
    output_path = os.path.join(SCRIPT_DIR, filename)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(prompt)
    return filename, len(prompt)


def run_parallel(targets_dict):
    """ThreadPoolExecutor で複数プロンプトを並列生成"""
    results = []
    with ThreadPoolExecutor(max_workers=len(targets_dict)) as executor:
        futures = {}
        for key, (filename, gen_func, *args) in targets_dict.items():
            future = executor.submit(write_prompt, filename, gen_func, *args)
            futures[future] = key

        for future in as_completed(futures):
            filename, char_count = future.result()
            results.append((filename, char_count))
            print(f"✅ {filename} を生成しました（{char_count:,}字）")

    return results


def main():
    content_type = sys.argv[1] if len(sys.argv) > 1 else 'all'

    if content_type == 'help':
        print(__doc__)
        return

    generators = {
        'posts':   ('prompt_posts.md', generate_posts_prompt),
        'posts1':  ('prompt_posts_phase1.md', generate_posts_phase_prompt, 1),
        'posts2':  ('prompt_posts_phase2.md', generate_posts_phase_prompt, 2),
        'posts3':  ('prompt_posts_phase3.md', generate_posts_phase_prompt, 3),
        'columns': ('prompt_columns.md', generate_columns_prompt),
        'letter':  ('prompt_letter.md', generate_letter_prompt),
        'line':    ('prompt_line.md', generate_line_prompt),
    }

    parallel_batch = {
        'posts1':  generators['posts1'],
        'posts2':  generators['posts2'],
        'posts3':  generators['posts3'],
        'columns': generators['columns'],
        'letter':  generators['letter'],
        'line':    generators['line'],
    }

    if content_type == '--parallel':
        print("🚀 並列モード: 6バッチのプロンプトを同時生成します\n")
        results = run_parallel(parallel_batch)
        print(f"\n✅ 全 {len(results)} ファイル生成完了！")
        print("   → それぞれ別のClaude/ChatGPTウィンドウに貼り付けて同時に生成できます")
        return

    if content_type == 'all':
        targets = ['posts', 'columns', 'letter', 'line']
    elif content_type in generators:
        targets = [content_type]
    else:
        print(f"不明なタイプ: {content_type}")
        print("使えるタイプ: posts, posts1, posts2, posts3, columns, letter, line, all, --parallel, help")
        return

    for t in targets:
        entry = generators[t]
        filename = entry[0]
        gen_func = entry[1]
        args = entry[2:] if len(entry) > 2 else ()
        _, char_count = write_prompt(filename, gen_func, *args)
        print(f"✅ {filename} を生成しました（{char_count:,}字）")
        print(f"   → Claude/ChatGPTに貼って使ってください\n")


if __name__ == '__main__':
    main()
