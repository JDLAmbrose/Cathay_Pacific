"""合成前端成果演示影片的音轨：原创配乐 + 界面音效（无旁白）。

读取 data/cues-<lang>.json（由 `node showcase/tools/render.mjs --cues` 从 film.js 导出），
输出 audio/soundtrack-<lang>.m4a —— 网页播放器与 MP4 共用。
用法（在 video/ 目录下）：python3 showcase/tools/build_audio.py [--lang zh-Hant|en]

配乐全部为程序合成的原创素材：120 BPM，D 大调 I–vi–IV–V，一小节 2 秒，分镜都切在小节线上。
  0–78   主体律动：底鼓、踩镲、贝斯、拨弦琶音、垫乐；开头两小节与 AI 助手段落先抽掉鼓
  70–84  高点：加入旋律
  84–90  收尾：长和弦渐弱
"""
import argparse
import json
import pathlib
import subprocess
import wave

import numpy as np
from scipy import signal

ROOT = pathlib.Path(__file__).resolve().parent.parent
SR = 44100
BEAT = 0.5
BAR = 2.0
MAIN_BAR = 0
PEAK_BAR, OUTRO_BAR = 39, 42   # 78 秒进入技术与数字，84 秒落到片尾标志

CHORDS = [
    {"bass": 38, "pad": [50, 57, 62, 66, 69], "lead": [78, 81, 86]},   # D
    {"bass": 35, "pad": [47, 54, 59, 62, 66], "lead": [78, 83, 86]},   # Bm
    {"bass": 31, "pad": [43, 50, 55, 59, 62], "lead": [79, 83, 86]},   # G
    {"bass": 33, "pad": [45, 52, 57, 61, 64], "lead": [76, 81, 85]},   # A
]
ARP = [0, 2, 1, 2, 3, 2, 1, 2, 0, 2, 1, 2, 4, 2, 1, 2]


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, clip, at, gain=1.0, pan=0.0):
    """把单声道片段放进立体声缓冲。pan：-1 左 … 1 右（等功率）。"""
    s = int(round(at * SR))
    if s >= buf.shape[1] or s < 0:
        return
    e = min(buf.shape[1], s + len(clip))
    ang = (pan + 1) * np.pi / 4
    buf[0, s:e] += clip[: e - s] * gain * np.cos(ang)
    buf[1, s:e] += clip[: e - s] * gain * np.sin(ang)


def env(n, attack, decay):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / attack) * np.exp(-tt / decay)


def lowpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "low")
    return signal.lfilter(b, a, x)


def highpass(x, hz, order=2):
    b, a = signal.butter(order, hz / (SR / 2), "high")
    return signal.lfilter(b, a, x)


def kick():
    n = int(0.32 * SR)
    tt = np.arange(n) / SR
    freq = 46 + 95 * np.exp(-tt / 0.035)
    x = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt / 0.13)
    return x * np.minimum(1, tt / 0.002)


def hat(seed, decay=0.022):
    rng = np.random.default_rng(seed)
    n = int(0.12 * SR)
    return highpass(rng.standard_normal(n), 7500) * env(n, 0.001, decay)


def clap(seed):
    rng = np.random.default_rng(seed)
    n = int(0.22 * SR)
    x = signal.lfilter(*signal.butter(2, [900 / (SR / 2), 3200 / (SR / 2)], "band"), rng.standard_normal(n))
    tt = np.arange(n) / SR
    burst = sum(np.exp(-np.maximum(0, tt - d) / 0.012) * (tt >= d) for d in (0, 0.011, 0.023))
    return x * (0.5 * burst + np.exp(-tt / 0.09) * (tt >= 0.023))


def bass_note(m, dur=0.24):
    n = int((dur + 0.05) * SR)
    tt = np.arange(n) / SR
    f = midi(m)
    x = sum((1 / h) * np.sin(2 * np.pi * f * h * tt) for h in range(1, 7))
    return lowpass(x, 420) * np.minimum(1, tt / 0.006) * np.exp(-tt / max(0.2, dur * 0.6)) * np.clip((dur + 0.05 - tt) / 0.05, 0, 1)


def pluck(m, decay=0.16):
    n = int(0.6 * SR)
    tt = np.arange(n) / SR
    f = midi(m)
    x = np.sin(2 * np.pi * f * tt) + 0.45 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt / 0.06) + 0.2 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt / 0.03)
    return x * np.minimum(1, tt / 0.003) * np.exp(-tt / decay)


def bell(m, decay=1.1):
    n = int(decay * 4 * SR)
    tt = np.arange(n) / SR
    f = midi(m)
    x = np.sin(2 * np.pi * f * tt) + 0.35 * np.sin(2 * np.pi * f * 2.76 * tt) * np.exp(-tt / (decay * 0.3)) + 0.18 * np.sin(2 * np.pi * f * 5.4 * tt) * np.exp(-tt / (decay * 0.12))
    return x * np.minimum(1, tt / 0.004) * np.exp(-tt / decay)


