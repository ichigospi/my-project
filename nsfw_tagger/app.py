"""NSFW 画像 → Danbooru タグ プロンプト 自動生成ツール（Web UI）

ブラウザに画像をドラッグ&ドロップすると、WD14 タガーで Danbooru タグを推論し、
Stable Diffusion / Illustrious / Pony / NAI 系で使えるプロンプトを生成する。

起動:
    python app.py
    -> http://127.0.0.1:7860 をブラウザで開く

画像はすべてローカルで処理され、外部へは送信されない。
"""

from __future__ import annotations

import functools

import gradio as gr
from PIL import Image

from tagger import MODELS, Tagger, tag_image


@functools.lru_cache(maxsize=4)
def get_tagger(repo_id: str) -> Tagger:
    """モデルは初回利用時にダウンロード&ロードしてキャッシュする。"""
    return Tagger(repo_id)


def run(
    image: Image.Image | None,
    model_label: str,
    general_threshold: float,
    character_threshold: float,
    underscores_to_spaces: bool,
    escape_parens: bool,
    include_rating: bool,
):
    if image is None:
        return "", "", {}
    tagger = get_tagger(MODELS[model_label])
    result = tag_image(
        tagger,
        image,
        general_threshold=general_threshold,
        character_threshold=character_threshold,
        underscores_to_spaces=underscores_to_spaces,
        escape_parens=escape_parens,
        include_rating=include_rating,
    )
    rating_label = max(result.rating, key=result.rating.get) if result.rating else "?"
    rating_md = f"**Rating: `{rating_label}`**  " + "  ".join(
        f"{k}:{v:.2f}" for k, v in result.rating.items()
    )
    # confidence ビュー（一般 + キャラ）
    confidences = {**result.character, **result.general}
    return result.prompt, rating_md, confidences


def build_ui() -> gr.Blocks:
    with gr.Blocks(title="NSFW 画像 → プロンプト生成") as demo:
        gr.Markdown(
            "# 🖼️ → 📝 画像プロンプト自動生成 (WD14 Tagger)\n"
            "画像をドロップすると Danbooru タグを推論してプロンプトを生成します。"
            "すべてローカル処理。NSFW 含む。**実在の人物・未成年を対象にした利用は禁止です。**"
        )
        with gr.Row():
            with gr.Column(scale=1):
                image = gr.Image(type="pil", label="画像をドラッグ&ドロップ", height=400)
                model_label = gr.Dropdown(
                    choices=list(MODELS.keys()),
                    value=list(MODELS.keys())[0],
                    label="モデル",
                )
                with gr.Accordion("詳細設定", open=False):
                    general_threshold = gr.Slider(
                        0.0, 1.0, value=0.35, step=0.01, label="一般タグのしきい値"
                    )
                    character_threshold = gr.Slider(
                        0.0, 1.0, value=0.85, step=0.01, label="キャラタグのしきい値"
                    )
                    underscores_to_spaces = gr.Checkbox(
                        value=True, label="アンダースコアを空白に (long_hair → long hair)"
                    )
                    escape_parens = gr.Checkbox(
                        value=True, label="括弧をエスケープ \\( \\) (SD系で推奨)"
                    )
                    include_rating = gr.Checkbox(
                        value=False, label="rating タグをプロンプト先頭に含める"
                    )
                run_btn = gr.Button("プロンプト生成", variant="primary")
            with gr.Column(scale=1):
                prompt_out = gr.Textbox(
                    label="生成プロンプト (クリックでコピー)",
                    lines=6,
                    show_copy_button=True,
                )
                rating_out = gr.Markdown()
                conf_out = gr.Label(label="タグ別 信頼度", num_top_classes=50)

        inputs = [
            image,
            model_label,
            general_threshold,
            character_threshold,
            underscores_to_spaces,
            escape_parens,
            include_rating,
        ]
        outputs = [prompt_out, rating_out, conf_out]
        run_btn.click(run, inputs=inputs, outputs=outputs)
        # ドロップしたら即実行
        image.upload(run, inputs=inputs, outputs=outputs)

    return demo


if __name__ == "__main__":
    build_ui().launch()
