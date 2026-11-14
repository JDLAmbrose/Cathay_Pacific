// 采集演示视频素材：用 Playwright 真实操作本地运行的 Plume Light 站点，
// 把每个关键状态截成 2× 高清图，并把要用到的元素位置写进 shots/<lang>/manifest.js。
// 影片（index.html + film.js）里的窗口、滚动、光标落点全部读这份清单，不写死坐标。
//
// 站点来源用 --base 指定：已部署的线上站点（AI 助手一段需要它，要有可用的 OpenAI 后端），
// 或本地 `PLUME_PORT=8137 node tools/start.mjs --no-open` 启动的站点（默认）。
// 用法：node showcase/tools/capture.mjs --base https://<线上地址>/ [--lang zh-Hant|en] [--only home,pricing]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const LANG = opt('lang', 'zh-Hant');
const BASE = opt('base', 'http://127.0.0.1:8137/');
const ONLY = opt('only', '');
const OUT = path.join(ROOT, 'shots', LANG);
const VW = 1440, VH = 810, DPR = 2;
fs.mkdirSync(OUT, { recursive: true });

const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  : { lang: LANG, vw: VW, vh: VH, shots: {}, rects: {}, text: {} };

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: DPR,
  locale: LANG === 'en' ? 'en-GB' : 'zh-HK',
  timezoneId: 'Asia/Hong_Kong',
  reducedMotion: 'reduce',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('[pageerror]', e.message));