def pad(notes, dur, attack=0.5, release=0.6, bright=1400):
    n = int((dur + release) * SR)
    tt = np.arange(n) / SR
    x = np.zeros(n)
    for m in notes:
        f = midi(m)
        for det in (-0.006, 0.0, 0.007):
            ff = f * (1 + det)
            x += sum((1 / h) * np.sin(2 * np.pi * ff * h * tt + h * det * 900) for h in range(1, 6))
    x = lowpass(x, bright)
    shape = np.minimum(1, tt / attack) * np.clip((dur + release - tt) / release, 0, 1)
    return x * shape / (3 * len(notes))


def whoosh(seed, dur=0.75):
    rng = np.random.default_rng(seed)
    n = int(dur * SR)
    tt = np.arange(n) / SR
    noise = rng.standard_normal(n)
    # 三个频段依次出现：听感是由低到高扫过，音量在结尾前达到峰值
    out = np.zeros(n)
    for k, (lo, hi) in enumerate([(300, 900), (900, 2500), (2500, 6000)]):
        band = signal.lfilter(*signal.butter(2, [lo / (SR / 2), hi / (SR / 2)], "band"), noise)
        centre = (k + 0.6) / 3 * dur * 0.8
        out += band * np.exp(-((tt - centre) ** 2) / (2 * (dur * 0.17) ** 2))
    return out * np.minimum(1, tt / 0.05)


def boom():
    n = int(1.2 * SR)
    tt = np.arange(n) / SR
    freq = 38 + 60 * np.exp(-tt / 0.05)
    rng = np.random.default_rng(5)
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-tt / 0.32) + 0.25 * lowpass(rng.standard_normal(n), 1800) * np.exp(-tt / 0.05)


def click_sfx(seed, soft=False):
    rng = np.random.default_rng(seed)
    n = int(0.05 * SR)
    tt = np.arange(n) / SR
    tone = np.sin(2 * np.pi * (1500 if soft else 1900) * tt) * np.exp(-tt / 0.006)
    return (tone + 0.5 * highpass(rng.standard_normal(n), 3000) * np.exp(-tt / 0.003)) * (0.6 if soft else 1.0)


def pop_sfx():
    n = int(0.16 * SR)
    tt = np.arange(n) / SR
    freq = 520 + 420 * (1 - np.exp(-tt / 0.03))
    return np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.minimum(1, tt / 0.004) * np.exp(-tt / 0.045)


def reverb(x, seconds=2.2, seed=11):
    rng = np.random.default_rng(seed)
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    out = np.zeros_like(x)
    for ch in range(2):
        ir = lowpass(rng.standard_normal(n), 5200) * np.exp(-tt / (seconds / 5.5))
        ir[: int(0.012 * SR)] = 0
        out[ch] = signal.fftconvolve(x[ch], ir / np.sqrt(np.sum(ir ** 2)), mode="full")[: x.shape[1]]
    return out


def section(bar):
    """各小节的配器开关（0 关，1 开，中间值为力度）。"""
    t = bar * BAR
    full = {"kick": 1, "hat": 1, "clap": 1, "bass": 1, "arp": 1, "pad": 1, "lead": 0}
    if t < 4:         # 开头两小节：先只有拨弦与垫乐
        return {**full, "kick": 0, "clap": 0, "bass": 0}
    if t < 12:
        return {**full, "clap": 0}
    if 32 <= t < 36:  # AI 助手：抽掉鼓，留出空间
        return {**full, "kick": 0, "clap": 0, "hat": 0.5}
    if 52 <= t < 58:  # 家庭专区：柔和一些
        return {**full, "clap": 0, "lead": 0.6}
    if t >= 70:       # 看板后半与高点：加入旋律
        return {**full, "lead": 1}
    return full


