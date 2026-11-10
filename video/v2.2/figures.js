/* Plume Light v2.2 · 手绘角色与道具
 * 在 engine.js 收集动效之前，把 <g data-fig='{"t":"lin", ...}'> 展开成 SVG，保证同一角色在各场景造型一致。
 * 坐标约定：原点在双脚中间的地面，y 向下为正；成人身高约 290 单位。
 * 通用参数：x / y 位置，s 缩放，flip 水平镜像（面向左），cls 附加类名。
 * 人物参数：face 表情、arms [左, 右] 手臂姿势、legs 腿部姿势、hold {l|r: 手持物}、lean 上身前倾角度、
 *          sweat 汗珠、shades 墨镜、wings / halo 天使造型、chair 轮椅。 */
(() => {
  'use strict';
  const INK = '#22302d';
  const SKIN = '#f3c9a4';
  const st = (w = 4.5) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const f1 = (v) => (+v).toFixed(1);
  const path = (pts) => 'M' + pts.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(' L');
  const RAD = Math.PI / 180;

  // 粗线条肢体：先画墨线描边，再叠一层颜色
  function limb(pts, color, w) {
    const d = path(pts);
    return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 9}" stroke-linecap="round" stroke-linejoin="round"/>`
      + `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  const BODY = {
    adult: { headY: -246, headR: 34, shY: -203, shX: 31, hipY: -122, hipX: 15, torsoW: 74, torsoTop: -216, L1: 46, L2: 42, armW: 17, legW: 22, hand: 8.5, seat: 72 },
    child: { headY: -170, headR: 33, shY: -128, shX: 21, hipY: -68, hipX: 11, torsoW: 52, torsoTop: -138, L1: 30, L2: 28, armW: 13, legW: 16, hand: 7, seat: 46 },
  };

  // 手臂姿势：[上臂角度, 前臂角度]，0° 垂直向下，90° 水平外展，180° 向上，负值为向身体内侧
  const ARMS = {
    down: [10, 4], hold: [18, 10], head: [140, -128], up: [165, 172], phone: [12, -118], back: [55, 62],
    thumb: [100, 165], wave: [125, 172], cup: [14, -105], face: [160, -81], tablet: [22, -88], reach: [78, 84],
    hip: [60, -60], lift: [8, 2], cane: [24, 14], push: [40, 70],
  };

  function armPts(d, side, pose) {
    const [a1, a2] = Array.isArray(pose) ? pose : ARMS[pose] || ARMS.down;
    const sx = side * d.shX, sy = d.shY;
    const ex = sx + Math.sin(a1 * RAD) * d.L1 * side, ey = sy + Math.cos(a1 * RAD) * d.L1;
    const hx = ex + Math.sin(a2 * RAD) * d.L2 * side, hy = ey + Math.cos(a2 * RAD) * d.L2;
    return [[sx, sy], [ex, ey], [hx, hy]];
  }

  function legPts(d, side, mode) {
    const x = side * d.hipX, y = d.hipY, k = d === BODY.child ? 0.62 : 1;
    switch (mode) {
      case 'walk': return side < 0 ? [[x, y], [x - 10 * k, y / 2], [x - 30 * k, -6]] : [[x, y], [x + 12 * k, y / 2], [x + 22 * k, -6]];
      case 'bent': return [[x, y], [x + side * 16 * k, y / 2], [x + side * 6 * k, -6]];
      case 'jump': return [[x, y], [x + side * 18 * k, y * 0.62], [x + side * 8 * k, y * 0.3]];
      case 'sit': return [[x, -d.seat], [x + 52 * k, -d.seat], [x + 54 * k, -6]];
      default: return [[x, y], [x + side * 2, -6]];
    }
  }

  // ---------- 头部：发型 / 表情 / 配件 ----------
  function hairBack(kind, color) {
    if (kind === 'long') return `<path d="M-40 -6 C-46 -50 46 -50 40 -6 L44 44 C20 52 -20 52 -44 44Z" fill="${color}" ${st()}/>`;
    if (kind === 'staff') return `<circle cx="-30" cy="-16" r="14" fill="${color}" ${st()}/>`;
    if (kind === 'bun') return `<circle cx="0" cy="-42" r="14" fill="${color}" ${st()}/>`;
    return '';
  }
  function hairFront(kind, color) {
    switch (kind) {
      case 'lin': return `<path d="M-36 4 C-42 -34 -14 -52 8 -46 C30 -42 44 -22 37 4 C32 -10 26 -20 14 -22 C12 -14 2 -12 -4 -20 C-12 -12 -24 -10 -36 4Z" fill="${color}" ${st()}/>`;
      case 'kid': return `<path d="M-36 6 C-42 -44 42 -44 36 6 C30 -12 18 -18 4 -12 C-8 -20 -26 -14 -36 6Z" fill="${color}" ${st()}/>`;
      case 'bun': case 'staff': return `<path d="M-35 0 C-36 -42 36 -42 35 0 C28 -18 6 -24 -4 -18 C-14 -24 -28 -16 -35 0Z" fill="${color}" ${st()}/>`;
      case 'long': return `<path d="M-35 2 C-36 -42 36 -42 35 2 C26 -16 10 -22 0 -14 C-10 -22 -26 -16 -35 2Z" fill="${color}" ${st()}/>`;
      case 'short': return `<path d="M-35 -2 C-36 -40 36 -40 35 -2 C26 -20 -26 -20 -35 -2Z" fill="${color}" ${st()}/>`;
      case 'cap': return `<path d="M-37 -4 C-37 -46 37 -46 37 -4Z" fill="#0b7a70" ${st()}/><path d="M10 -8 L62 -2 L58 6 L8 2Z" fill="#00615e" ${st()}/>`;
      default: return '';
    }
  }
  function face(mood) {
    const e = (x) => `<circle cx="${x}" cy="-2" r="3.8" fill="${INK}"/>`;
    const L = (d, w = 3.6) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const blush = '<ellipse cx="-20" cy="10" rx="7" ry="4" fill="#ef8f86" opacity=".45"/><ellipse cx="20" cy="10" rx="7" ry="4" fill="#ef8f86" opacity=".45"/>';
    switch (mood) {
      case 'happy': return L('M-18 0 Q-12 -7 -6 0') + L('M6 0 Q12 -7 18 0') + `<path d="M-12 9 Q0 24 12 9Z" fill="#fff" ${st(3.4)}/>` + blush;
      case 'smile': return e(-12) + e(12) + L('M-10 11 Q0 19 10 11') + blush;
      case 'worried': return e(-12) + e(12) + L('M-19 -11 L-7 -15') + L('M7 -15 L19 -11') + L('M-11 15 q5 -5 11 0 q5 5 11 0');
      case 'pained': return L('M-18 -7 L-9 -2 L-18 3') + L('M18 -7 L9 -2 L18 3') + `<rect x="-11" y="9" width="22" height="9" rx="3" fill="#fff" ${st(3)}/>` + L('M-4 9 V18 M4 9 V18', 2);
      case 'surprised': return `<circle cx="-12" cy="-3" r="5" fill="${INK}"/><circle cx="12" cy="-3" r="5" fill="${INK}"/>` + L('M-19 -16 Q-12 -21 -6 -16') + L('M6 -16 Q12 -21 19 -16') + `<ellipse cx="0" cy="15" rx="5.5" ry="7" fill="#7a2f2a" ${st(3)}/>`;
      case 'sad': return e(-12) + e(12) + L('M-19 -10 L-7 -14') + L('M7 -14 L19 -10') + L('M-9 17 Q0 9 9 17');
      case 'cry': return L('M-18 -1 Q-12 3 -6 -1') + L('M6 -1 Q12 3 18 -1') + L('M-10 17 Q0 8 10 17') + '<path d="M-14 4 Q-16 18 -12 30" stroke="#6fb6e6" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M14 4 Q16 18 12 30" stroke="#6fb6e6" stroke-width="5" fill="none" stroke-linecap="round"/>';
      case 'smug': return L('M-18 -2 H-6') + L('M6 -2 H18') + '<circle cx="-11" cy="1" r="2.6" fill="#22302d"/><circle cx="13" cy="1" r="2.6" fill="#22302d"/>' + L('M-8 13 Q4 19 13 8') + blush;
      case 'calm': return L('M-18 0 Q-12 4 -6 0') + L('M6 0 Q12 4 18 0') + L('M-8 12 Q0 17 8 12') + blush;
      default: return e(-12) + e(12) + L('M-8 12 Q0 16 8 12');
    }
  }

  function head(d, o) {
    const sc = d.headR / 34;
    const hc = o.hairColor || ({ lin: '#2a2a2a', kid: '#2a2a2a', bun: '#cfd4d2', staff: '#1f1f1f', long: '#5a3b2a', short: '#4a3426' })[o.hair] || '#2a2a2a';
    let s = `<g transform="translate(0 ${d.headY}) scale(${sc})">`;
    if (o.halo) s += '<ellipse cx="0" cy="-58" rx="32" ry="9" fill="none" stroke="#ffd36b" stroke-width="7"/><ellipse cx="0" cy="-58" rx="32" ry="9" fill="none" stroke="#fff6cf" stroke-width="2.5"/>';
    s += hairBack(o.hair, hc);
    s += `<rect x="-9" y="24" width="18" height="22" fill="${o.skin || SKIN}" ${st(4)}/>`;
    s += `<circle cx="-34" cy="2" r="7" fill="${o.skin || SKIN}" ${st(4)}/><circle cx="34" cy="2" r="7" fill="${o.skin || SKIN}" ${st(4)}/>`;
    s += `<circle r="34" fill="${o.skin || SKIN}" ${st()}/>`;
    s += face(o.face);
    s += hairFront(o.hair, hc);
    if (o.glasses) s += `<circle cx="-12" cy="-2" r="9" fill="none" ${st(3)}/><circle cx="12" cy="-2" r="9" fill="none" ${st(3)}/><path d="M-3 -2 H3" ${st(3)}/>`;
    if (o.shades) s += `<g class="shades"${o.shadesAt ? ` data-at="${o.shadesAt}" data-fx="drop"` : ''}><path d="M-26 -9 H26 L22 6 Q14 10 6 4 L2 -2 H-2 L-6 4 Q-14 10 -22 6Z" fill="#111" ${st(3)}/><path d="M-18 -5 L-12 -5" stroke="#fff" stroke-width="2.5" opacity=".7"/></g>`;
    if (o.sweat) {
      const drops = [[-46, -24], [46, -12], [-52, 8], [42, -40]].slice(0, o.sweat);
      s += drops.map(([x, y], i) => `<g data-float="4,${0.6 + i * 0.15},${i}"><path d="M${x} ${y} q-7 12 0 16 q7 -4 0 -16Z" fill="#8fd0f2" ${st(2.5)}/></g>`).join('');
    }
    return s + '</g>';
  }

  // ---------- 手持物 ----------
  function heldItem(kind, x, y, side) {
    switch (kind) {
      case 'phone': return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${side * -8})"><rect x="-11" y="-20" width="22" height="38" rx="4" fill="#2a3532" ${st(3)}/><rect x="-7" y="-15" width="14" height="27" rx="2" fill="#9ef0d6"/></g>`;
      case 'cup': return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M-12 -14 H12 L9 10 H-9Z" fill="#fff" ${st(3.5)}/><path d="M12 -8 q9 0 8 8 q-1 6 -10 6" fill="none" ${st(3.5)}/><path d="M-4 -22 q-5 -8 0 -14 M5 -22 q-5 -8 0 -14" fill="none" stroke="#9aa9a5" stroke-width="3" stroke-linecap="round"/></g>`;
      case 'tablet': return `<g transform="translate(${f1(x)} ${f1(y)})"><rect x="-46" y="-34" width="92" height="64" rx="8" fill="#2a3532" ${st(3.5)}/><rect x="-39" y="-27" width="78" height="50" rx="4" fill="#eaf5f1"/><text x="0" y="-4" text-anchor="middle" font-size="15" font-weight="800" fill="#00615e" font-family="Sora, sans-serif">Large text</text><rect x="-28" y="6" width="56" height="10" rx="5" fill="#00615e"/></g>`;
      case 'cane': return `<path d="M${f1(x - 10)} ${f1(y - 6)} q10 -14 20 -2 L${f1(x + 14)} -4" fill="none" stroke="#6b4f2c" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`;
      case 'bag': return `<g transform="translate(${f1(x)} ${f1(y)})"><path d="M-10 0 q10 -16 20 0" fill="none" ${st(4)}/><rect x="-20" y="0" width="40" height="30" rx="7" fill="#c98f2d" ${st(3.5)}/></g>`;
      case 'thumb': return `<g transform="translate(${f1(x)} ${f1(y)})"><rect x="-4" y="-27" width="10" height="22" rx="5" fill="${SKIN}" ${st(3.5)}/></g>`;
      default: return '';
    }
  }

  // ---------- 衣着 ----------
  function torso(d, o) {
    const w = d.torsoW, top = d.torsoTop, h = d.hipY + 10 - top;
    const c = o.top || '#0b7a70';
    let s = `<rect x="${-w / 2}" y="${top}" width="${w}" height="${h}" rx="${w * 0.32}" fill="${c}" ${st()}/>`;
    switch (o.outfit) {
      case 'hoodie': s += `<path d="M-16 ${top + 4} Q0 ${top + 22} 16 ${top + 4}" fill="none" ${st(3.5)}/><path d="M-20 ${d.hipY - 26} H20 V${d.hipY - 6} H-20Z" fill="none" ${st(3)}/>`; break;
      case 'uniform': s += `<path d="M-12 ${top + 2} L0 ${top + 26} L12 ${top + 2}Z" fill="#ffd36b" ${st(3)}/><path d="M0 ${top + 26} V${d.hipY}" ${st(3)}/><circle cx="-14" cy="${top + 40}" r="5" fill="#ffd36b"/>`; break;
      case 'vest': s += `<path d="M${-w / 2 + 6} ${top + 8} V${d.hipY} H${w / 2 - 6} V${top + 8}" fill="#ff8a1e" opacity=".9"/><path d="M${-w / 2 + 4} ${top + 50} H${w / 2 - 4}" stroke="#eef2f1" stroke-width="8"/>`; break;
      case 'cardigan': s += `<path d="M0 ${top + 6} V${d.hipY + 6}" ${st(3)}/><circle cx="6" cy="${top + 34}" r="3.5" fill="${INK}"/><circle cx="6" cy="${top + 58}" r="3.5" fill="${INK}"/>`; break;
      case 'tee': s += `<path d="M-14 ${top + 3} Q0 ${top + 14} 14 ${top + 3}" fill="none" ${st(3)}/>`; break;
      default: break;
    }
    if (o.straps) s += `<path d="M-22 ${top + 4} L-18 ${d.hipY - 4} M22 ${top + 4} L18 ${d.hipY - 4}" stroke="#c98f2d" stroke-width="8" stroke-linecap="round"/>`;
    if (o.skirt) s += `<path d="M${-w / 2} ${d.hipY - 4} L${-w / 2 - 12} ${d.hipY + 46} H${w / 2 + 12} L${w / 2} ${d.hipY - 4}Z" fill="${o.bottom}" ${st()}/>`;
    return s;
  }

  function wings() {
    const wing = '<path d="M0 0 C40 -70 130 -84 176 -50 C150 -44 140 -30 148 -16 C120 -16 108 -2 112 12 C84 6 58 10 40 24 C30 12 14 6 0 6Z" fill="#fffaf0" stroke="#e2b25c" stroke-width="4" stroke-linejoin="round"/>'
      + '<path d="M30 -20 C70 -40 110 -44 150 -40 M28 -4 C64 -14 98 -12 132 -8" fill="none" stroke="#e8cf98" stroke-width="3" stroke-linecap="round"/>';
    const one = (side) => `<g transform="translate(${side * 22} -196) scale(${side} 1)"><g data-wobble="7,0.9,${side > 0 ? 0 : 3.14}" style="transform-box:fill-box;transform-origin:0% 60%">${wing}</g></g>`;
    return one(1) + one(-1);
  }

  function chairBack() {
    return `<path d="M-46 -78 L-54 -196 M-54 -196 L-74 -200" fill="none" ${st(7)}/><path d="M-48 -78 H48" ${st(8)}/>`;
  }
  function chairFront() {
    const spokes = [0, 45, 90, 135].map((a) => `<path d="M${f1(-18 + Math.cos(a * RAD) * 54)} ${f1(-58 + Math.sin(a * RAD) * 54)} L${f1(-18 - Math.cos(a * RAD) * 54)} ${f1(-58 - Math.sin(a * RAD) * 54)}" stroke="#7b8b88" stroke-width="3"/>`).join('');
    return `<circle cx="-18" cy="-58" r="58" fill="none" ${st(7)}/>${spokes}<circle cx="-18" cy="-58" r="44" fill="none" stroke="#9aa9a5" stroke-width="3"/><circle cx="62" cy="-13" r="13" fill="#fff" ${st(5)}/><path d="M48 -78 L62 -26 M56 -12 H84" fill="none" ${st(6)}/>`;
  }

  function person(o) {
    const d = BODY[o.body || 'adult'];
    const sit = o.legs === 'sit';
    const dy = sit ? -d.seat - d.hipY : 0; // 坐姿时上半身整体下移到座面高度
    const hold = o.hold || {};
    const [aL, aR] = o.arms || ['down', 'down'];
    let s = '';
    if (o.chair) s += chairBack();
    if (o.wings) s += wings();
    const pants = o.bottom || '#3d4f6b';
    const legW = o.skirt ? d.legW * 0.62 : d.legW;
    const legColor = o.skirt ? (o.legColor || SKIN) : pants;
    for (const side of [-1, 1]) {
      const pts = legPts(d, side, o.legs);
      s += limb(pts, legColor, legW);
      const [fx, fy] = pts[pts.length - 1];
      s += `<ellipse cx="${f1(fx + (sit ? 8 : side * 4))}" cy="${f1(fy + 2)}" rx="${d.legW * 0.72}" ry="${d.legW * 0.38}" fill="${o.shoes || '#2b2b2b'}" ${st(4)}/>`;
    }
    let up = torso(d, o) + head(d, o);
    const armSvg = (side, pose) => {
      const pts = armPts(d, side, pose);
      const [hx, hy] = pts[2];
      return limb(pts, o.sleeve || o.top || '#0b7a70', d.armW) + `<circle cx="${f1(hx)}" cy="${f1(hy)}" r="${d.hand}" fill="${o.skin || SKIN}" ${st(4)}/>`
        + heldItem(hold[side < 0 ? 'l' : 'r'], hx, hy, side);
    };
    up += armSvg(-1, aL) + armSvg(1, aR);
    s += `<g transform="translate(0 ${dy}) rotate(${o.lean || 0} 0 ${d.hipY})">${up}</g>`;
    if (o.chair) s += chairFront();
    return s;
  }

  // ---------- 道具 ----------
  function suitcase(o) {
    const w = o.w || 110, h = o.h || 170, c = o.c || '#0b7a70';
    let s = '';
    if (o.handle === 'up') s += `<path d="M${-w * 0.2} ${-h - 10} V${-h - 10 - h * 0.5} H${w * 0.2} V${-h - 10}" fill="none" ${st(6)}/>`;
    s += `<rect x="${-w / 2}" y="${-h - 10}" width="${w}" height="${h}" rx="${Math.min(16, w * 0.14)}" fill="${c}" ${st()}/>`;
    s += `<path d="M${-w * 0.22} ${-h + 8} V-28 M${w * 0.22} ${-h + 8} V-28" stroke="rgba(0,0,0,.22)" stroke-width="6" stroke-linecap="round"/>`;
    s += `<rect x="${-w / 2 + 8}" y="${-h - 2}" width="${w * 0.22}" height="${h - 16}" rx="6" fill="#fff" opacity=".16"/>`;
    if (o.handle !== 'up') s += `<path d="M${-w * 0.18} ${-h - 10} V${-h - 24} H${w * 0.18} V${-h - 10}" fill="none" ${st(5)}/>`;
    s += `<circle cx="${-w / 2 + 12}" cy="-4" r="6" fill="${INK}"/><circle cx="${w / 2 - 12}" cy="-4" r="6" fill="${INK}"/>`;
    if (o.fuse != null) s += `<path d="M${w * 0.1} ${-h - 24} q10 -24 26 -22" fill="none" stroke="#6b4f2c" stroke-width="4" stroke-linecap="round"/><g data-float="3,0.3,${o.fuse}"><circle cx="${w * 0.1 + 27}" cy="${-h - 47}" r="9" fill="#ffd36b"/><circle cx="${w * 0.1 + 27}" cy="${-h - 47}" r="4.5" fill="#fff"/></g>`;
    if (o.tag) s += `<rect x="${w / 2 - 6}" y="${-h * 0.62}" width="26" height="18" rx="3" fill="#ffe9bd" ${st(3)} transform="rotate(14 ${w / 2} ${-h * 0.6})"/>`;
    return s;
  }
  function box(o) {
    const w = o.w || 130, h = o.h || 96;
    let s = `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" rx="4" fill="#d3ad74" ${st()}/>`;
    s += `<rect x="-11" y="${-h}" width="22" height="${h}" fill="#ecd3a2" stroke="${INK}" stroke-width="2.5"/>`;
    s += `<path d="M${-w / 2} ${-h + 18} H${w / 2}" stroke="#b58c55" stroke-width="3"/>`;
    s += `<rect x="${w / 2 - 34}" y="${-h * 0.45}" width="24" height="16" rx="2" fill="#fff" opacity=".8"/>`;
    if (o.fuse != null) s += `<path d="M10 ${-h} q10 -22 26 -20" fill="none" stroke="#6b4f2c" stroke-width="4" stroke-linecap="round"/><g data-float="3,0.3,${o.fuse}"><circle cx="37" cy="${-h - 21}" r="9" fill="#ffd36b"/><circle cx="37" cy="${-h - 21}" r="4.5" fill="#fff"/></g>`;
    return s;
  }

  const MAKERS = {
    // 角色预设：只需覆盖表情、姿势等差异
    lin: (o) => person({ hair: 'lin', top: '#0b7a70', outfit: 'hoodie', bottom: '#3d4f6b', shoes: '#f4f1ea', ...o }),
    elder: (o) => person({ hair: 'bun', glasses: true, top: '#c98f2d', outfit: 'cardigan', bottom: '#6f7c79', skirt: true, legColor: '#d9c7b5', ...o }),
    kid: (o) => person({ body: 'child', hair: 'kid', top: '#e2b25c', outfit: 'tee', bottom: '#2f4f4b', shoes: '#c25e00', ...o }),
    rider: (o) => person({ hair: 'short', top: '#7a5ba8', outfit: 'tee', bottom: '#3d4f6b', legs: 'sit', chair: true, ...o }),
    staff: (o) => person({ hair: 'staff', top: '#00615e', outfit: 'uniform', bottom: '#00504a', skirt: true, legColor: '#e7c3a0', ...o }),
    min: (o) => person({ hair: 'long', top: '#d9efe8', sleeve: '#d9efe8', bottom: '#3d4f6b', ...o }),
    crew: (o) => person({ hair: 'short', top: '#3d4f6b', outfit: 'vest', bottom: '#2f3b45', ...o }),
    driver: (o) => person({ hair: 'cap', top: '#0b7a70', outfit: 'tee', bottom: '#2f3b45', ...o }),
    traveler: (o) => person({ hair: 'short', top: '#9fb6b1', outfit: 'tee', bottom: '#55625f', ...o }),
    person,
    suitcase,
    box,
  };

  document.querySelectorAll('[data-fig]').forEach((el) => {
    const o = JSON.parse(el.dataset.fig);
    const make = MAKERS[o.t];
    if (!make) throw new Error(`未知角色/道具：${o.t}`);
    const s = o.s || 1;
    const tf = `translate(${o.x || 0} ${o.y || 0}) scale(${o.flip ? -s : s} ${s})`;
    el.innerHTML = `<g transform="${tf}"${o.cls ? ` class="${o.cls}"` : ''}>${make(o)}</g>`;
  });
})();
