// 逐帧导出演示视频：Playwright 打开 index.html?render，按帧调用 window.__seek(t) 截图，
// PNG 帧流经管道交给 ffmpeg，与 audio/soundtrack.m4a 合成 H.264 MP4。
// 用法：
//   node tools/render.mjs                       导出 960×540 / 30fps → plume-light-demo-540p.mp4
//   node tools/render.mjs --width 1920 --out plume-light-demo-1080p.mp4
//   node tools/render.mjs --stills 5,20,40      仅导出指定时刻的静帧到 .build/stills/
//   node tools/render.mjs --dir v2.2 --out plume-light-demo-v2.2-540p.mp4   导出子目录里的另一版分镜
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const WIDTH = Number(opt('width', 960));
const HEIGHT = Math.round((WIDTH * 9) / 16);
const FPS = Number(opt('fps', 30));
const OUT = path.resolve(ROOT, opt('out', 'plume-light-demo-540p.mp4'));
const STILLS = opt('stills', null);
// 分镜目录：内含 index.html 与 audio/soundtrack.m4a，默认即本目录
const SRC = path.resolve(ROOT, opt('dir', '.'));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('[pageerror]', e.message));
page.on('console', (m) => m.type() === 'error' && console.error('[console]', m.text()));
await page.goto(`${pathToFileURL(path.join(SRC, 'index.html')).href}?render`);
await page.evaluate(() => window.__ready);
const duration = await page.evaluate(() => window.__duration);
const seek = (t) => page.evaluate((x) => window.__seek(x), t);

if (STILLS) {
  const dir = path.join(SRC, '.build', 'stills');
  fs.mkdirSync(dir, { recursive: true });
  for (const s of STILLS.split(',')) {
    await seek(Number(s));
    await page.screenshot({ path: path.join(dir, `t${s}.png`) });
  }
  console.log(`静帧已写入 ${path.relative(ROOT, dir)}/`);
  await browser.close();
  process.exit(0);
}

const audio = path.join(SRC, 'audio', 'soundtrack.m4a');
const hasAudio = fs.existsSync(audio);
const ff = spawn(ffmpegPath, [
  '-y', '-loglevel', 'error',
  '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
  ...(hasAudio ? ['-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '160k', '-shortest'] : []),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  OUT,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = once(ff, 'close');

const total = Math.round(duration * FPS);
const started = Date.now();
for (let i = 0; i < total; i++) {
  await seek(i / FPS);
  const png = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await once(ff.stdin, 'drain');
  if (i % (FPS * 10) === 0) {
    const sec = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`帧 ${i}/${total}（视频 ${(i / FPS).toFixed(0)}s，已用 ${sec}s）`);
  }
}
ff.stdin.end();
const [code] = await done;
await browser.close();
if (code !== 0) {
  console.error(`ffmpeg 退出码 ${code}`);
  process.exit(code);
}
console.log(`完成：${path.relative(ROOT, OUT)}（${WIDTH}×${HEIGHT}，${FPS}fps，${hasAudio ? '含音轨' : '无音轨'}）`);