const settle = (ms = 450) => page.waitForTimeout(ms);
async function go(url) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // 底部提示条是 fixed 定位，整页截图里会盖在内容中间，影片里不需要
  await page.addStyleTag({ content: '[class*="toast"]{visibility:hidden!important}' });
  await settle(700);
}
/** 截图。full=true 截整页（影片里靠平移模拟滚动），否则只截当前视口。 */
async function shot(name, { full = true, clip } = {}) {
  await settle();
  // 懒加载的图片（如首页轮播里的人物照片）要先载入并解码，否则整页截图里是空白
  await page.evaluate(() => Promise.all([...document.images].map((img) => {
    img.loading = 'eager';
    return img.decode().catch(() => {});
  })));
  const file = `${name}.jpg`;
  await page.screenshot({ path: path.join(OUT, file), type: 'jpeg', quality: 92, fullPage: full || !!clip, clip });
  const size = clip
    ? { w: clip.width, h: clip.height }
    : full
      ? await page.evaluate(() => ({ w: document.documentElement.clientWidth, h: document.documentElement.scrollHeight }))
      : { w: VW, h: VH };
  const scroll = full || clip ? {} : { x: 0, y: await page.evaluate(() => scrollY) };
  manifest.shots[name] = { file, ...size, ...scroll, ...(clip ? { x: clip.x, y: clip.y } : {}) };
  console.log('  shot', name, `${size.w}×${Math.round(size.h)}`);
}
/** 记录元素在整页坐标系里的位置（CSS 像素）。 */
async function rect(name, locator) {
  const loc = typeof locator === 'string' ? page.locator(locator).first() : locator;
  const box = await loc.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  });
  manifest.rects[name] = Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  return manifest.rects[name];
}
/** 用页面内的函数找元素并记录位置（选择器不好写、要按尺寸或文字挑的情况）。 */
async function rectBy(name, find) {
  const box = await page.evaluate((src) => {
    const el = new Function(`return (${src})()`)();
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height };
  }, find.toString());
  if (!box) throw new Error(`找不到元素：${name}`);
  manifest.rects[name] = Object.fromEntries(Object.entries(box).map(([k, v]) => [k, Math.round(v * 10) / 10]));
}
/** 元素自身的小截图（拖拽时跟着光标走的卡片等）。 */
async function elementShot(name, locator) {
  const r = await rect(name, locator);
  await locator.screenshot({ path: path.join(OUT, `${name}.png`), type: 'png' });
  manifest.shots[name] = { file: `${name}.png`, w: r.w, h: r.h, x: r.x, y: r.y };
  console.log('  shot', name, '(element)');
}
/** 逐字输入并把输入框每一步截下来，影片里按帧切换即是真实的打字效果。 */
async function typeFrames(name, locator, text, { clear = true, pad = 0 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
  if (clear) await locator.fill('');
  const r = await rect(name, locator);
  const view = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  const clip = { x: r.x - pad, y: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2 };
  const frames = [];
  const chars = [...text];
  for (let i = 0; i <= chars.length; i++) {
    if (i > 0) await locator.pressSequentially(chars[i - 1]);
    await page.waitForTimeout(60);
    const file = `${name}-${String(i).padStart(2, '0')}.png`;
    // clip 用整页坐标；fullPage 才能截到视口之外的位置
    await page.screenshot({ path: path.join(OUT, file), type: 'png', clip, fullPage: true });
    frames.push(file);
  }
  await page.evaluate(({ x, y }) => scrollTo(x, y), view);
  manifest.shots[name] = { frames, w: clip.width, h: clip.height, x: clip.x, y: clip.y };
  console.log('  type', name, `${frames.length} 帧`);
}
const dump = async (tag, n = 700) => console.log(`  [${tag}]`, (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, n));
// 清单是增量写入的；每次重采某一段之前，先清掉这一段上次留下的条目，避免残留已经不存在的素材
function forget(prefixes) {
  for (const group of [manifest.shots, manifest.rects]) for (const key of Object.keys(group)) if (prefixes.some((p) => key.startsWith(p))) delete group[key];
}
const sections = [];
const section = (name, fn) => sections.push([name, fn]);
const resetDemo = () => page.evaluate(() => localStorage.removeItem('plume-light-multipage-v2'));

// ---------- 首页：多语言、案例轮播 ----------
section('home', async () => {
  await page.goto(BASE + 'index.html');
  await page.evaluate((lang) => localStorage.setItem('plume-light-language', lang), LANG);
  await resetDemo();
  await go('index.html');
  await shot('home');
  await rect('home.lang', '#languageSelect');
  await rect('home.cta', page.locator('main a[href*="prepare"]').first());
  manifest.text.locales = await page.locator('#languageSelect option').evaluateAll((os) => os.map((o) => ({ value: o.value, label: o.textContent.trim() })));
  const region = page.locator('main section').filter({ has: page.locator('img[src*="traveller"]') }).last();
  const rr = await rect('home.stories', region);
  const next = region.locator('button').nth(1);
  await rect('home.next', next);
  for (const i of [2, 3]) {
    await next.click();
    await settle(900);
    await shot(`home-story${i}`, { clip: { x: rr.x, y: rr.y, width: rr.w, height: rr.h } });
  }
  // 五种语言：只截首屏
  for (const { value } of manifest.text.locales) {
    await page.selectOption('#languageSelect', value);
    await settle(700);
    await page.evaluate(() => scrollTo(0, 0));
    await shot(`home-${value}`, { full: false });
  }
  await page.selectOption('#languageSelect', LANG);
  await settle();
});

// ---------- 预约五步 ----------
section('booking', async () => {
  await go('pages/prepare.html');
  await resetDemo();
  await go('pages/prepare.html');
  await shot('prepare');
  await rect('steps', page.locator('main a[href*="prepare"]').first().locator('xpath=..'));

  await go('pages/information.html');
  const region = page.locator('main select').first();
  await rect('info.region', region);
  manifest.text.regions = await region.locator('option').allInnerTexts();
  for (const [i, key] of ['hk', 'gba', 'cn'].entries()) {
    await region.selectOption({ index: i });
    await settle(500);
    await shot(`info-${key}`);
  }
  await region.selectOption({ index: 0 });
  await settle();

  await go('pages/baggage.html');
  await shot('baggage');
  const cards = page.locator('main article').filter({ has: page.locator('input[type=number]') });
  manifest.text.bags = await cards.count();
  for (let i = 0; i < Math.min(4, manifest.text.bags); i++) await rect(`baggage.bag${i + 1}`, cards.nth(i));
  const weight = cards.first().locator('input[type=number]').first();
  await typeFrames('baggage-weight', weight, '23', { pad: 6 });
  await weight.fill('20');
  await rect('baggage.save', page.locator('main button').last());
});

// ---------- 价格计算：三条泳道拖拽 ----------
section('pricing', async () => {
  await go('pages/pricing.html');
  await resetDemo();
  await go('pages/pricing.html');
  await shot('pricing');
  for (const lane of ['cabin', 'flight', 'cargo']) await rect(`pricing.lane.${lane}`, `[data-drop-lane=${lane}]`);
  const excess = page.locator('[data-drop-lane=flight] button:not([data-drag-handle])').last();
  if (await excess.count()) await rect('pricing.excess', excess);
  const card = page.locator('[data-drop-lane=flight] article[draggable]').nth(2);
  await card.scrollIntoViewIfNeeded();
  await elementShot('pricing-card', card);
  manifest.text.dragged = (await card.innerText()).replace(/\s+/g, ' ').trim();
  await card.dragTo(page.locator('[data-drop-lane=cargo]'), { targetPosition: { x: 200, y: 300 } });
  await settle(800);
  await page.evaluate(() => scrollTo(0, 0));
  await shot('pricing-after');
  manifest.text.cargoCount = await page.locator('[data-drop-lane=cargo] article[draggable]').count();
  if (manifest.text.cargoCount) await rect('pricing.dropped', page.locator('[data-drop-lane=cargo] article[draggable]').first());
  await rect('pricing.next', page.locator('main button').last());
  console.log('  dragged:', manifest.text.dragged, '→ cargo', manifest.text.cargoCount);
});

// ---------- 结算 → 行程交接 ----------
section('checkout', async () => {
  await go('pages/checkout.html');
  await shot('checkout');
  const cash = page.locator('input[name=payment][value=cash]');
  const miles = page.locator('input[name=payment][value=miles]');
  await rect('checkout.cash', cash.locator('xpath=ancestor::label[1]'));
  await rect('checkout.miles', miles.locator('xpath=ancestor::label[1]'));
  await miles.check();
  await shot('checkout-miles');
  await cash.check();
  const agree = page.locator('main input[data-field=agreed]');
  await rect('checkout.agree', agree);
  await agree.check();
  await settle();
  await shot('checkout-agreed');
  const pay = page.locator('main button[data-action=pay]');
  await rect('checkout.pay', pay);
  manifest.text.pay = (await pay.innerText()).trim();
  await pay.click();
  await page.waitForURL(/journey/, { timeout: 15000 }).catch(() => {});
  await settle(1500);
});

section('journey', async () => {
  if (!/journey/.test(page.url())) await go('pages/journey.html');
  await shot('journey-0');
  const controls = page.locator('main details').filter({ has: page.locator('[data-action=event]') });
  await controls.locator('summary').click();
  await settle();
  await shot('journey-open');
  await rect('journey.controls', controls);
  const nodes = page.locator('main [class*="_node_"]');
  for (let i = 0; i < 3; i++) await rect(`journey.m${i + 1}`, nodes.nth(i));
  for (const [i, kind] of ['airport', 'partial', 'loaded', 'handover'].entries()) {
    const button = page.locator(`[data-action=event][data-kind=${kind}]`);
    await rect(`journey.btn.${kind}`, button);
    await button.click();
    await settle(700);
    await shot(`journey-${i + 1}`);
  }
  const done = page.locator('[data-action=complete-service]');
  await rect('journey.btn.complete', done);
  await done.click();
  await settle(900);
  await shot('journey-5');
  // 订单卡：含订单号的那张卡片
  await rect('journey.order', page.getByText(/PL-\d{6,}/).first().locator('xpath=ancestor::*[contains(@class,"_card_")][1]'));
});

// ---------- AI 助手：线上 OpenAI 助手的真实流式回复 ----------
section('assistant', async () => {
  forget(['agent']);
  await go('pages/assistant.html');
  const mode = page.locator('[data-field="agent.mode"]');
  if ((await mode.inputValue()) !== 'live') throw new Error('这个站点没有配置线上 AI 助手：请用 --base 指向已部署的后端');
  // 页面里对话框限高 400px、内部滚动；影片要看到完整回复，采集时把它展开
  await page.addStyleTag({ content: '[class*="chatmessages"]{max-height:none!important;overflow:visible!important}' });
  await settle(300);
  let stream;
  for (let attempt = 1; ; attempt++) {
    await shot('agent-0');
    const input = page.locator('#chatQuestion');
    // 线上助手目前在英文界面下也常用中文作答（后端提示词里的结论格式是中文）。
    // 英文版在问题里注明用英文回答，并在下面重试，直到拿到英文回复
    const question = LANG === 'en' ? 'Can I bring beef jerky into the UK? Please answer in English.' : '可以帶牛肉乾入境英國嗎？';
    manifest.text.question = question;
    await typeFrames('agent-type', input, question, { pad: 4 });
    await input.press('Enter');
    // 回复是逐字流出的。整页截图一张要近一秒，来不及跟拍，所以分两步：
    // ① 生成期间在页面里高频记录对话区的 DOM 快照；② 结束后把快照逐个放回对话区再截图。
    // 每一帧都是应用当时真实渲染出来的内容，只是截图的时间挪到了事后。
    await page.evaluate(() => {
      const box = document.querySelector('main [class*="chatmessages"]');
      const snaps = [];
      const initial = box.childElementCount;
      let lastLen = -initial;
      const timer = setInterval(() => {
        const el = [...box.querySelectorAll('[class*="_agent-reply_"]')].pop();
        // 回复出现之前（问题刚发出、助手还在准备）也记一帧：用负数区分，按消息条数去重
        const len = el ? el.innerText.length : -box.childElementCount;
        if (len === lastLen || len === -initial) return;
        lastLen = len;
        snaps.push({ at: performance.now(), len: Math.max(0, len), html: box.innerHTML });
      }, 40);
      window.__stream = { snaps, stop: () => clearInterval(timer), t0: performance.now() };
    });
    await input.press('Enter');
    const busy = () => page.evaluate(() => {
      const el = [...document.querySelectorAll('main [class*="_agent-reply_"]')].pop();
      return { len: el ? el.innerText.length : 0, streaming: !!document.querySelector('main [class*="agent-streaming"], main [class*="agent-cursor"]') };
    });
    let lastLen = -1, idle = 0;
    const started = Date.now();
    while (idle < 6 && Date.now() - started < 90000) {
      await page.waitForTimeout(300);
      const state = await busy();
      idle = state.len > 0 && state.len === lastLen && !state.streaming ? idle + 1 : 0;
      lastLen = state.len;
    }
    if (lastLen <= 0) throw new Error('没有等到 AI 助手的回复');
    stream = await page.evaluate(() => { window.__stream.stop(); return { snaps: window.__stream.snaps.map((x) => ({ at: (x.at - window.__stream.t0) / 1000, len: x.len })) }; });
    await shot('agent-final');
    const text = await page.locator('main [class*="_agent-reply_"]').last().innerText();
    if (LANG !== 'en' || !/[\u4e00-\u9fff]/.test(text)) break;
    if (attempt >= 5) { console.log('  ⚠ 重试 5 次仍是中文回复，保留最后一次'); break; }
    console.log(`  第 ${attempt} 次是中文回复，开新对话重试`);
    await page.locator('main button', { hasText: /New conversation|新對話/ }).first().click();
    await settle(600);
    forget(['agent']);
  }
  const last = page.locator('main [class*="_agent-reply_"]').last();
  await rect('agent.reply', last.locator('xpath=ancestor::*[contains(@class,"_message_")][1]'));
  const verdict = last.locator('[class*="agent-verdict"]');
  manifest.text.agentVerdict = (await verdict.count()) ? (await verdict.first().innerText()).replace(/\s+/g, ' ').trim() : '';
  if (manifest.text.agentVerdict) await rect('agent.verdict', verdict.first());
  else delete manifest.rects['agent.verdict'];
  const callouts = last.locator('[class*="agent-callout"]');
  manifest.text.agentCallouts = await callouts.count();
  for (let i = 0; i < manifest.text.agentCallouts; i++) await rect(`agent.callout${i + 1}`, callouts.nth(i));
  const source = page.locator('main [class*="message-source"]').filter({ hasNot: page.locator('[class*="agent-reply"]') });
  if (await source.count()) await rect('agent.source', source.nth((await source.count()) - 2 >= 0 ? (await source.count()) - 2 : 0));
  manifest.text.agentSource = (await source.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).slice(-2);
  console.log(`  verdict: ${manifest.text.agentVerdict || '（无标题结论）'} · ${manifest.text.agentCallouts} 个提示块 · ${manifest.text.agentSource.join(' / ')}`);
  // ② 回放：均匀挑出若干个快照，放回对话区后截整页。此后页面不再交给应用操作
  const WANT = 16;
  const total = stream.snaps.length;
  const picks = [...new Set(Array.from({ length: Math.min(WANT, total) }, (_, i) => Math.round((i * (total - 1)) / Math.max(1, Math.min(WANT, total) - 1))))];
  const frames = [];
  for (const [k, index] of picks.entries()) {
    const box = await page.evaluate((i) => {
      const chat = document.querySelector('main [class*="chatmessages"]');
      chat.innerHTML = window.__stream.snaps[i].html;
      const el = [...chat.querySelectorAll('[class*="_agent-reply_"]')].pop() || chat.lastElementChild;
      const r = (el.closest('[class*="_message_"]') || el).getBoundingClientRect();
      return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, pageH: document.documentElement.scrollHeight };
    }, index);
    const name = `agent-s${String(k).padStart(2, '0')}`;
    await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 84, fullPage: true });
    manifest.shots[name] = { file: `${name}.jpg`, w: VW, h: box.pageH };
    manifest.rects[`agent.r${k}`] = { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.w), h: Math.round(box.h) };
    frames.push({ name, at: Math.round(stream.snaps[index].at * 100) / 100, len: stream.snaps[index].len });
  }
  manifest.text.agentFrames = frames;
  console.log(`  stream：记录到 ${total} 次内容变化，历时 ${frames[frames.length - 1].at}s，取 ${frames.length} 帧`);
});

