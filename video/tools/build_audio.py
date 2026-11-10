"""生成演示视频音轨：旁白（macOS say）+ 合成氛围垫乐 + 界面音效。

读取 data/timeline.js，输出：
  audio/soundtrack.m4a   —— 网页播放器与 MP4 共用的完整音轨
  data/timing.js         —— 每句旁白的实际时长，供字幕使用
用法：python3 tools/build_audio.py
"""
import json
import pathlib
import subprocess
import wave

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
BUILD = ROOT / ".build" / "audio"
SR = 44100


def load_timeline():
    src = (ROOT / "data" / "timeline.js").read_text(encoding="utf-8")
    body = src[src.index("{"): src.rindex("}") + 1]
    return json.loads(body)


def read_wav(path):
    with wave.open(str(path)) as w:
        assert w.getsampwidth() == 2 and w.getframerate() == SR
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float32) / 32768
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(axis=1)
    return data


def tts(line, voice, rate):
    out = BUILD / f"{line['id']}.wav"
    subprocess.run(
        ["say", "-v", voice, "-r", str(line.get("rate", rate)), "-o", str(out),
         "--file-format=WAVE", f"--data-format=LEI16@{SR}", line["tts"]],
        check=True,
    )
    buf = read_wav(out)
    # 去掉首尾静音，让字幕与发声对齐
    idx = np.where(np.abs(buf) > 0.01)[0]
    if len(idx):
        buf = buf[max(0, idx[0] - 200): idx[-1] + 2000]
    return buf


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def music(total):
    """柔和的 I–vi–IV–V 氛围垫乐 + 稀疏拨弦琶音；开头小调铺陈，品牌出现后转明亮。"""
    n = int(total * SR)
    t = np.arange(n) / SR
    left = np.zeros(n, np.float32)
    right = np.zeros(n, np.float32)
    chords = {
        "Bm9":   [47, 54, 57, 61, 62],
        "Gmaj9": [43, 50, 54, 57, 59],
        "Asus":  [45, 52, 57, 62, 64],
        "Dmaj9": [50, 57, 61, 64, 66],
        "A6":    [45, 52, 54, 59, 61],
    }
    seq = ["Bm9", "Gmaj9", "Asus"] + ["Dmaj9", "Bm9", "Gmaj9", "A6"] * 8
    bar = 3.75
    for k, name in enumerate(seq):
        start = k * bar
        if start >= total:
            break
        s0 = int(start * SR)
        seg_t = np.arange(min(int((bar + 1.6) * SR), n - s0)) / SR
        env = (np.minimum(1, seg_t / 1.2) * np.clip((bar + 1.6 - seg_t) / 1.6, 0, 1)) ** 1.3
        notes = chords[name]
        for j, m in enumerate(notes[1:]):
            f = midi(m)
            for ch, det in ((left, 0.9985), (right, 1.0015)):
                wav = np.sin(2 * np.pi * f * det * seg_t + j) + 0.22 * np.sin(4 * np.pi * f * det * seg_t)
                ch[s0:s0 + len(seg_t)] += (0.05 * env * wav).astype(np.float32)
        bass = (np.sin(2 * np.pi * midi(notes[0] - 12) * seg_t) * 0.09 * env).astype(np.float32)
        left[s0:s0 + len(seg_t)] += bass
        right[s0:s0 + len(seg_t)] += bass
        if start >= 11.25:
            step = bar / 8
            order = [0, 2, 1, 3, 2, 4, 3, 1]
            for q in range(8):
                ps = int((start + q * step) * SR)
                if ps >= n:
                    break
                pt = np.arange(min(int(1.2 * SR), n - ps)) / SR
                f = midi(notes[order[q] % len(notes)] + 12 + (12 if q % 4 == 3 else 0))
                vel = 0.030 + 0.012 * ((q * 37 + k * 11) % 5) / 4
                pluck = (np.sin(2 * np.pi * f * pt) + 0.3 * np.sin(4 * np.pi * f * pt)) * np.exp(-pt / 0.32) * vel
                pan = 0.35 if q % 2 else -0.35
                left[ps:ps + len(pt)] += (pluck * (1 - pan) / 1.35).astype(np.float32)
                right[ps:ps + len(pt)] += (pluck * (1 + pan) / 1.35).astype(np.float32)
    trem = 1 + 0.08 * np.sin(2 * np.pi * 0.18 * t)
    fade = np.minimum(1, t / 2.5) * np.clip((total - t) / 4.0, 0, 1)
    return left * trem * fade, right * trem * fade


