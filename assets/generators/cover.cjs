// Fantasy Code RPG key art: title screen poster at native 384 x 216.
const { Canvas } = require('./pixlib.cjs');
const hero2 = require('./hero.cjs');
const W = 384, H = 216;
const cv = new Canvas(W, H);
let seed = 4242;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
function tri(A, B, C, fn) {
  const minX = Math.floor(Math.min(A[0], B[0], C[0])), maxX = Math.ceil(Math.max(A[0], B[0], C[0]));
  const minY = Math.floor(Math.min(A[1], B[1], C[1])), maxY = Math.ceil(Math.max(A[1], B[1], C[1]));
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const d1 = (x - B[0]) * (A[1] - B[1]) - (A[0] - B[0]) * (y - B[1]);
    const d2 = (x - C[0]) * (B[1] - C[1]) - (B[0] - C[0]) * (y - C[1]);
    const d3 = (x - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (y - A[1]);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) fn(x, y);
  }
}
const poly = (pts, fn) => { for (let i = 1; i < pts.length - 1; i++) tri(pts[0], pts[i], pts[i + 1], fn); };
const line = (a, b, c, t = 1) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2); for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; for (let k = 0; k < t; k++) cv.set(x + k * 0.5, y + k * 0.5, c); } };

// ---------- Sky: deep violet → crimson → ember, with light rays behind the title ----------
cv.gradient(0, 150, ['#020806', '#04140c', '#06200f', '#0a3a1e', '#145a2c', '#1f8a3c', '#4fd070']);
const rc = [192, 46];
for (let y = 0; y < 150; y++) for (let x = 0; x < W; x++) {
  const a = Math.atan2(y - rc[1], x - rc[0]);
  const band = Math.sin(a * 14) > 0.55;
  const d = Math.hypot(x - rc[0], y - rc[1]);
  if (band && d > 20 && cv.dither(x, y, Math.max(0, 0.38 - d / 520))) cv.set(x, y, y < 60 ? '#0a3a1e' : '#1f8a3c');
}
// Digital rain: falling columns of rune glyphs, bright heads, fading tails
const RUNES = [[7, 5, 7, 4, 7], [2, 7, 2, 2, 7], [5, 2, 7, 2, 5], [7, 1, 3, 1, 7], [4, 6, 5, 4, 4], [1, 7, 5, 7, 4], [6, 5, 6, 5, 6], [7, 2, 2, 2, 2], [5, 5, 7, 1, 1], [3, 4, 2, 1, 6]];
for (let col = 0; col < 64; col++) {
  const x = Math.floor(rnd() * (W / 4)) * 4, len = 4 + Math.floor(rnd() * 14), head = Math.floor(rnd() * 150);
  for (let k = 0; k < len; k++) {
    const gy = head - k * 6; if (gy < -5 || gy > 140) continue;
    const glyph = RUNES[Math.floor(rnd() * RUNES.length)];
    const c = k === 0 ? '#e8ffe8' : k < 3 ? '#7dff9a' : k < len * 0.6 ? '#1f8a3c' : '#0a3a1e';
    for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (glyph[r] & (4 >> b)) cv.set(x + b, gy + r, c);
  }
}

// ---------- Distant mountains and the citadel ----------
const ridgeTop = [];
for (let x = 0; x < W; x++) {
  const t = Math.round(138 - Math.sin(x * 0.03 + 1) * 8 - Math.sin(x * 0.11) * 3);
  ridgeTop[x] = t;
  for (let y = t; y < H; y++) cv.set(x, y, '#04140c');
  cv.set(x, t, '#7dff9a');
  for (let y = t + 4; y < H; y += 5) if ((y - t) < 40) cv.set(x, y, (y - t) < 12 ? '#1f8a3c' : '#0a3a1e');
  if (x % 12 === 0) for (let y = t; y < Math.min(H, t + 36); y++) cv.set(x + Math.round((y - t) * 0.15), y, '#145a2c');
}
const cx0 = 340, by = 132;
cv.rect(cx0 - 14, by - 6, cx0 + 14, by + 8, '#1a1428');
for (const [tx, tw, th] of [[-12, 4, 18], [-3, 6, 28], [8, 4, 20]]) {
  cv.rect(cx0 + tx, by - th, cx0 + tx + tw, by, '#1a1428');
  for (let i = 0; i <= tw / 2; i++) cv.rect(cx0 + tx + i, by - th - (tw / 2 - i), cx0 + tx + tw - i, by - th - (tw / 2 - i), '#1a1428');
}
for (const [wx, wy] of [[-10, -10], [0, -20], [1, -12], [10, -12], [-6, 0], [6, 2]]) cv.set(cx0 + wx, by + wy, '#7dff9a');

