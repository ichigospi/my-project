"""WD14 (Waifu Diffusion) ONNX tagger.

画像から Danbooru タグを推論するコア部分。
SmilingWolf 氏の WD タガー（Danbooru で学習。NSFW タグも出力する）を
onnxruntime で動かす。クラウドへは一切送信せず、すべてローカルで完結する。
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import onnxruntime as ort
from huggingface_hub import hf_hub_download
from PIL import Image

# 利用可能なモデル（新しいほど精度が高い）。表示名 -> HuggingFace repo
MODELS: dict[str, str] = {
    "WD EVA02 Large v3 (最高精度)": "SmilingWolf/wd-eva02-large-tagger-v3",
    "WD ViT Large v3": "SmilingWolf/wd-vit-large-tagger-v3",
    "WD SwinV2 v3 (軽量)": "SmilingWolf/wd-swinv2-tagger-v3",
    "WD ViT v3 (最軽量)": "SmilingWolf/wd-vit-tagger-v3",
}

MODEL_FILENAME = "model.onnx"
LABEL_FILENAME = "selected_tags.csv"

# selected_tags.csv の category 列の意味
CAT_GENERAL = 0
CAT_CHARACTER = 4
CAT_RATING = 9


@dataclass
class LabelData:
    names: list[str]
    rating_idx: list[int] = field(default_factory=list)
    general_idx: list[int] = field(default_factory=list)
    character_idx: list[int] = field(default_factory=list)


def load_labels(csv_path: Path) -> LabelData:
    names: list[str] = []
    rating, general, character = [], [], []
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            names.append(row["name"])
            cat = int(row["category"])
            if cat == CAT_RATING:
                rating.append(i)
            elif cat == CAT_CHARACTER:
                character.append(i)
            elif cat == CAT_GENERAL:
                general.append(i)
    return LabelData(names=names, rating_idx=rating, general_idx=general, character_idx=character)


def prepare_image(image: Image.Image, target_size: int) -> np.ndarray:
    """WD タガーの前処理: 白背景で正方形にパディング → リサイズ → RGB→BGR。"""
    # 透過は白で埋める
    if image.mode in ("RGBA", "LA", "P"):
        image = image.convert("RGBA")
        canvas = Image.new("RGBA", image.size, (255, 255, 255, 255))
        canvas.alpha_composite(image)
        image = canvas.convert("RGB")
    else:
        image = image.convert("RGB")

    # 正方形にパディング
    w, h = image.size
    side = max(w, h)
    square = Image.new("RGB", (side, side), (255, 255, 255))
    square.paste(image, ((side - w) // 2, (side - h) // 2))

    if side != target_size:
        square = square.resize((target_size, target_size), Image.BICUBIC)

    arr = np.asarray(square, dtype=np.float32)
    arr = arr[:, :, ::-1]  # RGB -> BGR
    return np.expand_dims(arr, axis=0)  # NHWC


def escape_for_prompt(tag: str, underscores_to_spaces: bool = True) -> str:
    """プロンプト用にタグを整形（括弧をエスケープし、必要ならアンダースコアを空白に）。"""
    # kaomoji など記号だけのタグはそのまま
    if len(tag) > 3 and underscores_to_spaces:
        tag = tag.replace("_", " ")
    return tag.replace("(", r"\(").replace(")", r"\)")


class Tagger:
    """1モデルをロードして推論するクラス。"""

    def __init__(self, repo_id: str):
        self.repo_id = repo_id
        model_path = hf_hub_download(repo_id, MODEL_FILENAME)
        label_path = hf_hub_download(repo_id, LABEL_FILENAME)
        self.labels = load_labels(Path(label_path))
        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if "CUDAExecutionProvider" in ort.get_available_providers()
            else ["CPUExecutionProvider"]
        )
        self.session = ort.InferenceSession(model_path, providers=providers)
        _, h, _, _ = self.session.get_inputs()[0].shape
        self.target_size = int(h)
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name

    def predict(self, image: Image.Image) -> np.ndarray:
        batch = prepare_image(image, self.target_size)
        preds = self.session.run([self.output_name], {self.input_name: batch})[0]
        return preds[0]  # shape: [num_labels]


@dataclass
class TagResult:
    prompt: str
    rating: dict[str, float]
    general: dict[str, float]
    character: dict[str, float]


def tag_image(
    tagger: Tagger,
    image: Image.Image,
    general_threshold: float = 0.35,
    character_threshold: float = 0.85,
    underscores_to_spaces: bool = True,
    escape_parens: bool = True,
    include_rating: bool = False,
    sort_by_confidence: bool = True,
) -> TagResult:
    probs = tagger.predict(image)
    labels = tagger.labels

    def collect(indices: list[int], threshold: float) -> dict[str, float]:
        picked = {labels.names[i]: float(probs[i]) for i in indices if probs[i] >= threshold}
        if sort_by_confidence:
            picked = dict(sorted(picked.items(), key=lambda kv: kv[1], reverse=True))
        return picked

    rating = {labels.names[i]: float(probs[i]) for i in labels.rating_idx}
    rating = dict(sorted(rating.items(), key=lambda kv: kv[1], reverse=True))
    general = collect(labels.general_idx, general_threshold)
    character = collect(labels.character_idx, character_threshold)

    # プロンプト組み立て: キャラ → 一般タグ
    ordered = list(character.keys()) + list(general.keys())
    if include_rating and rating:
        ordered = [max(rating, key=rating.get)] + ordered

    def fmt(t: str) -> str:
        if escape_parens:
            return escape_for_prompt(t, underscores_to_spaces)
        return t.replace("_", " ") if underscores_to_spaces and len(t) > 3 else t

    prompt = ", ".join(fmt(t) for t in ordered)
    return TagResult(prompt=prompt, rating=rating, general=general, character=character)
