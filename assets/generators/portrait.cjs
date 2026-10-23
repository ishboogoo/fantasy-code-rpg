// Detailed anime-style fantasy portraits, 64 x 64. ES5 so it can be pasted into the canvas component.
function portrait(pr) {
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
    skin: ['#c07850', '#f0b088', '#ffd8b8', '#fff0e0'],
    umber: ['#6c4428', '#a06840', '#c89068', '#e8b890'],
    rose: ['#a03860', '#e06088', '#ff90b0', '#ffd0e0']
  };
  var job = pr.job || 'fighter';
  var tier = parseInt(pr.tier == null ? 2 : pr.tier, 10);
  var seed = String(pr.seed || 'aria');
  var adapter = pr.adapter || 'claude-code';
  var mood = pr.mood || 'neutral';

  var h = 2166136261;
  for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  if (h === 0) h = 7;
  function rnd() { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function dith(x, y, f) { return f * 16 > BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5; }

  var S = 64, W = S + 2, H = S + 2, g = [];
  for (var y = 0; y < H; y++) { var row = []; for (var x = 0; x < W; x++) row.push(null); g.push(row); }
  function set(x, y, c) { x = Math.round(x) + 1; y = Math.round(y) + 1; if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; }
  function get(x, y) { x = Math.round(x) + 1; y = Math.round(y) + 1; return (x >= 0 && x < W && y >= 0 && y < H) ? g[y][x] : null; }
  function hline(y, x0, x1, c) { for (var xx = Math.round(x0); xx <= Math.round(x1); xx++) set(xx, y, c); }
  function M(x) { return 63 - x; }
  // 4-tone shaded span (light from the top-left)
  function span(y, x0, x1, r) {
    x0 = Math.round(x0); x1 = Math.round(x1);
    for (var xx = x0; xx <= x1; xx++) {
      var t = (xx - x0) / Math.max(1, x1 - x0);
      var c = t < 0.15 ? r[3] : t < 0.45 ? r[2] : t < 0.85 ? r[1] : r[0];
      if (t >= 0.45 && t < 0.55 && dith(xx, y, 0.5)) c = r[1];
      set(xx, y, c);
    }
  }
  function tri(ax, ay, bx, by, cx, cy, fn) {
    var minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    var minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    for (var yy = minY; yy <= maxY; yy++) for (var xx = minX; xx <= maxX; xx++) {
      var d1 = (xx - bx) * (ay - by) - (ax - bx) * (yy - by);
      var d2 = (xx - cx) * (by - cy) - (bx - cx) * (yy - cy);
      var d3 = (xx - ax) * (cy - ay) - (cx - ax) * (yy - ay);
      var neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) fn(xx, yy);
    }
  }

  var RACES = ['human', 'elf', 'dwarf', 'beastkin', 'lizardfolk', 'demonkin', 'automaton', 'fae'];
  var race = pr.race && RACES.indexOf(pr.race) >= 0 ? pr.race : pick(RACES);
  var ELEM = { 'claude-code': P.ember, 'codex': P.ocean, 'gemini-cli': P.arcane, 'anthropic-api': P.rose, 'openai-compatible': P.steel, 'shell': P.earth };
  var elem = ELEM[adapter] || P.steel;

  var skin = pick([P.skin, P.skin, P.umber, P.earth]);
  var hair = pick([P.gold, P.ember, P.ink, P.steel, P.rose, P.ocean, P.arcane, P.earth, P.forest]);
  var eye = pick([P.ocean, P.forest, P.arcane, P.gold, P.ocean, P.ember]);
  var style = Math.floor(rnd() * 6);
  var blush = rnd() < 0.45;
  var slit = false, glowEyes = false;
  if (race === 'lizardfolk') { skin = pick([P.forest, P.ocean, [P.forest[0], P.forest[1], P.ocean[2], P.ocean[3]]]); eye = P.gold; slit = true; }
  if (race === 'demonkin') { skin = pick([[P.ink[2], P.ink[3], P.steel[1], P.steel[2]], [P.arcane[1], P.arcane[2], P.arcane[3], P.rose[3]], P.rose]); eye = pick([P.ember, P.gold]); slit = true; }
  if (race === 'automaton') { skin = P.steel; glowEyes = true; }
  if (race === 'beastkin') { slit = rnd() < 0.6; eye = pick([P.gold, P.forest, P.ocean]); }
  if (race === 'fae') { hair = pick([P.rose, P.ocean, P.arcane, P.forest, P.gold]); skin = P.skin; }
  if (race === 'dwarf') { hair = pick([P.ember, P.earth, P.steel, P.gold, P.ink]); }
  // A hero's colours can be chosen by the caller, so their portrait and battle sprite always match.
  var named = function (n) { return n === 'demon' ? [P.ink[2], P.ink[3], P.steel[1], P.steel[2]] : P[n]; };
  if (pr.hair && named(pr.hair)) hair = named(pr.hair);
  if (pr.skin && named(pr.skin)) skin = named(pr.skin);
  // Personality traits
  var build = pr.build || pick(['feminine', 'masculine']);
  var fem = build === 'feminine';
  if (fem && race !== 'automaton' && race !== 'lizardfolk' && !pr.style) style = pick([1, 1, 4, 2, 3]);
  var age = pr.age || pick(['young', 'adult', 'adult', 'elder']);
  if (race === 'automaton' || race === 'fae') age = age === 'elder' ? 'adult' : age;
  if (age === 'elder' && race !== 'lizardfolk') hair = pick([P.steel, P.steel, [P.ink[3], P.steel[0], P.steel[1], P.steel[2]]]);
  var turn = pr.turn != null ? parseInt(pr.turn, 10) : pick([-1, 0, 1, -1, 1]);
  var fx = turn * 3;
  var facial = (!fem && age !== 'young' && race !== 'lizardfolk' && race !== 'automaton' && race !== 'fae' && race !== 'dwarf') ? pick(['none', 'none', 'none', 'none', 'moustache', 'handlebar', 'goatee', 'beard', 'stubble']) : 'none';
  if (pr.facial) facial = pr.facial;
  var gear = pr.gear || (fem && rnd() < 0.35 ? 'earring' : null) || (job === 'thief' && rnd() < 0.35 ? 'mask' : pick(['none', 'none', 'bandana', 'eyepatch', 'scar', 'earring', 'paint', 'flower', 'goggles']));
  if (race === 'automaton') gear = 'none';
  var gaze = pick(['ahead', 'ahead', 'aside', 'closed', 'glare']);
  if (pr.gaze) gaze = pr.gaze;
  var robe = pick([P.arcane, P.ocean]);
  var white = [P.steel[0], P.steel[1], P.steel[2], P.steel[3]];
  var outfit = tier === 0 ? P.earth : ({ fighter: P.steel, mage: robe, cleric: white, thief: P.forest, bard: P.ember })[job];
  var hooded = tier > 0 && job === 'thief';
  var ink = P.ink[1];
  var faceW = race === 'dwarf' ? -1 : (race === 'lizardfolk' ? -1 : 0);

  // ---------- Fae wings (behind everything) ----------
  if (race === 'fae') {
    var wingC = pick([P.ocean, P.rose, P.arcane]);
    var wing = function (fx) {
      tri(fx(14), 44, fx(0), 2, fx(4), 40, function (x, y) { set(x, y, dith(x, y, 0.55) ? wingC[3] : wingC[2]); });
      tri(fx(14), 44, fx(4), 18, fx(10), 46, function (x, y) { set(x, y, dith(x, y, 0.3) ? wingC[3] : wingC[2]); });
      tri(fx(14), 48, fx(0), 56, fx(8), 58, function (x, y) { set(x, y, dith(x, y, 0.4) ? wingC[3] : wingC[2]); });
      for (var k = 0; k <= 40; k++) { set(fx(14 - k * 0.33), 44 - k, wingC[1]); }
      for (var k2 = 0; k2 <= 10; k2++) { set(fx(14 - k2 * 1.2), 48 + k2 * 0.7, wingC[1]); }
    };
    wing(function (x) { return x; }); wing(function (x) { return M(x); });
  }

  // ---------- Back hair / hood ----------
  var hasHair = race !== 'automaton' && race !== 'lizardfolk';
  if (hooded) {
    for (var hy = 4; hy <= 54; hy++) {
      var hw = hy < 12 ? 10 + (12 - hy) * 1.6 : (hy < 40 ? 10 : 10 - Math.floor((hy - 40) / 2.5));
      span(hy, Math.max(hw, 2), M(Math.max(hw, 2)), outfit);
    }
  } else if (hasHair && (style === 1 || style === 4)) {
    var yEnd = style === 1 ? 63 : 46;
    for (var by = 8; by <= yEnd; by++) {
      var bxl = by > yEnd - 4 ? 12 + (by - (yEnd - 4)) * 2 : 12;
      for (var bx = bxl; bx <= M(bxl); bx++) {
        var c = (bx - bxl) % 7 === 3 ? hair[0] : bx < 32 ? hair[1] : hair[0];
        if (bx < bxl + 2) c = hair[2];
        set(bx, by, c);
      }
    }
  } else if (hasHair) {
    for (var by2 = 8; by2 <= 34; by2++) for (var bx2 = 13; bx2 <= 50; bx2++) set(bx2, by2, bx2 < 32 ? hair[1] : hair[0]);
  }
  if (hasHair && !hooded && style === 2) {
    for (var ty = 18; ty <= 56; ty++) { var tw = ty < 23 ? 3 : (ty > 50 ? 1 : 4); span(ty, 9 - tw, 10, hair); span(ty, 53, 54 + tw, hair); }
    hline(20, 5, 11, elem[2]); hline(21, 5, 11, elem[1]); hline(20, 52, 58, elem[2]); hline(21, 52, 58, elem[1]);
  }

  // ---------- Shoulders / outfit ----------
  for (var sy = 50; sy <= 63; sy++) {
    var sw = sy === 50 ? 18 : sy === 51 ? 13 : sy === 52 ? 9 : sy < 56 ? 6 : 4;
    span(sy, sw, M(sw), outfit);
  }
  // fabric folds
  for (var fy = 55; fy <= 63; fy += 3) { set(14 + (fy % 5), fy, outfit[0]); set(M(14 + (fy % 5)), fy, outfit[0]); }

  // ---------- Neck ----------
  for (var ny = 43; ny <= 53; ny++) hline(ny, 26, 37, ny < 48 ? skin[0] : skin[1]);
  hline(53, 28, 35, skin[0]);

  // ---------- Face ----------
  var faceL = {};
  var JAW = { 12: 21, 13: 19, 14: 18, 31: 17, 32: 18, 33: 18, 34: 19, 35: 19, 36: 20, 37: 21, 38: 22, 39: 23, 40: 24, 41: 25, 42: 25, 43: 26, 44: 27, 45: 28 };
  if (fem) JAW = { 12: 21, 13: 19, 14: 18, 31: 18, 32: 18, 33: 19, 34: 20, 35: 21, 36: 22, 37: 23, 38: 24, 39: 25, 40: 26, 41: 27, 42: 27, 43: 28, 44: 28, 45: 29 };
  for (var fyy = 12; fyy <= 45; fyy++) faceL[fyy] = (JAW[fyy] || (fem ? 18 : 17)) + faceW;
  for (var yy = 12; yy <= 45; yy++) {
    var xl = faceL[yy] + (turn < 0 && yy > 24 ? 2 : 0), xr = M(faceL[yy]) - (turn > 0 && yy > 24 ? 2 : 0);
    for (var xx = xl; xx <= xr; xx++) {
      var fc = skin[2];
      if (xx >= 41 || (yy >= 38 && xx >= 37)) fc = skin[1];
      if (xx >= 44 || (yy >= 41 && xx >= 39)) fc = skin[0];
      if (xx >= 19 && xx <= 22 && yy >= 29 && yy <= 35) fc = skin[3];
      if (yy >= 15 && yy <= 19 && xx >= 24 && xx <= 30) fc = skin[3];
      if (yy >= 44) fc = skin[1];
      set(xx, yy, fc);
    }
  }
  for (var jy = 33; jy <= 45; jy++) { var jx = M(faceL[jy]); set(jx, jy, skin[0]); set(jx - 1, jy, skin[1]); }
  for (var jy2 = 39; jy2 <= 44; jy2++) set(faceL[jy2] + 1, jy2, skin[1]);
  for (var cb = 31; cb <= 36; cb++) { set(41, cb, skin[0]); set(40, cb + 1, skin[1]); }
  // Race face treatments
  if (race === 'lizardfolk') {
    for (var ly = 14; ly <= 42; ly++) for (var lx = faceL[ly]; lx <= M(faceL[ly]); lx++) if ((lx + ly * 2) % 5 === 0 && (lx < 26 || lx > 37 || ly < 22)) set(lx, ly, skin[1]);
    for (var dy2 = 5; dy2 <= 13; dy2++) { var dw2 = dy2 < 9 ? 6 + (dy2 - 5) * 3 : 14 - (dy2 > 11 ? 1 : 0); span(dy2, 32 - dw2, 31 + dw2, skin); }
    for (var dy3 = 6; dy3 <= 13; dy3++) for (var dx3 = 20; dx3 <= 43; dx3++) if (get(dx3, dy3) && (dx3 + dy3 * 2) % 5 === 0) set(dx3, dy3, skin[1]);
    var fins = [[25, 1], [31, -1], [37, 1], [43, 5]];
    for (var fi = 0; fi < fins.length; fi++) {
      var fxp = fins[fi][0], fyp = fins[fi][1];
      tri(fxp - 4, 9, fxp + 2, 8, fxp, fyp, function (x, y) { set(x, y, x < fxp - 1 ? elem[2] : elem[1]); });
      set(fxp, fyp + 1, elem[3]);
    }
  }
  if (race === 'automaton') {
    hline(37, 19, 44, P.ink[2]);
    for (var sy2 = 37; sy2 <= 43; sy2++) set(31, sy2, P.ink[2]);
    set(20, 22, P.steel[3]); set(43, 22, P.steel[0]); set(20, 40, P.steel[3]); set(43, 40, P.steel[0]);
  }

  // Ears
  if (race === 'elf' || race === 'fae') {
    var ear = function (fx) {
      tri(fx(19), 26, fx(19), 36, fx(4), 15, function (x, y) { set(x, y, skin[2]); });
      tri(fx(18), 29, fx(18), 34, fx(8), 20, function (x, y) { set(x, y, skin[1]); });
      if (pick([true, false])) { set(fx(12), 25, P.gold[2]); set(fx(12), 26, P.gold[1]); }
    };
    ear(function (x) { return x; }); ear(function (x) { return M(x); });
  } else if (race === 'lizardfolk') {
    var fin = function (fx) { for (var k = 0; k < 4; k++) tri(fx(19), 24 + k * 3, fx(19), 27 + k * 3, fx(10 - k), 20 + k * 4, function (x, y) { set(x, y, k % 2 ? elem[1] : elem[2]); }); };
    fin(function (x) { return x; }); fin(function (x) { return M(x); });
  } else if (race === 'automaton') {
    for (var ay = 27; ay <= 34; ay++) { hline(ay, 15, 18, ay < 30 ? P.steel[2] : P.steel[1]); hline(ay, 45, 48, ay < 30 ? P.steel[1] : P.steel[0]); }
    set(16, 30, elem[2]); set(47, 30, elem[2]);
  } else if (race !== 'beastkin') {
    for (var ey = 28; ey <= 35; ey++) { set(17, ey, skin[1]); set(46, ey, skin[0]); }
    set(17, 31, skin[0]);
  }

  // ---------- Eyes ----------
  function drawEye(cx, outerLeft, far) {
    var x0 = cx - (far ? 2 : 3), x1 = cx + (far ? 2 : 3);
    if (glowEyes) {
      for (var gy = 28; gy <= 31; gy++) hline(gy, x0, x1, gy === 29 ? '#ffffff' : gy === 30 ? elem[3] : elem[2]);
      hline(27, x0 - 1, x1 + 1, P.ink[2]); hline(32, x0 - 1, x1 + 1, P.ink[2]);
      return;
    }
    if (gaze === 'closed') {
      hline(29, x0, x1, ink); set(outerLeft ? x0 - 1 : x1 + 1, 28, ink); hline(30, x0 + 1, x1 - 1, skin[1]);
      return;
    }
    hline(27, x0 + 1, x1 - 1, fem ? (elem === P.steel ? P.rose[0] : elem[0]) : skin[1]);
    if (fem) { hline(26, x0 + 1, x1 - 1, skin[1]); }
    var lidY = gaze === 'glare' ? 29 : 28;
    if (gaze === 'glare') hline(28, x0, x1, skin[1]);
    hline(lidY, x0, x1, P.ink[2]); hline(lidY, x0 + 1, x1 - 1, ink);
    set(outerLeft ? x0 - 1 : x1 + 1, lidY + 1, P.ink[2]);
    if (fem) { var wx = outerLeft ? x0 - 1 : x1 + 1, wd = outerLeft ? -1 : 1; set(wx, lidY, ink); set(wx + wd, lidY - 1, ink); set(wx + wd * 2, lidY - 2, ink); hline(lidY - 1, x0 + 1, x1 - 1, P.ink[2]); }
    if (lidY === 28) hline(29, x0, x1, P.steel[2]);
    hline(30, x0 + 1, x1 - 1, P.steel[3]);
    var shift = gaze === 'aside' ? (turn === 0 ? -1 : turn) : turn;
    var ic = cx + Math.max(-1, Math.min(1, shift));
    var e0 = eye[0], e1 = eye[1], e2 = eye[2];
    if (lidY === 28) { set(ic - 1, 29, e0); set(ic, 29, slit ? ink : e0); set(ic + 1, 29, e0); }
    set(ic - 1, 30, e1); set(ic, 30, ink); set(ic + 1, 30, e2);
    set(ic - 1, lidY + 1, '#ffffff');
    hline(31, x0 + 1, x1 - 1, skin[1]);
    hline(32, x0 + 1, x1 - 1, skin[outerLeft ? 2 : 1]);
  }
  drawEye(24 + fx, true, turn === -1);
  drawEye(39 + fx, false, turn === 1);

  // Nose, mouth, blush, race extras
  if (race === 'lizardfolk') { set(29, 36, skin[0]); set(34, 36, skin[0]); hline(40, 24, 39, skin[0]); set(23, 39, skin[0]); set(40, 39, skin[0]); }
  else if (race === 'automaton') { for (var gx = 28; gx <= 35; gx += 2) { set(gx, 39, P.ink[2]); set(gx, 40, P.ink[2]); set(gx, 41, P.ink[2]); } }
  else {
    for (var nb = 29; nb <= 35; nb++) { set(31 + fx, nb, skin[3]); set(33 + fx, nb, skin[1]); }
    set(30 + fx, 36, skin[0]); set(33 + fx, 36, skin[0]); hline(36, 31 + fx, 32 + fx, skin[1]); set(34 + fx, 35, skin[1]);
    hline(37, 30 + fx, 33 + fx, skin[1]);
    if (turn !== 0) { var nsx = turn < 0 ? 29 + fx : 34 + fx; for (var ns = 31; ns <= 36; ns++) set(nsx, ns, skin[0]); }
    if (turn !== 0) { var farX = turn < 0 ? faceL[30] : M(faceL[30]); for (var fc2 = 26; fc2 <= 40; fc2++) { set(turn < 0 ? faceL[fc2] : M(faceL[fc2]), fc2, skin[0]); } }
    var lip = skin === P.skin ? P.rose[0] : skin[0];
    var mx = fx;
    if (mood === 'smile') { hline(40, 28 + mx, 34 + mx, lip); set(35 + mx, 39, lip); set(36 + mx, 38, skin[0]); hline(41, 29 + mx, 33 + mx, skin[1]); }
    else if (mood === 'worried') { hline(40, 29 + mx, 34 + mx, lip); set(28 + mx, 41, skin[0]); set(35 + mx, 41, skin[0]); hline(41, 30 + mx, 33 + mx, skin[1]); }
    else if (mood === 'determined') { hline(40, 28 + mx, 35 + mx, lip); set(27 + mx, 41, skin[0]); set(36 + mx, 41, skin[0]); }
    else { hline(40, 28 + mx, 35 + mx, lip); hline(41, 29 + mx, 34 + mx, skin[1]); set(31 + mx, 41, skin[3]); }
    if (fem && race !== 'lizardfolk') { hline(39, 29 + mx, 34 + mx, P.rose[0]); hline(40, 28 + mx, 35 + mx, P.rose[1]); hline(41, 29 + mx, 34 + mx, P.rose[1]); set(30 + mx, 41, P.rose[2]); set(31 + mx, 41, P.rose[3]); set(31 + mx, 39, P.rose[1]); set(32 + mx, 39, P.rose[1]); }
    hline(43, 30 + mx, 33 + mx, skin[1]);
    if (age === 'elder') {
      hline(19, 26 + mx, 37 + mx, skin[1]); hline(21, 27 + mx, 36 + mx, skin[1]);
      for (var nl = 37; nl <= 40; nl++) { set(28 + mx - (nl - 37), nl, skin[1]); set(35 + mx + (nl - 37), nl, skin[0]); }
      hline(33, 21 + mx, 26 + mx, skin[1]); hline(33, 37 + mx, 42 + mx, skin[0]);
    }
    if (race === 'demonkin' || (race === 'beastkin' && slit)) { set(30, 41, P.steel[3]); set(33, 41, P.steel[3]); }

  }


  // Dwarf beard
  if (race === 'dwarf') {
    for (var dby = 36; dby <= 60; dby++) {
      var dbw = dby < 41 ? 15 : Math.max(2, 15 - Math.floor((dby - 41) * 0.75));
      for (var dbx = 32 - dbw; dbx <= 31 + dbw; dbx++) {
        if (dby < 41 && dbx > 26 && dbx < 37 && dby > 37) continue;
        var dc = (dbx % 3 === 0) ? hair[0] : dbx < 30 ? hair[2] : hair[1];
        set(dbx, dby, dc);
      }
    }
    hline(38, 26, 37, hair[1]); hline(39, 24, 39, hair[1]); hline(40, 29, 34, P.rose[0]);
  }

  // ---------- Front hair / crest ----------
  if (hasHair && !hooded) {
    var hcx = 31.5, hcy = 22;
    var nClumps = style === 5 ? 8 : (style === 1 || style === 4 ? 12 : 10);
    var amp = style === 5 ? 4 : (style === 0 ? 2.5 : 1.5);
    var baseR = style === 5 ? 17 : 18.5;
    var sweep = (rnd() - 0.5) * 0.6;
    var clumpH = [];
    for (var ci = 0; ci < nClumps; ci++) clumpH.push(0.55 + rnd() * 0.45);
    for (var hy3 = 0; hy3 <= 30; hy3++) {
      for (var hx3 = 6; hx3 <= 57; hx3++) {
        var ddx = hx3 - hcx, ddy = hy3 - hcy;
        if (ddy > 3 && Math.abs(ddx) < 13) continue;
        var ang = Math.atan2(ddy, ddx);
        var a01 = (ang + Math.PI) / (2 * Math.PI);
        var posv = (a01 * nClumps + sweep * (hcy - hy3) / 12) % 1; if (posv < 0) posv += 1;
        var cidx = Math.floor(((a01 * nClumps) % nClumps + nClumps) % nClumps);
        var trv = 1 - Math.abs(posv * 2 - 1);
        var lim = baseR + amp * clumpH[cidx] * Math.pow(trv, 1.6);
        if (ddy > 0) lim = Math.min(lim, baseR - ddy * 0.25);
        var dist = Math.sqrt(ddx * ddx + ddy * ddy * 1.15);
        if (dist > lim) continue;
        var hc = hair[1];
        if (ddx + ddy < -12) hc = hair[2];
        if (ddx + ddy < -20 && dith(hx3, hy3, 0.5)) hc = hair[3];
        if (ddx - ddy * 0.3 > 10) hc = hair[0];
        if (trv < 0.14 && dist > 8) hc = hair[0];
        if (trv > 0.4 && trv < 0.5 && dist > 10 && dist < lim - 1) hc = hair[0];
        set(hx3, hy3, hc);
      }
    }
    // Bangs with strand lines
    var bangN = 6 + Math.floor(rnd() * 2);
    var longOne = Math.floor(rnd() * bangN);
    for (var bi = 0; bi < bangN; bi++) {
      var bx0 = 19 + Math.round(bi * (26 / bangN));
      var bw = Math.round(26 / bangN) + 2;
      var btip = 18 + Math.floor(rnd() * 3) + (bi === longOne ? 4 : 0);
      if (style === 0 && bi >= Math.floor(bangN / 2) - 1 && bi <= Math.floor(bangN / 2)) btip = 15;
      for (var by3 = 13; by3 <= btip; by3++) {
        var prog = (by3 - 13) / (btip - 13 + 0.001);
        var half = Math.max(0, Math.round((bw / 2) * (1 - Math.pow(prog, 1.4))));
        var mid = bx0 + Math.round(bw / 2) + Math.round(sweep * 5 * prog);
        for (var bx3 = mid - half; bx3 <= mid + half; bx3++) {
          var bc = by3 >= btip - 1 ? hair[0] : (bx3 === mid - half ? hair[2] : (bx3 === mid && prog > 0.35 ? hair[0] : hair[1]));
          set(bx3, by3, bc);
        }
        var under = get(mid, btip + 1);
        if (under === skin[2] || under === skin[3]) { set(mid, btip + 1, skin[1]); set(mid + 1, btip + 1, skin[1]); }
      }
    }
    // Side locks
    var lockLen = style === 1 ? 50 : style === 4 ? 46 : style === 5 ? 32 : 40;
    for (var sly = 18; sly <= lockLen; sly++) {
      var slw = sly > lockLen - 5 ? 1 : 3;
      for (var slx = 0; slx <= slw; slx++) {
        set(16 + slx, sly, sly > lockLen - 2 ? hair[0] : (slx === 0 ? hair[2] : hair[1]));
        set(M(16 + slx), sly, slx === 0 ? hair[1] : hair[0]);
      }
    }
    // Shine strokes
    var shine = [[19, 11], [20, 10], [21, 10], [22, 9], [26, 8], [27, 8], [28, 8], [29, 8], [34, 8], [35, 8], [36, 9]];
    for (var sh = 0; sh < shine.length; sh++) { if (get(shine[sh][0], shine[sh][1])) set(shine[sh][0], shine[sh][1], hair[3]); }
  } else if (race === 'automaton' && !hooded) {
    for (var ay2 = 4; ay2 <= 20; ay2++) { var aw = ay2 < 9 ? 10 + (ay2 - 4) * 2 : 19; span(ay2, 32 - aw, 31 + aw, P.steel); }
    hline(14, 14, 49, elem[2]); hline(15, 14, 49, elem[1]);
    for (var ant = 0; ant <= 6; ant++) set(44 + Math.floor(ant / 2), 4 - ant, P.steel[1]);
    set(48, -2, elem[3]); set(47, -2, elem[2]);
  } else if (hooded) {
    for (var hy2 = 4; hy2 <= 17; hy2++) { var hd = hy2 < 9 ? [24 - (hy2 - 4) * 2, 39 + (hy2 - 4) * 2] : [13, 50]; span(hy2, hd[0], hd[1], outfit); }
    hline(17, 15, 48, outfit[3]);
    for (var bx4 = 17; bx4 <= 46; bx4++) { var tip2 = 18 + ((bx4 % 5 === 0) ? 4 : (bx4 % 2 ? 1 : 2)); for (var by4 = 18; by4 <= tip2; by4++) set(bx4, by4, by4 === tip2 ? hair[0] : hair[1]); }
  }

  // Brows
  if (race !== 'automaton') {
    var browC = race === 'lizardfolk' ? skin[0] : (hair[0] === P.ink[0] ? P.ink[2] : hair[0]);
    var bIn = mood === 'determined' ? 26 : mood === 'worried' ? 24 : 25;
    if (gaze === 'glare') bIn = 26;
    hline(25, 20 + fx, 27 + fx, browC); hline(24, 21 + fx, 26 + fx, browC); set(28 + fx, bIn, browC);
    hline(25, 36 + fx, 43 + fx, browC); hline(24, 37 + fx, 42 + fx, browC); set(35 + fx, bIn, browC);
    if (age === 'elder') { hline(23, 21 + fx, 26 + fx, browC); hline(23, 37 + fx, 42 + fx, browC); set(19 + fx, 26, browC); set(44 + fx, 26, browC); }
    set(20, 26, skin[1]); set(43, 26, skin[0]);
  }

  // ---------- Facial hair ----------
  var fh = [hair[0], hair[1], hair[2], hair[3]];
  if (facial === 'stubble') { for (var sy3 = 38; sy3 <= 45; sy3++) for (var sx3 = faceL[sy3] + 1; sx3 <= M(faceL[sy3]) - 1; sx3++) if (dith(sx3, sy3, 0.35) && get(sx3, sy3) !== P.rose[0]) set(sx3, sy3, skin[0]); }
  if (facial === 'moustache' || facial === 'handlebar' || facial === 'beard') {
    hline(38, 27 + fx, 36 + fx, fh[1]); hline(39, 26 + fx, 29 + fx, fh[1]); hline(39, 34 + fx, 37 + fx, fh[0]); hline(38, 30 + fx, 31 + fx, fh[2]);
    if (facial === 'handlebar') { set(25 + fx, 38, fh[1]); set(24 + fx, 37, fh[2]); set(38 + fx, 38, fh[0]); set(39 + fx, 37, fh[1]); }
    else { set(26 + fx, 40, fh[1]); set(37 + fx, 40, fh[0]); }
  }
  if (facial === 'goatee') { for (var gy2 = 42; gy2 <= 47; gy2++) { var gw = gy2 < 45 ? 3 : 2 - (gy2 - 45); for (var gx3 = 31 + fx - gw; gx3 <= 32 + fx + gw; gx3++) set(gx3, gy2, gx3 % 2 ? fh[1] : (gx3 < 31 + fx ? fh[2] : fh[0])); } }
  if (facial === 'beard') {
    for (var by5 = 33; by5 <= 53; by5++) {
      var bl = by5 <= 45 ? faceL[by5] + 1 : 21 + (by5 - 45) * 1.4, br = by5 <= 45 ? M(faceL[by5]) - 1 : M(21 + (by5 - 45) * 1.4);
      for (var bxx = Math.round(bl); bxx <= Math.round(br); bxx++) {
        if (by5 >= 39 && by5 <= 41 && bxx >= 28 + fx && bxx <= 35 + fx) continue;
        if (by5 < 38 && bxx > bl + 3 && bxx < br - 3) continue;
        var bcol = (bxx + Math.floor(by5 / 3)) % 3 === 0 ? fh[0] : (bxx < 30 ? fh[2] : fh[1]);
        if (bxx < 28 && dith(bxx, by5, 0.3)) bcol = fh[3];
        set(bxx, by5, bcol);
      }
    }
  }

  // ---------- Signature gear ----------
  var gc = pick([P.ember, P.night, P.forest, P.gold, P.rose]);
  if (gear === 'bandana') {
    for (var bdy = 14; bdy <= 17; bdy++) span(bdy, 15, 48, gc);
    hline(15, 15, 48, gc[3]);
    var side = turn > 0 ? -1 : 1;
    var kx = side > 0 ? 49 : 14;
    for (var kt = 0; kt < 9; kt++) { set(kx + side * Math.floor(kt / 2), 16 + kt, kt % 2 ? gc[1] : gc[2]); set(kx + side * (Math.floor(kt / 2) + 1), 17 + kt, gc[0]); }
  }
  if (gear === 'eyepatch') {
    var ex = (turn === 1 ? 39 : 24) + fx;
    for (var ey2 = 27; ey2 <= 32; ey2++) hline(ey2, ex - 3, ex + 3, ey2 === 27 ? P.ink[2] : ink);
    for (var st3 = 0; st3 < 16; st3++) set(ex - 4 - st3, 26 - Math.floor(st3 / 2), P.ink[2]);
  }
  if (gear === 'scar') { for (var sc3 = 0; sc3 < 9; sc3++) { set(22 + fx + sc3 * 0.6, 23 + sc3, P.rose[0]); set(23 + fx + sc3 * 0.6, 23 + sc3, skin[3]); } }
  if (gear === 'earring') { var erx = turn < 0 ? 46 : 17; set(erx, 37, P.gold[2]); set(erx, 38, P.gold[1]); set(erx, 39, elem[2]); }
  if (gear === 'paint') { for (var pt = 0; pt < 3; pt++) { hline(33 + pt, 21 + fx + pt, 23 + fx + pt, elem[1]); hline(33 + pt, 40 + fx - pt, 42 + fx - pt, elem[1]); } }
  if (gear === 'flower') { var flx = turn > 0 ? 18 : 45; var fl = [P.rose[2], P.rose[3], P.gold[2]]; set(flx, 15, fl[2]); set(flx - 1, 15, fl[0]); set(flx + 1, 15, fl[0]); set(flx, 14, fl[1]); set(flx, 16, fl[0]); set(flx - 1, 14, fl[0]); set(flx + 1, 16, fl[1]); }
  if (gear === 'goggles') {
    hline(13, 14, 49, P.earth[1]); hline(14, 14, 49, P.earth[0]);
    for (var gg = 0; gg < 2; gg++) { var gx2 = 22 + gg * 14 + fx; for (var gy3 = 10; gy3 <= 15; gy3++) hline(gy3, gx2, gx2 + 6, gy3 === 10 || gy3 === 15 ? P.steel[0] : (gy3 < 12 ? P.ocean[3] : P.ocean[1])); hline(11, gx2 + 1, gx2 + 2, '#ffffff'); }
  }
  if (gear === 'mask') {
    for (var mk = 36; mk <= 46; mk++) for (var mxk = faceL[Math.min(mk, 45)]; mxk <= M(faceL[Math.min(mk, 45)]); mxk++) set(mxk, mk, mk === 36 ? P.ink[3] : (mxk < 30 ? P.ink[3] : P.ink[2]));
  }

  var bare = fem && tier > 0 && (job === 'mage' || job === 'bard');
  if (bare) {
    for (var bsy = 48; bsy <= 56; bsy++) { var bw2 = bsy === 48 ? 18 : bsy === 49 ? 13 : 8; for (var bsx = bw2; bsx <= M(bw2); bsx++) set(bsx, bsy, bsx > 42 ? skin[1] : skin[2]); }
    hline(52, 22, 28, skin[1]); hline(52, 35, 41, skin[0]);
    for (var nk = 0; nk < 9; nk++) set(27 + nk, 51 + Math.round(Math.sin(nk / 8 * Math.PI) * 3), nk % 2 ? P.gold[2] : P.gold[1]);
    set(31, 55, elem[2]); set(32, 55, elem[2]); set(31, 56, elem[1]); set(32, 56, elem[1]);
    for (var gw2 = 57; gw2 <= 63; gw2++) span(gw2, 4, 59, outfit);
    hline(57, 6, 57, P.gold[1]);
  }
  // ---------- Job details ----------
  if (tier === 0) {
    for (var vy = 50; vy <= 55; vy++) hline(vy, 28 + (vy - 50), 35 - (vy - 50), vy === 55 ? skin[0] : skin[1]);
    hline(50, 22, 41, P.earth[3]);
  } else if (job === 'fighter') {
    for (var fy2 = 49; fy2 <= 61; fy2++) { var pw2 = fy2 < 52 ? 8 : 12; span(fy2, 3, 3 + pw2, P.steel); span(fy2, M(3 + pw2), 60, P.steel); }
    hline(49, 5, 11, P.steel[3]); hline(49, 52, 58, P.steel[3]);
    for (var rv = 5; rv <= 13; rv += 4) { set(rv, 55, P.steel[0]); set(M(rv), 55, P.steel[0]); }
    hline(51, 22, 41, P.steel[2]); hline(52, 21, 42, P.steel[1]); hline(53, 21, 42, P.steel[0]);
    if (tier >= 2) { hline(48, 5, 11, P.gold[2]); hline(48, 52, 58, P.gold[1]); hline(14, 16, 47, P.steel[2]); hline(15, 16, 47, P.steel[1]); hline(16, 16, 47, P.steel[0]); hline(14, 30, 33, elem[3]); hline(15, 30, 33, elem[2]); hline(16, 31, 32, elem[1]); }
  } else if (job === 'mage' && bare) {
  } else if (job === 'mage') {
    for (var cy = 44; cy <= 54; cy++) { span(cy, 21, 25, outfit); span(cy, 38, 42, outfit); }
    hline(44, 21, 25, P.gold[2]); hline(44, 38, 42, P.gold[1]);
    hline(54, 28, 35, P.gold[1]); hline(55, 30, 33, elem[2]); hline(56, 30, 33, elem[1]);
  } else if (job === 'cleric') {
    for (var st = 52; st <= 63; st++) { hline(st, 22, 24, st % 4 === 0 ? P.gold[2] : P.gold[1]); hline(st, 39, 41, P.gold[1]); }
    for (var cr = 54; cr <= 62; cr++) hline(cr, 31, 32, P.gold[2]);
    hline(56, 28, 35, P.gold[2]); hline(57, 28, 35, P.gold[1]);
    hline(16, 18, 45, P.gold[1]); set(31, 16, elem[2]); set(32, 16, elem[2]); set(31, 15, elem[3]);
  } else if (job === 'thief') {
    for (var sc = 44; sc <= 53; sc++) span(sc, 23 - (sc - 44), 40 + (sc - 44), P.forest);
    hline(47, 23, 40, P.forest[0]); hline(51, 17, 46, P.forest[0]);
    set(36, 55, elem[2]); set(37, 55, elem[1]);
  } else if (job === 'bard' && bare) {
  } else if (job === 'bard') {
    for (var rf = 47; rf <= 52; rf++) hline(rf, 25 - (rf - 47), 38 + (rf - 47), rf % 2 ? P.steel[3] : P.steel[2]);
    for (var bt = 55; bt <= 62; bt += 3) { set(31, bt, P.gold[2]); set(32, bt, P.gold[1]); }
  }

  // Hats
  if (tier > 0 && job === 'mage') {
    for (var k2 = -2; k2 <= 11; k2++) { var cw2 = Math.max(1, Math.round((k2 + 3) * 1.25)); span(k2, 33 - cw2 + Math.round((11 - k2) * 0.4), 33 + cw2 + Math.round((11 - k2) * 0.4), outfit); }
    hline(11, 15, 50, tier >= 4 ? P.gold[2] : P.gold[1]); hline(12, 15, 50, P.gold[0]); set(32, 11, elem[2]); set(33, 11, elem[3]);
    for (var br = 13; br <= 15; br++) span(br, br === 15 ? 6 : 4, br === 15 ? 57 : 59, outfit);
    hline(15, 6, 57, outfit[0]);
  }
  if (tier > 0 && job === 'bard') {
    for (var k3 = 4; k3 <= 13; k3++) { var bw3 = k3 < 7 ? 8 + (k3 - 4) * 4 : (k3 < 11 ? 21 : 19); span(k3, 30 - bw3, 30 + bw3 - 4, P.ember); }
    hline(13, 13, 45, P.ember[0]);
    for (var f = 0; f < 12; f++) { set(44 + f * 0.8, 9 - f, f < 9 ? elem[2] : elem[3]); set(45 + f * 0.8, 9 - f, elem[1]); }
  }
  if (tier >= 4 && (job === 'fighter' || job === 'cleric' || job === 'thief')) {
    hline(6, 21, 42, P.gold[1]); hline(7, 21, 42, P.gold[0]);
    var peaks = [21, 26, 31, 32, 37, 42];
    for (var pk = 0; pk < peaks.length; pk++) { set(peaks[pk], 5, P.gold[2]); set(peaks[pk], 4, P.gold[3]); }
    hline(6, 30, 33, elem[2]);
  }

  // Race headpieces that sit on top of hair and hats
  if (race === 'demonkin') {
    var curl = rnd() < 0.5;
    var path = curl ? [[25, 15], [23, 10], [20, 6], [16, 4], [12, 5], [10, 8], [10, 12]] : [[25, 15], [23, 10], [21, 6], [19, 2], [18, -1]];
    var horn = function (fx) {
      for (var pi = 0; pi < path.length - 1; pi++) {
        for (var st2 = 0; st2 <= 6; st2++) {
          var tt = st2 / 6, prog2 = (pi + tt) / (path.length - 1);
          var hxp = path[pi][0] + (path[pi + 1][0] - path[pi][0]) * tt, hyp = path[pi][1] + (path[pi + 1][1] - path[pi][1]) * tt;
          var rad = 2.6 - prog2 * 2.1;
          for (var oy2 = -3; oy2 <= 3; oy2++) for (var ox2 = -3; ox2 <= 3; ox2++) {
            if (ox2 * ox2 + oy2 * oy2 > rad * rad) continue;
            var hcol = oy2 < 0 ? (prog2 > 0.7 ? P.steel[3] : P.steel[2]) : (oy2 > 0 ? P.ink[2] : P.ink[3]);
            if ((pi * 7 + st2) % 5 === 0 && oy2 === 0) hcol = P.ink[2];
            set(fx(hxp + ox2), hyp + oy2, hcol);
          }
        }
      }
    };
    horn(function (x) { return x; }); horn(function (x) { return M(x); });
  }
  if (race === 'beastkin') {
    var furIn = P.rose[2];
    var bear = function (fx, light) {
      tri(fx(17), 16, fx(27), 12, fx(16), -1, function (x, y) { set(x, y, light ? hair[2] : hair[0]); });
      tri(fx(19), 13, fx(25), 11, fx(18), 3, function (x, y) { set(x, y, furIn); });
    };
    bear(function (x) { return x; }, true); bear(function (x) { return M(x); }, false);
  }
  if (race === 'fae') {
    var spark = [[6, 50], [58, 44], [10, 8], [55, 12]];
    for (var sp = 0; sp < spark.length; sp++) { var sx = spark[sp][0], syy = spark[sp][1]; set(sx, syy, '#ffffff'); set(sx - 1, syy, P.gold[2]); set(sx + 1, syy, P.gold[2]); set(sx, syy - 1, P.gold[2]); set(sx, syy + 1, P.gold[2]); }
  }

  // ---------- Selective outline: dark ink outside, coloured where it touches light areas ----------
  var out = [];
  for (var oy = 0; oy < H; oy++) {
    var orow = [];
    for (var ox = 0; ox < W; ox++) {
      var oc = g[oy][ox];
      if (!oc) {
        var n = (oy > 0 && g[oy - 1][ox]) || (oy < H - 1 && g[oy + 1][ox]) || (ox > 0 && g[oy][ox - 1]) || (ox < W - 1 && g[oy][ox + 1]);
        if (n && oy < H - 1) oc = (ox < 20 && oy < 30) ? P.ink[2] : ink;
      }
      orow.push(oc);
    }
    out.push(orow);
  }
  return { W: W, H: H, grid: out, race: race };
}
if (typeof module !== 'undefined') module.exports = portrait;