// ---------- The Dragon (realistic pass: skeleton, volume, scales, backlit wings) ----------
const DK = '#04100a', RIM = '#7dff9a', RIM2 = '#1f8a3c';
const PAL = { deep: '#020a06', dark: '#04100a', mid: '#0a1a12', base: '#122a1e', lit: '#1e3e2c', hi: '#3a6a4c',
  belly: '#5a7462', bellyD: '#34463a', bellyL: '#86a48e' };
const FAR = { deep: '#010604', dark: '#020a06', mid: '#06120c', base: '#0a1e14', lit: '#122a1e', hi: '#1e3e2c',
  belly: '#34463a', bellyD: '#1e2c22', bellyL: '#4a6252' };
// Tube along a spine: per-pixel shading from the local cross-section, so the form reads as round.
function tube(pts, radii, P, opt = {}) {
  const segs = []; let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, L, u0: acc, r0: radii[i], r1: radii[i + 1] }); acc += L; }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), R = Math.max(...radii) + 1;
  for (let y = Math.floor(Math.min(...ys) - R); y <= Math.max(...ys) + R; y++) for (let x = Math.floor(Math.min(...xs) - R); x <= Math.max(...xs) + R; x++) {
    let best = null;
    for (const s of segs) {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1];
      let t = ((x - s.a[0]) * dx + (y - s.a[1]) * dy) / (s.L * s.L); t = Math.max(0, Math.min(1, t));
      const px = s.a[0] + dx * t, py = s.a[1] + dy * t, r = s.r0 + (s.r1 - s.r0) * t, dist = Math.hypot(x - px, y - py);
      if (!best || dist - r < best.k) { let nx = dy / s.L, ny = -dx / s.L; if (ny > 0) { nx = -nx; ny = -ny; } best = { k: dist - r, r, sd: (x - px) * nx + (y - py) * ny, u: s.u0 + t * s.L, uf: (s.u0 + t * s.L) / acc }; }
    }
    if (best.k > 0) continue;
    const s = -best.sd / Math.max(best.r, 0.5), u = best.u, v = best.sd;
    let c;
    if (s < -0.82) c = RIM2;
    else if (s < -0.5) c = cv.dither(x, y, (s + 0.82) / 0.32) ? P.lit : P.hi;
    else if (s < -0.1) c = cv.dither(x, y, (s + 0.5) / 0.4) ? P.base : P.lit;
    else if (s < 0.35) c = cv.dither(x, y, (s + 0.1) / 0.45) ? P.mid : P.base;
    else if (s < 0.75) c = P.mid; else c = P.dark;
    // scales: a diamond lattice that follows the body's own surface
    const m1 = ((Math.round(u + v * 1.2) % 4) + 4) % 4, m2 = ((Math.round(u - v * 1.2) % 4) + 4) % 4;
    if ((m1 === 0 || m2 === 0) && s > -0.82 && s < 0.6) c = c === P.hi ? P.lit : c === P.lit ? P.base : c === P.base ? P.mid : P.dark;
    // ventral scutes: pale banded belly plates
    if (opt.belly && best.uf >= opt.belly[0] && best.uf <= opt.belly[1] && s > 0.3) c = (Math.round(u) % 3 === 0) ? P.bellyD : (s > 0.7 ? P.bellyD : (s < 0.45 ? P.bellyL : P.belly));
    if (s > 0.9) c = opt.underglow ? RIM2 : P.deep;
    cv.set(x, y, c);
  }
  return { segs, acc };
}
function claws(x, y, dir, P) { for (let k = 0; k < 3; k++) { const cx = x + dir * k * 2, cy = y + k; cv.set(cx, cy, '#a8b4c8'); cv.set(cx + dir, cy + 1, '#6a6488'); cv.set(cx + dir * 2, cy + 1, '#3a3450'); } }
// Wing: arm (shoulder > elbow > wrist), fingers fanning from the wrist, membrane backlit by the code-glow sky.
function wing(sh, el, wr, tips, flank, dim) {
  const memA = dim ? '#020a06' : '#04100a', memB = dim ? '#06140c' : '#0a2416', memC = dim ? '#0a2416' : '#145a2c';
  const fill = (A, B, C) => tri(A, B, C, (x, y) => { const g = Math.min(1, Math.hypot(x - wr[0], y - wr[1]) / 70); cv.set(x, y, cv.dither(x, y, g * 0.6) ? (cv.dither(x + 1, y, g * 0.35) ? memC : memB) : memA); });
  const all = tips.concat([flank]);
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i], b = all[i + 1], mid = [(a[0] + b[0]) / 2 * 0.74 + wr[0] * 0.26, (a[1] + b[1]) / 2 * 0.74 + wr[1] * 0.26];
    fill(wr, a, mid); fill(wr, mid, b); line(a, mid, dim ? RIM2 : RIM); line(mid, b, dim ? RIM2 : RIM);
  }
  fill(wr, flank, sh); fill(el, wr, sh);
  // arm bones with a lit leading edge
  tube([sh, el, wr], [4, 3, 2], dim ? FAR : PAL);
  tips.forEach((tp, i) => { line(wr, tp, dim ? '#020a06' : '#04100a', i === 0 ? 2 : 1); line([wr[0], wr[1] - 1], [tp[0], tp[1] - 1], dim ? '#0a1e14' : '#3a6a4c'); cv.set(tp[0], tp[1], '#a8b4c8'); });
  // wrist talon
  cv.set(wr[0], wr[1] - 2, '#a8b4c8'); cv.set(wr[0] - 1, wr[1] - 3, '#e0e8f0');
}
// far wing (behind body), then far legs
wing([280, 100], [304, 66], [330, 34], [[346, 6], [370, 26], [382, 58], [378, 92]], [334, 114], true);
tube([[320, 124], [330, 140], [322, 150], [328, 155]], [7, 5, 3, 2], FAR); claws(330, 155, 1, FAR);
tube([[272, 118], [278, 133], [272, 142]], [5, 3, 2], FAR); claws(270, 143, -1, FAR);
// body, neck and tail as one continuous spine
const SPINE = [[244, 88], [248, 96], [254, 105], [266, 113], [290, 119], [314, 121], [334, 127], [350, 137], [364, 135], [374, 123], [380, 110]];
const RAD = [6, 7, 9, 13, 15, 14, 10, 7, 5, 3, 1];
tube(SPINE, RAD, PAL, { belly: [0, 0.42], underglow: true });
// dorsal spines along the ridge, largest over the shoulders
{ let acc = 0; const segs = []; for (let i = 0; i < SPINE.length - 1; i++) { const a = SPINE[i], b = SPINE[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]); segs.push({ a, b, L, u0: acc, r0: RAD[i], r1: RAD[i + 1] }); acc += L; }
  for (let u = 4; u < acc - 6; u += 6) {
    const s = segs.find(q => u >= q.u0 && u < q.u0 + q.L), t = (u - s.u0) / s.L, dx = (s.b[0] - s.a[0]) / s.L, dy = (s.b[1] - s.a[1]) / s.L;
    let nx = dy, ny = -dx; if (ny > 0) { nx = -nx; ny = -ny; }
    const r = s.r0 + (s.r1 - s.r0) * t, bx = s.a[0] + dx * u - dx * s.u0 + 0 + (s.a[0] - s.a[0]), px = s.a[0] + (s.b[0] - s.a[0]) * t, py = s.a[1] + (s.b[1] - s.a[1]) * t;
    const h = 2 + r * 0.35, ox = px + nx * (r - 1), oy = py + ny * (r - 1);
    tri([ox - dx * 2.5, oy - dy * 2.5], [ox + dx * 2.5, oy + dy * 2.5], [ox + nx * h + dx * h * 0.6, oy + ny * h + dy * h * 0.6], (x, y) => cv.set(x, y, PAL.lit));
    cv.set(Math.round(ox + nx * h + dx * h * 0.6), Math.round(oy + ny * h + dy * h * 0.6), RIM);
  }
}
// near wing, raised behind the head
wing([262, 102], [242, 64], [214, 32], [[196, 6], [168, 16], [150, 42], [148, 74]], [238, 110], false);
// near legs: hind leg tucked under, foreleg reaching
tube([[306, 120], [298, 140], [308, 150], [302, 156]], [10, 5, 3, 2], PAL, { underglow: true }); claws(300, 156, -1, PAL);
tube([[258, 114], [250, 130], [242, 139]], [6, 4, 2.5], PAL, { underglow: true }); claws(240, 139, -1, PAL);
// head: long wedge skull, heavy brow, open jaws toward the party (drawn at 1.4x around the skull base)
const HK = 1.4, T = (x, y) => [250 + (x - 250) * HK, 86 + (y - 88) * HK - 2], TP = pts => pts.map(p => T(p[0], p[1]));
const headMask = new Set(), hset = (x, y) => headMask.add(Math.round(x) + ',' + Math.round(y));
const upper = TP([[252, 80], [242, 75], [233, 76], [226, 80], [214, 83], [207, 86], [205, 90], [212, 91], [226, 92], [240, 93], [252, 90]]);
const lower = TP([[242, 93], [226, 97], [212, 102], [209, 105], [218, 107], [234, 103], [248, 97]]);
poly(upper, hset); poly(lower, hset);
const mouth = TP([[240, 93], [226, 92], [210, 91], [211, 101], [226, 97]]);
const [jx, jy] = T(240, 93), [bx0, by0] = T(240, 80);
for (const k of headMask) { const [x, y] = k.split(',').map(Number);
  const up = !headMask.has(x + ',' + (y - 1)), dn = !headMask.has(x + ',' + (y + 1)), jaw = y > jy + (jx - x) * 0.3 - 1;
  let c = jaw ? PAL.mid : (y < by0 + 3 ? PAL.lit : PAL.base);
  if (!jaw && y < by0) c = PAL.hi;
  const m1 = ((x + y * 2) % 5 + 5) % 5, m2 = ((x - y * 2) % 5 + 5) % 5;
  if ((m1 === 0 || m2 === 0) && !up) c = jaw ? PAL.dark : (c === PAL.hi ? PAL.lit : PAL.mid);
  if (up) c = RIM; else if (dn) c = jaw ? RIM2 : PAL.dark;
  cv.set(x, y, c);
}
const [mx0] = T(208, 0);
poly(mouth, (x, y) => cv.set(x, y, cv.dither(x, y, (x - mx0) / 44) ? '#3a0a10' : '#ff9a70'));
for (let x = 212; x <= 236; x += 2.5) { const [tx, ty] = T(x, 92); cv.set(tx, ty, '#fff6d0'); cv.set(tx, ty + 1, '#e0e8f0'); cv.set(tx, ty + 2, '#a8b4c8'); }
for (let i = 0; i < 7; i++) { const [tx, ty] = T(214 + i * 3.6, 101 - i * 1.0); cv.set(tx, ty, '#fff6d0'); cv.set(tx, ty - 1, '#e0e8f0'); }
// brow ridge, slit-pupil eye, nostril, cheek frills
line(T(224, 79), T(238, 76), PAL.hi, 2); line(T(225, 80.5), T(238, 77.5), PAL.deep);
{ const [ex, ey] = T(228, 81.5); cv.rect(ex, ey, ex + 5, ey + 1, '#ffe090'); cv.set(ex + 3, ey - 1, '#ffe090'); cv.set(ex + 2, ey, '#04100a'); cv.set(ex + 2, ey + 1, '#04100a'); cv.set(ex + 1, ey, '#fff6d0'); cv.set(ex + 5, ey + 1, '#e0b040'); }
{ const [nx, ny] = T(209, 87); cv.set(nx, ny, PAL.deep); cv.set(nx + 1, ny, PAL.deep); cv.set(nx + 1, ny - 1, PAL.hi); }
tri(T(248, 92), T(264, 99), T(252, 96), (x, y) => cv.set(x, y, PAL.lit)); tri(T(250, 88), T(266, 90), T(252, 92), (x, y) => cv.set(x, y, PAL.base));
for (let i = 0; i < 4; i++) { const [sx, sy] = T(214 + i * 6, 106 - i * 1); tri([sx, sy], [sx + 3, sy], [sx + 1, sy + 3], (x, y) => cv.set(x, y, PAL.lit)); }
// horns: ridged, curving back and up
function horn(x0, y0, cx, cy, x1, y1, w) { for (let t = 0; t <= 1; t += 0.015) { const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1, r = w * (1 - t) + 0.5;
  for (let oy = -r; oy <= r; oy++) cv.set(x, y + oy, oy < -r * 0.3 ? '#e0e8f0' : oy > r * 0.3 ? '#3a3450' : (Math.round(t * 40) % 3 === 0 ? '#6a6488' : '#a8b4c8')); } }
