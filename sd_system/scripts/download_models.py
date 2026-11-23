#!/usr/bin/env python3
"""
モデルダウンローダー（sd_system）

  python3 download_models.py --default          # models.txt の * 行から取得できる最初の1つ
  python3 download_models.py --menu             # 番号を選んでDL
  python3 download_models.py --id wai17 --id noob11
  python3 download_models.py --list

- Hugging Face は直接DL、Civitai は ~/.sd_system/civitai_api_key のキーを使う
- curl で再開可能DL（途中で止まっても再実行すれば続きから）
- DL後に safetensors のヘッダを検査し、ログインページ等の誤保存を防ぐ
"""
import argparse
import json
import os
import shutil
import struct
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SUBDIR = {"checkpoint": "checkpoints", "lora": "loras", "vae": "vae", "upscale": "upscale_models"}


def load_models():
    rows = []
    with open(os.path.join(HERE, "models.txt"), encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split("|")]
            if len(parts) < 7:
                continue
            mid, fname, src, size, key, kind, desc = parts[:7]
            rows.append({
                "default": mid.startswith("*"),
                "id": mid.lstrip("*"),
                "file": fname,
                "source": src,
                "size_gb": size,
                "needs_key": key.lower() == "yes",
                "key_optional": key.lower() == "optional",
                "kind": kind,
                "desc": desc,
            })
    return rows


def read_key(config_dir):
    p = os.path.join(config_dir, "civitai_api_key")
    try:
        with open(p, encoding="utf-8") as f:
            k = f.read().strip()
            return k or None
    except OSError:
        return None


def target_path(sd_home, m):
    return os.path.join(sd_home, "models", SUBDIR.get(m["kind"], m["kind"]), m["file"])


def build_url(m, key):
    src = m["source"]
    if src.startswith("hf:"):
        repo_file = src[3:]
        owner, repo, *rest = repo_file.split("/")
        return f"https://huggingface.co/{owner}/{repo}/resolve/main/{'/'.join(rest)}"
    if src.startswith("civitai:"):
        vid = src[len("civitai:"):]
        url = f"https://civitai.com/api/download/models/{vid}?type=Model&format=SafeTensor"
        if key:
            url += f"&token={key}"
        return url
    raise ValueError(f"unknown source: {src}")


def looks_like_safetensors(path):
    try:
        with open(path, "rb") as f:
            head = f.read(8)
            if len(head) < 8:
                return False
            n = struct.unpack("<Q", head)[0]
            if n <= 0 or n > 100_000_000:
                return False
            return f.read(1) == b"{"
    except OSError:
        return False


def download(m, sd_home, key):
    dest = target_path(sd_home, m)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.exists(dest) and looks_like_safetensors(dest):
        print(f"✅ 既にあります: {m['file']}")
        return True
    if m["needs_key"] and not key:
        print(f"⏭  {m['id']}: Civitai APIキーが無いためスキップ（~/.sd_system/civitai_api_key に保存すると取得できます）")
        return False
    url = build_url(m, key)
    part = dest + ".part"
    print(f"\n⬇️  {m['file']}（約{m['size_gb']}GB）をダウンロード中... 途中で止めても再実行で続きから再開します")
    cmd = [
        "curl", "-L", "--fail", "--retry", "5", "--retry-delay", "5", "--retry-all-errors",
        "-C", "-", "--progress-bar", "-o", part, url,
    ]
    r = subprocess.run(cmd)
    if r.returncode != 0:
        # -C - で「既に完了」扱い(33)になるケースは成功として進める
        if not (r.returncode == 33 and os.path.exists(part)):
            print(f"❌ ダウンロード失敗（curl 終了コード {r.returncode}）")
            if m["source"].startswith("civitai:"):
                print("   Civitai: APIキーが正しいか、モデルがログイン必須/非公開になっていないか確認してください")
            return False
    if not looks_like_safetensors(part):
        print("❌ 取得したファイルがモデル形式ではありません（ログインページ等を保存した可能性）。削除します")
        try:
            os.remove(part)
        except OSError:
            pass
        return False
    shutil.move(part, dest)
    size_gb = os.path.getsize(dest) / 1e9
    print(f"✅ 完了: {dest}（{size_gb:.2f}GB）")
    return True


def status_mark(m, sd_home):
    return "✅" if os.path.exists(target_path(sd_home, m)) else "  "


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sd-home", default=os.environ.get("SD_HOME", os.path.expanduser("~/ComfyUI")))
    ap.add_argument("--config-dir", default=os.environ.get("SD_CONFIG_DIR", os.path.expanduser("~/.sd_system")))
    ap.add_argument("--default", action="store_true", help="models.txt の * 行から取得できる最初の1つ")
    ap.add_argument("--menu", action="store_true", help="番号を選んでDL")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--id", action="append", default=[])
    a = ap.parse_args()

    models = load_models()
    key = read_key(a.config_dir)
    if not shutil.which("curl"):
        print("❌ curl が見つかりません")
        return 1

    if a.list or a.menu:
        print(f"\nモデル保存先: {os.path.join(a.sd_home, 'models')}")
        print(f"Civitai APIキー: {'あり' if key else 'なし（Civitaiのモデルは取得不可）'}\n")
        for i, m in enumerate(models, 1):
            need = "（Civitaiキー必要）" if m["needs_key"] else ("（Civitai）" if m["key_optional"] else "")
            print(f" {status_mark(m, a.sd_home)} {i}. {m['id']:<10} {m['size_gb']}GB {need}\n      {m['desc']}")
        print()
        if a.list:
            return 0
        sel = input("ダウンロードする番号（複数はスペース区切り、Enterでやめる）: ").strip()
        if not sel:
            return 0
        chosen = []
        for tok in sel.split():
            if tok.isdigit() and 1 <= int(tok) <= len(models):
                chosen.append(models[int(tok) - 1])
        ok_all = all(download(m, a.sd_home, key) for m in chosen)
        return 0 if ok_all else 1

    if a.id:
        by_id = {m["id"]: m for m in models}
        ok_all = True
        for i in a.id:
            if i not in by_id:
                print(f"❌ 不明なID: {i}")
                ok_all = False
                continue
            ok_all &= download(by_id[i], a.sd_home, key)
        return 0 if ok_all else 1

    if a.default:
        have = [m for m in models if m["kind"] == "checkpoint" and os.path.exists(target_path(a.sd_home, m))]
        if have:
            print(f"✅ チェックポイントは既にあります: {', '.join(m['file'] for m in have)}")
            return 0
        for m in models:
            if not m["default"]:
                continue
            if m["needs_key"] and not key:
                print(f"⏭  {m['id']}（Civitaiキーなしのため次の候補へ）")
                continue
            if download(m, a.sd_home, key):
                return 0
            print(f"↪  {m['id']} を取得できなかったので次の候補へ")
        print("❌ 既定モデルを取得できませんでした。download-models.command から手動で選んでください")
        return 1

    ap.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
