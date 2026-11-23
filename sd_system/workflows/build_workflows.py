#!/usr/bin/env python3
"""
ComfyUI ワークフロー生成スクリプト（sd_system）

このファイルを編集して `python3 build_workflows.py` を実行すると、
同じフォルダに ComfyUI の UI 形式 JSON（ドラッグ&ドロップ / Workflows サイドバーで開ける）と、
API 形式 JSON（`*_api.json`、検証・自動生成用）を書き出す。

ノードの widgets_values の並びは ComfyUI 標準ノードの定義順に合わせてある。
  KSampler: [seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise]
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# 既定値（モデル名は start-sd.command が実在ファイルに自動置換する）
DEFAULT_CKPT = "WAI-Nsfw-Illustrious-17.safetensors"
DEFAULT_LORA = "your_lora.safetensors"
POS = (
    "masterpiece, best quality, amazing quality, very aesthetic, absurdres, newest, "
    "1girl, solo, mature female, long hair, looking at viewer, smile, "
    "white shirt, cowboy shot, simple background, soft lighting"
)
NEG = (
    "bad quality, worst quality, worst detail, sketch, censor, "
    "lowres, bad anatomy, bad hands, extra digits, missing fingers, "
    "text, signature, watermark, loli, shota, child"
)
WIDTH, HEIGHT = 832, 1216
STEPS, CFG = 28, 5.5
SAMPLER, SCHEDULER = "euler_ancestral", "normal"


class WF:
    """UI形式とAPI形式を同時に組み立てる小さなビルダー"""

    def __init__(self):
        self.nodes = []
        self.links = []
        self.api = {}
        self._nid = 0
        self._lid = 0
        self._outputs = {}  # (node_id, slot) -> type

    def node(self, type_, widgets, inputs, outputs, pos, size, api_inputs, title=None):
        """inputs: [(name, type, link_id|None)], outputs: [(name, type)]"""
        self._nid += 1
        nid = self._nid
        n = {
            "id": nid,
            "type": type_,
            "pos": list(pos),
            "size": list(size),
            "flags": {},
            "order": nid - 1,
            "mode": 0,
            "inputs": [{"name": a, "type": b, "link": c} for a, b, c in inputs],
            "outputs": [
                {"name": a, "type": b, "links": [], "slot_index": i}
                for i, (a, b) in enumerate(outputs)
            ],
            "properties": {"Node name for S&R": type_},
            "widgets_values": list(widgets),
        }
        if title:
            n["title"] = title
        self.nodes.append(n)
        for i, (_, t) in enumerate(outputs):
            self._outputs[(nid, i)] = t
        self.api[str(nid)] = {"class_type": type_, "inputs": dict(api_inputs)}
        return nid

    def link(self, from_node, from_slot, to_node, to_input_name):
        self._lid += 1
        t = self._outputs[(from_node, from_slot)]
        self.links.append([self._lid, from_node, from_slot, to_node, None, t])
        # UI側: 入力スロットに link id を入れ、出力側 links に追加
        dst = next(n for n in self.nodes if n["id"] == to_node)
        for i, inp in enumerate(dst["inputs"]):
            if inp["name"] == to_input_name:
                inp["link"] = self._lid
                self.links[-1][4] = i
                break
        else:
            raise KeyError(f"input {to_input_name} not found on node {to_node}")
        src = next(n for n in self.nodes if n["id"] == from_node)
        src["outputs"][from_slot]["links"].append(self._lid)
        # API側
        self.api[str(to_node)]["inputs"][to_input_name] = [str(from_node), from_slot]

    def dump(self, name):
        ui = {
            "last_node_id": self._nid,
            "last_link_id": self._lid,
            "nodes": self.nodes,
            "links": self.links,
            "groups": [],
            "config": {},
            "extra": {"ds": {"scale": 0.8, "offset": [60, 60]}},
            "version": 0.4,
        }
        with open(os.path.join(HERE, f"{name}.json"), "w", encoding="utf-8") as f:
            json.dump(ui, f, ensure_ascii=False, indent=2)
        with open(os.path.join(HERE, f"{name}_api.json"), "w", encoding="utf-8") as f:
            json.dump(self.api, f, ensure_ascii=False, indent=2)
        print("wrote", name)


def ckpt(w, pos=(0, 0)):
    return w.node(
        "CheckpointLoaderSimple", [DEFAULT_CKPT], [],
        [("MODEL", "MODEL"), ("CLIP", "CLIP"), ("VAE", "VAE")],
        pos, (380, 100), {"ckpt_name": DEFAULT_CKPT}, title="① モデル読み込み",
    )


def clip_text(w, text, pos, title):
    return w.node(
        "CLIPTextEncode", [text], [("clip", "CLIP", None)],
        [("CONDITIONING", "CONDITIONING")], pos, (420, 180), {"text": text}, title=title,
    )


def latent(w, pos):
    return w.node(
        "EmptyLatentImage", [WIDTH, HEIGHT, 1], [],
        [("LATENT", "LATENT")], pos, (320, 110),
        {"width": WIDTH, "height": HEIGHT, "batch_size": 1}, title="④ 画像サイズ",
    )


def ksampler(w, pos, title, steps=STEPS, cfg=CFG, denoise=1.0):
    return w.node(
        "KSampler",
        [0, "randomize", steps, cfg, SAMPLER, SCHEDULER, denoise],
        [("model", "MODEL", None), ("positive", "CONDITIONING", None),
         ("negative", "CONDITIONING", None), ("latent_image", "LATENT", None)],
        [("LATENT", "LATENT")], pos, (320, 270),
        {"seed": 0, "steps": steps, "cfg": cfg, "sampler_name": SAMPLER,
         "scheduler": SCHEDULER, "denoise": denoise}, title=title,
    )


def decode(w, pos):
    return w.node(
        "VAEDecode", [], [("samples", "LATENT", None), ("vae", "VAE", None)],
        [("IMAGE", "IMAGE")], pos, (210, 50), {}, title="⑥ 画像に変換",
    )


def save(w, pos, prefix):
    return w.node(
        "SaveImage", [prefix], [("images", "IMAGE", None)], [],
        pos, (400, 450), {"filename_prefix": prefix}, title="⑦ 保存（output フォルダ）",
    )


def build_basic():
    w = WF()
    c = ckpt(w, (0, 0))
    p = clip_text(w, POS, (450, -120), "② プロンプト（描きたいもの）")
    n = clip_text(w, NEG, (450, 120), "③ ネガティブ（避けたいもの）")
    l = latent(w, (450, 360))
    k = ksampler(w, (930, 0), "⑤ 生成（Steps / CFG / Seed）")
    d = decode(w, (1300, 0))
    s = save(w, (1560, 0), "sd_system/basic")
    w.link(c, 1, p, "clip"); w.link(c, 1, n, "clip")
    w.link(c, 0, k, "model"); w.link(p, 0, k, "positive"); w.link(n, 0, k, "negative")
    w.link(l, 0, k, "latent_image")
    w.link(k, 0, d, "samples"); w.link(c, 2, d, "vae")
    w.link(d, 0, s, "images")
    w.dump("01_basic_txt2img")


def build_hires():
    w = WF()
    c = ckpt(w, (0, 0))
    p = clip_text(w, POS, (450, -120), "② プロンプト（描きたいもの）")
    n = clip_text(w, NEG, (450, 120), "③ ネガティブ（避けたいもの）")
    l = latent(w, (450, 360))
    k1 = ksampler(w, (930, 0), "⑤ 1回目生成")
    up = w.node(
        "LatentUpscaleBy", ["nearest-exact", 1.5], [("samples", "LATENT", None)],
        [("LATENT", "LATENT")], (1300, 0), (320, 90),
        {"upscale_method": "nearest-exact", "scale_by": 1.5}, title="⑤-2 拡大（1.5倍）",
    )
    k2 = ksampler(w, (1660, 0), "⑤-3 2回目生成（denoise 0.45）", steps=20, cfg=CFG, denoise=0.45)
    d = decode(w, (2030, 0))
    s = save(w, (2290, 0), "sd_system/hires")
    w.link(c, 1, p, "clip"); w.link(c, 1, n, "clip")
    w.link(c, 0, k1, "model"); w.link(p, 0, k1, "positive"); w.link(n, 0, k1, "negative")
    w.link(l, 0, k1, "latent_image")
    w.link(k1, 0, up, "samples")
    w.link(c, 0, k2, "model"); w.link(p, 0, k2, "positive"); w.link(n, 0, k2, "negative")
    w.link(up, 0, k2, "latent_image")
    w.link(k2, 0, d, "samples"); w.link(c, 2, d, "vae")
    w.link(d, 0, s, "images")
    w.dump("02_hires_fix")


def build_lora():
    w = WF()
    c = ckpt(w, (0, 0))
    lo = w.node(
        "LoraLoader", [DEFAULT_LORA, 0.8, 0.8],
        [("model", "MODEL", None), ("clip", "CLIP", None)],
        [("MODEL", "MODEL"), ("CLIP", "CLIP")], (0, 160), (380, 130),
        {"lora_name": DEFAULT_LORA, "strength_model": 0.8, "strength_clip": 0.8},
        title="①-2 LoRA（models/loras に入れたもの）",
    )
    p = clip_text(w, POS, (450, -120), "② プロンプト（LoRAのトリガーワードも入れる）")
    n = clip_text(w, NEG, (450, 120), "③ ネガティブ（避けたいもの）")
    l = latent(w, (450, 360))
    k = ksampler(w, (930, 0), "⑤ 生成（Steps / CFG / Seed）")
    d = decode(w, (1300, 0))
    s = save(w, (1560, 0), "sd_system/lora")
    w.link(c, 0, lo, "model"); w.link(c, 1, lo, "clip")
    w.link(lo, 1, p, "clip"); w.link(lo, 1, n, "clip")
    w.link(lo, 0, k, "model"); w.link(p, 0, k, "positive"); w.link(n, 0, k, "negative")
    w.link(l, 0, k, "latent_image")
    w.link(k, 0, d, "samples"); w.link(c, 2, d, "vae")
    w.link(d, 0, s, "images")
    w.dump("03_lora")


if __name__ == "__main__":
    build_basic()
    build_hires()
    build_lora()
