// Detailed enemies, 72 x 72 (dragon 112 x 96). Facing left toward the party. ES5.
function foe2(pr) {
  var P = {
    ink: ['#08081c', '#1a1428', '#3a3450', '#6a6488'],
    night: ['#0a1148', '#142070', '#2a3c9c', '#6a80e0'],
    steel: ['#6c7890', '#a8b4c8', '#e0e8f0', '#ffffff'],
    ember: ['#9a2a20', '#e05a38', '#ff9a70', '#ffd0b0'],
    forest: ['#2c5020', '#4c8038', '#80b060', '#c8e8a0'],
    gold: ['#9a7018', '#e0b040', '#ffe090', '#fff6d0'],
    ocean: ['#2458a8', '#4890e0', '#90d0ff', '#d8f0ff'],
    arcane: ['#2a1e44', '#5a38a0', '#9a68e0', '#d0a8ff'],
    earth: ['#4a2a18', '#6c4028', '#a07848', '#c8a070'],
    rose: ['#a03860', '#e06088', '#ff90b0', '#ffd0e0'],
    stone: ['#3a3450', '#6a6488', '#a8b4c8', '#e0e8f0'],
    bone: ['#a07848', '#c8a070', '#e0e8f0', '#fff6d0']
  };
  var kind = pr.kind || 'goblin';
  var stage = parseInt(pr.stage || 0, 10);      // evolution from repeat escapes: 0, 1, 2
  var biome = pr.biome || 'api';
  var flaky = String(pr.flaky) === 'true';
  var BIOME = { api: P.ember, ui: P.forest, core: P.ocean, auth: P.arcane, payments: P.gold, legacy: P.stone, docs: P.rose };
  var R = BIOME[biome] || P.forest;
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function dith(x, y, f) { return f * 16 > BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5; }

  var big = kind === 'dragon';
  var W = big ? 114 : 74, H = big ? 98 : 74, g = [];
  for (var y = 0; y < H; y++) { var row = []; for (var x = 0; x < W; x++) row.push(null); g.push(row); }
  function set(x, y, c) { x = Math.round(x) + 1; y = Math.round(y) + 1; if (x >= 0 && x < W && y >= 0 && y < H && c) g[y][x] = c; }
  function get(x, y) { x = Math.round(x) + 1; y = Math.round(y) + 1; return (x >= 0 && x < W && y >= 0 && y < H) ? g[y][x] : null; }
  // Shaded ellipse (light from the top-left)
  function blob(cx, cy, rx, ry, r, tex) {
    for (var yy = Math.floor(cy - ry); yy <= cy + ry; yy++) for (var xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
      var dx = (xx - cx) / rx, dy = (yy - cy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      var l = -dx * 0.7 - dy * 0.8;
      var c = l > 0.55 ? r[3] : l > 0.1 ? r[2] : l > -0.45 ? r[1] : r[0];
      if (l > 0.1 && l < 0.25 && dith(xx, yy, 0.5)) c = r[1];
      if (l > -0.55 && l < -0.4 && dith(xx, yy, 0.5)) c = r[0];
      if (tex && (xx * 3 + yy * 7) % tex === 0 && l < 0.5) c = r[Math.max(0, r.indexOf(c) - 1)] || r[0];
      set(xx, yy, c);
    }
  }
  function limb(a, b, t0, t1, r) {
    var len = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
    for (var s2 = 0; s2 <= len * 2; s2++) {
      var t = s2 / (len * 2), cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t;
      var rad = (t0 + (t1 - t0) * t) / 2;
      for (var oy = -4; oy <= 4; oy++) for (var ox = -4; ox <= 4; ox++) {
        if (ox * ox + oy * oy > rad * rad + 0.3) continue;
        var lit = -ox - oy;
        set(cx + ox, cy + oy, lit > rad * 0.6 ? r[2] : lit < -rad * 0.6 ? r[0] : r[1]);
      }
    }
  }
  function tri(A, B, C, fn) {
    var minX = Math.floor(Math.min(A[0], B[0], C[0])), maxX = Math.ceil(Math.max(A[0], B[0], C[0]));
    var minY = Math.floor(Math.min(A[1], B[1], C[1])), maxY = Math.ceil(Math.max(A[1], B[1], C[1]));
    for (var yy = minY; yy <= maxY; yy++) for (var xx = minX; xx <= maxX; xx++) {
      var d1 = (xx - B[0]) * (A[1] - B[1]) - (A[0] - B[0]) * (yy - B[1]);
      var d2 = (xx - C[0]) * (B[1] - C[1]) - (B[0] - C[0]) * (yy - C[1]);
      var d3 = (xx - A[0]) * (C[1] - A[1]) - (C[0] - A[0]) * (yy - A[1]);
      if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) fn(xx, yy);
    }
  }
  function fillTri(A, B, C, c1, c2) { tri(A, B, C, function (x, y) { set(x, y, c2 && dith(x, y, 0.45) ? c2 : c1); }); }
  function eye(x, y, c) { set(x, y, c[3] || '#ffffff'); set(x + 1, y, c[2]); set(x, y + 1, c[1]); set(x + 1, y + 1, c[0]); }
  function crown(cx, top, w, col) {
    for (var xx = cx - w; xx <= cx + w; xx++) { set(xx, top, col[1]); set(xx, top + 1, col[0]); }
    for (var k = -w; k <= w; k += Math.max(2, Math.floor(w / 2))) { set(cx + k, top - 1, col[2]); set(cx + k, top - 2, col[3]); }
    set(cx, top, '#d0a8ff');
  }
  function scar(x, y) { for (var k = 0; k < 6; k++) { set(x + k * 0.7, y + k, '#e05a38'); set(x + 1 + k * 0.7, y + k, '#ffd0b0'); } }

  if (kind === 'slime') {
    var sz = 15 + stage * 4;
    blob(36, 66 - sz * 0.7, sz, sz * 0.75, R);
    for (var dx = -sz; dx <= sz; dx++) { var foot = 66 + Math.round(Math.sin(dx * 0.6) * 1.2); for (var fy = 60; fy <= foot; fy++) if (Math.abs(dx) < sz - 1) set(36 + dx, fy, R[1]); }
    blob(36 - sz * 0.45, 66 - sz * 1.15, 3, 2, ['#ffffff', '#ffffff', '#ffffff', '#ffffff']);
    var ey = 66 - sz * 0.75;
    for (var e = 0; e < 2; e++) { var exx = 29 + e * 9; for (var yy2 = ey - 2; yy2 <= ey + 3; yy2++) { set(exx, yy2, P.ink[1]); set(exx + 1, yy2, P.ink[1]); } set(exx, ey - 1, '#ffffff'); }
    for (var m = 0; m < 6; m++) set(31 + m, ey + 6 + (m === 0 || m === 5 ? -1 : 0), P.ink[1]);
    if (stage >= 2) crown(36, Math.round(66 - sz * 1.5) - 2, 5, P.gold);
  }

  if (kind === 'goblin' || kind === 'orc') {
    var orc = kind === 'orc';
    var skinR = orc ? [P.forest[0], P.forest[1], P.forest[2], P.forest[3]] : [R[0], R[1], R[2], R[3]];
    if (!orc && biome === 'ui') skinR = [P.earth[0], P.earth[1], P.earth[2], P.earth[3]];
    var s = orc ? 1.25 : 1 + stage * 0.08;
    var bx = 38, by = 66;
    // legs (wide, crouched)
    limb([bx - 4 * s, by - 18 * s], [bx - 12 * s, by - 9 * s], 6 * s, 5 * s, skinR);
    limb([bx - 12 * s, by - 9 * s], [bx - 9 * s, by], 5 * s, 4 * s, skinR);
    limb([bx + 4 * s, by - 18 * s], [bx + 11 * s, by - 9 * s], 6 * s, 5 * s, skinR);
    limb([bx + 11 * s, by - 9 * s], [bx + 13 * s, by], 5 * s, 4 * s, skinR);
    for (var f2 = -3; f2 <= 3; f2++) { set(bx - 10 * s + f2, by, P.earth[0]); set(bx + 13 * s + f2, by, P.earth[0]); }
    if (stage >= 2) {
      fillTri([bx - 2 * s, by - 36 * s], [bx + 12 * s, by - 36 * s], [bx + 26 * s, by - 6 * s], P.ember[1], P.ember[0]);
      fillTri([bx - 2 * s, by - 36 * s], [bx + 26 * s, by - 6 * s], [bx + 8 * s, by - 2 * s], P.ember[0], P.ember[1]);
      for (var cf = 0; cf < 6; cf++) set(bx + (10 + cf * 3) * s, by - (4 + (cf % 2) * 2) * s, P.ember[2]);
    }
    // torso leaning forward (toward the left)
    blob(bx, by - 26 * s, 12 * s, 11 * s, skinR, 0);
    // belt / armour
    var arm = stage >= 1 || orc ? P.steel : P.earth;
    for (var ax = -11; ax <= 11; ax++) { set(bx + ax * s, by - 19 * s, arm[0]); set(bx + ax * s, by - 18 * s, arm[1]); }
    if (stage >= 1 || orc) { blob(bx + 7 * s, by - 34 * s, 6 * s, 4 * s, P.steel); for (var rv = 0; rv < 3; rv++) set(bx + (4 + rv * 3) * s, by - 33 * s, P.steel[0]); }
    // back arm with weapon raised
    limb([bx + 8 * s, by - 32 * s], [bx + 16 * s, by - 40 * s], 5 * s, 4 * s, skinR);
    limb([bx + 16 * s, by - 40 * s], [bx + 12 * s, by - 50 * s], 4 * s, 4 * s, skinR);
    if (orc) {
      limb([bx + 12 * s, by - 50 * s], [bx + 10 * s, by - 26 * s], 3, 3, P.earth);
      tri([bx + 12 * s, by - 56 * s], [bx + 24 * s, by - 52 * s], [bx + 14 * s, by - 44 * s], function (x, y) { set(x, y, x < bx + 15 * s ? P.steel[3] : P.steel[1]); });
      tri([bx + 12 * s, by - 56 * s], [bx + 3 * s, by - 52 * s], [bx + 11 * s, by - 44 * s], function (x, y) { set(x, y, P.steel[2]); });
    } else {
      limb([bx + 12 * s, by - 50 * s], [bx + 14 * s, by - 62 * s], 4, 5, P.earth);
      for (var sp = 0; sp < 4; sp++) set(bx + (13 + (sp % 2) * 2) * s, by - (54 + sp * 2) * s, P.steel[2]);
    }
    // head (big, jutting forward-left)
    var hx = bx - 10 * s, hy = by - 40 * s;
    blob(hx, hy, 10 * s, 9 * s, skinR, 0);
    // ears / tusks
    if (!orc) {
      fillTri([hx + 6 * s, hy - 4 * s], [hx + 9 * s, hy + 1 * s], [hx + 20 * s, hy - 10 * s], skinR[1], skinR[2]);
      fillTri([hx - 6 * s, hy - 5 * s], [hx - 9 * s, hy - 1 * s], [hx - 17 * s, hy - 12 * s], skinR[2], skinR[3]);
    }
    // brow, eyes, nose, grin
    for (var bw = -8; bw <= 4; bw++) set(hx + bw * s, hy - 3 * s, skinR[0]);
    eye(hx - 5 * s, hy - 2 * s, [P.ember[0], P.ember[1], P.gold[2], '#ffffff']);
    eye(hx + 1 * s, hy - 2 * s, [P.ember[0], P.ember[1], P.gold[2], '#ffffff']);
    tri([hx - 3 * s, hy], [hx - 11 * s, hy + 5 * s], [hx - 3 * s, hy + 4 * s], function (x, y) { set(x, y, skinR[1]); });
    for (var gm = -7; gm <= 4; gm++) { set(hx + gm * s, hy + 5 * s, P.ink[1]); if (gm % 2 === 0) set(hx + gm * s, hy + 6 * s, '#fff6d0'); }
    if (orc) { for (var tk = 0; tk < 4; tk++) { set(hx - 6 * s, hy + 4 * s - tk, P.bone[3]); set(hx + 3 * s, hy + 4 * s - tk, P.bone[2]); } }
    // front arm clawing forward
    limb([bx - 6 * s, by - 32 * s], [bx - 18 * s, by - 26 * s], 5 * s, 4 * s, skinR);
    limb([bx - 18 * s, by - 26 * s], [bx - 26 * s, by - 30 * s], 4 * s, 3 * s, skinR);
    for (var cl = 0; cl < 3; cl++) set(bx - 28 * s, by - (32 - cl * 2) * s, P.bone[3]);
    if (stage >= 1) { scar(hx + 1 * s, hy - 6 * s); }
    if (stage >= 2) { crown(hx, Math.round(hy - 11 * s), 5, P.gold); for (var sk = 0; sk < 5; sk++) { set(bx + (-6 + sk * 4) * s, by - 40 * s, P.bone[3]); set(bx + (-6 + sk * 4) * s, by - 41 * s, P.bone[2]); } }
  }

  if (kind === 'golem') {
    var gb = function (x0, y0, x1, y1) { for (var yy3 = y0; yy3 <= y1; yy3++) for (var xx3 = x0; xx3 <= x1; xx3++) { var c3 = (xx3 === x0 || yy3 === y0) ? P.stone[3] : (xx3 === x1 || yy3 === y1) ? P.stone[0] : (dith(xx3, yy3, 0.25) ? P.stone[2] : P.stone[1]); set(xx3, yy3, c3); } };
    gb(18, 52, 28, 70); gb(44, 52, 54, 70);
    gb(14, 24, 58, 52);
    gb(24, 8, 48, 26);
    gb(2, 26, 14, 50); gb(0, 50, 14, 62);
    gb(58, 26, 70, 48); gb(58, 48, 72, 60);
    // glowing core and runes
    blob(36, 38, 6, 6, [R[0], R[1], R[3], '#ffffff']);
    for (var rn = 0; rn < 14; rn++) { set(20 + rn * 2.5, 30 + (rn % 3), R[3]); }
    set(30, 16, R[3]); set(31, 16, '#ffffff'); set(40, 16, R[3]); set(41, 16, '#ffffff');
    for (var ck = 0; ck < 8; ck++) set(50 - ck, 28 + ck * 2, P.ink[1]);
    if (stage >= 1) for (var mo = 0; mo < 20; mo += 2) set(15 + mo, 24, P.forest[2]);
    if (stage >= 2) crown(36, 5, 8, P.gold);
  }

  if (kind === 'wyvern') {
    // far wing
    fillTri([40, 30], [62, 2], [70, 34], R[0], P.ink[2]);
    // body, tail
    blob(38, 42, 13, 9, R);
    for (var t2 = 0; t2 <= 1; t2 += 0.02) { var tx = 50 + t2 * 22, ty = 46 + Math.sin(t2 * 4) * 6 + t2 * 10, tr = 4 - t2 * 3.5; blob(tx, ty, tr, tr, R); }
    fillTri([71, 58], [74, 64], [66, 62], P.bone[2]);
    // legs gripping
    limb([34, 48], [30, 58], 4, 3, R); limb([30, 58], [27, 66], 3, 2, R);
    limb([44, 48], [46, 58], 4, 3, R); limb([46, 58], [44, 66], 3, 2, R);
    for (var tc = 0; tc < 3; tc++) { set(25 + tc * 2, 67, P.bone[3]); set(42 + tc * 2, 67, P.bone[3]); }
    // neck and head lunging left
    limb([30, 38], [16, 26], 6, 5, R);
    blob(12, 24, 7, 5, R);
    fillTri([6, 24], [-1, 27], [7, 28], R[1]);
    for (var tt = 0; tt < 4; tt++) set(1 + tt * 2, 27, '#fff6d0');
    eye(9, 21, [P.ember[0], P.gold[1], P.gold[2], '#ffffff']);
    limb([14, 20], [20, 12], 2, 1, P.bone);
    // near wing spread up
    fillTri([36, 34], [14, 0], [6, 30], R[1], R[2]);
    fillTri([36, 34], [6, 30], [20, 40], R[0], R[1]);
    limb([36, 34], [14, 0], 2, 2, P.bone);
    if (stage >= 1) scar(10, 18);
    if (stage >= 2) crown(13, 15, 4, P.gold);
  }

  if (kind === 'lich') {
    var rb = [P.arcane[0], P.arcane[1], P.arcane[2], P.arcane[3]];
    for (var ly = 26; ly <= 68; ly++) {
      var half = 6 + (ly - 26) * 0.42;
      for (var lx = -half; lx <= half; lx++) {
        if (ly > 62 && (Math.round(lx) + ly) % 5 < 2) continue;
        var l = -lx / half;
        set(36 + lx, ly, l > 0.45 ? rb[2] : l > -0.3 ? rb[1] : rb[0]);
      }
    }
    for (var fold = 0; fold < 4; fold++) for (var fy2 = 34; fy2 < 64; fy2++) set(30 + fold * 4 + (fy2 % 7 === 0 ? 1 : 0), fy2, rb[0]);
    // hood and skull
    blob(36, 22, 11, 11, rb);
    blob(35, 24, 7, 7, P.bone);
    set(32, 23, P.ink[0]); set(33, 23, P.ink[0]); set(32, 24, P.ink[0]); set(38, 23, P.ink[0]); set(37, 23, P.ink[0]); set(37, 24, P.ink[0]);
    set(32, 23, R[3]); set(37, 23, R[3]);
    for (var tth = 31; tth <= 38; tth++) set(tth, 29, tth % 2 ? P.ink[1] : P.bone[3]);
    // arms: bony hands, staff with orb
    limb([28, 34], [16, 40], 5, 4, rb); for (var bf = 0; bf < 4; bf++) set(12 + bf, 41 + (bf % 2), P.bone[3]);
    limb([44, 34], [56, 30], 5, 4, rb);
    limb([58, 8], [58, 66], 3, 3, P.earth);
    blob(58, 8, 5, 5, [R[0], R[1], R[3], '#ffffff']);
    for (var gl = 0; gl < 12; gl++) set(58 + Math.cos(gl) * 8, 8 + Math.sin(gl) * 8, R[3]);
    for (var gf = 0; gf < 3; gf++) set(54 + gf * 2, 31, P.bone[3]);
    // magic wisps
    for (var wsp = 0; wsp < 10; wsp++) set(14 + wsp * 2, 46 + Math.sin(wsp) * 3, R[2]);
    if (stage >= 2) crown(35, 10, 6, P.gold);
  }

  if (kind === 'mimic') {
    // a spellbook that lies: open tome with teeth and a tongue
    for (var by2 = 40; by2 <= 66; by2++) for (var bx2 = 10; bx2 <= 62; bx2++) {
      var c4 = bx2 < 36 ? (bx2 < 14 ? R[0] : R[1]) : (bx2 > 58 ? R[0] : R[1]);
      if (by2 > 63) c4 = P.earth[0];
      set(bx2, by2, c4);
    }
    // pages, gaping like a jaw
    tri([12, 40], [36, 46], [36, 20], function (x, y) { set(x, y, (y % 3 === 0) ? P.bone[1] : P.bone[3]); });
    tri([60, 40], [36, 46], [36, 20], function (x, y) { set(x, y, (y % 3 === 0) ? P.bone[1] : P.bone[2]); });
    tri([14, 42], [58, 42], [36, 58], function (x, y) { set(x, y, '#3a1020'); });
    for (var tth2 = 0; tth2 < 9; tth2++) { fillTri([16 + tth2 * 5, 42], [20 + tth2 * 5, 42], [18 + tth2 * 5, 47], '#fff6d0'); }
    limb([36, 52], [22, 62], 4, 3, P.rose);
    eye(26, 30, [P.ember[0], P.ember[1], P.gold[2], '#ffffff']); eye(44, 30, [P.ember[0], P.ember[1], P.gold[2], '#ffffff']);
    for (var cl2 = 0; cl2 < 4; cl2++) { set(14 + cl2, 64, P.gold[1]); set(55 + cl2, 64, P.gold[1]); }
    // lying glyphs floating off the pages
    var gl2 = [[20, 14], [48, 10], [8, 24], [62, 22]];
    for (var gi = 0; gi < gl2.length; gi++) { set(gl2[gi][0], gl2[gi][1], R[3]); set(gl2[gi][0] + 1, gl2[gi][1], R[2]); set(gl2[gi][0], gl2[gi][1] + 1, R[2]); }
    if (stage >= 2) crown(36, 16, 5, P.gold);
  }

  function wing(sh, tips, last, m1, m2, rim) {
    var all = tips.concat([last]);
    for (var wi = 0; wi < tips.length; wi++) {
      var a = all[wi], b = all[wi + 1];
      var mid = [(a[0] + b[0]) / 2 * 0.72 + sh[0] * 0.28, (a[1] + b[1]) / 2 * 0.72 + sh[1] * 0.28];
      fillTri(sh, a, mid, m1, m2); fillTri(sh, mid, b, m1, m2);
      limb(a, mid, 1, 1, [rim, rim, rim, rim]); limb(mid, b, 1, 1, [rim, rim, rim, rim]);
    }
    for (var wj = 0; wj < tips.length; wj++) limb(sh, tips[wj], 2, 1, P.bone);
  }
  if (kind === 'dragon') {
    var dr = [R[0], R[1], R[2], R[3]];
    wing([66, 42], [[88, 2], [104, 10], [112, 28], [112, 44]], [96, 52], dr[0], P.ink[2], dr[1]);
    blob(64, 58, 28, 20, dr, 11);
    for (var t3 = 0; t3 <= 1; t3 += 0.01) { var tx2 = 86 + t3 * 26, ty2 = 64 + Math.sin(t3 * 5) * 8 + t3 * 14, tr2 = 9 - t3 * 8; blob(tx2, ty2, tr2, tr2, dr); }
    limb([52, 70], [44, 90], 8, 6, dr); limb([74, 72], [80, 92], 8, 6, dr);
    for (var cl3 = 0; cl3 < 4; cl3++) { set(40 + cl3 * 2, 92, P.bone[3]); set(78 + cl3 * 2, 93, P.bone[3]); }
    for (var nk = 0; nk <= 1; nk += 0.02) blob(46 - nk * 22, 50 - nk * 26, 9 - nk * 2, 9 - nk * 2, dr);
    blob(20, 22, 15, 10, dr);
    fillTri([10, 24], [-1, 30], [12, 32], dr[1]);
    fillTri([12, 32], [0, 31], [8, 40], dr[0]);
    for (var ft = 0; ft < 5; ft++) { set(1 + ft * 2, 30, '#fff6d0'); set(2 + ft * 2, 33, '#fff6d0'); }
    eye(14, 17, [P.ember[0], P.gold[1], P.gold[2], '#ffffff']);
    limb([22, 14], [40, -1], 4, 2, P.bone); limb([28, 16], [44, 6], 3, 1, P.bone);
    // belly plates
    for (var bp = 0; bp < 6; bp++) for (var bxx = 48; bxx <= 64; bxx++) set(bxx + bp, 62 + bp * 3, P.bone[bp % 2 ? 1 : 2]);
    // near wing
    wing([62, 44], [[58, 2], [46, 6], [38, 20], [36, 36]], [46, 54], dr[1], dr[2], dr[3]);
    if (stage >= 1) for (var gr = 0; gr < 12; gr++) { set(56 + gr * 3, 52 + (gr % 2), P.ocean[2]); set(57 + gr * 3, 52 + (gr % 2), P.ocean[3]); }
  }


  function headL(x, y, r, eyeC) { // small reptile head facing left
    blob(x, y, 5, 4, r);
    fillTri([x - 3, y - 1], [x - 10, y + 1], [x - 3, y + 3], r[1]);
    fillTri([x - 3, y + 2], [x - 9, y + 3], [x - 3, y + 4], r[0]);
    set(x - 9, y + 1, '#fff6d0'); set(x - 7, y + 2, '#fff6d0');
    set(x - 2, y - 2, eyeC || P.gold[3]); set(x - 1, y - 2, P.ember[1]);
  }

  if (kind === 'hydra') {
    var hr = [P.forest[0], P.forest[1], P.forest[2], P.forest[3]];
    if (biome !== 'ui') hr = [R[0], R[1], R[2], R[3]];
    var heads = [[12, 22], [20, 10], [34, 6], [48, 12]];
    if (stage >= 1) heads.push([58, 26]);
    if (stage >= 2) { heads.push([6, 36]); heads.push([28, 18]); }
    for (var hi = 0; hi < heads.length; hi++) {
      var hb = [32 + hi * 3, 52], hh = heads[hi], mid = [(hb[0] + hh[0]) / 2 + 6, (hb[1] + hh[1]) / 2 + 4];
      limb(hb, mid, 6, 5, hr); limb(mid, [hh[0] + 3, hh[1] + 2], 5, 4, hr);
    }
    // the sealed stump: a head that was cut AND cauterized (the right way)
    limb([50, 52], [62, 40], 6, 5, hr);
    blob(62, 39, 3, 3, [P.ember[0], P.ember[1], P.gold[2], '#ffffff']);
    blob(38, 60, 18, 10, hr, 9);
    limb([24, 62], [20, 70], 5, 4, hr); limb([50, 62], [54, 70], 5, 4, hr);
    for (var hj = 0; hj < heads.length; hj++) headL(heads[hj][0], heads[hj][1], hr);
    for (var bp2 = 0; bp2 < 8; bp2++) set(32 + bp2 * 2, 64, P.bone[2]);
  }

  if (kind === 'nurikabe') {
    for (var ny = 6; ny <= 66; ny++) for (var nx = 8; nx <= 64; nx++) {
      var edge = (nx - 8) < 3 ? 3 : (64 - nx) < 3 ? 0 : 1;
      var c5 = edge === 3 ? P.stone[3] : edge === 0 ? P.stone[0] : (dith(nx, ny, 0.18) ? P.stone[3] : P.stone[2]);
      if (ny < 9) c5 = P.forest[ny % 2 ? 1 : 2];
      set(nx, ny + Math.round(Math.sin(nx * 0.3) * 0.6), c5);
    }
    // cracks
    var cr = [[40, 12], [42, 18], [39, 24], [43, 30], [41, 36]];
    for (var ci2 = 0; ci2 < cr.length - 1; ci2++) limb(cr[ci2], cr[ci2 + 1], 1, 1, [P.stone[0], P.stone[0], P.stone[0], P.stone[0]]);
    limb([18, 20], [24, 26], 1, 1, [P.stone[1], P.stone[1], P.stone[1], P.stone[1]]);
    // sleepy face low on the wall
    for (var lid = 0; lid < 5; lid++) { set(22 + lid, 46, P.ink[1]); set(44 + lid, 46, P.ink[1]); }
    set(24, 47, P.ink[1]); set(46, 47, P.ink[1]);
    for (var mo2 = 0; mo2 < 8; mo2++) set(31 + mo2, 54 + (mo2 > 1 && mo2 < 6 ? 1 : 0), P.stone[0]);
    // stubby feet and the glowing weak spot at the base
    blob(16, 68, 5, 3, P.stone); blob(56, 68, 5, 3, P.stone);
    for (var ws = 0; ws < 14; ws++) set(29 + ws, 64 + (ws % 2), ws % 3 ? P.gold[2] : '#ffffff');
    for (var sp2 = 0; sp2 < 4; sp2++) { set(26 + sp2 * 7, 60, P.gold[3]); set(26 + sp2 * 7, 59, P.gold[1]); }
  }

  if (kind === 'kasa') {
    var paper = [P.ember[0], P.ember[1], P.ember[2], P.ember[3]];
    if (biome === 'legacy') paper = [P.earth[1], P.earth[2], P.bone[1], P.bone[3]];
    // canopy cone
    for (var ky = 4; ky <= 40; ky++) {
      var kw = (ky - 4) * 0.85;
      for (var kx = -kw; kx <= kw; kx++) {
        var t3 = kx / Math.max(1, kw);
        var c6 = t3 < -0.5 ? paper[2] : t3 < 0.2 ? paper[1] : paper[0];
        if (Math.abs(Math.round(kx * 6 / Math.max(1, kw))) % 2 === 0 && dith(kx, ky, 0.15)) c6 = paper[3];
        set(36 + kx, ky, c6);
      }
    }
    for (var rib = -3; rib <= 3; rib++) limb([36, 4], [36 + rib * 10, 40], 1, 1, [P.earth[0], P.earth[0], P.earth[0], P.earth[0]]);
    for (var hem = 6; hem <= 66; hem++) set(hem, 40 + ((hem % 10) < 5 ? 1 : 0), paper[0]);
    // age: tears and patches
    fillTri([20, 30], [26, 36], [18, 38], '#2a1e44'); fillTri([50, 22], [55, 30], [49, 30], '#2a1e44');
    for (var pt2 = 0; pt2 < 6; pt2++) set(42 + pt2, 14 + (pt2 % 2), P.bone[2]);
    // one great eye and a long tongue
    blob(36, 22, 6, 5, [P.steel[1], P.steel[2], P.steel[3], '#ffffff']);
    blob(35, 22, 3, 3, [P.ink[0], P.ember[0], P.ember[1], P.ember[2]]);
    set(34, 21, '#ffffff'); for (var ll = 0; ll < 8; ll++) set(30 + ll, 16, P.ink[1]);
    limb([36, 32], [32, 46], 4, 3, P.rose);
    // single hairy leg with a wooden sandal
    limb([36, 40], [37, 62], 3, 3, P.skin || P.ember);
    for (var hair2 = 46; hair2 < 60; hair2 += 3) set(35, hair2, P.earth[0]);
    for (var gx = 28; gx <= 46; gx++) { set(gx, 64, P.earth[2]); set(gx, 65, P.earth[1]); }
    set(31, 66, P.earth[0]); set(43, 66, P.earth[0]); set(31, 67, P.earth[0]); set(43, 67, P.earth[0]);
  }

  if (kind === 'ouroboros') {
    var sr = [R[0], R[1], R[2], R[3]];
    for (var a2 = 0; a2 < Math.PI * 1.88; a2 += 0.02) {
      var rad2 = 22, tx2 = 36 + Math.cos(a2 - 2.2) * rad2, ty2 = 38 + Math.sin(a2 - 2.2) * rad2;
      var th = 4 + 3 * Math.sin(a2 / 1.88 * 0.5 * Math.PI * 1.9);
      blob(tx2, ty2, Math.max(2, th), Math.max(2, th), sr, 7);
    }
    // head biting its own tail
    var hx3 = 36 + Math.cos(-2.2) * 22, hy3 = 38 + Math.sin(-2.2) * 22;
    blob(hx3 - 2, hy3 - 1, 7, 6, sr);
    fillTri([hx3 - 6, hy3 + 1], [hx3 + 6, hy3 + 6], [hx3 - 3, hy3 + 6], P.ink[1]);
    set(hx3 - 4, hy3 - 3, P.gold[3]); set(hx3 - 3, hy3 - 3, P.ember[1]);
    for (var fang = 0; fang < 3; fang++) set(hx3 - 4 + fang * 3, hy3 + 3, '#fff6d0');
    // the loop counter glowing in the centre
    for (var lg = 0; lg < 12; lg++) set(36 + Math.cos(lg / 12 * 6.28) * 8, 38 + Math.sin(lg / 12 * 6.28) * 8, lg % 2 ? R[3] : P.ocean[3]);
    for (var ar = 0; ar < 4; ar++) set(43 - ar, 35 + ar, P.ocean[3]);
  }

  if (kind === 'wisp') {
    var wc = [P.ocean[0], P.ocean[1], P.ocean[2], P.ocean[3]];
    var flames = [[36, 30, 12], [14, 44, 6], [58, 50, 5]];
    for (var fi = 0; fi < flames.length; fi++) {
      var fx4 = flames[fi][0], fy4 = flames[fi][1], fr = flames[fi][2];
      for (var yy4 = -fr * 2; yy4 <= fr; yy4++) for (var xx4 = -fr; xx4 <= fr; xx4++) {
        var w2 = yy4 < 0 ? fr * (1 + yy4 / (fr * 2)) : Math.sqrt(Math.max(0, fr * fr - yy4 * yy4));
        if (Math.abs(xx4 + Math.sin(yy4 * 0.5) * (yy4 < 0 ? 2 : 0)) > w2) continue;
        var d4 = (Math.abs(xx4) / fr + Math.max(0, yy4) / fr);
        set(fx4 + xx4, fy4 + yy4, d4 < 0.35 ? '#ffffff' : d4 < 0.7 ? wc[3] : d4 < 1.1 ? wc[2] : wc[1]);
      }
      if (fi === 0) { blob(31, 30, 2, 3, [P.ink[0], P.ink[1], P.ink[1], P.ink[1]]); blob(40, 30, 2, 3, [P.ink[0], P.ink[1], P.ink[1], P.ink[1]]); for (var m3 = 0; m3 < 4; m3++) set(34 + m3, 37 - (m3 % 3 ? 0 : 1), P.ink[1]); }
    }
  }

  if (kind === 'kitsune') {
    var fur = [P.gold[1], P.gold[2], P.gold[3], '#ffffff'];
    var tails = 3 + stage * 3;
    for (var tl = 0; tl < tails; tl++) {
      var ang2 = -2.6 + tl * (1.9 / Math.max(1, tails - 1));
      var base2 = [46, 52], tip3 = [46 + Math.cos(ang2) * -26 + 18, 52 + Math.sin(ang2) * 30];
      limb(base2, tip3, 6, 7, fur);
      blob(tip3[0], tip3[1], 3, 3, [P.steel[1], P.steel[2], '#ffffff', '#ffffff']);
    }
    blob(34, 52, 12, 11, fur);
    limb([26, 58], [24, 68], 4, 3, fur); limb([38, 60], [40, 68], 4, 3, fur);
    blob(22, 32, 9, 8, fur);
    fillTri([14, 26], [18, 14], [22, 25], P.gold[2]); fillTri([22, 25], [28, 14], [30, 26], P.gold[1]);
    set(18, 19, P.rose[2]); set(27, 19, P.rose[2]);
    fillTri([16, 33], [6, 38], [16, 37], P.gold[2]); set(6, 38, P.ink[1]);
    set(17, 30, P.ink[1]); set(18, 30, P.ember[1]); set(24, 30, P.ink[1]); set(25, 30, P.ember[1]);
    for (var mk2 = 0; mk2 < 3; mk2++) { set(15 + mk2, 28, P.ember[1]); set(23 + mk2, 28, P.ember[1]); }
    // holding a mask: the disguise it wears
    blob(10, 50, 6, 7, [P.steel[1], P.steel[2], P.steel[3], '#ffffff']);
    set(8, 48, P.ink[1]); set(12, 48, P.ink[1]); for (var mm = 0; mm < 4; mm++) set(8 + mm, 53, P.ember[1]);
    limb([24, 46], [14, 50], 3, 3, fur);
    for (var sp3 = 0; sp3 < 5; sp3++) set(4 + sp3 * 13, 6 + (sp3 % 2) * 8, P.arcane[3]);
  }

  if (kind === 'chimera') {
    var lion = [P.gold[0], P.gold[1], P.gold[2], P.gold[3]];
    // snake tail head (rear)
    limb([54, 50], [66, 42], 4, 3, P.forest); limb([66, 42], [64, 30], 3, 3, P.forest); headL(66, 28, P.forest);
    blob(40, 48, 18, 11, lion);
    limb([28, 54], [26, 68], 5, 4, lion); limb([36, 56], [36, 68], 5, 4, lion); limb([48, 56], [50, 68], 5, 4, lion); limb([54, 54], [58, 68], 5, 4, lion);
    // goat head rising from the back
    limb([44, 40], [46, 26], 5, 4, [P.steel[0], P.steel[1], P.steel[2], P.steel[3]]);
    blob(44, 22, 5, 5, [P.steel[0], P.steel[1], P.steel[2], P.steel[3]]);
    limb([46, 18], [54, 12], 2, 1, P.bone); limb([42, 18], [36, 10], 2, 1, P.bone);
    set(41, 21, P.gold[3]); set(41, 22, P.ink[1]); limb([40, 25], [40, 29], 2, 1, P.steel);
    // lion head with mane (front)
    blob(20, 38, 13, 12, [P.ember[0], P.ember[1], P.ember[2], P.gold[2]], 6);
    blob(17, 40, 8, 7, lion);
    set(13, 37, P.ink[1]); set(14, 37, P.gold[3]); set(20, 37, P.ink[1]); set(21, 37, P.gold[3]);
    fillTri([10, 43], [18, 43], [14, 48], '#3a1020'); set(11, 43, '#fff6d0'); set(17, 43, '#fff6d0');
  }

  if (kind === 'phoenix') {
    var fire = [P.ember[0], P.ember[1], P.gold[2], P.gold[3]];
    // ash heap it keeps rising from
    for (var ah = 0; ah < 24; ah++) for (var ay2 = 62 + Math.abs(ah - 12) / 3; ay2 <= 70; ay2++) set(24 + ah, ay2, (ah + ay2) % 3 ? P.ink[3] : P.ink[2]);
    for (var em = 0; em < 6; em++) set(27 + em * 4, 63, P.ember[2]);
    // wings
    for (var wf = 0; wf < 6; wf++) { limb([36, 34], [6 + wf * 2, 4 + wf * 7], 5 - wf * 0.5, 2, fire); limb([38, 34], [66 - wf * 2, 4 + wf * 7], 5 - wf * 0.5, 2, fire); }
    blob(37, 38, 7, 10, fire);
    blob(36, 24, 5, 5, fire);
    fillTri([32, 24], [26, 27], [32, 27], P.gold[1]);
    set(34, 23, '#ffffff'); set(35, 23, P.ink[1]);
    for (var cr2 = 0; cr2 < 4; cr2++) limb([36 + cr2, 20], [34 + cr2 * 3, 12 - cr2], 1, 1, fire);
    for (var tf = 0; tf < 4; tf++) limb([36, 46], [30 + tf * 4, 60], 3, 1, fire);
  }

  if (kind === 'sphinx') {
    var sand = [P.earth[1], P.earth[2], P.earth[3], P.gold[3]];
    blob(42, 54, 22, 9, sand);
    limb([22, 58], [8, 62], 5, 4, sand); limb([30, 60], [14, 66], 5, 4, sand);
    fillTri([40, 44], [62, 14], [68, 40], P.gold[1], P.gold[2]);
    for (var fw = 0; fw < 5; fw++) limb([42, 44], [56 + fw * 2, 16 + fw * 5], 1, 1, [P.gold[0], P.gold[0], P.gold[0], P.gold[0]]);
    // headdress and calm face
    for (var hdy = 18; hdy <= 46; hdy++) { var hw2 = hdy < 26 ? 8 + (hdy - 18) * 0.6 : 13 - Math.max(0, hdy - 40); for (var hdx = -hw2; hdx <= hw2; hdx++) set(26 + hdx, hdy, (hdy % 3 === 0) ? P.ocean[1] : P.gold[1]); }
    blob(26, 30, 6, 8, [P.earth[1], P.earth[2], P.earth[3], P.bone[3]]);
    set(23, 28, P.ink[1]); set(29, 28, P.ink[1]); set(23, 27, P.ocean[1]); set(29, 27, P.ocean[1]);
    for (var lp = 0; lp < 4; lp++) set(24 + lp, 35, P.earth[0]);
    // the riddle
    var q = [[0, 0], [1, -1], [2, -1], [3, 0], [3, 1], [2, 2], [1, 3], [1, 5]];
    for (var qi = 0; qi < q.length; qi++) { set(8 + q[qi][0] * 2, 8 + q[qi][1] * 2, P.arcane[3]); set(9 + q[qi][0] * 2, 8 + q[qi][1] * 2, P.arcane[2]); }
  }

  // Flaky enemies are half-there
  if (flaky) for (var fy3 = 0; fy3 < H; fy3++) for (var fx3 = 0; fx3 < W; fx3++) if (g[fy3][fx3] && (fx3 + fy3) % 3 === 0 && dith(fx3, fy3, 0.7)) g[fy3][fx3] = null;

  // Outline (red for evolved nemeses)
  var line = stage >= 2 ? P.ember[0] : P.ink[1];
  var out = [];
  for (var oy = 0; oy < H; oy++) {
    var orow = [];
    for (var ox = 0; ox < W; ox++) {
      var oc = g[oy][ox];
      if (!oc) {
        var n = (oy > 0 && g[oy - 1][ox]) || (oy < H - 1 && g[oy + 1][ox]) || (ox > 0 && g[oy][ox - 1]) || (ox < W - 1 && g[oy][ox + 1]);
        if (n && !flaky) oc = line;
      }
      orow.push(oc);
    }
    out.push(orow);
  }
  return { W: W, H: H, grid: out };
}
if (typeof module !== 'undefined') module.exports = foe2;