def sfx_buffer(kind, gain=1.0, dur=1.0, seed=0):
    rng = np.random.default_rng(seed)
    if kind == "click":
        tt = np.arange(int(0.05 * SR)) / SR
        x = 0.5 * np.sin(2 * np.pi * 2300 * tt) * np.exp(-tt / 0.010)
        x += 0.25 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.003)
        return 0.32 * gain * x
    if kind == "pop":
        tt = np.arange(int(0.12 * SR)) / SR
        f = 520 + 900 * np.minimum(1, tt / 0.05)
        return 0.16 * gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.035)
    if kind == "thud":
        tt = np.arange(int(0.25 * SR)) / SR
        f = 150 * np.exp(-tt / 0.08) + 60
        return 0.32 * gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.07)
    if kind == "chime":
        tt = np.arange(int(1.2 * SR)) / SR
        x = np.zeros_like(tt)
        for f, off in ((1318.5, 0.0), (1975.5, 0.09)):
            o = int(off * SR)
            tt2 = tt[: len(tt) - o]
            x[o:] += (np.sin(2 * np.pi * f * tt2) + 0.2 * np.sin(4 * np.pi * f * tt2)) * np.exp(-tt2 / 0.38)
        return 0.11 * gain * x
    if kind == "whoosh":
        length = int(0.9 * SR)
        tt = np.arange(length) / SR
        noise = np.convolve(rng.standard_normal(length), np.ones(24) / 24, mode="same")
        env = np.sin(np.pi * np.minimum(1, tt / 0.9)) ** 2
        return 0.30 * gain * noise * env
    if kind == "typing":
        x = np.zeros(int((dur + 0.1) * SR))
        pos = 0.0
        while pos < dur:
            click = sfx_buffer("click", 0.22, seed=int(pos * 1000))
            s = int(pos * SR)
            x[s:s + len(click)] += click[: len(x) - s]
            pos += 0.06 + 0.05 * rng.random()
        return x
    raise ValueError(kind)


def place(buf, clip, at):
    s = int(at * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(clip))
    buf[s:e] += clip[: e - s]


def main():
    tl = load_timeline()
    total = float(tl["duration"])
    BUILD.mkdir(parents=True, exist_ok=True)
    n = int(total * SR)

    voice = np.zeros(n, np.float32)
    timing = {}
    lines = tl["narration"]
    for i, line in enumerate(lines):
        clip = tts(line, tl["voice"], tl["rate"])
        dur = len(clip) / SR
        timing[line["id"]] = round(dur, 3)
        nxt = lines[i + 1]["at"] if i + 1 < len(lines) else total
        flag = "  <-- 与下一句重叠" if line["at"] + dur > nxt else ""
        print(f"{line['id']:>4} @{line['at']:6.1f}s  {dur:5.2f}s  结束 {line['at'] + dur:6.2f}s{flag}")
        place(voice, clip, line["at"])
    voice *= 0.82 / max(1e-6, np.abs(voice).max())

    # 旁白时压低垫乐（平滑侧链）
    active = np.zeros(n, np.float32)
    for line in lines:
        s = int(line["at"] * SR)
        active[s: s + int(timing[line["id"]] * SR)] = 1
    k = int(0.35 * SR)
    duck_gain = 1 - 0.45 * np.clip(np.convolve(active, np.ones(k) / k, mode="same"), 0, 1)

    ml, mr = music(total)
    ml *= duck_gain
    mr *= duck_gain

    fx = np.zeros(n, np.float32)
    for track in tl["cursor"]:
        for kf in track:
            if kf.get("click"):
                place(fx, sfx_buffer("click"), kf["t"])
    for i, ev in enumerate(tl["sfx"]):
        place(fx, sfx_buffer(ev["type"], ev.get("gain", 1.0), ev.get("dur", 1.0), seed=i), ev["t"])

    left = voice + ml + fx
    right = voice + mr + fx
    peak = max(np.abs(left).max(), np.abs(right).max())
    if peak > 0.98:
        left /= peak / 0.98
        right /= peak / 0.98
    pcm = (np.clip(np.stack([left, right], axis=1), -1, 1) * 32767).astype("<i2")

    wav_path = BUILD / "soundtrack.wav"
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())

    out_dir = ROOT / "audio"
    out_dir.mkdir(exist_ok=True)
    m4a = out_dir / "soundtrack.m4a"
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "160000", str(wav_path), str(m4a)], check=True)

    (ROOT / "data" / "timing.js").write_text(
        "/* 由 tools/build_audio.py 生成：每句旁白的实际时长（秒） */\n"
        f"window.TIMING = {json.dumps(timing, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print(f"写出 {m4a.relative_to(ROOT)} 与 data/timing.js")


if __name__ == "__main__":
    main()