horn(...T(246, 80), ...T(258, 70), ...T(276, 60), 3.4); horn(...T(244, 84), ...T(258, 82), ...T(274, 76), 2.2);
// fire breath roaring toward the party, meeting the mage's bolt
for (let i = 0; i < 46; i++) {
  const t = i / 46, x = 196 - i * 1.8, y = 100 + i * 0.18 + Math.sin(i * 0.9) * 1.5;
  const r = 2 + t * 6;
  for (let oy = -r; oy <= r; oy++) for (let ox = -r; ox <= r; ox++) {
    if (ox * ox + oy * oy > r * r) continue;
    const d = Math.hypot(ox, oy) / r;
    if (!cv.dither(Math.round(x + ox), Math.round(y + oy), 1.1 - d * 0.5)) continue;
    cv.set(x + ox, y + oy, d < 0.35 ? '#fff6d0' : d < 0.65 ? '#ffe090' : '#ff9a70');
  }
}
// clash flare where fire meets magic
for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2, rr = k % 2 ? 7 : 12; line([112, 104], [112 + Math.cos(a) * rr, 104 + Math.sin(a) * rr], k % 2 ? '#d0a8ff' : '#ffffff'); }
cv.rect(110, 102, 114, 106, '#ffffff');
// ---------- Foreground crag with the party ----------
const crag = [[0, 160], [30, 150], [70, 146], [120, 148], [168, 154], [214, 168], [240, 216], [0, 216]];
poly(crag, (x, y) => {
  const top = y < 158 + (x > 160 ? (x - 160) * 0.3 : 0);
  const bp = y + Math.round(2 * Math.sin(x * 0.13) + Math.sin(x * 0.37));
  const band = Math.floor(bp / 7), inb = ((bp % 7) + 7) % 7;
  let c = top ? '#4c8038' : (band % 2 ? '#5a5478' : '#4a4468');
  if (!top && inb === 0) c = '#2a1e44';
  if (!top && inb === 1) c = x < 120 ? '#a8b4c8' : '#6a6488';
  if (!top && y > 196) c = cv.dither(x, y, (y - 196) / 20) ? '#1a1428' : c;
  if (top && cv.dither(x, y, 0.3)) c = '#80b060';
  cv.set(x, y, c);
});
// rim light from the sunset on the crag edge
for (let x = 0; x < 214; x++) { for (let y = 140; y < 200; y++) { const c = cv.get(x, y); if (c === '#4c8038' || c === '#80b060') { cv.set(x, y, '#7dff9a'); break; } } }

