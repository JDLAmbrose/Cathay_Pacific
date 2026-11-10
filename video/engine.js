/* Plume Light 演示视频 · 时间轴引擎
 * render(t) 是时间 t（秒）的纯函数：同一个 t 永远画出同一帧，
 * 因此既能实时播放（与音轨同步），也能被 tools/render.mjs 逐帧导出。 */
(() => {
  'use strict';
  const TL = window.TIMELINE;
  const TIMING = window.TIMING || {};
  const DURATION = TL.duration;
  const RENDER = new URLSearchParams(location.search).has('render');
  if (RENDER) document.body.classList.add('render');

  const W = 1920, H = 1080;
  const $ = (s) => document.querySelector(s);
  const stage = $('#stage');
  let scale = 1;
  function fit() {
    scale = Math.min(innerWidth / W, innerHeight / H);
    stage.style.transform = `translate(-50%,-50%) scale(${scale})`;
  }

  // ---------- 缓动与插值 ----------
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (t, a, b) => (b <= a ? (t >= a ? 1 : 0) : clamp((t - a) / (b - a)));
  const ease = {
    out: (p) => 1 - Math.pow(1 - p, 3),
    in: (p) => p * p * p,
    inOut: (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    back: (p) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); },
    bounce: (p) => {
      const n = 7.5625, d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
      if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
      return n * (p -= 2.625 / d) * p + 0.984375;
    },
  };
  const parseKeys = (s) => s.split(',').map((x) => { const [v, at] = x.split('@'); return [parseFloat(v), parseFloat(at)]; });
  function keyVal(keys, lt) {
    if (lt <= keys[0][1]) return keys[0][0];
    for (let i = 1; i < keys.length; i++) {
      const [v, at] = keys[i];
      if (lt <= at) {
        const [v0, t0] = keys[i - 1];
        return v0 + (v - v0) * ease.inOut(seg(lt, t0, at));
      }
    }
    return keys[keys.length - 1][0];
  }
  // "on@3 | on@3-5 | on@<5"，同名类多条规则取并集
  function parseCls(s) {
    const map = {};
    for (const tok of s.trim().split(/\s+/)) {
      const [name, cond] = tok.split('@');
      let test;
      if (cond.startsWith('<')) { const b = +cond.slice(1); test = (lt) => lt < b; }
      else if (cond.includes('-')) { const [a, b] = cond.split('-').map(Number); test = (lt) => lt >= a && lt < b; }
      else { const a = +cond; test = (lt) => lt >= a; }
      (map[name] = map[name] || []).push(test);
    }
    return Object.entries(map);
  }

  // ---------- 收集场景与动效声明 ----------
  const scenes = [...document.querySelectorAll('.scene')].map((el) => {
    const sc = { el, id: el.id, start: +el.dataset.start, end: +el.dataset.end, cues: [], nums: [], ks: [], cls: [], types: [], floats: [] };
    el.querySelectorAll('[data-at]').forEach((n) => {
      const fx = n.dataset.fx || 'up';
      sc.cues.push({
        el: n, fx, at: +n.dataset.at,
        dur: +(n.dataset.dur || (fx === 'drop' ? 0.8 : fx === 'pop' ? 0.5 : 0.55)),
        out: n.dataset.out != null ? +n.dataset.out : null,
        d: +(n.dataset.d || 28), tf: n.dataset.tf || '',
      });
    });
    el.querySelectorAll('[data-num]').forEach((n) => sc.nums.push({
      el: n, keys: parseKeys(n.dataset.num), dec: +(n.dataset.dec || 0), sep: !!n.dataset.sep, last: null,
    }));
    el.querySelectorAll('[data-k]').forEach((n) => {
      for (const part of n.dataset.k.split(';')) {
        const [prop, unit, keys] = part.split('|');
        sc.ks.push({ el: n, prop, unit, keys: parseKeys(keys), svg: n instanceof SVGElement && unit === '' });
      }
    });
    el.querySelectorAll('[data-cls]').forEach((n) => sc.cls.push({ el: n, rules: parseCls(n.dataset.cls) }));
    el.querySelectorAll('[data-type]').forEach((n) => {
      const [a, b] = n.dataset.type.split(',').map(Number);
      sc.types.push({ el: n, a, b, chars: Array.from(n.textContent), last: -1 });
    });
    el.querySelectorAll('[data-float]').forEach((n) => {
      const [amp, period, phase] = n.dataset.float.split(',').map(Number);
      sc.floats.push({ el: n, amp, period, phase });
    });
    return sc;
  });

  function applyCue(c, lt) {
    const raw = seg(lt, c.at, c.at + c.dur);
    const pIn = c.fx === 'pop' || c.fx === 'drop' ? raw : ease.out(raw);
    const pOut = c.out == null ? 0 : ease.in(seg(lt, c.out, c.out + 0.35));
    const vis = (c.fx === 'drop' ? Math.min(1, raw * 4) : pIn) * (1 - pOut);
    const s = c.el.style;
    s.opacity = vis.toFixed(3);
    s.visibility = vis <= 0.001 ? 'hidden' : '';
    const q = 1 - pIn;
    let tr = c.tf;
    switch (c.fx) {
      case 'up': tr += ` translate3d(0,${(q * c.d).toFixed(2)}px,0)`; break;
      case 'down': tr += ` translate3d(0,${(-q * c.d).toFixed(2)}px,0)`; break;
      case 'left': tr += ` translate3d(${(-q * c.d).toFixed(2)}px,0,0)`; break;
      case 'right': tr += ` translate3d(${(q * c.d).toFixed(2)}px,0,0)`; break;
      case 'scale': tr += ` scale(${(0.92 + 0.08 * pIn).toFixed(4)})`; break;
      case 'pop': tr += ` scale(${(0.55 + 0.45 * ease.back(raw)).toFixed(4)})`; break;
      case 'drop': tr += ` translate3d(0,${(-(1 - ease.bounce(raw)) * 150).toFixed(2)}px,0)`; break;
      default: break;
    }
    if (pOut > 0 && c.fx !== 'fade') tr += ` translate3d(0,${(-pOut * 14).toFixed(2)}px,0)`;
    s.transform = tr.trim();
    if (c.fx === 'pop') { s.transformBox = 'fill-box'; s.transformOrigin = '50% 50%'; }
  }

  function fmt(v, dec, sep) {
    const n = dec ? v.toFixed(dec) : String(Math.round(v));
    return sep ? Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }) : n;
  }

  // ---------- 场景内的特殊动效 ----------
  const pad = (n) => String(n).padStart(2, '0');
  const hms = (sec) => `${pad(Math.floor(sec / 3600) % 24)}:${pad(Math.floor(sec / 60) % 60)}:${pad(sec % 60)}`;
  const custom = {
    's-lug'(lt) {
      // 申请截止倒计时：演示“现在”距 10月27日 23:30 HKT 还有 2 天 06:12:40
      const left = 2 * 86400 + 6 * 3600 + 12 * 60 + 40 - Math.floor(Math.max(0, lt - 9.6));
      const el = $('#lg-countdown');
      const txt = `${Math.floor(left / 86400)} 天 ${hms(left % 86400)}`;
      if (el.textContent !== txt) el.textContent = txt;
    },
    's-agent'(lt) {
      document.querySelectorAll('#s-agent .dots i').forEach((d, i) => {
        d.style.transform = `translateY(${(-Math.abs(Math.sin(lt * 6 - i * 0.7)) * 6).toFixed(2)}px)`;
      });
    },
    's-ops'(lt) {
      const base = lt < 21 ? 17 * 3600 + 24 * 60 + 5 + Math.floor(Math.max(0, lt)) : 17 * 3600 + 31 * 60 + 12 + Math.floor(lt - 21);
      const el = $('#op-clock');
      const txt = hms(base);
      if (el.textContent !== txt) el.textContent = txt;
      const pulse = (0.55 + 0.45 * Math.sin(lt * 4)).toFixed(3);
      document.querySelectorAll('#s-ops .live i').forEach((d) => { d.style.opacity = pulse; });
    },
  };

  function renderScenes(t) {
    for (const sc of scenes) {
      const fadeIn = sc.start <= 0 ? 1 : seg(t, sc.start - 0.3, sc.start + 0.3);
      const fadeOut = sc.end >= DURATION ? 0 : seg(t, sc.end - 0.3, sc.end + 0.3);
      const op = fadeIn * (1 - fadeOut);
      sc.el.style.visibility = op > 0 ? 'visible' : 'hidden';
      sc.el.style.opacity = op.toFixed(3);
      if (op <= 0) continue;
      const lt = t - sc.start;
      for (const c of sc.cues) applyCue(c, lt);
      for (const n of sc.nums) {
        const txt = fmt(keyVal(n.keys, lt), n.dec, n.sep);
        if (txt !== n.last) { n.el.textContent = txt; n.last = txt; }
      }
      for (const k of sc.ks) {
        const v = keyVal(k.keys, lt);
        if (k.svg) k.el.setAttribute(k.prop, v.toFixed(3));
        else k.el.style.setProperty(k.prop, v.toFixed(3) + k.unit);
      }
      for (const c of sc.cls) for (const [name, tests] of c.rules) c.el.classList.toggle(name, tests.some((f) => f(lt)));
      for (const ty of sc.types) {
        const n = Math.round(ty.chars.length * seg(lt, ty.a, ty.b));
        if (n !== ty.last) { ty.el.textContent = ty.chars.slice(0, n).join(''); ty.last = n; }
        const typing = lt >= ty.a && lt < ty.b;
        const blink = lt >= ty.a - 0.2 && lt < ty.b + 0.5 && Math.floor(lt * 3) % 2 === 0;
        ty.el.classList.toggle('caret', typing || blink);
      }
      for (const f of sc.floats) {
        f.el.style.transform = `translateY(${(Math.sin((lt / f.period) * Math.PI * 2 + f.phase) * f.amp).toFixed(2)}px)`;
      }
      if (custom[sc.id]) custom[sc.id](lt);
    }
  }

  // ---------- 常驻元素 ----------
  const top = $('#chrome-top');
  const darkSpans = scenes.filter((s) => s.el.classList.contains('dark')).map((s) => [s.start, s.end]);
  function renderChrome(t) {
    let dark = 0;
    for (const [a, b] of darkSpans) dark = Math.max(dark, seg(t, a - 0.3, a + 0.3) * (1 - (b >= DURATION ? 0 : seg(t, b - 0.3, b + 0.3))));
    top.style.opacity = ((1 - dark) * ease.out(seg(t, 0, 0.5))).toFixed(3);
  }

  const chapterBox = $('#chapters');
  const chapters = TL.chapters.map((c, i) => {
    const end = i + 1 < TL.chapters.length ? TL.chapters[i + 1].at : DURATION;
    const el = document.createElement('div');
    el.className = 'ch';
    el.style.flex = String(end - c.at);
    el.innerHTML = '<i></i>';
    chapterBox.appendChild(el);
    return { start: c.at, end, fill: el.firstChild };
  });
  function renderChapters(t) {
    for (const c of chapters) c.fill.style.width = (seg(t, c.start, c.end) * 100).toFixed(2) + '%';
  }

  let captions = true;
  const sub = $('#subtitle');
  const lines = TL.narration.map((n) => ({ ...n, dur: TIMING[n.id] || Array.from(n.text).length / 4.6 }));
  function renderSubtitle(t) {
    const line = captions ? lines.find((l) => t >= l.at && t < l.at + l.dur + 0.3) : null;
    const txt = line ? line.text : '';
    if (sub.textContent !== txt) sub.textContent = txt;
    sub.style.opacity = line ? (seg(t, line.at, line.at + 0.15) * (1 - seg(t, line.at + line.dur + 0.1, line.at + line.dur + 0.3))).toFixed(3) : '0';
  }

  // ---------- 光标：关键帧的 sel 在初始化时换算成画布坐标 ----------
  const cursor = $('#cursor');
  const ripple = cursor.querySelector('.ripple');
  ripple.style.left = '-20px';
  ripple.style.top = '-24px';
  const tracks = TL.cursor.map((tr) => tr.map((k) => ({ ...k })));
  const pressTargets = [];
  function measureCursor() {
    const sr = stage.getBoundingClientRect();
    for (const tr of tracks) {
      for (const k of tr) {
        if (!k.sel) continue;
        renderScenes(k.t);
        const el = document.querySelector(k.sel);
        const r = el.getBoundingClientRect();
        k.x = (r.left + r.width * (k.ax ?? 0.5) - sr.left) / scale;
        k.y = (r.top + r.height * (k.ay ?? 0.55) - sr.top) / scale;
        if (k.click) pressTargets.push({ el, t: k.t });
      }
    }
  }
  function renderCursor(t) {
    let vis = 0, x = 0, y = 0, click = -1;
    for (const tr of tracks) {
      const t0 = tr[0].t, t1 = tr[tr.length - 1].t;
      if (t < t0 - 0.4 || t > t1 + 0.5) continue;
      vis = seg(t, t0 - 0.4, t0) * (1 - seg(t, t1, t1 + 0.5));
      if (t <= t0) { x = tr[0].x; y = tr[0].y; }
      else if (t >= t1) { x = tr[tr.length - 1].x; y = tr[tr.length - 1].y; }
      else {
        for (let i = 1; i < tr.length; i++) {
          const a = tr[i - 1], b = tr[i];
          if (t > b.t) continue;
          const mv = Math.min(0.9, (b.t - a.t) * 0.8);
          const p = ease.inOut(seg(t, b.t - mv, b.t));
          const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
          const arc = Math.sin(Math.PI * p) * Math.min(60, len * 0.12);
          x = a.x + dx * p - (dy / len) * arc;
          y = a.y + dy * p + (dx / len) * arc;
          break;
        }
      }
      for (const k of tr) if (k.click && t >= k.t && t < k.t + 0.5) click = (t - k.t) / 0.5;
    }
    cursor.style.opacity = vis.toFixed(3);
    const s = click >= 0 && click < 0.24 ? 0.86 : 1;
    cursor.style.transform = `translate(${(x - 8).toFixed(1)}px,${(y - 4).toFixed(1)}px) scale(${s})`;
    ripple.style.opacity = click >= 0 ? (1 - click).toFixed(3) : '0';
    ripple.style.transform = `scale(${(0.35 + Math.max(0, click) * 1.1).toFixed(3)})`;
    for (const p of pressTargets) p.el.classList.toggle('is-pressed', t >= p.t - 0.02 && t < p.t + 0.2);
  }

  function render(t) {
    renderScenes(t);
    renderChrome(t);
    renderChapters(t);
    renderSubtitle(t);
    renderCursor(t);
  }

  // ---------- 播放器 ----------
  const audio = $('#soundtrack');
  const btnPlay = $('#btn-play'), scrub = $('#scrub'), timeEl = $('#time'), controls = $('#controls'), overlay = $('#startover');
  let t = 0, playing = false, last = 0, muted = false, hideTimer = 0;
  const mmss = (s) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;

  function syncUI() {
    btnPlay.querySelector('use').setAttribute('href', playing ? '#i-pause' : '#i-play');
    if (document.activeElement !== scrub) scrub.value = t.toFixed(2);
    timeEl.textContent = `${mmss(t)} / ${mmss(DURATION)}`;
  }
  function play() {
    if (t >= DURATION - 0.05) t = 0;
    playing = true;
    overlay.style.display = 'none';
    try { audio.currentTime = t; } catch { /* 音轨尚未加载 */ }
    audio.muted = muted;
    audio.play().catch(() => {});
    last = performance.now();
    poke();
  }
  function pause() { playing = false; audio.pause(); poke(); }
  function seek(x) {
    t = clamp(x, 0, DURATION);
    try { audio.currentTime = t; } catch { /* 音轨尚未加载 */ }
    render(t);
    syncUI();
  }
  function poke() {
    controls.classList.remove('hide');
    clearTimeout(hideTimer);
    if (playing) hideTimer = setTimeout(() => controls.classList.add('hide'), 2500);
  }
  function loop(now) {
    if (playing) {
      t += (now - last) / 1000;
      // 以自身时钟为主，偏差过大时跟随音轨，避免缓冲导致音画不同步
      if (!audio.paused && audio.readyState >= 3 && Math.abs(audio.currentTime - t) > 0.25) t = audio.currentTime;
      if (t >= DURATION) { t = DURATION; pause(); }
    }
    last = now;
    render(t);
    syncUI();
    requestAnimationFrame(loop);
  }
  function bindControls() {
    overlay.addEventListener('click', play);
    btnPlay.addEventListener('click', () => (playing ? pause() : play()));
    $('#btn-restart').addEventListener('click', () => { seek(0); play(); });
    scrub.addEventListener('input', () => seek(+scrub.value));
    $('#btn-cc').addEventListener('click', (e) => { captions = !captions; e.currentTarget.classList.toggle('off', !captions); });
    $('#btn-mute').addEventListener('click', (e) => { muted = !muted; audio.muted = muted; e.currentTarget.classList.toggle('off', muted); });
    $('#btn-full').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()));
    addEventListener('mousemove', poke);
    addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); playing ? pause() : play(); }
      else if (e.key === 'ArrowRight') seek(t + 5);
      else if (e.key === 'ArrowLeft') seek(t - 5);
      else if (e.key === 'Home') seek(0);
      else if (e.key === 'c' || e.key === 'C') $('#btn-cc').click();
      else if (e.key === 'm' || e.key === 'M') $('#btn-mute').click();
      else if (e.key === 'f' || e.key === 'F') $('#btn-full').click();
      poke();
    });
  }

  async function init() {
    fit();
    addEventListener('resize', fit);
    const fontLoads = ['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 40px Sora`));
    await Promise.race([Promise.all(fontLoads).catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
    await document.fonts.ready;
    await Promise.all([...document.images].map((img) => (img.complete ? 0 : new Promise((r) => { img.onload = img.onerror = r; }))));
    measureCursor();
    render(0);
    window.__duration = DURATION;
    window.__seek = (x) => { t = x; render(x); };
    if (!RENDER) {
      bindControls();
      syncUI();
      requestAnimationFrame(loop);
    }
  }
  window.__ready = init();
})();
