"""生成 v2.2 演示视频音轨：合成配乐 + 音效（本版无旁白配音，旁白以字幕呈现）。

读取 data/timeline.js，输出 audio/soundtrack.m4a —— 网页播放器与 MP4 共用的完整音轨。
用法：python3 v2.2/tools/build_audio.py

配乐全部为程序合成的原创素材（不使用任何影视主题曲旋律）：
  timeline.music.tension  开场谍战主题：5/4（3+3+2+2）律动的低音断奏、手鼓、铜管与弦乐颤音（风格致敬谍战片，旋律原创）
  timeline.music.anxious  焦虑段：钟表滴答 + 低频
  timeline.music.pad_*    希望段起的 I–vi–IV–V 氛围垫乐与琶音，end 之后完全静音
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


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, clip, at):
    s = int(at * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(clip))
    buf[s:e] += clip[: e - s]


def tone(f, dur, decay, harmonics=((1, 1.0),)):
    tt = np.arange(int(dur * SR)) / SR
    x = sum(a * np.sin(2 * np.pi * f * h * tt) for h, a in harmonics)
    return x * np.exp(-tt / decay)


def _staccato(m, dur, vel):
    """低音弦乐断奏：带轻微失谐的锯齿谐波 + 快衰减，dur 后迅速收尾。"""
    length = int((dur + 0.06) * SR)
    tt = np.arange(length) / SR
    f = midi(m)
    x = sum((1 / h) * (np.sin(2 * np.pi * f * h * tt) + 0.6 * np.sin(2 * np.pi * f * 1.004 * h * tt)) for h in range(1, 9))
    env = np.minimum(1, tt / 0.008) * np.exp(-tt / 0.22) * np.clip((dur + 0.06 - tt) / 0.06, 0, 1)
    return vel * x * env


def _brass(notes, dur, vel, swell=0.03):
    """铜管：谐波随起音逐渐变亮，略带颤音；notes 为同时发声的 MIDI 音高。"""
    length = int((dur + 0.12) * SR)
    tt = np.arange(length) / SR
    att = np.minimum(1, tt / swell)
    env = att * np.clip((dur + 0.12 - tt) / 0.12, 0, 1)
    vib = 1 + 0.003 * np.sin(2 * np.pi * 5.2 * tt) * np.minimum(1, tt / 0.3)
    x = np.zeros(length)
    for m in notes:
        f = midi(m)
        for h in range(1, 9):
            bright = att ** (1 + 0.4 * h)
            x += (1 / h) * bright * np.sin(2 * np.pi * f * h * vib * tt)
    return vel * x * env


def _conga(f, vel, seed):
    """手鼓：音高从高处快速落下 + 一点敲击噪声。"""
    rng = np.random.default_rng(seed)
    tt = np.arange(int(0.22 * SR)) / SR
    pitch = f * (1 + 0.5 * np.exp(-tt / 0.012))
    x = np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-tt / 0.08)
    x += 0.25 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.004)
    return vel * x


def _hat(vel, seed, decay=0.025):
    rng = np.random.default_rng(seed)
    tt = np.arange(int(0.08 * SR)) / SR
    return vel * np.diff(rng.standard_normal(len(tt) + 1)) * np.exp(-tt / decay)


def tension(n, a, b):
    """开场谍战主题（原创旋律，致敬谍战片风格而不引用任何影视主题曲）：
    160 BPM、5/4 拍、按 3+3+2+2 八分音符分组的律动；
    低音弦乐断奏固定音型 + 手鼓/踩镲 + 铜管长音与和弦重击 + 高音弦乐颤音，
    重拍对齐 4.95s 的「IMPOSSIBLE」印章，7.85s 收在一记齐奏上，交给焦虑段。"""
    x = np.zeros(n, np.float32)
    e = 60 / 160 / 2                      # 八分音符时长
    bar = 10 * e                          # 5/4 一小节
    groups = (0, 3, 6, 8)                 # 3+3+2+2 的起点（八分音符）
    lens = (3, 3, 2, 2)
    hit = 4.95                            # 印章重拍
    t0 = hit - 2 * bar                    # 第一小节从 1.2s 开始，第三小节落在印章上
    end = b - 0.05

    # 前奏 a → t0：小军鼓滚奏渐强 + D 低音持续，像点燃引信
    k = 0
    t = a + 0.05
    while t < t0 - 0.02:
        p = (t - a) / (t0 - a)
        place(x, _hat(0.05 + 0.22 * p ** 2, seed=500 + k, decay=0.03), t)
        t += e / 4
        k += 1
    s0, s1 = int(a * SR), int(t0 * SR)
    tt = np.arange(s1 - s0) / SR
    swell = (tt / (t0 - a)) ** 2
    x[s0:s1] += (0.06 * swell * (np.sin(2 * np.pi * midi(38) * tt) + 0.4 * np.sin(2 * np.pi * midi(50) * tt))).astype(np.float32)

    # 低音固定音型：A 型 D D C E♭ / B 型 D D B♭ A，两小节一循环
    riffs = ((38, 38, 36, 39), (38, 38, 34, 33))
    j = 0
    bs = t0
    while bs < end:
        riff = riffs[j % 2]
        loud = 1.0 if bs >= hit - 0.01 else 0.8
        for g, ln, m in zip(groups, lens, riff):
            at = bs + g * e
            if at >= end:
                break
            d = ln * e * 0.55
            place(x, 0.05 * loud * _staccato(m, d, 1.0), at)
            place(x, 0.022 * loud * _staccato(m + 12, d, 1.0), at)
        # 打击乐：每个八分音符一下手鼓（组首重音），踩镲走八分，组首加低鼓
        for q in range(10):
            at = bs + q * e
            if at >= end:
                break
            accent = q in groups
            place(x, _conga(330 if q % 2 else 220, (0.13 if accent else 0.06) * loud, seed=700 + j * 10 + q), at)
            place(x, _hat(0.05 if accent else 0.03, seed=900 + j * 10 + q), at)
            if accent:
                place(x, sfx_buffer("thud", (0.55 if q == 0 else 0.3) * loud), at)
        bs += bar
        j += 1

    # 铜管：第二小节起吹出原创动机 A–B♭–A–F，印章重拍上一记小调和弦重击
    b2 = t0 + bar
    motif = ((69, 3), (70, 3), (69, 2), (65, 2))
    for (m, ln), g in zip(motif, groups):
        place(x, 0.018 * _brass((m, m - 12), ln * e * 0.9, 1.0), b2 + g * e)
    place(x, 0.02 * _brass((50, 57, 62, 65, 70), 0.55, 1.0, swell=0.012), hit)
    place(x, sfx_buffer("thud", 0.9), hit)
    # 印章之后：铜管两拍一记的切分重音，最后一小节半音上行推进
    for at, ch in ((hit + 6 * e, (50, 57, 63)), (hit + 8 * e, (50, 57, 62)),
                   (hit + bar, (51, 58, 63)), (hit + bar + 3 * e, (52, 59, 64)), (hit + bar + 6 * e, (53, 60, 65))):
        if at < end:
            place(x, 0.016 * _brass(ch, e * 1.6, 1.0, swell=0.015), at)
    # 收尾齐奏：D 八度长音 + 低鼓
    fin = end - 0.05
    place(x, 0.022 * _brass((38, 50, 62), 0.45, 1.0, swell=0.01), fin)
    place(x, sfx_buffer("thud", 0.8), fin)

    # 高音弦乐颤音（A5 与 B♭5 小二度，16 分音符抖动），印章之后铺满到结尾，制造紧迫感
    s0, s1 = int(hit * SR), min(n, int(end * SR))
    tt = np.arange(s1 - s0) / SR
    trem = 0.5 + 0.5 * np.sign(np.sin(2 * np.pi * (1 / (e / 2)) * tt))
    strings = (np.sin(2 * np.pi * midi(81) * tt) + 0.8 * np.sin(2 * np.pi * midi(82) * tt)
               + 0.3 * np.sin(4 * np.pi * midi(81) * tt))
    env = np.minimum(1, tt / 0.6) * np.clip((end - hit - tt) / 0.15, 0, 1)
    x[s0:s1] += (0.010 * strings * (0.6 + 0.4 * trem) * env).astype(np.float32)
    # D 低频持续音贯穿全段
    s0, s1 = int(t0 * SR), min(n, int(end * SR))
    tt = np.arange(s1 - s0) / SR
    drone = np.sin(2 * np.pi * midi(26) * tt) + 0.5 * np.sin(2 * np.pi * midi(38) * tt)
    env = np.minimum(1, tt / 0.3) * np.clip((end - t0 - tt) / 0.2, 0, 1)
    x[s0:s1] += (0.035 * drone * env).astype(np.float32)
    # 开场主题要压过后面的氛围垫乐：整体抬高约 5 dB，用 tanh 软限幅防止重击削波
    return (0.6 * np.tanh(x * 1.8 / 0.6)).astype(np.float32)


def anxious(n, a, b):
    """焦虑段：钟表滴答 + 低频持续音（比开场更松弛，形成反差）。"""
    x = np.zeros(n, np.float32)
    k = 0
    at = a + 0.2
    while at < b - 0.2:
        place(x, sfx_buffer("tick", 0.5 if k % 2 == 0 else 0.32), at)
        at += 0.5
        k += 1
    s0, s1 = int(a * SR), min(n, int(b * SR))
    tt = np.arange(s1 - s0) / SR
    drone = np.sin(2 * np.pi * midi(43) * tt) + 0.4 * np.sin(2 * np.pi * midi(50) * tt)
    env = np.minimum(1, tt / 1.0) * np.clip((b - a - tt) / 0.6, 0, 1)
    x[s0:s1] += (0.035 * drone * env).astype(np.float32)
    return x


def pad(total, start, arp_start, end):
    """柔和的 I–vi–IV–V 氛围垫乐 + 稀疏拨弦琶音，从 start 起，end 时淡出至静音。"""
    n = int(total * SR)
    t = np.arange(n) / SR
    left = np.zeros(n, np.float32)
    right = np.zeros(n, np.float32)
    chords = {
        "Bm9":   [47, 54, 57, 61, 62],
        "Gmaj9": [43, 50, 54, 57, 59],
        "Dmaj9": [50, 57, 61, 64, 66],
        "A6":    [45, 52, 54, 59, 61],
    }
    seq = ["Dmaj9", "Bm9", "Gmaj9", "A6"] * 10
    bar = 3.75
    for k, name in enumerate(seq):
        cstart = start + k * bar
        if cstart >= end:
            break
        s0 = int(cstart * SR)
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
        if cstart >= arp_start:
            step = bar / 8
            order = [0, 2, 1, 3, 2, 4, 3, 1]
            for q in range(8):
                ps = int((cstart + q * step) * SR)
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
    fade = np.clip((t - start) / 2.0, 0, 1) * np.clip((end - t) / 3.0, 0, 1)
    return left * trem * fade, right * trem * fade


def sfx_buffer(kind, gain=1.0, dur=1.0, seed=0, note=76):
    rng = np.random.default_rng(seed)
    if kind == "click":
        tt = np.arange(int(0.05 * SR)) / SR
        x = 0.5 * np.sin(2 * np.pi * 2300 * tt) * np.exp(-tt / 0.010)
        x += 0.25 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.003)
        return 0.32 * gain * x
    if kind == "tick":
        tt = np.arange(int(0.04 * SR)) / SR
        x = np.sin(2 * np.pi * 3400 * tt) * np.exp(-tt / 0.004) + 0.3 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.002)
        return 0.16 * gain * x
    if kind == "pop":
        tt = np.arange(int(0.12 * SR)) / SR
        f = 520 + 900 * np.minimum(1, tt / 0.05)
        return 0.16 * gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.035)
    if kind == "thud":
        tt = np.arange(int(0.25 * SR)) / SR
        f = 150 * np.exp(-tt / 0.08) + 60
        return 0.32 * gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.07)
    if kind == "stamp":
        tt = np.arange(int(0.5 * SR)) / SR
        f = 110 * np.exp(-tt / 0.06) + 45
        x = 0.55 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.12)
        x += 0.35 * rng.standard_normal(len(tt)) * np.exp(-tt / 0.012)
        return 0.6 * gain * x
    if kind == "boom":
        tt = np.arange(int(2.2 * SR)) / SR
        f = 32 + 48 * np.exp(-tt / 0.3)
        x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.8) * np.minimum(1, tt / 0.01)
        return 0.55 * gain * x
    if kind == "chime":
        tt = np.arange(int(1.2 * SR)) / SR
        x = np.zeros_like(tt)
        for f, off in ((1318.5, 0.0), (1975.5, 0.09)):
            o = int(off * SR)
            tt2 = tt[: len(tt) - o]
            x[o:] += (np.sin(2 * np.pi * f * tt2) + 0.2 * np.sin(4 * np.pi * f * tt2)) * np.exp(-tt2 / 0.38)
        return 0.11 * gain * x
    if kind == "bell":
        x = tone(midi(note), 2.2, 0.9, ((1, 1.0), (2.01, 0.4), (3.98, 0.15)))
        return 0.09 * gain * x
    if kind == "magic":
        x = np.zeros(int(1.6 * SR))
        for i, m in enumerate((84, 86, 88, 91, 93, 96, 98, 100)):
            place(x, 0.06 * tone(midi(m), 0.9, 0.3, ((1, 1), (2, 0.2))), i * 0.055)
        return gain * x
    if kind == "beep":
        x = np.zeros(int(0.35 * SR))
        for off in (0.0, 0.14):
            tt = np.arange(int(0.08 * SR)) / SR
            place(x, 0.07 * np.sin(2 * np.pi * 1480 * tt) * np.minimum(1, (0.08 - tt) / 0.01), off)
        return gain * x
    if kind == "boing":
        tt = np.arange(int(0.7 * SR)) / SR
        f = 230 * (1 + 0.45 * np.exp(-tt / 0.25) * np.sin(2 * np.pi * 13 * tt)) * (1 + 0.6 * tt)
        return 0.2 * gain * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.3)
    if kind == "shutter":
        x = np.zeros(int(0.2 * SR))
        for off in (0.0, 0.07):
            tt = np.arange(int(0.012 * SR)) / SR
            place(x, 0.4 * np.diff(rng.standard_normal(len(tt) + 1)) * np.exp(-tt / 0.004), off)
        return gain * x
    if kind == "fanfare":
        x = np.zeros(int(1.6 * SR))
        brass = tuple((h, 1 / h) for h in range(1, 7))
        for off, dur, notes in ((0.0, 0.13, (62, 66, 69)), (0.17, 1.2, (62, 66, 69, 74))):
            tt = np.arange(int(dur * SR)) / SR
            env = np.minimum(1, tt / 0.02) * np.clip((dur - tt) / 0.25, 0, 1)
            vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * tt)
            chord = sum(sum(a * np.sin(2 * np.pi * midi(m) * h * vib * tt) for h, a in brass) for m in notes)
            place(x, 0.028 * chord * env, off)
        return gain * x
    if kind == "sizzle":
        length = int(dur * SR)
        hiss = np.diff(rng.standard_normal(length + 1)) * 0.035
        crack = np.zeros(length)
        for p in rng.integers(0, length, int(dur * 28)):
            m = min(length - p, int(0.004 * SR))
            crack[p:p + m] += rng.uniform(0.1, 0.35) * rng.standard_normal(m) * np.exp(-np.arange(m) / (0.001 * SR))
        tt = np.arange(length) / SR
        env = np.minimum(1, tt / 0.15) * np.clip((dur - tt) / 0.2, 0, 1)
        return gain * (hiss + crack) * env
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


def main():
    tl = load_timeline()
    total = float(tl["duration"])
    cfg = tl.get("music", {})
    BUILD.mkdir(parents=True, exist_ok=True)
    n = int(total * SR)

    ml, mr = pad(total, cfg.get("pad_start", 0), cfg.get("arp_start", 11.25), cfg.get("end", total))
    intro = np.zeros(n, np.float32)
    if "tension" in cfg:
        intro += tension(n, *cfg["tension"])
    if "anxious" in cfg:
        intro += anxious(n, *cfg["anxious"])
    ml = ml + intro
    mr = mr + intro

    fx = np.zeros(n, np.float32)
    for track in tl["cursor"]:
        for kf in track:
            if kf.get("click"):
                place(fx, sfx_buffer("click"), kf["t"])
    for i, ev in enumerate(tl["sfx"]):
        clip = sfx_buffer(ev["type"], ev.get("gain", 1.0), ev.get("dur", 1.0), seed=i, note=ev.get("note", 76))
        place(fx, clip, ev["t"])

    left = ml + fx
    right = mr + fx
    # 结尾按配置完全静音
    if "silence" in cfg:
        tt = np.arange(n) / SR
        gate = np.clip((cfg["silence"] - tt) / 0.4, 0, 1)
        left *= gate
        right *= gate
    # 无旁白：整体归一到 -1 dBFS 峰值
    peak = max(np.abs(left).max(), np.abs(right).max())
    left *= 0.89 / peak
    right *= 0.89 / peak
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

    print(f"写出 {m4a.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