// ---------- 家庭专区 ----------
section('family', async () => {
  await go('pages/family.html');
  await shot('family-0');
  const demo = page.locator('main button[type=button]').first();
  await rect('family.demo', demo);
  await demo.click();
  await settle(900);
  await shot('family-1');
  await go('pages/benefits.html');
  await shot('benefits');
  await rect('benefits.table', 'main table');
  await rect('benefits.milestone', 'main [class*="milestone-card"]');
  await rect('benefits.gauge', 'main [class*="milestone-orbit"]');
});

// ---------- 营运看板 ----------
section('ops', async () => {
  await go('pages/operations.html');
  await shot('ops', { full: false });
  await rect('ops.cargo', 'a.board.cargo');
  await rect('ops.member', 'a.board.member');
  // 看板有自己的语言开关（繁中 / EN），不跟随旅客站点的语言设定
  const boardLang = async () => {
    if (LANG !== 'en') return;
    await page.locator('button', { hasText: /^EN$/ }).click();
    await settle(600);
  };
  await go('pages/hold-pressure/index.html');
  await boardLang();
  await settle(1200);
  await shot('cargo');
  // 看板主体的四张指标卡：页面顶部现在是 OAG 航班衔接面板，镜头要直接落到这里
  await rectBy('cargo.kpis', () => {
    const ring = [...document.querySelectorAll('svg')].find((svg) => svg.querySelector('circle') && svg.getBoundingClientRect().width > 80);
    let el = ring;
    while (el && el.getBoundingClientRect().width < 1200) el = el.parentElement;
    return el;
  });
  const bar = page.locator('button', { hasText: 'CX251' }).first();
  await rect('cargo.bar', bar);
  await bar.scrollIntoViewIfNeeded();
  await bar.hover();
  await settle(700);
  await shot('cargo-hover', { full: false });
  manifest.text.cargoHoverScroll = await page.evaluate(() => scrollY);
  await bar.click();
  await settle(1500);
  await page.evaluate(() => scrollTo(0, 0));
  await shot('cargo-detail');
  await rect('cargo.flow', page.locator('svg').last().locator('xpath=ancestor::*[self::section or self::article or self::div][1]'));
  await page.locator('button', { hasText: /overview/i }).first().click();
  await settle(900);
  for (const [key, label] of [['vol', 'VOL'], ['mel', 'MEL']]) {
    const button = page.locator('button', { hasText: label }).first();
    await rect(`cargo.btn.${key}`, button);
    await button.click();
    await settle(1100);
    await page.evaluate(() => scrollTo(0, 0));
    await shot(`cargo-${key}`);
  }
  await go('pages/hold-pressure/index.html?board=members');
  await boardLang();
  await settle(1200);
  const marks = page.locator('button').filter({ hasText: /\d+\/\d+/ });
  manifest.text.bookmarks = (await marks.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  for (let i = 0; i < (await marks.count()); i++) {
    await rect(`members.mark${i}`, marks.nth(i));
    await marks.nth(i).click();
    await settle(1000);
    await page.evaluate(() => scrollTo(0, 0));
    await shot(`members-${i}`);
  }
  // 家庭关系流向图：页面下半部最大的那张 SVG
  await rectBy('members.flow', () => [...document.querySelectorAll('svg')]
    .filter((svg) => svg.getBoundingClientRect().top + scrollY > 1200)
    .sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height)[0]);
});

