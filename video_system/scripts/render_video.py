#!/usr/bin/env python3
"""timeline.json から動画をレンダリングするスクリプト。

使い方:
    python3 video_system/scripts/render_video.py <project_dir>/timeline.json

timeline.json の仕様は video_system/CLAUDE.md を参照。
ffmpeg / ffprobe が必要。テロップには日本語フォント (Noto Sans CJK 等) を使用する。
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
    "C:/Windows/Fonts/meiryo.ttc",
]

# テロップのスタイルプリセット。fontsize は画面高さに対する比率。
TELOP_STYLES = {
    "title":   {"size_ratio": 0.055, "y": "(h-text_h)/2", "border": True,  "box": False},
    "caption": {"size_ratio": 0.042, "y": "h-text_h-h*0.16", "border": False, "box": True},
    "note":    {"size_ratio": 0.030, "y": "h*0.08",      "border": False, "box": True},
}


def run(cmd, desc=""):
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        sys.stderr.write(f"[render_video] ffmpeg failed: {desc}\n")
        sys.stderr.write(" ".join(str(c) for c in cmd) + "\n")
        sys.stderr.write(proc.stderr.decode("utf-8", errors="replace")[-3000:] + "\n")
        sys.exit(1)


def probe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        return float(out.stdout.decode().strip())
    except ValueError:
        return None


def has_audio(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "a",
         "-show_entries", "stream=index", "-of", "csv=p=0", path],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    return bool(out.stdout.decode().strip())


def find_font(cfg):
    font = cfg.get("font")
    if font and font != "auto":
        if os.path.exists(font):
            return font
        sys.stderr.write(f"[render_video] 指定フォントが見つかりません: {font}\n")
        sys.exit(1)
    for f in FONT_CANDIDATES:
        if os.path.exists(f):
            return f
    sys.stderr.write("[render_video] 日本語フォントが見つかりません。"
                     "timeline.json の \"font\" にフォントパスを指定してください。\n")
    sys.exit(1)


def build_drawtext(telop, font, width, height, tmpdir, idx):
    style = TELOP_STYLES.get(telop.get("style", "caption"), TELOP_STYLES["caption"])
    fontsize = telop.get("fontsize") or max(24, int(height * style["size_ratio"]))
    color = telop.get("color", "white")
    x = telop.get("x", "(w-text_w)/2")
    y = telop.get("y", style["y"])

    textfile = os.path.join(tmpdir, f"telop_{idx}.txt")
    with open(textfile, "w", encoding="utf-8") as f:
        f.write(telop["text"])

    parts = [
        f"drawtext=fontfile='{font}'",
        f"textfile='{textfile}'",
        f"fontsize={fontsize}",
        f"fontcolor={color}",
        f"x={x}",
        f"y={y}",
        "line_spacing=12",
    ]
    if telop.get("box", style["box"]):
        parts.append(f"box=1:boxcolor={telop.get('boxcolor', 'black@0.55')}:boxborderw=18")
    if telop.get("border", style["border"]):
        parts.append(f"borderw={max(2, fontsize // 12)}:bordercolor=black")
    start = telop.get("start")
    end = telop.get("end")
    if start is not None or end is not None:
        s = 0 if start is None else start
        e = 100000 if end is None else end
        parts.append(f"enable='between(t,{s},{e})'")
    return ":".join(parts)


def render_scene(scene, idx, cfg, tmpdir):
    width, height, fps = cfg["width"], cfg["height"], cfg["fps"]
    font = cfg["_font"]
    base = cfg["_base_dir"]
    stype = scene.get("type", "video")
    src = scene.get("src")
    if src:
        src = os.path.join(base, src)
        if not os.path.exists(src):
            sys.stderr.write(f"[render_video] 素材が見つかりません: {src}\n")
            sys.exit(1)

    inputs = []
    duration = scene.get("duration")

    if stype == "video":
        if duration is None:
            total = probe_duration(src)
            duration = max(0.1, (total or 5.0) - scene.get("start", 0))
        pre = []
        if scene.get("start"):
            pre += ["-ss", str(scene["start"])]
        inputs.append(pre + ["-t", str(duration), "-i", src])
        audio_from_src = has_audio(src) and not scene.get("mute", False)
    elif stype == "image":
        duration = duration or 4.0
        if scene.get("zoom"):
            # Ken Burns: 静止画1枚を zoompan でゆっくりズームさせる
            inputs.append(["-i", src])
        else:
            inputs.append(["-loop", "1", "-t", str(duration), "-framerate", str(fps), "-i", src])
        audio_from_src = False
    elif stype == "color":
        duration = duration or 3.0
        color = scene.get("color", "black")
        inputs.append(["-f", "lavfi", "-t", str(duration), "-i",
                       f"color=c={color}:s={width}x{height}:r={fps}"])
        audio_from_src = False
    else:
        sys.stderr.write(f"[render_video] 不明な type: {stype}\n")
        sys.exit(1)

    # 無音音声（音声なし素材用）
    if not audio_from_src:
        inputs.append(["-f", "lavfi", "-t", str(duration), "-i",
                       "anullsrc=channel_layout=stereo:sample_rate=48000"])

    # シーン単位のナレーション音声
    narration = scene.get("narration")
    narration_idx = None
    if narration:
        nar_src = os.path.join(base, narration["src"])
        if not os.path.exists(nar_src):
            sys.stderr.write(f"[render_video] ナレーションが見つかりません: {nar_src}\n")
            sys.exit(1)
        narration_idx = len(inputs)
        inputs.append(["-t", str(duration), "-i", nar_src])

    # オーバーレイ素材
    overlays = scene.get("overlays", [])
    overlay_input_start = len(inputs)
    for ov in overlays:
        ov_src = os.path.join(base, ov["src"])
        if not os.path.exists(ov_src):
            sys.stderr.write(f"[render_video] オーバーレイ素材が見つかりません: {ov_src}\n")
            sys.exit(1)
        inputs.append(["-loop", "1", "-t", str(duration), "-i", ov_src])

    # --- filter_complex 組み立て ---
    filters = []
    if stype == "image" and scene.get("zoom"):
        # ジッタ防止のため大きめに拡大してから zoompan する
        frames = max(1, int(round(duration * fps)))
        zoom_to = 1.12
        step = (zoom_to - 1.0) / frames
        vf = (f"[0:v]scale={width * 2}:{height * 2}:force_original_aspect_ratio=increase,"
              f"crop={width * 2}:{height * 2},"
              f"zoompan=z='min(zoom+{step:.6f},{zoom_to})':d={frames}"
              f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'"
              f":s={width}x{height}:fps={fps},setsar=1,format=yuv420p[v0]")
    else:
        vf = (f"[0:v]fps={fps},scale={width}:{height}:force_original_aspect_ratio=decrease,"
              f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[v0]")
    filters.append(vf)
    last = "v0"

    for j, ov in enumerate(overlays):
        in_idx = overlay_input_start + j
        scale = ov.get("scale")
        ov_label = f"ov{j}"
        if scale:
            filters.append(f"[{in_idx}:v]scale=iw*{scale}:-1[{ov_label}]")
        else:
            filters.append(f"[{in_idx}:v]null[{ov_label}]")
        x = ov.get("x", "W-w-40")
        y = ov.get("y", "40")
        enable = f":enable='between(t,{ov.get('start', 0)},{ov.get('end', duration)})'"
        out_label = f"v_ov{j}"
        filters.append(f"[{last}][{ov_label}]overlay={x}:{y}{enable}[{out_label}]")
        last = out_label

    telop_filters = [build_drawtext(t, font, width, height, tmpdir, f"{idx}_{k}")
                     for k, t in enumerate(scene.get("telops", []))]
    fade_parts = []
    if scene.get("fade_in"):
        fade_parts.append(f"fade=t=in:st=0:d={scene['fade_in']}")
    if scene.get("fade_out"):
        st = max(0, duration - scene["fade_out"])
        fade_parts.append(f"fade=t=out:st={st}:d={scene['fade_out']}")
    chain = ",".join(telop_filters + fade_parts) or "null"
    filters.append(f"[{last}]{chain}[vout]")

    if audio_from_src:
        vol = scene.get("volume", 1.0)
        filters.append(f"[0:a]volume={vol},aresample=48000,"
                       f"apad=whole_dur={duration}[abase]")
    else:
        filters.append("[1:a]anull[abase]")

    if narration_idx is not None:
        nar_vol = narration.get("volume", 1.0)
        filters.append(f"[{narration_idx}:a]volume={nar_vol},aresample=48000,"
                       f"apad=whole_dur={duration}[anar]")
        filters.append("[abase][anar]amix=inputs=2:duration=first:"
                       "dropout_transition=0:normalize=0[aout]")
    else:
        filters.append("[abase]anull[aout]")

    out_path = os.path.join(tmpdir, f"scene_{idx:03d}.mp4")
    cmd = ["ffmpeg", "-y", "-hide_banner"]
    for inp in inputs:
        cmd += inp
    cmd += ["-filter_complex", ";".join(filters),
            "-map", "[vout]", "-map", "[aout]",
            "-c:v", "libx264", "-preset", cfg.get("preset", "medium"), "-crf", "20",
            "-c:a", "aac", "-ar", "48000", "-ac", "2",
            "-t", str(duration), "-r", str(fps),
            out_path]
    run(cmd, f"scene {idx}")
    return out_path


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    timeline_path = os.path.abspath(sys.argv[1])
    base_dir = os.path.dirname(timeline_path)
    with open(timeline_path, encoding="utf-8") as f:
        cfg = json.load(f)

    cfg.setdefault("width", 1080)
    cfg.setdefault("height", 1920)
    cfg.setdefault("fps", 30)
    cfg["_base_dir"] = base_dir
    cfg["_font"] = find_font(cfg)

    output = os.path.join(base_dir, cfg.get("output", "output/final.mp4"))
    os.makedirs(os.path.dirname(output), exist_ok=True)

    tmpdir = tempfile.mkdtemp(prefix="render_video_")
    try:
        # 1. 各シーンをレンダリング
        scene_files = []
        for i, scene in enumerate(cfg.get("scenes", [])):
            print(f"[render_video] シーン {i + 1}/{len(cfg['scenes'])} をレンダリング中...")
            scene_files.append(render_scene(scene, i, cfg, tmpdir))

        if not scene_files:
            sys.stderr.write("[render_video] scenes が空です。\n")
            sys.exit(1)

        # 2. 連結
        concat_list = os.path.join(tmpdir, "concat.txt")
        with open(concat_list, "w", encoding="utf-8") as f:
            for p in scene_files:
                f.write(f"file '{p}'\n")
        concat_path = os.path.join(tmpdir, "concat.mp4")
        run(["ffmpeg", "-y", "-hide_banner", "-f", "concat", "-safe", "0",
             "-i", concat_list, "-c", "copy", concat_path], "concat")

        # 3. BGM / ナレーションのミックス
        bgm = cfg.get("bgm")
        narration = cfg.get("narration")
        if bgm or narration:
            total = probe_duration(concat_path) or 0
            cmd = ["ffmpeg", "-y", "-hide_banner", "-i", concat_path]
            mix_labels = ["[0:a]"]
            filters = []
            n_in = 1
            if bgm:
                bgm_src = os.path.join(base_dir, bgm["src"])
                if not os.path.exists(bgm_src):
                    sys.stderr.write(f"[render_video] BGMが見つかりません: {bgm_src}\n")
                    sys.exit(1)
                cmd += ["-stream_loop", "-1", "-i", bgm_src]
                vol = bgm.get("volume", 0.15)
                fade = bgm.get("fade_out", 2.0)
                st = max(0, total - fade)
                filters.append(f"[{n_in}:a]volume={vol},aresample=48000,"
                               f"afade=t=out:st={st}:d={fade}[bgm]")
                mix_labels.append("[bgm]")
                n_in += 1
            if narration:
                nar_src = os.path.join(base_dir, narration["src"])
                if not os.path.exists(nar_src):
                    sys.stderr.write(f"[render_video] ナレーションが見つかりません: {nar_src}\n")
                    sys.exit(1)
                cmd += ["-i", nar_src]
                vol = narration.get("volume", 1.0)
                delay = int(narration.get("start", 0) * 1000)
                filters.append(f"[{n_in}:a]volume={vol},aresample=48000,"
                               f"adelay={delay}|{delay}[nar]")
                mix_labels.append("[nar]")
                n_in += 1
            filters.append("".join(mix_labels) +
                           f"amix=inputs={len(mix_labels)}:duration=first:"
                           f"dropout_transition=0:normalize=0[amix]")
            cmd += ["-filter_complex", ";".join(filters),
                    "-map", "0:v", "-map", "[amix]",
                    "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2",
                    output]
            run(cmd, "bgm/narration mix")
        else:
            shutil.copyfile(concat_path, output)

        # 4. 結果レポート
        dur = probe_duration(output) or 0
        size_mb = os.path.getsize(output) / (1024 * 1024)
        print(f"[render_video] 完了: {output}")
        print(f"[render_video] 長さ: {dur:.1f}秒 / サイズ: {size_mb:.1f}MB")
        if dur > 140:
            print("[render_video] ⚠ X(Twitter)の動画は140秒までです。カットを検討してください。")
        if size_mb > 512:
            print("[render_video] ⚠ X(Twitter)の動画は512MBまでです。圧縮を検討してください。")
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


if __name__ == "__main__":
    main()
