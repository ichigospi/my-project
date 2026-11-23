#!/usr/bin/env python3
"""
sd_system のワークフローを ComfyUI の Workflows サイドバーに配置する。
  python3 install_workflows.py <SD_HOME> <workflows_dir>

- 配置先: <SD_HOME>/user/default/workflows/sd_system/
- ワークフロー内のモデル名（ckpt_name / lora_name）が実在しなければ、
  models/checkpoints・models/loras にある実ファイルへ自動で置き換える
"""
import glob
import json
import os
import sys


def pick_existing(folder, preferred, prefer_words):
    files = sorted(
        os.path.basename(p)
        for p in glob.glob(os.path.join(folder, "*.safetensors")) + glob.glob(os.path.join(folder, "*.ckpt"))
    )
    if not files:
        return preferred
    if preferred in files:
        return preferred
    for w in prefer_words:
        for f in files:
            if w.lower() in f.lower():
                return f
    return files[0]


def main(sd_home, wf_dir):
    dest_dir = os.path.join(sd_home, "user", "default", "workflows", "sd_system")
    os.makedirs(dest_dir, exist_ok=True)
    ckpt_dir = os.path.join(sd_home, "models", "checkpoints")
    lora_dir = os.path.join(sd_home, "models", "loras")
    n = 0
    for src in sorted(glob.glob(os.path.join(wf_dir, "*.json"))):
        if src.endswith("_api.json"):
            continue
        with open(src, encoding="utf-8") as f:
            wf = json.load(f)
        for node in wf.get("nodes", []):
            wv = node.get("widgets_values") or []
            if node.get("type") == "CheckpointLoaderSimple" and wv:
                wv[0] = pick_existing(ckpt_dir, wv[0], ["WAI", "Illustrious", "NoobAI"])
            if node.get("type") == "LoraLoader" and wv:
                wv[0] = pick_existing(lora_dir, wv[0], [])
        wf.setdefault("extra", {})["sd_system_generated"] = True
        dest = os.path.join(dest_dir, os.path.basename(src))
        with open(dest, "w", encoding="utf-8") as f:
            json.dump(wf, f, ensure_ascii=False, indent=2)
        n += 1
    print(f"✅ ワークフロー {n} 件を配置: {dest_dir}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    sys.exit(main(sys.argv[1], sys.argv[2]))