// 站点语言存在 localStorage：先设好，单独重采某一段（--only）时界面语言才是对的
await page.goto(BASE + 'index.html');
await page.evaluate((lang) => localStorage.setItem('plume-light-language', lang), LANG);
for (const [name, fn] of sections) {
  if (ONLY && !ONLY.split(',').includes(name)) continue;
  console.log(`# ${name}`);
  try {
    await fn();
  } catch (error) {
    console.error(`  ✗ ${name}: ${error.message.split('\n')[0]}`);
    process.exitCode = 1;
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
}
if (!process.exitCode) {
  const keep = new Set(['manifest.json', 'manifest.js', ...Object.values(manifest.shots).flatMap((x) => x.frames || [x.file])]);
  const stale = fs.readdirSync(OUT).filter((f) => !keep.has(f));
  for (const f of stale) fs.rmSync(path.join(OUT, f));
  if (stale.length) console.log(`已清理 ${stale.length} 个不再使用的旧素材`);
}
fs.writeFileSync(path.join(OUT, 'manifest.js'), `window.SHOTS = window.SHOTS || {};\nwindow.SHOTS[${JSON.stringify(LANG)}] = ${JSON.stringify(manifest)};\n`);
await browser.close();
console.log(`完成：${path.relative(ROOT, OUT)}/（${Object.keys(manifest.shots).length} 组截图）`);