const party = [
  { job: 'mage', tier: 2, seed: 'mira', race: 'elf', build: 'feminine', adapter: 'anthropic-api', pose: 'attack', x: 6, gy: 150 },
  { job: 'cleric', tier: 2, seed: 'cass', race: 'fae', build: 'feminine', adapter: 'gemini-cli', pose: 'idle', x: 40, gy: 147 },
  { job: 'thief', tier: 2, seed: 'rook', race: 'beastkin', build: 'masculine', adapter: 'codex', pose: 'attack', x: 120, gy: 150 },
  { job: 'fighter', tier: 3, seed: 'aria', race: 'human', build: 'feminine', adapter: 'claude-code', pose: 'victory', x: 78, gy: 146 },
];
for (const p of party) {
  const { grid } = hero2(p);
  cv.stamp(grid, p.x, p.gy - grid.length + 2);
}
// magic bolt from the mage toward the dragon
for (let i = 0; i < 31; i++) { const x = 44 + i * 2.2, y = 112 - i * 0.27 + Math.sin(i * 0.8) * 1.5; cv.set(x, y, i % 3 ? '#d0a8ff' : '#ffffff'); if (i % 4 === 0) cv.set(x, y + 1, '#9a68e0'); }

// embers drifting up
for (let i = 0; i < 80; i++) { const x = Math.floor(rnd() * W), y = 60 + Math.floor(rnd() * 140); if (rnd() < 0.5) { cv.set(x, y, '#7dff9a'); cv.set(x, y + 1, '#1f8a3c'); } else { cv.set(x, y, '#e8ffe8'); } }

