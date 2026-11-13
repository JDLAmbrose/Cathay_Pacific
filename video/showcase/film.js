/* Plume Light 前端成果演示影片 · 时间轴
 *
 * render(t) 是时间 t（秒）的纯函数：同一个 t 永远画出同一帧，
 * 因此既能实时播放，也能被 tools/render.mjs 逐帧导出。全片 90 秒，按 120 BPM（一小节 2 秒）切分镜。
 *
 * 界面画面来自 tools/capture.mjs 对真实站点的截图；窗口里的滚动、光标落点、高亮框
 * 读取 shots/<语言>/manifest.js 里记录的元素位置（整页坐标，CSS 像素）。
 */
(() => {
  'use strict';
  const Q = new URLSearchParams(location.search);
  const LANG = window.FILM_LANG;
  const EN = LANG === 'en';
  const L = (zh, en) => (EN ? en : zh);
  const M = window.SHOTS[LANG];
  const RENDER = Q.has('render');
  document.documentElement.lang = EN ? 'en' : 'zh-Hant';
  if (RENDER) document.body.classList.add('render');

  const DURATION = 90, W = 1920, H = 1080, VH = M.vh, BAR = 44;
  const DIR = `shots/${LANG}/`;
  const ASSETS = '../../assets/';
  const stage = document.getElementById('stage');

  // ---------- 小工具 ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const E = {
    lin: (p) => p,
    out: (p) => 1 - (1 - p) ** 3,
    out5: (p) => 1 - (1 - p) ** 5,
    in: (p) => p ** 3,
    io: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
    io5: (p) => (p < 0.5 ? 16 * p ** 5 : 1 - (-2 * p + 2) ** 5 / 2),
    spring: (p) => 1 - Math.exp(-6.5 * p) * Math.cos(10 * p),
  };
  /** 一段进度：t 从 a 到 b 映射到 0..1 并套缓动。 */
  const seg = (t, a, b, e = E.out) => e(clamp((t - a) / (b - a)));
  /** 关键帧：[[时刻, 值, 到达该帧所用缓动], …] */
  function K(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        const [t0, v0] = keys[i - 1];
        const [t1, v1, e = E.io] = keys[i];
        return lerp(v0, v1, e((t - t0) / (t1 - t0)));
      }
    }
    return keys[keys.length - 1][1];
  }
  /** 钟形：a→b 淡入，c→d 淡出 */
  const bell = (t, a, b, c, d) => Math.min(seg(t, a, b, E.out), 1 - seg(t, c, d, E.in));
  function h(tag, cls, parent, html) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (html != null) el.innerHTML = html;
    if (parent) parent.appendChild(el);
    return el;
  }
  function op(el, o) {
    el.style.opacity = o;
    el.style.visibility = o <= 0.002 ? 'hidden' : 'visible';
  }
  /** 写入 transform / opacity / blur。 */
  function st(el, p) {
    let tr = '';
    if (p.x != null || p.y != null) tr += `translate(${p.x || 0}px,${p.y || 0}px) `;
    if (p.r) tr += `rotate(${p.r}deg) `;
    if (p.s != null) tr += `scale(${p.s}) `;
    if (tr) el.style.transform = tr;
    if (p.o != null) op(el, p.o);
    if (p.blur != null) el.style.filter = p.blur > 0.08 ? `blur(${p.blur}px)` : 'none';
  }
  const R = (name) => {
    const r = M.rects[name];
    if (!r) throw new Error(`manifest 缺少位置：${name}`);
    return r;
  };
  const C = (name) => { const r = R(name); return [r.x + r.w / 2, r.y + r.h / 2]; };
  const fmt = (n) => Math.round(n).toLocaleString('en-US');

  // 供 tools/build_audio.py 使用的音效时刻表（全片时间，秒）
  const CUES = { duration: DURATION, bpm: 120, clicks: [], keys: [], whoosh: [], hits: [], pops: [] };
  // 分镜内部按各自的原始节奏写时间，scene() 再把它等比压缩到实际时长；这里把分镜内的时刻换算成全片时间
  let SCALE = { a: 0, k: 1 };
  const toGlobal = (t) => SCALE.a + (t - SCALE.a) / SCALE.k;
  const cue = (kind, t) => { CUES[kind].push(Math.round(toGlobal(t) * 1000) / 1000); return t; };

  // ---------- 文字逐行揭示 ----------
  function lines(el, html) {
    el.innerHTML = html.split('\n').map((s) => `<span class="ln"><span>${s}</span></span>`).join('');
    const spans = [...el.querySelectorAll('.ln > span')];
    return {
      el,
      /** tin：入场后经过的秒数；out：0..1 的退场进度 */
      set(tin, out = 0, gap = 0.1) {
        spans.forEach((s, i) => {
          const p = E.out5(clamp((tin - i * gap) / 0.75));
          s.style.transform = `translateY(${(1 - p) * 108 - out * 108}%)`;
        });
        op(el, tin < 0 ? 0 : 1 - out * out);
      },
    };
  }

  // ---------- 字幕 ----------
  function Caption(parent, { eb, ti, su }, x = 120, y = 872) {
    const el = h('div', 'cap', parent);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    const ebEl = h('div', 'cap-eb', el, eb);
    const tiEl = lines(h('div', 'cap-ti', el), ti);
    const suEl = su ? h('div', 'cap-su', el, su) : null;
    return (t, a, b) => {
      if (t < a || t >= b) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      const tin = t - a;
      const out = seg(t, b - 0.32, b, E.in);
      op(ebEl, seg(tin, 0, 0.4) * (1 - out));
      ebEl.style.transform = `translateX(${(1 - seg(tin, 0, 0.5, E.out5)) * -26}px)`;
      tiEl.set(tin - 0.06, out);
      if (suEl) {
        op(suEl, seg(tin, 0.32, 0.8) * (1 - out));
        suEl.style.transform = `translateY(${(1 - seg(tin, 0.32, 0.9, E.out5)) * 14}px)`;
      }
    };
  }

  /** 字幕右侧的一排胶囊：语言、步骤、节点… active 为当前项，done 为已完成的最后一项。 */
  function Steps(parent, labels, { numbered = true, y = 944 } = {}) {
    const el = h('div', 'steps', parent);
    el.style.left = 'auto';
    el.style.right = '120px';
    el.style.top = `${y}px`;
    const pills = labels.map((s, i) => h('div', 'pill', el, (numbered ? `<b>${i + 1}</b>` : '') + s));
    return (t, a, b, active, done = active - 1) => {
      if (t < a || t >= b) { el.style.display = 'none'; return; }
      el.style.display = 'flex';
      const out = seg(t, b - 0.3, b, E.in);
      pills.forEach((p, i) => {
        const tin = seg(t, a + 0.25 + i * 0.07, a + 0.75 + i * 0.07, E.out5);
        op(p, tin * (1 - out));
        p.style.transform = `translateY(${(1 - tin) * 22}px)`;
        p.className = 'pill' + (i === active ? ' on' : i <= done ? ' done' : '');
      });
    };
  }

  // ---------- 浏览器窗口 ----------
  const CURSOR_SVG = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M4.5 2.2l14.6 9.3-6.5 1.3 3.9 7.2-2.9 1.6-3.9-7.3-5.2 4.1z" fill="#fff" stroke="#0b2b26" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  class Win {
    constructor(parent, url, pages, patches = []) {
      this.rig = h('div', 'rig', parent);
      this.el = h('div', 'win', this.rig);
      const bar = h('div', 'win-bar', this.el, '<i></i><i></i><i></i>');
      this.url = h('div', 'url', bar, url);
      const view = h('div', 'win-view', this.el);
      this.page = h('div', 'win-page', view);
      this.layers = {};
      this.pageNames = pages;
      [...pages, ...patches].forEach((n) => this.add(n));
      this.cur = pages[0];
      this.cursor = h('div', 'cursor', this.page, CURSOR_SVG);
      this.rip = h('div', 'ripple', this.page);
      op(this.cursor, 0);
    }
    add(name) {
      const s = M.shots[name];
      if (!s) throw new Error(`manifest 缺少截图：${name}`);
      const imgs = (s.frames || [s.file]).map((file) => {
        const img = h('img', '', this.page);
        img.src = DIR + file;
        img.style.cssText = `left:${s.x || 0}px;top:${s.y || 0}px;width:${s.w}px;height:${s.h}px;visibility:hidden;opacity:0`;
        return img;
      });
      this.layers[name] = { s, imgs };
    }
    /**
     * 整页图按时间表切换：[[时刻, 名称, 'nav'?], …]。
     * 同一页的状态变化用很短的叠化；标了 'nav' 的是换页：叠化更长，旧页停在它原来的滚动位置（见 look 的 prevPy），
     * 镜头在换页期间连续运动，不跳切。
     */
    pages(t, seq) {
      let i = 0;
      while (i + 1 < seq.length && t >= seq[i + 1][0]) i++;
      const [at, cur, mode] = seq[i];
      const prev = i > 0 ? seq[i - 1][1] : null;
      const p = i > 0 ? E.io(clamp((t - at) / (mode === 'nav' ? NAV : 0.14))) : 1;
      for (const n of this.pageNames) {
        const img = this.layers[n].imgs[0];
        op(img, 0);
        img.style.transform = 'none';
      }
      this.fading = null;
      if (prev && prev !== cur && p < 1 && mode === 'nav') {
        op(this.layers[prev].imgs[0], 1 - clamp(p / 0.5));
        op(this.layers[cur].imgs[0], clamp((p - 0.3) / 0.7));
        this.layers[cur].imgs[0].style.transform = `translateY(${(1 - p) * NAV_SHIFT}px)`;
        this.fading = { prev, p };
      } else if (prev && prev !== cur && p < 1) {
        const above = this.pageNames.indexOf(cur) > this.pageNames.indexOf(prev);
        op(this.layers[prev].imgs[0], above ? 1 : 1 - p);
        op(this.layers[cur].imgs[0], above ? p : 1);
      } else op(this.layers[cur].imgs[0], 1);
      this.cur = cur;
      return { cur, since: t - at, index: i };
    }
    /** 叠在整页图上的局部图（视口截图、轮播切片等）。 */
    patch(name, o, dx = 0) {
      const img = this.layers[name].imgs[0];
      op(img, o);
      img.style.transform = dx ? `translateX(${dx}px)` : 'none';
    }
    /** 打字序列：显示第 i 帧，i < 0 时隐藏。 */
    frame(name, i) {
      const { imgs } = this.layers[name];
      imgs.forEach((img, k) => op(img, k === Math.min(i, imgs.length - 1) ? 1 : 0));
    }
    /**
     * 镜头：把整页坐标 (px, py) 这一点放到舞台的 (ax, ay)，缩放 z。
     * 纵向优先滚动页面（和真实浏览一样），横向移动窗口本身。
     */
    look(px, py, z, o = {}) {
      const pageH = this.layers[this.cur].s.h;
      const sy = clamp(py - VH / 2, 0, Math.max(0, pageH - VH));
      const fx = px, fy = py - sy + BAR;
      const ax = o.ax != null ? o.ax : 960, ay = o.ay != null ? o.ay : 468;
      this.page.style.transform = `translateY(${-sy}px)`;
      if (this.fading && o.prevPy != null) {
        const { prev, p } = this.fading;
        const prevSy = clamp(o.prevPy - VH / 2, 0, Math.max(0, this.layers[prev].s.h - VH));
        this.layers[prev].imgs[0].style.transform = `translateY(${sy - prevSy - p * NAV_SHIFT}px)`;
      }
      this.rig.style.transform = `translate(${ax - fx * z + (o.tx || 0)}px,${ay - fy * z + (o.ty || 0)}px) scale(${z})`;
      this.el.style.transformOrigin = `${fx}px ${fy}px`;
      this.el.style.transform = `perspective(2600px) rotateX(${o.rx || 0}deg) rotateY(${o.ry || 0}deg) rotateZ(${o.rz || 0}deg)`;
      op(this.rig, o.o != null ? o.o : 1);
    }
    /** 光标沿轨迹移动；clicks 里的时刻播放按下与涟漪；换页（cuts）前后短暂隐去。track：[[时刻, x, y], …]（整页坐标）。 */
    pointer(t, track, clicks = [], cuts = []) {
      const xs = track.map(([a, x]) => [a, x]);
      const ys = track.map(([a, , y]) => [a, y]);
      const x = K(t, xs), y = K(t, ys);
      const first = track[0][0], last = track[track.length - 1][0];
      let press = 0, rip = null;
      for (const c of clicks) {
        if (t >= c - 0.09 && t < c + 0.16) press = Math.max(press, 1 - Math.abs((t - c - 0.035) / 0.125));
        if (t >= c && t < c + 0.55) rip = { p: (t - c) / 0.55, x: K(c, xs), y: K(c, ys) };
      }
      let show = Math.min(seg(t, first, first + 0.25), 1 - seg(t, last, last + 0.25));
      for (const c of cuts) show *= 1 - bell(t, c - 0.2, c - 0.05, c + 0.35, c + 0.6);
      st(this.cursor, { x, y, s: 1.25 - 0.22 * clamp(press), o: show });
      if (rip) st(this.rip, { x: rip.x, y: rip.y, s: lerp(0.25, 1.5, E.out(rip.p)), o: 0.9 * (1 - rip.p) });
      else op(this.rip, 0);
      return [x, y];
    }
    /** 金色高亮框（整页坐标）。 */
    hl(pad = 8) {
      const el = h('div', 'hl', this.page);
      return (r, o, grow = 0) => {
        if (o <= 0.002) { op(el, 0); return; }
        const g = pad + grow;
        el.style.left = `${r.x - g}px`;
        el.style.top = `${r.y - g}px`;
        el.style.width = `${r.w + g * 2}px`;
        el.style.height = `${r.h + g * 2}px`;
        op(el, o);
      };
    }
    tag(text) {
      const el = h('div', 'tag', this.page, text);
      return (x, y, p) => st(el, { x, y: y + (1 - p) * 10, s: lerp(0.86, 1, p), o: p });
    }
  }
  /**
   * 分镜之间的衔接：上一镜的窗口向左摇出，下一镜的窗口同时从右摇入，两者用同一条缓动曲线，
   * 看起来是镜头在一排窗口之间平移，而不是先消失再出现。
   * enter：pan 摇入 / rise 片头自下而上翻起；exit：pan 摇出 / sink 向后沉入截图墙。
   */
  const NAV = 0.55, NAV_SHIFT = 34, PAN = 0.7, TRAVEL = 1900;
  const NOW = { rt: 0, D: 1 };   // 正在渲染的分镜：真实的本地时间与时长（秒）
  function inOut(enter = 'pan', exit = 'pan') {
    const { rt, D } = NOW;
    const a = enter === 'pan' ? seg(rt, -PAN, PAN, E.io) : 1;
    const b = exit === 'pan' ? seg(rt, D - PAN, D + PAN, E.io) : 0;
    const swing = Math.sin(a * Math.PI) + Math.sin(b * Math.PI);   // 平移途中略微拉远并侧转
    // 窗口放大时可能比画面还宽，摇到尽头仍露出一截，所以在行程两端各用四分之一路程淡入淡出
    const io = { o: Math.min(clamp(a / 0.25), clamp((1 - b) / 0.25)), tx: (1 - a - b) * TRAVEL, ty: 0, rx: 0, ry: (b - (1 - a)) * 14, zm: 1 - 0.1 * swing };
    if (enter === 'rise') {
      const r = seg(rt, 0, 1.15, E.out5);
      Object.assign(io, { ty: (1 - r) * 460, rx: (1 - r) * 40, zm: io.zm * lerp(0.72, 1, r), o: io.o * seg(rt, 0, 0.35, E.lin) });
    }
    if (exit === 'sink') {
      const k = seg(rt, D - 0.55, D + 0.5, E.io);
      Object.assign(io, { ty: k * 150, rx: k * 40, zm: io.zm * lerp(1, 0.5, k), o: 1 - seg(rt, D - 0.15, D + 0.5, E.lin) });
    }
    return io;
  }

  // ---------- 舞台常驻层 ----------
  const bg = h('div', '', stage);
  bg.id = 'bg';
  const g1 = h('div', 'glow g1', bg), g2 = h('div', 'glow g2', bg), grid = h('div', 'grid', bg);
  const scenesRoot = h('div', '', stage);
  scenesRoot.style.cssText = 'position:absolute;inset:0';
  h('div', '', stage).id = 'vignette';
  const topscrim = h('div', '', stage); topscrim.id = 'topscrim';
  const scrim = h('div', '', stage); scrim.id = 'scrim';
  const front = h('div', '', stage);
  front.style.cssText = 'position:absolute;inset:0';
  const hud = h('div', '', stage); hud.id = 'hud';
  h('img', 'logo', hud).src = 'assets/plume-light-logo-white.svg';
  const hudChapter = h('div', 'chapter', hud);
  const bar = h('div', '', stage, '<i></i>'); bar.id = 'bar';
  const barFill = bar.firstChild;
  const flash = h('div', '', stage); flash.id = 'flash';
  const fade = h('div', '', stage);
  fade.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none';

  const CHAPTERS = [
    [0, L('行程首頁', 'Journey home')],
    [12, L('行李預約', 'Baggage booking')],
    [32, L('AI 出行助手', 'AI travel assistant')],
    [44, L('行程追蹤', 'Journey tracking')],
    [52, L('家庭專區', 'Family zone')],
    [58, L('營運看板', 'Operations boards')],
  ];
  const UI_START = 0, UI_END = 78;
  for (const [at] of [...CHAPTERS.slice(1), [UI_END]]) h('s', '', bar).style.left = `${(at / DURATION) * 100}%`;
  const FLASHES = [];
  for (const [at] of [...CHAPTERS.slice(1), [UI_END]]) cue('whoosh', at);

  function renderChrome(t) {
    st(g1, { x: 60 + 240 * Math.sin(t * 0.13), y: -260 + 150 * Math.cos(t * 0.11) });
    st(g2, { x: 900 + 300 * Math.cos(t * 0.09 + 1), y: 200 + 190 * Math.sin(t * 0.12) });
    grid.style.transform = `translate(${-(t * 5) % 80}px,${-(t * 3) % 80}px)`;
    const ui = bell(t, UI_START, UI_START + 0.7, UI_END - 0.5, UI_END);
    op(scrim, ui); op(topscrim, ui); op(hud, ui);
    let ci = 0;
    while (ci + 1 < CHAPTERS.length && t >= CHAPTERS[ci + 1][0]) ci++;
    const since = t - CHAPTERS[ci][0];
    if (hudChapter.dataset.i !== String(ci)) {
      hudChapter.dataset.i = ci;
      hudChapter.innerHTML = `<b>0${ci + 1}</b><span>${CHAPTERS[ci][1]}</span><i>/ 0${CHAPTERS.length}</i>`;
    }
    st(hudChapter, { y: (1 - seg(since, 0.1, 0.7, E.out5)) * -22, o: seg(since, 0.1, 0.5) });
    barFill.style.transform = `scaleX(${t / DURATION})`;
    op(bar, bell(t, 0.2, 0.9, DURATION - 1.5, DURATION - 0.6));
    let f = 0;
    for (const [at, k] of FLASHES) if (t >= at && t < at + 0.6) f = Math.max(f, k * (1 - E.out((t - at) / 0.6)));
    op(flash, f);
    op(fade, Math.max(1 - seg(t, 0, 0.5, E.lin), seg(t, DURATION - 1.1, DURATION - 0.15, E.lin)));
  }

  // ---------- 分镜注册 ----------
  // 每个分镜有两层：窗口等主体在字幕压暗层之下（el），字幕与小组件在其上（ui）。
  // a..b 是全片时间；span 是分镜内部沿用的原始时长，播放时等比压缩到 b − a。
  // lap 是与前后分镜重叠的秒数：相邻两镜在这段时间里同时渲染，才能做连续的摇镜。
  const scenes = [];
  function scene(id, a, b, span, build, lap = [PAN, PAN]) {
    const el = h('section', 'scene', scenesRoot);
    el.id = `s-${id}`;
    const ui = h('section', 'scene', front);
    SCALE = { a, k: span / (b - a) };
    scenes.push({ id, a, b, k: span / (b - a), lap, els: [el, ui], render: build(el, a, ui) });
    SCALE = { a: 0, k: 1 };
  }

  // ---------- 标志与飘落的羽毛（片尾使用） ----------
  const FEATHERS = Array.from({ length: 9 }, (_, i) => ({
    x: 140 + ((i * 397) % 1640), y: 120 + ((i * 263) % 760), s: 0.35 + ((i * 37) % 60) / 100, r: (i * 53) % 360, v: 0.5 + ((i * 29) % 50) / 100, d: i % 3,
  }));
  function feathers(parent) {
    const els = FEATHERS.map((f) => {
      const img = h('img', 'feather', parent);
      img.src = ASSETS + 'plume-feather.png';
      img.style.filter = `blur(${f.d * 3}px)`;
      return img;
    });
    return (t, o) => els.forEach((img, i) => {
      const f = FEATHERS[i];
      st(img, { x: f.x + Math.sin(t * 0.5 * f.v + i) * 60 + t * 9 * f.v, y: f.y + t * 16 * f.v + Math.cos(t * 0.4 + i * 2) * 26, r: f.r + Math.sin(t * 0.45 * f.v + i) * 24, s: f.s, o: o * (0.16 + 0.1 * (2 - f.d)) });
    });
  }
  function LogoBlock(el, { sub, chipText, fine }) {
    const rings = [h('div', 'ring', el), h('div', 'ring', el)];
    const logo = h('img', 'logo-big', el);
    logo.src = 'assets/plume-light-logo-white.svg';
    const sweep = h('div', 'sweep', el);
    const tag = lines(h('div', 'tagline', el), L('輕裝啟程，<em>安心抵達</em>。', 'Less to carry. <em>More to discover.</em>'));
    tag.el.style.top = '590px';
    const en = h('div', 'tag-en', el, sub);
    en.style.top = '728px';
    const chip = h('div', 'chip', el, chipText);
    const fineEl = h('div', 'fine', el, fine);
    fineEl.style.top = '930px';
    return (t, out) => {
      rings.forEach((r, i) => { const p = seg(t, 0.05 + i * 0.22, 1.5 + i * 0.22, E.out); st(r, { s: lerp(0.15, 2.6, p), o: t < 0.05 ? 0 : (1 - p) * 0.9 }); });
      const wipe = seg(t, 0.2, 1.15, E.io);
      logo.style.clipPath = `inset(0 ${(1 - wipe) * 100}% 0 0)`;
      st(logo, { s: lerp(1.1, 1, seg(t, 0.2, 1.6, E.out5)) - out * 0.05, y: -out * 30, o: (t < 0.2 ? 0 : 1) * (1 - out) });
      st(sweep, { x: lerp(420, 1400, seg(t, 0.9, 1.9, E.io)), y: 200, r: 12, o: bell(t, 0.9, 1.2, 1.6, 1.9) * 0.9 });
      tag.set(t - 1.45, out);
      op(en, seg(t, 2.1, 2.7) * (1 - out));
      en.style.letterSpacing = `${lerp(0.6, 0.34, seg(t, 2.1, 3.2, E.out5))}em`;
      const cp = seg(t, 2.7, 3.5, E.spring);
      chip.style.transform = `translate(-50%,0) translate(960px,${838 - out * 20}px) scale(${lerp(0.6, 1, cp)})`;
      op(chip, seg(t, 2.7, 2.95, E.lin) * (1 - out));
      op(fineEl, seg(t, 3.3, 3.9) * (1 - out));
    };
  }
  // ===== 0–12 行程首页 =====
  scene('home', 0, 12, 14, (el, T0, ui) => {
    const locales = M.text.locales;
    const others = locales.filter((l) => l.value !== LANG);
    const w = new Win(el, '<b>plume-light</b> / index.html', ['home'], [...others.map((l) => `home-${l.value}`), 'home-story2', 'home-story3']);
    const lang = C('home.lang'), next = C('home.next'), stories = R('home.stories');
    const storyY = stories.y + stories.h / 2;
    const tClick = cue('clicks', T0 + 4.0) - T0;
    const flips = others.map((_, i) => cue('pops', T0 + 4.35 + i * 0.6) - T0);
    const tBack = cue('pops', T0 + 7.1) - T0;
    const tN1 = cue('clicks', T0 + 10.0) - T0, tN2 = cue('clicks', T0 + 11.6) - T0;
    const track = [[1.6, 960, 560], [3.8, lang[0], lang[1]], [7.2, lang[0] - 40, lang[1] + 20], [9.6, next[0], next[1]], [13, next[0], next[1]]];
    const c1 = Caption(ui, { eb: L('01 · 行程首頁', '01 · Journey home'), ti: L('一趟旅程，從<em>提前準備</em>開始', 'Every journey starts with <em>getting ready early</em>'), su: L('航班、行李入口、目的地與旅客故事，放在同一頁', 'Flight, baggage entry points, destination and traveller stories on one page') });
    const c2 = Caption(ui, { eb: L('多語言', 'Internationalisation'), ti: L('<em>5 種語言</em>，一鍵切換', '<em>5 languages</em>, one switch'), su: L('979 條文案鍵 · 阿拉伯語版面自動 RTL 鏡像', '979 copy keys · Arabic layout mirrors to RTL automatically') });
    const c3 = Caption(ui, { eb: L('旅客故事', 'Traveller stories'), ti: L('三位旅客，<em>三段旅程</em>', 'Three travellers, <em>three journeys</em>'), su: L('留學生 · 獨行兒童 · 研究學者（均為虛構案例）', 'A student, a child travelling alone, a visiting scholar — all fictional') });
    const pills = Steps(ui, [locales.find((l) => l.value === LANG), ...others].map((l) => l.label), { numbered: false });
    return (t) => {
      const io = inOut('rise');
      w.pages(t, [[0, 'home']]);
      let active = 0;
      others.forEach((l, i) => {
        const on = t >= flips[i] && t < (i + 1 < flips.length ? flips[i + 1] : tBack);
        w.patch(`home-${l.value}`, on ? 1 : 0);
        if (on) active = i + 1;
      });
      const flipT = [...flips, tBack].reduce((m, f) => (t >= f ? f : m), -9);
      const punch = 1 + 0.018 * (1 - seg(t, flipT, flipT + 0.3, E.out));
      const s2 = seg(t, tN1 + 0.05, tN1 + 0.6, E.out5), s3 = seg(t, tN2 + 0.05, tN2 + 0.6, E.out5);
      w.patch('home-story2', s2, (1 - s2) * 90);
      w.patch('home-story3', s3, (1 - s3) * 90);
      const py = K(t, [[0, 405], [3.2, 405], [4.0, 300], [7.3, 300], [8.9, storyY + 40, E.io5], [14, storyY + 60, E.lin]]);
      const z = K(t, [[0, 0.9], [3.2, 0.96, E.lin], [4.0, 1.12], [7.3, 1.15, E.lin], [8.9, 1.1], [14, 1.16, E.lin]]) * io.zm * punch;
      w.look(720, py, z, { ...io, ry: io.ry + K(t, [[0, 0], [1.2, -3], [7, 3, E.lin], [9.4, 0]]) });
      w.pointer(t, track, [tClick, tN1, tN2]);
      c1(t, 0.5, 3.5); c2(t, 3.6, 7.5); c3(t, 7.7, 13.2);
      pills(t, 3.6, 7.5, active, 99);
    };
  }, [0, PAN]);

  // ===== 12–32 行李预约五步 =====
  scene('book', 12, 32, 22, (el, T0, ui) => {
    const w = new Win(el, '', ['info-hk', 'info-gba', 'info-cn', 'baggage', 'pricing', 'pricing-after', 'checkout', 'checkout-miles', 'checkout-agreed'], ['baggage-weight']);
    const sel = C('info.region'), wt = C('baggage-weight'), card = R('pricing-card'), drop = R('pricing.dropped');
    const cc = [card.x + card.w / 2, card.y + card.h / 2], dc = [drop.x + drop.w / 2, drop.y + drop.h / 2];
    const miles = C('checkout.miles'), cash = C('checkout.cash'), agree = C('checkout.agree'), pay = C('checkout.pay');
    const lanes = R('pricing.lane.flight');
    const laneY = lanes.y + lanes.h / 2;
    const k = (kind, lt) => cue(kind, T0 + lt) - T0;
    const tR1 = k('clicks', 1.9), tR2 = k('clicks', 2.8);
    const tW = k('clicks', 6.1), tK1 = k('keys', 6.5), tK2 = k('keys', 6.8);
    const tGrab = k('clicks', 11.4), tDrop = k('pops', 12.9);
    const tMiles = k('clicks', 18.3), tCash = k('clicks', 19.3), tAgree = k('clicks', 20.0), tPay = k('clicks', 20.8);
    FLASHES.push([toGlobal(T0 + tPay + 0.12), 0.25]);
    const seq = [[0, 'info-hk'], [tR1 + 0.2, 'info-gba'], [tR2 + 0.2, 'info-cn'], [4.2, 'baggage', 'nav'], [9.5, 'pricing', 'nav'], [tDrop, 'pricing-after'], [17.2, 'checkout', 'nav'], [tMiles + 0.05, 'checkout-miles'], [tCash + 0.05, 'checkout'], [tAgree + 0.05, 'checkout-agreed']];
    const urls = { info: 'information', baggage: 'baggage', pricing: 'pricing', checkout: 'checkout' };
    const track = [
      [0.8, 940, 760], [1.7, sel[0], sel[1]], [3.9, sel[0] + 30, sel[1] + 10],
      [4.4, 930, 720], [5.9, wt[0] - 30, wt[1] + 4], [7.6, wt[0] - 30, wt[1] + 4], [9.2, 640, 1560],
      [9.7, 960, laneY - 180], [11.2, cc[0], cc[1]], [tGrab + 0.15, cc[0], cc[1]], [tDrop - 0.1, dc[0], dc[1] + 30], [14.6, dc[0] + 150, dc[1] + 190],
      [17.3, 940, 1300], [18.2, miles[0], miles[1]], [19.2, cash[0], cash[1]], [19.9, agree[0], agree[1]], [20.7, pay[0], pay[1]], [21.6, pay[0], pay[1]],
    ];
    const hl = w.hl(), tagA = w.tag(L('超出免費額 1 件 · 需加購 HKD 600', '1 bag over allowance · HKD 600 extra')), tagB = w.tag(L('改走 Cargo · 運費 HKD 250', 'Moved to Cargo · HKD 250'));
    const hole = h('div', 'hole', w.page);
    hole.style.cssText = `left:${card.x}px;top:${card.y}px;width:${card.w}px;height:${card.h}px`;
    const ghost = h('img', 'ghost', w.page);
    ghost.src = DIR + M.shots['pricing-card'].file;
    ghost.style.width = `${card.w}px`;
    const excess = R('pricing.excess');
    const price = h('div', 'card', ui, `<small>${L('服務演示總價', 'DEMO SERVICE TOTAL')}</small><strong><span>HKD</span><b>1,800</b></strong><em>${L('書籍改走 Cargo · 節省 HKD 350', 'Books via Cargo · HKD 350 saved')}</em>`);
    const priceNum = price.querySelector('b'), priceNote = price.querySelector('em');
    const caps = [
      [Caption(ui, { eb: L('02 · 信息預留', '02 · Pickup details'), ti: L('截止時間，<em>按地區自動計算</em>', 'Deadlines <em>worked out by region</em>'), su: L('香港 24 小時 · 大灣區 48 小時 · 出發國境內 120 小時', 'Hong Kong 24 h · Greater Bay Area 48 h · elsewhere in the country 120 h') }), 0.4, 4.0],
      [Caption(ui, { eb: L('行李預報', 'Baggage forecast'), ti: L('逐件申報：<em>重量、尺寸、類別</em>', 'Declare each bag: <em>weight, size, contents</em>'), su: L('預報可獨立保存，確定行程後再預約搬運', 'Save the forecast first; book the pickup once plans are firm') }), 4.4, 9.3],
      [Caption(ui, { eb: L('價格計算', 'Pricing'), ti: L('拖一拖，<em>價格即時更新</em>', 'Drag a bag, <em>the price updates live</em>'), su: L('隨身攜帶 · 隨本次航班 · Cargo 調度，三條泳道', 'Three lanes: carry-on, on this flight, or by Cargo') }), 9.7, 17.0],
      [Caption(ui, { eb: L('確認結算', 'Checkout'), ti: L('現金或<em>里數</em>，自由選擇', 'Pay with cash or <em>miles</em>'), su: L('模擬交易 · 訂單按確認時的快照保存', 'Simulated payment · the order keeps a snapshot at confirmation') }), 17.4, 21.6],
    ];
    const steps = Steps(ui, EN ? ['Traveller', 'Details', 'Baggage', 'Pricing', 'Checkout'] : ['乘機人', '信息預留', '行李預報', '價格計算', '確認結算']);
    const CUTS = [4.2, 9.5, 17.2];
    const PX = [[0, 720], [0.9, 720], [1.8, 660], [4.05, 660], [4.6, 720], [4.9, 720], [5.9, 590], [7.6, 590], [8.6, 720], [13.1, 720], [14.1, 880], [17.05, 880], [17.6, 720], [20.2, 720], [21.1, 520]];
    const PY = [[0, 780], [0.9, 780], [1.8, 930], [4.19, 930], [4.2, 640, E.lin], [4.9, 640], [5.9, 960], [7.6, 960], [9.3, 1760, E.io5], [9.49, 1760], [9.5, laneY + 6, E.lin], [13.1, laneY + 6], [14.1, laneY - 60], [17.19, laneY - 60], [17.2, cash[1] + 40, E.lin], [20.2, cash[1] + 40], [21.1, pay[1] - 40]];
    const Z = [[0, 0.92], [0.9, 0.92], [1.8, 1.2], [4.05, 1.2], [4.6, 0.95], [4.9, 0.95], [5.9, 1.45], [7.6, 1.45], [8.6, 1.0], [9.35, 1.0], [9.9, 0.97], [13.1, 0.97], [14.1, 1.16], [17.05, 1.16], [17.6, 1.1], [20.2, 1.1], [21.1, 1.5]];
    return (t) => {
      const io = inOut();
      const pg = w.pages(t, seq);
      w.url.innerHTML = `<b>plume-light</b> / pages / ${urls[pg.cur.split('-')[0]]}.html`;
      w.frame('baggage-weight', pg.cur !== 'baggage' || t < tW + 0.1 ? -1 : t < tK1 ? 0 : t < tK2 ? 1 : 2);
      const cutT = CUTS.reduce((m, c) => (t >= c ? c : m), -9);
      const prevPy = K(cutT - 0.005, PY);
      const px = K(t, PX);
      const py = K(t, PY);
      const z = K(t, Z) * 1.07 * io.zm;
      w.look(px, py, z, { ...io, prevPy, ry: io.ry + K(t, [[0, 0], [9.5, 0], [11.5, -2.5], [13, 2.5], [14.2, 0]]) });
      const [cx, cy] = w.pointer(t, track, [tR1, tR2, tW, tGrab, tMiles, tCash, tAgree, tPay], CUTS);
      // 泳道拖拽：原位留空位，卡片跟着光标走
      const dragging = t >= tGrab && t < tDrop + 0.18;
      op(hole, pg.cur === 'pricing' && dragging ? seg(t, tGrab, tGrab + 0.15) : 0);
      if (dragging) {
        const lift = seg(t, tGrab, tGrab + 0.22, E.out5);
        st(ghost, { x: cx - card.w / 2, y: cy - card.h / 2, r: lift * 3.5, s: 1 + lift * 0.05, o: 1 - seg(t, tDrop, tDrop + 0.18, E.lin) });
      } else op(ghost, 0);
      const a = pg.cur === 'pricing' ? bell(t, 10.0, 10.3, tGrab - 0.2, tGrab) : 0;
      const b = pg.cur === 'pricing-after' ? bell(t, tDrop + 0.1, tDrop + 0.5, 16.4, 16.9) : 0;
      hl(a > 0 ? excess : drop, Math.max(a, b), b > 0 ? (1 - seg(t, tDrop + 0.1, tDrop + 0.7, E.out5)) * 26 : 0);
      tagA(excess.x + excess.w + 18, excess.y - 6, a);
      tagB(drop.x + 16, drop.y + drop.h + 22, b * seg(t, tDrop + 0.5, tDrop + 0.9));
      const pin = bell(t, 10.1, 10.6, 16.5, 17.0);
      st(price, { x: 1470, y: 640 + (1 - pin) * 30, s: lerp(0.9, 1, pin) * (1 + 0.06 * bell(t, tDrop, tDrop + 0.15, tDrop + 0.3, tDrop + 0.7)), o: pin });
      priceNum.textContent = fmt(lerp(1800, 1450, seg(t, tDrop + 0.1, tDrop + 1.0, E.out5)));
      op(priceNote, seg(t, tDrop + 0.7, tDrop + 1.2));
      caps.forEach(([c, a0, b0]) => c(t, a0, b0));
      steps(t, 0.4, 21.6, t < 4.2 ? 1 : t < 9.5 ? 2 : t < 17.2 ? 3 : 4);
    };
  });

  // ===== 32–44 AI 出行助手 =====
  scene('agent', 32, 44, 14, (el, T0, ui) => {
    const w = new Win(el, '<b>plume-light</b> / pages / assistant.html', ['agent-0', 'agent-1', 'agent-2'], ['agent-type', 'agent-type2', 'agent-3']);
    const in1 = R('agent-type'), in2 = R('agent-type2'), review = C('agent.review'), confirm = C('agent.confirm');
    const dlg = M.shots['agent-3'];
    const layers = [1, 2, 3].map((i) => R(`agent.layer${i}`));
    const lc = [layers[1].x + layers[1].w / 2, layers[1].y + layers[1].h / 2];
    const n1 = M.shots['agent-type'].frames.length, n2 = M.shots['agent-type2'].frames.length;
    const k = (kind, lt) => cue(kind, T0 + lt) - T0;
    const tFocus = k('clicks', 1.7);
    const type1 = Array.from({ length: n1 - 1 }, (_, i) => k('keys', 1.95 + (i * 1.4) / (n1 - 1)));
    const tSend1 = k('pops', 3.6);
    const type2 = Array.from({ length: n2 - 1 }, (_, i) => k('keys', 5.0 + (i * 1.3) / (n2 - 1)));
    const tSend2 = k('pops', 6.55);
    const tL = [8.1, 8.9, 9.7].map((x) => k('pops', x));
    const tReview = k('clicks', 11.0), tConfirm = k('clicks', 12.5);
    const track = [[0.9, 900, 640], [1.6, in1.x + 150, in1.y + 26], [3.5, in1.x + 520, in1.y + 30], [4.7, in2.x + 150, in2.y + 26], [6.5, in2.x + 520, in2.y + 30], [7.4, 900, lc[1] + 150], [10.4, 900, lc[1] + 150], [10.9, review[0], review[1]], [11.3, review[0], review[1]], [12.3, confirm[0], confirm[1]], [13.4, confirm[0], confirm[1]]];
    const hl = w.hl(6);
    const done = w.tag(L('已標記：規則待復核 · 同步營運看板', 'Marked for rule review · synced to operations'));
    const caps = [
      [Caption(ui, { eb: L('03 · AI 出行助手', '03 · AI travel assistant'), ti: L('出發之前，<em>把問題問清楚</em>', 'Ask before you fly, <em>get it straight</em>'), su: L('13 類常見問題 · 可關聯目的地與指定行李', '13 question types · tied to the destination and a specific bag') }), 0.4, 3.5],
      [Caption(ui, { eb: L('追問', 'Follow-up'), ti: L('先<em>追問規格</em>，再給答案', 'It <em>asks for the spec</em> before answering'), su: L('未知規格也可說明，結果會保留待確認', 'Unknown specs are fine — the result stays pending') }), 3.8, 6.5],
      [Caption(ui, { eb: L('三層回答', 'Three-layer answer'), ti: L('海關、隨身、托運，<em>分開整理</em>', 'Customs, carry-on, checked — <em>kept apart</em>'), su: L('附資料來源樣本 · 模擬規則，不是承運批准', 'With source samples · simulated rules, not carriage approval') }), 6.8, 10.8],
      [Caption(ui, { eb: L('回寫清單', 'Write-back'), ti: L('<em>確認之後</em>，才更新行李清單', 'The list only changes <em>after you confirm</em>'), su: L('保存後同步營運看板', 'Once saved, it syncs to the operations boards') }), 11.1, 13.6],
    ];
    const pills = Steps(ui, EN ? ['Customs & entry', 'Carry-on', 'Checked'] : ['入境與海關', '隨身攜帶', '托運行李']);
    return (t) => {
      const io = inOut();
      w.pages(t, [[0, 'agent-0'], [tSend1, 'agent-1'], [tSend2, 'agent-2']]);
      w.frame('agent-type', t < tFocus + 0.1 || t >= tSend1 ? -1 : type1.filter((x) => t >= x).length);
      w.frame('agent-type2', t < 4.8 || t >= tSend2 ? -1 : type2.filter((x) => t >= x).length);
      w.patch('agent-3', seg(t, tReview + 0.1, tReview + 0.3, E.lin));
      const px = K(t, [[0, 640], [0.9, 640], [1.8, in1.x + in1.w / 2], [3.5, in1.x + in1.w / 2], [4.3, 640], [4.9, in2.x + in2.w / 2], [6.5, in2.x + in2.w / 2], [7.4, lc[0]], [10.3, lc[0]], [10.9, 720]]);
      const py = K(t, [[0, 640], [0.9, 640], [1.8, in1.y + 20], [3.5, in1.y + 20], [4.3, in2.y - 150], [4.9, in2.y + 10], [6.5, in2.y + 10], [7.4, lc[1] - 60], [7.9, lc[1] - 60], [8.6, lc[1] + 10], [10.3, lc[1] + 10], [10.9, dlg.y + 405], [14, dlg.y + 395, E.lin]]);
      const z = K(t, [[0, 0.92], [0.9, 0.92], [1.8, 1.5], [3.5, 1.5], [4.3, 1.2], [4.9, 1.5], [6.5, 1.5], [7.4, 1.12], [7.9, 1.12], [8.6, 1.42], [10.3, 1.42], [10.9, 1.0], [11.4, 1.0], [12.2, 1.2], [14, 1.24, E.lin]]) * 1.06 * io.zm;
      w.look(px, py, z, io);
      w.pointer(t, track, [tFocus, tReview, tConfirm]);
      const li = t < tL[1] ? 0 : t < tL[2] ? 1 : 2;
      hl(layers[li], bell(t, tL[0], tL[0] + 0.25, 10.2, 10.5), (1 - seg(t, tL[li], tL[li] + 0.4, E.out5)) * 14);
      done(confirm[0] - 60, confirm[1] + 60, bell(t, tConfirm + 0.25, tConfirm + 0.65, 13.5, 13.8));
      caps.forEach(([c, a0, b0]) => c(t, a0, b0));
      pills(t, 6.8, 10.8, t < tL[0] ? -1 : li);
    };
  });

  // ===== 44–52 行程追踪 =====
  scene('journey', 44, 52, 10, (el, T0, ui) => {
    const names = ['journey-open', 'journey-1', 'journey-2', 'journey-3', 'journey-4', 'journey-5'];
    const w = new Win(el, '<b>plume-light</b> / pages / journey.html', names);
    const kinds = ['airport', 'partial', 'loaded', 'handover'];
    const btn = kinds.map((x) => C(`journey.btn.${x}`)), complete = C('journey.btn.complete');
    const nodes = [1, 2, 3].map((i) => R(`journey.m${i}`)), order = R('journey.order');
    const k = (lt) => cue('clicks', T0 + lt) - T0;
    const tE = [1.8, 3.0, 4.2, 5.4].map(k), tDone = k(6.8);
    const seq = [[0, names[0]], ...tE.map((x, i) => [x + 0.06, names[i + 1]]), [tDone + 0.06, names[5]]];
    const track = [[0.9, 760, btn[0][1] - 200], ...tE.map((x, i) => [x - 0.12, btn[i][0], btn[i][1]]), [tE[3] + 0.3, btn[3][0], btn[3][1]], [tDone - 0.15, complete[0], complete[1]], [tDone + 0.4, complete[0], complete[1]], [8.2, order.x + order.w - 120, order.y + order.h - 60]];
    const hl = w.hl(4);
    const tag = w.tag(L('服務完成 · 里數入帳', 'Service complete · miles credited'));
    const midY = (nodes[0].y + btn[0][1]) / 2 + 10;
    const c1 = Caption(ui, { eb: L('04 · 行程追蹤', '04 · Journey tracking'), ti: L('只確認<em>三個關鍵交接</em>', 'Only <em>three handovers</em> to confirm'), su: L('由交接事件推進 · 付款或航班起飛不會自動更新', 'Driven by handover events — paying or take-off never advances it') });
    const c2 = Caption(ui, { eb: L('服務完成', 'Service complete'), ti: L('行李送達，<em>里數入帳</em>', 'Bags delivered, <em>miles credited</em>'), su: L('現金訂單在服務完成後才入帳里數', 'Cash orders earn miles only once the service is complete') });
    const pills = Steps(ui, EN ? ['At the airport', 'Loaded on board', 'Local handover'] : ['到達機場', '裝入飛機', '當地物流交接']);
    return (t) => {
      const io = inOut();
      w.pages(t, seq);
      const px = K(t, [[0, 720], [7.1, 720], [8.1, order.x + order.w / 2 - 40]]);
      const py = K(t, [[0, midY - 120], [1.1, midY], [tE[3], midY], [tE[3] + 0.9, midY + 130], [7.1, midY + 130], [8.1, order.y + order.h / 2 + 30]]);
      const z = K(t, [[0, 1.05], [1.1, 1.2], [7.1, 1.2], [8.1, 1.4], [10, 1.46, E.lin]]) * io.zm;
      w.look(px, py, z, io);
      w.pointer(t, track, [...tE, tDone]);
      const ni = t < tE[1] ? 0 : t < tE[3] ? 1 : 2;
      const last = tE.reduce((m, x) => (t >= x ? x : m), -9);
      const final = t >= tDone + 0.5;
      hl(final ? order : nodes[ni], final ? bell(t, 7.9, 8.4, 9.3, 9.6) : bell(t, last + 0.1, last + 0.35, last + 0.9, last + 1.15), (1 - seg(t, final ? 7.9 : last + 0.1, final ? 8.5 : last + 0.6, E.out5)) * 18);
      tag(order.x + 24, order.y + order.h + 22, bell(t, 8.3, 8.7, 9.3, 9.6));
      c1(t, 0.4, 6.7); c2(t, 6.9, 9.6);
      // 到机场 → 部分装机 → 全部装机 → 当地物流交接
      const active = t < tE[0] ? -1 : t < tE[1] ? 0 : t < tE[3] ? 1 : 2;
      const doneIdx = t < tE[0] ? -1 : t < tE[2] ? 0 : t < tE[3] ? 1 : 2;
      pills(t, 0.4, 9.6, doneIdx >= active ? -1 : active, doneIdx);
    };
  });

  // ===== 52–58 家庭专区 =====
  scene('family', 52, 58, 8, (el, T0, ui) => {
    const w = new Win(el, '', ['family-0', 'family-1', 'benefits']);
    const demo = C('family.demo'), table = R('benefits.table'), card = R('benefits.milestone'), gauge = R('benefits.gauge');
    const tLink = cue('clicks', T0 + 1.2) - T0;
    const CUT = 2.9;
    const cols = Array.from({ length: 5 }, (_, i) => ({ x: table.x + table.w * 0.281 + i * table.w * 0.1437, y: table.y, w: table.w * 0.1437, h: table.h }));
    const tCol = cols.map((_, i) => cue('pops', T0 + 6.0 + i * 0.3) - T0);
    const hl = w.hl(0), ring = w.hl(10);
    const cardY = card.y + card.h / 2, tableY = table.y + table.h / 2;
    const PX = [[0, 720], [CUT - 0.15, 720], [CUT + 0.5, card.x + card.w / 2 + 170], [4.9, card.x + card.w / 2 + 170], [5.8, 720]];
    const PY = [[0, 480], [tLink, 500], [2.1, 650], [CUT - 0.01, 660, E.lin], [CUT, cardY - 10, E.lin], [4.9, cardY + 10, E.lin], [5.8, tableY - 30], [8, tableY - 10, E.lin]];
    const Z = [[0, 0.95], [tLink, 0.98, E.lin], [2.1, 1.14], [CUT - 0.15, 1.15, E.lin], [CUT + 0.5, 1.2], [4.9, 1.24, E.lin], [5.8, 1.1], [8, 1.14, E.lin]];
    const c1 = Caption(ui, { eb: L('05 · 家庭專區', '05 · Family zone'), ti: L('家人在家，<em>也能幫上忙</em>', 'Family can help <em>from home</em>'), su: L('成員互聯 · 代填行李預報 · 按授權範圍查看行李進度', 'Link members · fill in forecasts for them · see progress within what they authorise') });
    const c2 = Caption(ui, { eb: L('家庭權益', 'Family benefits'), ti: L('每次搬運，<em>累積家庭里程碑</em>', 'Every move <em>builds a family milestone</em>'), su: L('五個會籍級別的權益對照 · 均為 Hackathon 擬議構思', 'Benefits compared across five tiers · all proposals for the hackathon') });
    return (t) => {
      const io = inOut();
      const pg = w.pages(t, [[0, 'family-0'], [tLink + 0.08, 'family-1'], [CUT, 'benefits', 'nav']]);
      w.url.innerHTML = `<b>plume-light</b> / pages / ${pg.cur === 'benefits' ? 'benefits' : 'family'}.html`;
      w.look(K(t, PX), K(t, PY), K(t, Z) * 1.1 * io.zm, { ...io, prevPy: K(CUT - 0.005, PY) });
      w.pointer(t, [[0.4, 860, 620], [tLink - 0.1, demo[0], demo[1]], [2.4, 780, 760], [2.8, 800, 800]], [tLink]);
      ring(gauge, pg.cur === 'benefits' ? bell(t, 3.5, 3.9, 4.7, 5.0) : 0, (1 - seg(t, 3.5, 4.1, E.out5)) * 20);
      const ci = tCol.filter((x) => t >= x).length - 1;
      hl(cols[Math.max(0, ci)], pg.cur === 'benefits' && ci >= 0 ? bell(t, tCol[0], tCol[0] + 0.2, 7.3, 7.6) : 0);
      c1(t, 0.3, 2.8); c2(t, 3.1, 7.7);
    };
  });

  // ===== 58–78 营运看板 =====
  scene('ops', 58, 78, 22, (el, T0, ui) => {
    const marks = M.text.bookmarks.map((_, i) => C(`members.mark${i}`));
    const pages = ['ops', 'cargo', 'cargo-detail', 'cargo-vol', 'cargo-mel', ...marks.map((_, i) => `members-${i}`)];
    const w = new Win(el, '', pages, ['cargo-hover']);
    const cargoCard = C('ops.cargo'), barC = C('cargo.bar'), flow = R('cargo.flow'), vol = C('cargo.btn.vol'), mel = C('cargo.btn.mel');
    const hover = M.shots['cargo-hover'];
    const k = (kind, lt) => cue(kind, T0 + lt) - T0;
    const tEnter = k('clicks', 2.2), tBar = k('clicks', 8.4), tVol = k('clicks', 13.4), tMel = k('clicks', 14.4), tBoard = k('clicks', 15.5);
    const tMark = marks.map((_, i) => k('clicks', 16.3 + i * 0.4));
    const demoIdx = Math.min(4, marks.length - 1);
    const tHome = k('clicks', 16.3 + marks.length * 0.4 + 0.1);
    const a = tEnter + 0.55;
    const seq = [[0, 'ops'], [a, 'cargo', 'nav'], [tBar + 0.06, 'cargo-detail', 'nav'], [tVol + 0.06, 'cargo-vol'], [tMel + 0.06, 'cargo-mel'], [tBoard + 0.06, `members-${demoIdx}`, 'nav'], ...tMark.map((x, i) => [x + 0.05, `members-${i}`]), [tHome + 0.05, `members-${demoIdx}`]];
    const track = [
      [1.0, 940, 430], [2.1, cargoCard[0], cargoCard[1] + 120], [3.2, cargoCard[0], cargoCard[1] + 120], [5.8, 640, 620], [7.3, barC[0], barC[1] - 20], [tBar + 0.2, barC[0], barC[1] - 20],
      [9.6, 420, flow.y + flow.h + 40], [12.6, 420, flow.y + flow.h + 40], [tVol - 0.1, vol[0], vol[1]], [tMel - 0.1, mel[0], mel[1]], [tBoard - 0.1, 611, 29], [tBoard + 0.2, 611, 29],
      ...tMark.map((x, i) => [x - 0.08, marks[i][0], marks[i][1] + 4]), [tHome - 0.08, marks[demoIdx][0], marks[demoIdx][1] + 4], [tHome + 0.4, marks[demoIdx][0] + 40, marks[demoIdx][1] + 90], [20.0, 1000, 1560], [21.4, 1000, 1560],
    ];
    const urls = { ops: 'operations.html', cargo: 'hold-pressure /', members: 'hold-pressure / ?board=members' };
    const hl = w.hl(10);
    const caps = [
      [Caption(ui, { eb: L('06 · 營運看板', '06 · Operations boards'), ti: L('旅客的預報，<em>航司的規劃依據</em>', 'Passenger forecasts become <em>planning input</em>'), su: L('僅限國泰員工 · 貨物與用戶兩塊看板', 'Cathay staff only · one board for cargo, one for users') }), 0.4, 2.7],
      [Caption(ui, { eb: L('貨艙看板', 'Cargo board'), ti: L('哪一班<em>超限</em>，一眼看見', 'Spot the flight that is <em>over capacity</em>'), su: L('商貨 + 乘客預測 + Plume 行李 · 先臨近起飛，再佔用率', 'Cargo + passenger estimate + Plume bags · nearest departure first') }), 3.1, 8.2],
      [Caption(ui, { eb: L('航班詳情', 'Flight detail'), ti: L('超限行李，<em>建議延後到後班</em>', 'Over the limit? <em>Defer bags to a later flight</em>'), su: L('同航段候選航班逐一評估 · 規劃建議，不直接改配載', 'Each candidate flight on the sector assessed · advice only, no load change') }), 8.7, 13.1],
      [Caption(ui, { eb: L('切換視角', 'Switch the view'), ti: L('重量 / 體積，<em>三條航段</em>', 'Weight or volume, <em>three sectors</em>'), su: L('LHR 倫敦 · MEL 墨爾本 · SYD 悉尼', 'LHR London · MEL Melbourne · SYD Sydney') }), 13.4, 15.4],
      [Caption(ui, { eb: L('用戶看板', 'Users board'), ti: L('收入、轉化、<em>家庭關係</em>', 'Revenue, conversion, <em>family links</em>'), su: L('按學期書籤回看 · 全部為模擬數據', 'Replay by term bookmark · simulated data throughout') }), 15.8, 21.5],
    ];
    const pills = Steps(ui, EN ? ['Cargo', 'Users'] : ['貨物', '用戶']);
    const CUTS = [a, tBar + 0.06, tBoard + 0.06];
    const flowY = flow.y + flow.h / 2 + 10;
    // 进入货舱看板：朝卡片推近，新页面在推近中叠入，再拉回全景
    const PX = [[0, 720], [tEnter, 720], [a, cargoCard[0], E.in], [a + 0.7, 720, E.out], [3.7, 720], [4.6, 420], [5.6, 1010], [6.8, 720], [9.3, 720], [10.3, 600], [12.8, 860, E.lin], [13.3, 720], [16.1, 720]];
    const PY = [[0, 405], [3.7, 405], [4.6, 400], [5.6, 400], [6.8, hover.y + 405], [tBar + 0.05, hover.y + 405], [tBar + 0.06, 430, E.lin], [9.3, 430], [10.3, flowY], [12.8, flowY], [13.3, 430], [tBoard, 430], [16.1, 330], [tHome + 0.2, 330], [tHome + 1.2, 1650, E.io5], [22, 1700, E.lin]];
    const Z = [[0, 0.92], [tEnter, 0.94, E.lin], [a, 1.5, E.in], [a + 0.7, 0.92, E.out], [3.7, 0.92], [4.6, 1.6], [5.6, 1.6], [6.8, 1.0], [tBar - 0.1, 1.03, E.lin], [tBar + 0.5, 0.95], [9.3, 0.95], [10.3, 1.3], [12.8, 1.3], [13.3, 0.95], [tBoard, 0.95], [16.1, 1.3], [tHome + 0.2, 1.3], [tHome + 1.2, 1.25], [22, 1.3, E.lin]];
    return (t) => {
      const io = inOut('pan', 'sink');
      const pg = w.pages(t, seq);
      w.url.innerHTML = `<b>plume-light</b> / pages / ${urls[pg.cur.split('-')[0]]}`;
      w.patch('cargo-hover', pg.cur === 'cargo' ? seg(t, 7.35, 7.6, E.lin) : 0);
      const cutT = CUTS.reduce((m, c) => (t >= c ? c : m), -9);
      const prevPy = K(cutT - 0.005, PY);
      const px = K(t, PX);
      const py = K(t, PY);
      const z = K(t, Z) * 1.08 * io.zm;
      w.look(px, py, z, { ...io, prevPy });
      w.pointer(t, track, [tEnter, tBar, tVol, tMel, tBoard, ...tMark, tHome], CUTS);
      hl(flow, pg.cur === 'cargo-detail' ? bell(t, 10.2, 10.6, 12.6, 12.9) : 0, (1 - seg(t, 10.2, 10.8, E.out5)) * 22);
      caps.forEach(([c, a0, b0]) => c(t, a0, b0));
      pills(t, 3.1, 21.5, t < tBoard ? 0 : 1, 99);
    };
  }, [PAN, 0.5]);

  // ===== 78–90 技术与收尾 =====
  scene('outro', 78, 90, 16, (el, T0) => {
    const lastLocale = M.text.locales[M.text.locales.length - 1].value;
    const names = ['home', 'pricing', 'agent-2', 'cargo', 'journey-4', 'baggage', 'members-4', 'checkout', 'family-1', 'cargo-detail', 'benefits', 'info-hk', `home-${lastLocale}`, 'prepare', 'ops'];
    const persp = h('div', '', el);
    persp.style.cssText = 'position:absolute;inset:0;perspective:1700px;perspective-origin:50% 40%';
    const wall = h('div', 'wall', persp);
    const COLS = 6, ROWS = 4, TW = 560, TH = 350, GAP = 40;
    const tiles = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const tile = h('div', 'tile', wall);
      h('img', '', tile).src = DIR + M.shots[names[(r * COLS + c * 2 + r) % names.length]].file;
      tiles.push({ el: tile, r, c });
    }
    const shade = h('div', 'wall-shade', el);
    const title = lines(h('div', 'center-title', el), L('一套 React 技術棧，<em>旅客端與營運端</em>同步上線', 'One React stack for <em>passengers and operations</em>'));
    title.el.style.top = '170px';
    const KPIS = [[11, L('個頁面', 'PAGES')], [5, L('種語言', 'LANGUAGES')], [2, L('塊營運看板', 'OPS BOARDS')], [151, L('項測試通過', 'TESTS PASSING')]];
    const kpis = h('div', 'kpis', el);
    kpis.style.top = '330px';
    const kEls = KPIS.map(([, label]) => h('div', 'kpi', kpis, `<b>0</b><span>${label}</span>`));
    const techs = h('div', 'techs', el);
    techs.style.top = '640px';
    const tEls = ['React 19', 'TypeScript', 'Vite', 'TanStack Query', 'CSS Modules', 'Vitest', 'Floating UI'].map((s) => h('div', 'chip ghosty', techs, s));
    const fine = h('div', 'fine', el, L('鍵盤可操作的拖拽 · 大字模式 · RTL · 響應式版面 · 可重設的演示場景', 'Keyboard-operable drag and drop · large-text mode · RTL · responsive layout · resettable demo scenarios'));
    fine.style.top = '760px';
    const fl = feathers(el);
    const block = LogoBlock(el, {
      sub: L('Less to carry. More to discover.', '輕裝啟程，安心抵達。'),
      chipText: L('PLUME LIGHT · 泰易送 · 翼隨行', 'PLUME LIGHT · CATHAY HACKATHON'),
      fine: L('Cathay Hackathon 概念原型 · 頁面中的價格、里數、時間與規則均為演示數據', 'Cathay Hackathon concept prototype · prices, miles, times and rules shown are demo data'),
    });
    KPIS.forEach((_, i) => cue('pops', T0 + 0.9 + i * 0.3));
    FLASHES.push([toGlobal(cue('hits', T0 + 8)), 0.45]);
    return (t) => {
      const fin = seg(t, 7.4, 8.2, E.io);
      op(shade, seg(t, 0, 0.8, E.lin));
      wall.style.transform = `translateZ(${lerp(-900, -520, seg(t, 0, 16, E.out))}px) rotateX(${lerp(58, 50, seg(t, 0, 8, E.out))}deg) rotateZ(${-24 + t * 0.6}deg)`;
      tiles.forEach(({ el: tile, r, c }) => {
        const drift = (r % 2 ? 1 : -1) * (t * 34 + 120);
        const x = (c - (COLS - 1) / 2) * (TW + GAP) + drift - TW / 2;
        const y = (r - (ROWS - 1) / 2) * (TH + GAP) - TH / 2;
        const p = seg(t, 0.05 + (r + c) * 0.06, 0.9 + (r + c) * 0.06, E.out5);
        tile.style.transform = `translate3d(${x}px,${y}px,${(1 - p) * -500}px)`;
        op(tile, p * lerp(1, 0.7, fin));
      });
      const out = seg(t, 7.2, 7.9, E.in);
      title.set(t - 0.45, out);
      kEls.forEach((kEl, i) => {
        const a = 0.9 + i * 0.3;
        const p = seg(t, a, a + 0.6, E.out5);
        kEl.firstChild.textContent = Math.round(KPIS[i][0] * seg(t, a, a + 1.1, E.out5));
        st(kEl, { y: (1 - p) * 60 - out * 40, s: lerp(0.8, 1, p), o: p * (1 - out) });
      });
      tEls.forEach((c, i) => {
        const p = seg(t, 2.6 + i * 0.12, 3.2 + i * 0.12, E.out5);
        st(c, { y: (1 - p) * 26 - out * 30, o: p * (1 - out) });
      });
      op(fine, seg(t, 3.6, 4.2) * (1 - out));
      fl(t, seg(t, 8, 9.5));
      block(t - 8, 0);
    };
  }, [0, 0]);

  // ---------- 渲染与播放 ----------
  function render(t) {
    t = clamp(t, 0, DURATION);
    renderChrome(t);
    for (const s of scenes) {
      const on = t >= s.a - s.lap[0] && t < s.b + s.lap[1];
      for (const el of s.els) el.style.display = on ? 'block' : 'none';
      if (!on) continue;
      NOW.rt = t - s.a;
      NOW.D = s.b - s.a;
      s.render((t - s.a) * s.k);
    }
  }
  function fit() {
    const pad = RENDER ? 0 : 44;
    const k = Math.min(innerWidth / W, (innerHeight - pad) / H);
    stage.style.transform = `translate(${(-W * k) / 2}px,${(-H * k) / 2 - pad / 2}px) scale(${k})`;
  }
  addEventListener('resize', fit);
  fit();

  window.__duration = DURATION;
  window.__cues = CUES;
  window.__seek = (t) => { render(t); };
  window.__ready = (async () => {
    await document.fonts.ready;
    // 逐帧导出前把所有图片解码好，避免某一帧截到未加载的空白
    for (const s of scenes) for (const el of s.els) el.style.display = 'block';
    await Promise.all([...document.images].map((img) => img.decode().catch(() => console.error('图片未能载入：' + img.src))));
    render(Number(Q.get('t')) || 0);
  })();

  if (!RENDER) {
    const audio = new Audio(`audio/soundtrack-${LANG}.m4a`);
    const play = document.getElementById('play'), seekEl = document.getElementById('seek'), clock = document.getElementById('clock');
    let t = Number(Q.get('t')) || 0, playing = false, last = 0;
    const mmss = (x) => `${Math.floor(x / 60)}:${String(Math.floor(x % 60)).padStart(2, '0')}`;
    const ui = () => { seekEl.firstElementChild.style.width = `${(t / DURATION) * 100}%`; clock.textContent = `${mmss(t)} / ${mmss(DURATION)}`; play.textContent = playing ? '❚❚' : '▶'; };
    const jump = (x) => { t = clamp(x, 0, DURATION); if (audio.readyState) audio.currentTime = t; render(t); ui(); };
    function tick(now) {
      if (!playing) return;
      t = audio.readyState >= 2 && !audio.paused ? audio.currentTime : t + (now - last) / 1000;
      last = now;
      if (t >= DURATION) { t = DURATION; playing = false; audio.pause(); }
      render(t); ui();
      requestAnimationFrame(tick);
    }
    function toggle() {
      playing = !playing;
      if (playing) { if (t >= DURATION) t = 0; if (audio.readyState) audio.currentTime = t; audio.play().catch(() => {}); last = performance.now(); requestAnimationFrame(tick); } else audio.pause();
      ui();
    }
    play.addEventListener('click', toggle);
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); toggle(); }
      if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') jump(t + (e.code === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 5 : 1));
    });
    seekEl.addEventListener('click', (e) => { const r = seekEl.getBoundingClientRect(); jump(((e.clientX - r.left) / r.width) * DURATION); });
    window.__ready.then(ui);
  }
})();
