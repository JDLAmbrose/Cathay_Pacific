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
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
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
const WIDTH = Number(opt('width', 1920));
const HEIGHT = Math.round((WIDTH * 9) / 16);
const FPS = Number(opt('fps', 30));
const WORKERS = Number(opt('workers', Math.max(2, Math.min(6, Math.floor(os.cpus().length / 2)))));
const STILLS = opt('stills', null);
const BUILD = path.join(ROOT, '.build');
// 成片默认放在 video/ 下，与旧版演示视频并列
const OUT = path.resolve(ROOT, opt('out', `../plume-light-showcase-90s-${LANG === 'en' ? 'en-' : ''}${HEIGHT}p.mp4`));
const PAGE_URL = `${pathToFileURL(path.join(ROOT, 'index.html')).href}?render&lang=${LANG}`;
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

if (args.includes('--cues')) {
  const cues = await first.evaluate(() => window.__cues);
  const file = path.join(ROOT, 'data', `cues-${LANG}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cues, null, 1) + '\n');
  console.log(`音效时刻表已写入 ${path.relative(ROOT, file)}`);
  await browser.close();
  process.exit(0);
}

if (STILLS) {
  const dir = path.join(BUILD, 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of STILLS.split(',')) {
    await first.evaluate((x) => window.__seek(x), Number(s));
    await first.screenshot({ path: path.join(dir, `${LANG === 'en' ? 'en-' : ''}t${s}.png`) });
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
  const file = path.join(BUILD, `seg-${LANG}-${String(index).padStart(2, '0')}.mp4`);
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
console.log(`导出 ${LANG}：${total} 帧，${WIDTH}×${HEIGHT}，${FPS}fps，${WORKERS} 路并行`);
const files = await Promise.all(pages.map((page, i) => segment(i, page)));
clearInterval(timer);
await browser.close();

const list = path.join(BUILD, `concat-${LANG}.txt`);
fs.writeFileSync(list, files.map((f) => `file '${f.replaceAll("'", "'\\''")}'`).join('\n') + '\n');
const audio = path.join(ROOT, 'audio', `soundtrack-${LANG}.m4a`);
const withAudio = fs.existsSync(audio) && from === 0 && to === duration;
await run(ffmpegPath, [
  '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
  ...(withAudio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'copy', '-shortest'] : []),
  '-c:v', 'copy', '-movflags', '+faststart', OUT,
]);
for (const f of files) fs.rmSync(f);
console.log(`完成：${path.relative(path.resolve(ROOT, '..'), OUT)}（${withAudio ? '含音轨' : '无音轨'}，用时 ${((Date.now() - started) / 1000).toFixed(0)}s）`);