// ---------- Rendered title: emblem + sword behind, beveled gold wordmark, ribbon ----------
const GLYPHS = {
  G: ['.XXX.', 'X...X', 'X....', 'X.XXX', 'X...X', 'X...X', '.XXX.'], U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'], L: ['X....', 'X....', 'X....', 'X....', 'X....', 'X....', 'XXXXX'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'], M: ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'], R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
};
const SMALL = {
  E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'], A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'], R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], N: ['X.X', 'XXX', 'XXX', 'X.X', 'X.X'],
  T: ['XXX', '.X.', '.X.', '.X.', '.X.'], H: ['X.X', 'X.X', 'XXX', 'X.X', 'X.X'], I: ['XXX', '.X.', '.X.', '.X.', 'XXX'], U: ['X.X', 'X.X', 'X.X', 'X.X', 'XXX'],
  S: ['.XX', 'X..', '.X.', '..X', 'XX.'], O: ['.X.', 'X.X', 'X.X', 'X.X', '.X.'], Q: ['.X.', 'X.X', 'X.X', 'XX.', '.XX'], ' ': ['...', '...', '...', '...', '...'],
  ',': ['...', '...', '...', '.X.', 'X..'], '.': ['...', '...', '...', '...', '.X.'],
};
Object.assign(GLYPHS, {
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'], N: ['X...X', 'XX..X', 'X.X.X', 'X.X.X', 'X..XX', 'X...X', 'X...X'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'], S: ['.XXXX', 'X....', 'X....', '.XXX.', '....X', '....X', 'XXXX.'],
  Y: ['X...X', 'X...X', '.X.X.', '..X..', '..X..', '..X..', '..X..'], C: ['.XXX.', 'X...X', 'X....', 'X....', 'X....', 'X...X', '.XXX.'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'], E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'].map((r, i) => i === 4 ? 'X..X.' : i === 5 ? 'X...X' : i === 6 ? 'X...X' : r), P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
});
function drawWord(word, PX, wy, palette) {
  const cells = []; let cx = 0;
  for (const ch of word) { const g = GLYPHS[ch]; for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++) if (g[r][c] === 'X') for (let dy = 0; dy < PX; dy++) for (let dx = 0; dx < PX + 1; dx++) cells.push([cx + c * PX + dx, r * PX + dy]); cx += ch === ' ' ? 3 * PX : 5 * PX + 1 + 3; }
  const ww = cx - 3, wh = 7 * PX, wx = Math.round((W - ww) / 2);
  const has = new Set(cells.map(([x, y]) => x + ',' + y));
  for (const [x, y] of cells) { cv.set(wx + x + 3, wy + y + 3, '#2a1e44'); cv.set(wx + x + 2, wy + y + 2, '#5a38a0'); }
  for (const [x, y] of cells) {
    const t = y / (wh - 1);
    let c = t < 0.2 ? palette[3] : t < 0.48 ? palette[2] : t < 0.55 ? palette[3] : t < 0.8 ? palette[1] : palette[0];
    if (!has.has((x - 1) + ',' + y) || !has.has(x + ',' + (y - 1))) c = '#ffffff';
    if (!has.has((x + 1) + ',' + y) && t > 0.4) c = palette[0];
    cv.set(wx + x, wy + y, c);
  }
  for (let y = wy - 1; y <= wy + wh + 4; y++) for (let x = wx - 1; x <= wx + ww + 4; x++) {
    if (has.has((x - wx) + ',' + (y - wy))) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => has.has((x - wx + dx) + ',' + (y - wy + dy)))) cv.set(x, y, '#08081c');
  }
  return { wx, ww, wh };
}
// sword behind the title
for (let y = 0; y <= 34; y++) { cv.set(191, y, y < 4 ? '#ffffff' : '#e0e8f0'); cv.set(192, y, '#a8b4c8'); cv.set(193, y, '#6c7890'); }
for (let x = 184; x <= 200; x++) { cv.set(x, 35, '#e0b040'); cv.set(x, 36, '#9a7018'); }
const GOLD4 = ['#9a7018', '#e0b040', '#ffe090', '#fff6d0'];
const SILVER4 = ['#2458a8', '#90d0ff', '#e0e8f0', '#ffffff'];
const L1 = drawWord('FANTASY CODE', 3, 12, GOLD4);
const L2 = drawWord('RPG', 4, 40, SILVER4);
const wx = L1.wx, ww = L1.ww, wy = 12, wh = 7 * 4 + 28;
// sparkles on the title
for (const [sx, sy] of [[wx + 4, wy + 2], [wx + ww - 6, wy + 18], [L2.wx + L2.ww + 6, 44]]) { cv.set(sx, sy, '#ffffff'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) cv.set(sx + dx, sy + dy, '#ffe090'); cv.set(sx + 2, sy, '#e0b040'); cv.set(sx - 2, sy, '#e0b040'); cv.set(sx, sy + 2, '#e0b040'); cv.set(sx, sy - 2, '#e0b040'); }

cv.png(process.argv[2] || 'cover.png');
cv.scaled(3).png(process.argv[3] || 'cover@3x.png');
console.log('ok');
