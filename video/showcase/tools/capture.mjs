// 采集演示视频素材：用 Playwright 真实操作本地运行的 Plume Light 站点，
// 把每个关键状态截成 2× 高清图，并把要用到的元素位置写进 shots/<lang>/manifest.js。
// 影片（index.html + film.js）里的窗口、滚动、光标落点全部读这份清单，不写死坐标。
//
// 先在仓库根目录启动站点：PLUME_PORT=8137 node tools/start.mjs --no-open
// 用法：node showcase/tools/capture.mjs [--lang zh-Hant|en] [--base http://127.0.0.1:8137/] [--only home,pricing]
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

// ---------- AI 助手：离线规则演示 ----------
section('assistant', async () => {
  await go('pages/assistant.html');
  const mode = page.locator('[data-field="agent.mode"]');
  await mode.selectOption({ index: 1 });
  await settle(600);
  await shot('agent-0');
  const input = page.locator('#chatQuestion');
  await rect('agent.input', input);
  const question = LANG === 'en' ? 'Can I check in a power bank?' : '充電寶可以托運嗎？';
  manifest.text.question = question;
  await typeFrames('agent-type', input, question, { pad: 4 });
  await input.press('Enter');
  await settle(1800);
  await shot('agent-1');
  const reply = LANG === 'en' ? 'Power bank, 74 Wh' : '充電寶，74 Wh';
  await rect('agent.input2', input);
  await typeFrames('agent-type2', input, reply, { pad: 4 });
  await input.press('Enter');
  await settle(2000);
  await shot('agent-2');
  const grid = page.locator('main [class*="_answergrid_"] > div');
  for (let i = 0; i < 3; i++) await rect(`agent.layer${i + 1}`, grid.nth(i));
  const answer = page.locator('main [data-action=review-advice]');
  await rect('agent.review', answer);
  await answer.click();
  await settle(900);
  await shot('agent-3', { full: false });
  const confirm = page.locator('dialog[open] button').first();
  await rect('agent.confirm', confirm);
  manifest.rects['agent.confirm'].y += manifest.shots['agent-3'].y - (await page.evaluate(() => scrollY));
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
});

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
fs.writeFileSync(path.join(OUT, 'manifest.js'), `window.SHOTS = window.SHOTS || {};\nwindow.SHOTS[${JSON.stringify(LANG)}] = ${JSON.stringify(manifest)};\n`);
await browser.close();
console.log(`完成：${path.relative(ROOT, OUT)}/（${Object.keys(manifest.shots).length} 组截图）`);