def build(cues):
    duration = cues["duration"]
    n = int(duration * SR)
    drums, music, wet, sfx = (np.zeros((2, n)) for _ in range(4))
    duck = np.ones(n)   # 底鼓把贝斯与垫乐压一下，律动更清楚
    k_clip, c_clip = kick(), clap(3)
    duck_shape = 1 - 0.55 * np.exp(-np.arange(int(0.3 * SR)) / SR / 0.09)

    for bar in range(MAIN_BAR, OUTRO_BAR):
        sec = section(bar)
        t0 = bar * BAR
        ch = CHORDS[(bar - MAIN_BAR) % 4]
        place(music, pad(ch["pad"], BAR, bright=2400), t0, 1.0)
        for beat in range(4):
            tb = t0 + beat * BEAT
            if sec["kick"]:
                place(drums, k_clip, tb, 0.5)
                s = int(tb * SR)
                e = min(n, s + len(duck_shape))
                duck[s:e] = np.minimum(duck[s:e], duck_shape[: e - s])
            if sec["hat"]:
                place(drums, hat(bar * 8 + beat), tb + BEAT / 2, 0.3 * sec["hat"], 0.25)
                place(drums, hat(bar * 8 + beat + 4, 0.012), tb + BEAT * 0.75, 0.13 * sec["hat"], -0.3)
            if sec["clap"] and beat in (1, 3):
                place(drums, c_clip, tb, 0.3)
                place(wet, c_clip, tb, 0.05)
        if sec["bass"]:
            for i, off in enumerate([0, 0.75, 1.0, 1.5, 1.75]):
                place(music, bass_note(ch["bass"] + (12 if i in (2, 4) else 0)), t0 + off, 0.2)
        tones = [m + 12 for m in ch["pad"]]
        for i, idx in enumerate(ARP):
            clip = pluck(tones[idx])
            vel = 0.17 * (1.25 if i % 4 == 0 else 0.85)
            place(music, clip, t0 + i * BEAT / 4, vel, 0.5 * np.sin(i * 1.3))
            place(wet, clip, t0 + i * BEAT / 4 + 0.375, vel * 0.45, -0.5 * np.sin(i * 1.3))
        if sec["lead"]:
            for off, m in zip((0, 0.5, 1.25), ch["lead"]):
                clip = bell(m, 0.5)
                place(music, clip, t0 + off, 0.15 * sec["lead"], 0.15)
                place(wet, clip, t0 + off, 0.1 * sec["lead"])

    # 收尾：长和弦与钟琴，逐渐停下
    out_t = OUTRO_BAR * BAR
    place(music, pad(CHORDS[0]["pad"] + [74], 4.6, attack=0.05, release=1.6, bright=2600), out_t, 0.85)
    place(music, bass_note(38, 2.5), out_t, 0.3)
    for off, m in [(0, 86), (0.5, 81), (1.0, 78), (1.5, 74), (2.5, 78), (3.5, 81), (5.0, 86)]:
        clip = bell(m, 1.3)
        place(music, clip, out_t + off, 0.2, 0.3 * np.cos(off * 2))
        place(wet, clip, out_t + off, 0.2)

    # 音效
    boom_clip = boom()
    for t in cues["hits"]:
        place(sfx, boom_clip, t, 0.42)
        place(wet, boom_clip, t, 0.12)
    for i, t in enumerate(cues["whoosh"]):
        place(sfx, whoosh(40 + i, 1.1), t - 0.7, 0.2, 0.4 * (-1) ** i)   # 跟着摇镜走的一阵风声
    for i, t in enumerate(cues["clicks"]):
        place(sfx, click_sfx(100 + i), t, 0.2, 0.1)
    for i, t in enumerate(cues["keys"]):
        place(sfx, click_sfx(300 + i, soft=True), t, 0.13, -0.1 + 0.2 * (i % 2))
    pop_clip = pop_sfx()
    for t in cues["pops"]:
        place(sfx, pop_clip, t, 0.13)
        place(wet, pop_clip, t, 0.03)
    riser = whoosh(77, 2.0)   # 进入高点与片尾前的长扫
    place(sfx, riser, PEAK_BAR * BAR - 1.9, 0.2)
    place(sfx, riser, out_t - 1.9, 0.26)

    mix = drums + music * duck + reverb(wet) * 0.8 + sfx
    mix = np.stack([highpass(mix[ch], 28) for ch in range(2)])
    # 首尾淡入淡出，再软限幅，峰值留 1 dB 余量
    tt = np.arange(n) / SR
    mix *= np.minimum(1, tt / 0.3) * np.clip((duration - 0.15 - tt) / 1.6, 0, 1)
    mix = np.tanh(mix * 1.35) / np.tanh(1.35)
    mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
    return mix


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lang", default="zh-Hant")
    lang = parser.parse_args().lang
    cues = json.loads((ROOT / "data" / f"cues-{lang}.json").read_text(encoding="utf-8"))
    mix = build(cues)
    build_dir = ROOT / ".build"
    build_dir.mkdir(exist_ok=True)
    wav_path = build_dir / f"soundtrack-{lang}.wav"
    with wave.open(str(wav_path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((mix.T * 32767).astype("<i2").tobytes())
    out_dir = ROOT / "audio"
    out_dir.mkdir(exist_ok=True)
    m4a = out_dir / f"soundtrack-{lang}.m4a"
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "192000", str(wav_path), str(m4a)], check=True)
    rms = 20 * np.log10(np.sqrt(np.mean(mix ** 2)))
    count = sum(len(cues[k]) for k in ("clicks", "keys", "pops", "whoosh", "hits"))
    print(f"写出 {m4a.relative_to(ROOT)}（{cues['duration']} 秒，整体 RMS {rms:.1f} dBFS，音效 {count} 处）")


if __name__ == "__main__":
    main()
