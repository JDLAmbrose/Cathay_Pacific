// 逐帧导出前端成果演示影片。
// 用 Playwright 打开 index.html?render，对每一帧调用 window.__seek(t) 后截图，交给 ffmpeg 编码成 H.264 MP4。
// 画面是时间的纯函数，所以把全片切成几段并行截图，最后无损拼接并混入音轨。
//
// 用法（在 video/ 目录下）：
//   node showcase/tools/render.mjs --cues                       只导出音效时刻表 data/cues-<lang>.json（供 build_audio.py 使用）
//   node showcase/tools/render.mjs                              1920×1080 / 30fps → plume-light-showcase-90s-1080p.mp4（繁中）
//   node showcase/tools/render.mjs --lang en                    英文版 → plume-light-showcase-90s-en-1080p.mp4
//   node showcase/tools/render.mjs --stills 5,20,40             只导出指定时刻的静帧到 .build/stills/
//   node showcase/tools/render.mjs --from 28 --to 50 --out a.mp4  只导出一段（无音轨），用于预览
//   node showcase/tools/render.mjs --clips [--lang en]         导出全部分功能片段 → video/clips/<语言>/NN-<片段>.mp4（无配乐）
//   node showcase/tools/render.mjs --clip pricing              只导出一个片段
//   node showcase/tools/render.mjs --clips --with-audio        片段也配乐：逐个导出音效时刻表、合成配乐再混入
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const LANG = opt('lang', 'zh-Hant');
const CLIP = opt('clip', null);
const WIDTH = Number(opt('width', 1920));
const HEIGHT = Math.round((WIDTH * 9) / 16);
const FPS = Number(opt('fps', 30));
const WORKERS = Number(opt('workers', CLIP ? 3 : Math.max(2, Math.min(6, Math.floor(os.cpus().length / 2)))));
const STILLS = opt('stills', null);
const WITH_AUDIO = args.includes('--with-audio');   // 只对片段有意义：完整版总是带配乐
const BUILD = path.join(ROOT, '.build');
const PAGE_URL = `${pathToFileURL(path.join(ROOT, 'index.html')).href}?render&lang=${LANG}${CLIP ? `&clip=${CLIP}` : ''}`;
fs.mkdirSync(BUILD, { recursive: true });

const browser = await chromium.launch();
async function open() {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
  await page.goto(PAGE_URL);
  await page.evaluate(() => window.__ready);
  return page;
}
const run = (cmd, argv) => {
  const child = spawn(cmd, argv, { stdio: ['ignore', 'inherit', 'inherit'] });
  return once(child, 'close').then(([code]) => { if (code !== 0) throw new Error(`${path.basename(cmd)} 退出码 ${code}`); });
};

const first = await open();
const duration = await first.evaluate(() => window.__duration);
const clips = await first.evaluate(() => window.__clips);
const tag = CLIP ? `${LANG}-${CLIP}` : LANG;
// 成片默认放在 video/ 下，与旧版演示视频并列；片段放在 video/clips/<语言>/，文件名带序号
const clipNo = CLIP ? String(clips.find((c) => c.id === CLIP).n).padStart(2, '0') : '';
const OUT = path.resolve(ROOT, opt('out', CLIP ? `../clips/${LANG}/${clipNo}-${CLIP}.mp4` : `../plume-light-showcase-90s-${LANG === 'en' ? 'en-' : ''}${HEIGHT}p.mp4`));
const CUES_FILE = path.join(ROOT, 'data', CLIP ? `clips/cues-${tag}.json` : `cues-${LANG}.json`);
const AUDIO_FILE = path.join(ROOT, 'audio', CLIP ? `clips/${LANG}/${CLIP}.m4a` : `soundtrack-${LANG}.m4a`);

if (args.includes('--clips')) {
  // 逐个片段导出；每一步都是对本脚本（带配乐时还有 build_audio.py）的一次独立调用
  await browser.close();
  const self = fileURLToPath(import.meta.url);
  const step = (cmd, argv) => {
    const r = spawnSync(cmd, argv, { stdio: 'inherit', cwd: path.resolve(ROOT, '..') });
    if (r.status !== 0) { console.error(`失败：${cmd} ${argv.join(' ')}`); process.exit(r.status || 1); }
  };
  for (const { id } of clips) {
    if (WITH_AUDIO) {
      step(process.execPath, [self, '--lang', LANG, '--clip', id, '--cues']);
      step('python3', [path.join(ROOT, 'tools', 'build_audio.py'), '--lang', LANG, '--clip', id]);
    }
    step(process.execPath, [self, '--lang', LANG, '--clip', id, '--width', String(WIDTH), ...(WITH_AUDIO ? ['--with-audio'] : [])]);
  }
  console.log(`全部 ${clips.length} 个片段已导出到 clips/${LANG}/`);
  process.exit(0);
}

if (args.includes('--cues')) {
  const cues = await first.evaluate(() => window.__cues);
  fs.mkdirSync(path.dirname(CUES_FILE), { recursive: true });
  fs.writeFileSync(CUES_FILE, JSON.stringify(cues, null, 1) + '\n');
  console.log(`音效时刻表已写入 ${path.relative(ROOT, CUES_FILE)}`);
  await browser.close();
  process.exit(0);
}

if (STILLS) {
  const dir = path.join(BUILD, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of STILLS.split(',')) {
    await first.evaluate((x) => window.__seek(x), Number(s));
    await first.screenshot({ path: path.join(dir, `${LANG === 'en' ? 'en-' : ''}${CLIP ? `${CLIP}-` : ''}t${s}.png`) });
  }
  console.log(`静帧已写入 ${path.relative(ROOT, dir)}/`);
  await browser.close();
  process.exit(0);
}

const from = Number(opt('from', 0)), to = Number(opt('to', duration));
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
const total = f1 - f0;
const per = Math.ceil(total / WORKERS);
const started = Date.now();
let done = 0;
const timer = setInterval(() => {
  const sec = (Date.now() - started) / 1000;
  console.log(`帧 ${done}/${total}（${((done / total) * 100).toFixed(0)}%，已用 ${sec.toFixed(0)}s，约剩 ${done ? ((sec / done) * (total - done)).toFixed(0) : '?'}s）`);
}, 15000);

async function segment(index, page) {
  const a = f0 + index * per, b = Math.min(f1, a + per);
  const file = path.join(BUILD, `seg-${tag}-${String(index).padStart(2, '0')}.mp4`);
  const ff = spawn(ffmpegPath, [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    file,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const closed = once(ff, 'close');
  for (let i = a; i < b; i++) {
    await page.evaluate((x) => window.__seek(x), i / FPS);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 97 });
    if (!ff.stdin.write(jpg)) await once(ff.stdin, 'drain');
    done++;
  }
  ff.stdin.end();
  const [code] = await closed;
  if (code !== 0) throw new Error(`ffmpeg 退出码 ${code}`);
  await page.close();
  return file;
}
const pages = [first, ...(await Promise.all(Array.from({ length: WORKERS - 1 }, open)))];
console.log(`导出 ${tag}：${total} 帧，${WIDTH}×${HEIGHT}，${FPS}fps，${WORKERS} 路并行`);
const files = await Promise.all(pages.map((page, i) => segment(i, page)));
clearInterval(timer);
await browser.close();

const list = path.join(BUILD, `concat-${tag}.txt`);
fs.writeFileSync(list, files.map((f) => `file '${f.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
const audio = AUDIO_FILE;
const withAudio = (!CLIP || WITH_AUDIO) && fs.existsSync(audio) && from === 0 && to === duration;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await run(ffmpegPath, [
  '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
  ...(withAudio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'copy', '-shortest'] : []),
  '-c:v', 'copy', '-movflags', '+faststart', OUT,
]);
for (const f of files) fs.rmSync(f);
console.log(`完成：${path.relative(path.resolve(ROOT, '..'), OUT)}（${withAudio ? '含音轨' : '无音轨'}，用时 ${((Date.now() - started) / 1000).toFixed(0)}s）`);
