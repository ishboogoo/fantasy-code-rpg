// Poseable battle sprites, 40 x 52, three-quarter view facing right. ES5 for the canvas component.
function hero2(pr) {
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
  var race = pr.race || 'human';
  var pose = pr.pose || 'idle';
  var cursed = String(pr.cursed) === 'true';

  var h = 2166136261;
  for (var i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  if (h === 0) h = 7;
  function rnd() { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function dith(x, y, f) { return f * 16 > BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5; }

  var W = 42, H = 54, g = [];
  for (var y = 0; y < H; y++) { var row = []; for (var x = 0; x < W; x++) row.push(null); g.push(row); }
  function set(x, y, c) { x = Math.round(x) + 1; y = Math.round(y) + 1; if (x >= 0 && x < W && y >= 0 && y < H && c) g[y][x] = c; }
  function get(x, y) { x = Math.round(x) + 1; y = Math.round(y) + 1; return (x >= 0 && x < W && y >= 0 && y < H) ? g[y][x] : null; }
  // Thick shaded limb from a to b. Ramp r: [dark, mid, light, highlight]
  function limb(a, b, t0, t1, r) {
    var len = Math.max(1, Math.hypot(b[0] - a[0], b[1] - a[1]));
    var steps = Math.ceil(len * 2);
    var nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len; // normal
    for (var s2 = 0; s2 <= steps; s2++) {
      var t = s2 / steps, cx = a[0] + (b[0] - a[0]) * t, cy = a[1] + (b[1] - a[1]) * t;
      var rad = (t0 + (t1 - t0) * t) / 2;
      for (var oy = -3; oy <= 3; oy++) for (var ox = -3; ox <= 3; ox++) {
        if (ox * ox + oy * oy > rad * rad + 0.3) continue;
        var side = ox * nx + oy * ny; // which side of the limb
        var lit = -ox - oy;
        var c = r[1];
        if (lit > rad * 0.6) c = r[2];
        if (lit < -rad * 0.6) c = r[0];
        set(cx + ox, cy + oy, c);
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
      var neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      if (!(neg && pos)) fn(xx, yy);
    }
  }
  function quad(A, B, C, D, fn) { tri(A, B, C, fn); tri(A, C, D, fn); }
  function shadeQuad(A, B, C, D, r) {
    var cx = (A[0] + B[0] + C[0] + D[0]) / 4, cy = (A[1] + B[1] + C[1] + D[1]) / 4;
    quad(A, B, C, D, function (x, y) {
      var l = (cx - x) * 0.7 + (cy - y) * 0.4;
      set(x, y, l > 2 ? r[2] : l < -2.5 ? r[0] : (l > 0.5 && dith(x, y, 0.5) ? r[2] : r[1]));
    });
  }

  // ---------- Look ----------
  var ELEM = { 'claude-code': P.ember, 'codex': P.ocean, 'gemini-cli': P.arcane, 'anthropic-api': P.rose, 'openai-compatible': P.steel, 'shell': P.earth };
  var elem = ELEM[adapter] || P.steel;
  var skin = pick([P.skin, P.skin, P.umber, P.earth]);
  var hair = pick([P.gold, P.ember, P.ink, P.steel, P.rose, P.ocean, P.arcane, P.earth]);
  var hairStyle = Math.floor(rnd() * 4);
  var build = pr.build || pick(['feminine', 'masculine']);
  var fem = build === 'feminine';
  if (fem && race !== 'automaton' && race !== 'lizardfolk') hairStyle = pick([2, 2, 3, 1]);
  if (race === 'lizardfolk') skin = P.forest;
  if (race === 'demonkin') skin = [P.ink[2], P.ink[3], P.steel[1], P.steel[2]];
  if (race === 'automaton') { skin = P.steel; hair = P.steel; }
  if (race === 'dwarf') hair = pick([P.ember, P.earth, P.steel, P.gold]);
  var robe = pick([P.arcane, P.ocean]);
  var white = [P.steel[0], P.steel[1], P.steel[2], P.steel[3]];
  var outfit = tier === 0 ? P.earth : ({ fighter: P.steel, mage: robe, cleric: white, thief: P.forest, bard: P.ember })[job];
  var under = tier === 0 ? P.earth : ({ fighter: P.night, mage: P.ink, cleric: P.night, thief: P.ink, bard: P.night })[job];
  var cape = job === 'bard' ? P.ember : elem;
  var hasCape = tier >= 3 || job === 'bard' || job === 'fighter' && tier >= 2;
  var robed = tier > 0 && (job === 'mage' || job === 'cleric');
  var short = race === 'dwarf' ? 4 : 0;

  // ---------- Skeleton per job and pose (facing right; ground at y = 51) ----------
  var J = {
    head: [21, 9], neck: [20, 14], chest: [20, 19], pelvis: [19, 29],
    fSh: [23, 17], fEl: [27, 22], fHa: [30, 21], bSh: [16, 17], bEl: [13, 23], bHa: [14, 28],
    fHip: [21, 30], fKn: [25, 39], fFt: [28, 50], bHip: [17, 30], bKn: [14, 40], bFt: [10, 50]
  };
  var weapon = null; // [from, to, kind]
  if (job === 'fighter' || tier === 0) {
    if (pose === 'attack') { J.head = [26, 12]; J.neck = [24, 16]; J.chest = [23, 21]; J.pelvis = [19, 30]; J.fSh = [26, 19]; J.fEl = [31, 19]; J.fHa = [35, 18]; J.bSh = [19, 18]; J.bEl = [14, 21]; J.bHa = [9, 19]; J.fKn = [28, 38]; J.fFt = [34, 50]; J.bKn = [12, 41]; J.bFt = [4, 50]; weapon = [[35, 18], [41, 6], 'sword']; }
    else if (pose === 'victory') { J.fEl = [25, 12]; J.fHa = [26, 7]; weapon = [[26, 7], [31, -1], 'sword']; J.bHa = [15, 29]; }
    else { J.fEl = [26, 23]; J.fHa = [29, 25]; J.bEl = [12, 23]; J.bHa = [14, 28]; weapon = [[29, 25], [39, 9], 'sword']; }
    if (tier === 0) weapon = [[29, 25], [37, 14], 'stick'];
  } else if (job === 'mage') {
    J.fEl = [27, 13]; J.fHa = [30, 7]; J.bEl = [13, 21]; J.bHa = [12, 25];
    if (pose === 'attack') { J.fEl = [29, 15]; J.fHa = [35, 12]; J.head = [23, 10]; }
    weapon = [[12, 6], [12, 50], 'staff'];
  } else if (job === 'cleric') {
    J.fEl = [26, 22]; J.fHa = [28, 21]; J.bEl = [12, 15]; J.bHa = [11, 10];
    weapon = [[28, 4], [28, 50], 'crozier'];
  } else if (job === 'thief') {
    J.head = [25, 16]; J.neck = [23, 20]; J.chest = [22, 24]; J.pelvis = [17, 33];
    J.fSh = [24, 22]; J.fEl = [28, 27]; J.fHa = [32, 31]; J.bSh = [18, 22]; J.bEl = [13, 27]; J.bHa = [10, 26];
    J.fHip = [19, 34]; J.fKn = [27, 40]; J.fFt = [30, 50]; J.bHip = [15, 34]; J.bKn = [10, 42]; J.bFt = [5, 50];
    if (pose === 'attack') { J.fHa = [36, 24]; J.fEl = [30, 24]; J.head = [28, 15]; J.chest = [25, 23]; J.neck = [26, 19]; J.fSh = [27, 21]; }
    weapon = [[J.fHa[0], J.fHa[1]], [J.fHa[0] + 5, J.fHa[1] + 3], 'dagger'];
  } else if (job === 'bard') {
    J.head = [19, 9]; J.neck = [19, 14]; J.chest = [19, 19]; J.fEl = [24, 25]; J.fHa = [26, 24]; J.bSh = [16, 17]; J.bEl = [20, 21]; J.bHa = [30, 16];
    J.fKn = [26, 39]; J.fFt = [30, 50]; J.bKn = [16, 40]; J.bFt = [13, 50];
    weapon = [[22, 27], [34, 13], 'lute'];
  }
  if (fem) { J.fSh = [J.fSh[0] - 1, J.fSh[1] + 1]; J.bSh = [J.bSh[0] + 1, J.bSh[1] + 1]; }
  if (short) { ['head', 'neck', 'chest', 'fSh', 'bSh', 'fEl', 'bEl', 'fHa', 'bHa'].forEach(function (k) { J[k] = [J[k][0], J[k][1] + short]; }); J.pelvis[1] += short; J.fHip[1] += short; J.bHip[1] += short; J.fKn[1] += 2; J.bKn[1] += 2; if (weapon) { weapon[0] = [weapon[0][0], weapon[0][1] + short]; weapon[1] = [weapon[1][0], weapon[1][1] + short]; } }

  var wave = rnd() * 3;

  // ---------- Behind the body ----------
  if (race === 'fae') {
    tri([J.chest[0] - 2, J.chest[1] - 2], [J.chest[0] - 16, J.chest[1] - 16], [J.chest[0] - 12, J.chest[1] + 4], function (x, y) { set(x, y, dith(x, y, 0.5) ? P.ocean[3] : P.ocean[2]); });
    tri([J.chest[0] - 2, J.chest[1] + 2], [J.chest[0] - 14, J.chest[1] + 10], [J.chest[0] - 6, J.chest[1] + 12], function (x, y) { set(x, y, dith(x, y, 0.4) ? P.rose[3] : P.rose[2]); });
  }
  if (hasCape) {
    var cs = [J.bSh[0] + 1, J.bSh[1] - 1], ce = [J.fSh[0], J.fSh[1] - 1];
    quad(cs, ce, [J.pelvis[0] - 2, J.pelvis[1] + 10], [cs[0] - 12 - wave, J.pelvis[1] + 6 + wave], function (x, y) {
      var c = cape[1]; if ((x + Math.floor(y / 3)) % 5 === 0) c = cape[0]; if (x > J.chest[0] - 1) c = cape[0]; if (x < cs[0] - 4 && y < J.chest[1] + 4) c = cape[2];
      set(x, y, c);
    });
  }
  if (race === 'lizardfolk' || race === 'demonkin' || race === 'beastkin') {
    var tc = race === 'beastkin' ? hair : skin;
    var tailEnd = race === 'lizardfolk' ? [J.pelvis[0] - 14, 48] : [J.pelvis[0] - 11, J.pelvis[1] - 4];
    limb([J.pelvis[0] - 2, J.pelvis[1] + 1], [J.pelvis[0] - 7, J.pelvis[1] + 6], race === 'lizardfolk' ? 4 : 2, race === 'lizardfolk' ? 3 : 2, tc);
    limb([J.pelvis[0] - 7, J.pelvis[1] + 6], tailEnd, race === 'lizardfolk' ? 3 : 2, 1, tc);
    if (race === 'demonkin') { set(tailEnd[0], tailEnd[1], P.ember[1]); set(tailEnd[0] - 1, tailEnd[1] - 1, P.ember[2]); set(tailEnd[0] + 1, tailEnd[1] - 1, P.ember[1]); }
  }
  if (job === 'mage' && weapon) { limb(weapon[0], weapon[1], 2, 2, P.earth); for (var oy3 = -2; oy3 <= 2; oy3++) for (var ox3 = -2; ox3 <= 2; ox3++) if (ox3 * ox3 + oy3 * oy3 <= 5) set(weapon[0][0] + ox3, weapon[0][1] - 2 + oy3, ox3 + oy3 < -1 ? elem[3] : ox3 + oy3 < 1 ? elem[2] : elem[1]); }
  // Long hair flows behind
  if (hairStyle === 2 && race !== 'automaton' && race !== 'lizardfolk') {
    quad([J.head[0] - 4, J.head[1] - 3], [J.head[0] + 1, J.head[1] + 2], [J.chest[0] - 2, J.chest[1] + 6], [J.chest[0] - 9 - wave, J.chest[1] + 3], function (x, y) { set(x, y, (x + y) % 4 === 0 ? hair[0] : hair[1]); });
  }

  // ---------- Back limbs ----------
  limb(J.bSh, J.bEl, 3, 3, outfit);
  limb(J.bEl, J.bHa, 3, 2, outfit);
  set(J.bHa[0], J.bHa[1], skin[1]); set(J.bHa[0] + 1, J.bHa[1], skin[1]); set(J.bHa[0], J.bHa[1] + 1, skin[0]);
  if (!robed) {
    var legU = fem ? (job === 'bard' || (job === 'fighter' && tier > 0) ? skin : under) : under;
    limb(J.bHip, J.bKn, fem ? 3 : 4, 3, legU);
    limb(J.bKn, [J.bFt[0] + 1, J.bFt[1] - 4], fem ? 2 : 3, fem ? 2 : 3, fem ? P.earth : under);
    limb(fem ? [J.bKn[0], J.bKn[1] + 1] : [J.bFt[0] + 1, J.bFt[1] - 5], J.bFt, fem ? 3 : 4, 3, P.earth);
    for (var bf = -1; bf <= 2; bf++) set(J.bFt[0] + bf, J.bFt[1], P.earth[0]);
  }

  // ---------- Torso ----------
  if (robed) {
    quad([J.chest[0] - 4, J.chest[1] - 2], [J.chest[0] + 4, J.chest[1] - 2], [J.fFt[0] + 3, 50], [J.bFt[0] - 1, 50], function (x, y) {
      var l = (J.chest[0] - x) * 0.5;
      var c = l > 2 ? outfit[2] : l < -2 ? outfit[0] : outfit[1];
      if ((x * 3 + y) % 11 === 0) c = outfit[0];
      if (y >= 48) c = outfit[0];
      set(x, y, c);
    });
    for (var tx = J.bFt[0]; tx <= J.fFt[0] + 3; tx++) set(tx, 49, job === 'cleric' ? P.gold[1] : P.gold[0]);
    if (fem && job === 'mage') {
      limb([J.fHip[0], J.fHip[1] + 4], J.fKn, 3, 3, skin);
      limb(J.fKn, [J.fFt[0] - 1, J.fFt[1] - 4], 3, 2, skin);
      limb([J.fFt[0] - 1, J.fFt[1] - 7], [J.fFt[0] + 1, J.fFt[1]], 3, 3, P.ink);
      for (var sl = 0; sl < 10; sl++) set(J.fHip[0] - 1 + sl * 0.5, J.fHip[1] + 3 + sl, P.gold[1]);
    }
    set(J.fFt[0] + 1, 51, P.earth[0]); set(J.fFt[0] + 2, 51, P.earth[0]);
  }
  if (fem) {
    var waist = [J.chest[0] + (J.pelvis[0] - J.chest[0]) * 0.55, J.chest[1] + (J.pelvis[1] - J.chest[1]) * 0.55];
    shadeQuad([J.bSh[0], J.bSh[1] - 1], [J.fSh[0] + 1, J.fSh[1] - 1], [waist[0] + 2, waist[1]], [waist[0] - 2, waist[1]], outfit);
    shadeQuad([waist[0] - 2, waist[1]], [waist[0] + 2, waist[1]], [J.fHip[0] + 2, J.fHip[1] + 1], [J.bHip[0] - 2, J.bHip[1] + 1], outfit);
    // bust highlight and shading on the front side
    set(J.fSh[0] + 1, J.chest[1] + 1, outfit[2]); set(J.fSh[0] + 1, J.chest[1] + 2, outfit[1]); set(J.fSh[0] + 1, J.chest[1] + 3, outfit[0]);
    // bare shoulders for the sorceress and the bard; collarbone line
    if (tier > 0 && (job === 'mage' || job === 'bard')) {
      for (var bs = J.bSh[0] - 1; bs <= J.fSh[0] + 1; bs++) { set(bs, J.bSh[1] - 1, skin[2]); set(bs, J.bSh[1], skin[1]); }
      set(J.chest[0], J.bSh[1], skin[0]); set(J.chest[0] + 1, J.bSh[1] + 1, skin[0]);
      for (var nl = J.bSh[0]; nl <= J.fSh[0]; nl++) set(nl, J.bSh[1] + 1, outfit[2]);
    }
    // cinched waist
    for (var wb = Math.round(waist[0]) - 2; wb <= Math.round(waist[0]) + 2; wb++) set(wb, Math.round(waist[1]), tier >= 2 ? P.gold[1] : outfit[0]);
  } else {
    shadeQuad([J.bSh[0], J.bSh[1] - 1], [J.fSh[0], J.fSh[1] - 1], [J.fHip[0] + 1, J.fHip[1]], [J.bHip[0] - 1, J.bHip[1]], outfit);
  }
  if (fem && tier > 0 && (job === 'fighter' || job === 'bard')) {
    var sk = job === 'fighter' ? P.steel : P.ember;
    quad([J.bHip[0] - 2, J.pelvis[1] - 1], [J.fHip[0] + 2, J.pelvis[1] - 1], [J.fHip[0] + 5, J.pelvis[1] + 7], [J.bHip[0] - 5, J.pelvis[1] + 7], function (x, y) {
      var c = (x + y) % 4 === 0 ? sk[0] : (x < J.pelvis[0] ? sk[2] : sk[1]);
      if (y === J.pelvis[1] + 7) c = job === 'fighter' ? P.gold[1] : P.ember[3];
      set(x, y, c);
    });
  }
  // belt and insignia
  for (var bx = J.bHip[0] - 1; bx <= J.fHip[0] + 1; bx++) set(bx, J.pelvis[1] - 1, tier >= 2 ? P.gold[1] : P.earth[1]);
  if (tier >= 1) { set(J.chest[0] + 1, J.chest[1] + 1, elem[2]); set(J.chest[0] + 2, J.chest[1] + 1, elem[1]); }
  if (job === 'cleric' && tier > 0) { for (var cy = 0; cy < 6; cy++) set(J.chest[0], J.chest[1] - 1 + cy, P.gold[2]); set(J.chest[0] - 1, J.chest[1] + 1, P.gold[2]); set(J.chest[0] + 1, J.chest[1] + 1, P.gold[2]); }
  if (job === 'thief' && tier > 0) { limb(J.neck, [J.neck[0] - 10 - wave, J.neck[1] + 3], 3, 2, P.ember); }

  // ---------- Front leg ----------
  if (!robed) {
    var legF = fem ? (job === 'bard' || (job === 'fighter' && tier > 0) ? skin : under) : under;
    limb(J.fHip, J.fKn, fem ? 3 : 4, 3, legF);
    limb(J.fKn, [J.fFt[0] - 1, J.fFt[1] - 4], fem ? 2 : 3, fem ? 2 : 3, fem ? P.earth : under);
    limb(fem ? [J.fKn[0], J.fKn[1] + 1] : [J.fFt[0] - 1, J.fFt[1] - 5], [J.fFt[0] + 1, J.fFt[1]], fem ? 3 : 4, 3, P.earth);
    if (fem) { set(J.fKn[0] - 1, J.fKn[1] + 1, P.earth[3]); set(J.fKn[0], J.fKn[1] + 1, P.earth[2]); }
    for (var ff = -1; ff <= 3; ff++) set(J.fFt[0] + ff, J.fFt[1], P.earth[0]);
    if (job === 'fighter' && tier > 0) { set(J.fKn[0], J.fKn[1], P.steel[2]); set(J.fKn[0] + 1, J.fKn[1], P.steel[1]); }
  }

  // ---------- Head ----------
  var hx = J.head[0], hy = J.head[1];
  // neck
  set(J.neck[0], J.neck[1], skin[0]); set(J.neck[0] + 1, J.neck[1], skin[1]); set(J.neck[0], J.neck[1] - 1, skin[1]);
  for (var oy2 = -5; oy2 <= 5; oy2++) for (var ox2 = -5; ox2 <= 5; ox2++) {
    var e = (ox2 * ox2) / 22 + (oy2 * oy2) / 27;
    if (e > 1) continue;
    var c2 = ox2 + oy2 < -3 ? skin[2] : ox2 < -2 ? skin[1] : skin[2];
    if (oy2 > 3 && ox2 < 1) c2 = skin[1];
    set(hx + ox2, hy + oy2, c2);
  }
  // jaw toward the front
  set(hx + 4, hy + 3, skin[2]); set(hx + 3, hy + 5, skin[1]); set(hx + 5, hy + 1, skin[2]);
  // face: near eye, far eye hint, nose, mouth
  var eyeC = race === 'automaton' ? elem[2] : P.ink[1];
  set(hx + 2, hy, eyeC); set(hx + 2, hy + 1, race === 'automaton' ? elem[3] : P.ocean[1]); set(hx + 3, hy, race === 'automaton' ? elem[2] : P.ink[2]);
  set(hx - 1, hy, eyeC);
  set(hx + 1, hy - 2, hair[0]); set(hx + 2, hy - 2, hair[0]); set(hx + 3, hy - 2, hair[0]);
  set(hx + 5, hy + 2, skin[1]);
  set(hx + 3, hy + 4, fem ? P.rose[1] : P.rose[0]);
  if (fem) { set(hx + 3, hy - 1, P.ink[1]); set(hx + 4, hy - 1, P.ink[1]); set(hx + 4, hy + 4, P.rose[0]); }
  // ears
  if (race === 'elf' || race === 'fae') { set(hx - 3, hy + 1, skin[2]); set(hx - 4, hy, skin[2]); set(hx - 5, hy - 1, skin[1]); set(hx - 6, hy - 2, skin[1]); }
  else if (race !== 'automaton' && race !== 'lizardfolk') { set(hx - 3, hy + 1, skin[1]); set(hx - 3, hy + 2, skin[0]); }
  if (race === 'lizardfolk') { for (var sn = 1; sn <= 3; sn++) { set(hx + 5 + sn, hy + 2, skin[1]); set(hx + 5 + sn, hy + 3, skin[0]); } set(hx + 7, hy + 1, skin[2]); }
  if (race === 'dwarf') { for (var by = hy + 3; by <= hy + 10; by++) for (var bxx = hx - 1 - Math.floor((by - hy - 3) / 3); bxx <= hx + 5 - Math.floor((by - hy - 3) / 2); bxx++) set(bxx, by, (bxx + by) % 3 === 0 ? hair[0] : hair[1]); }

  // hair (on top / back of the head)
  if (race === 'automaton') {
    for (var ax = -5; ax <= 5; ax++) for (var ay = -6; ay <= -2; ay++) if ((ax * ax) / 25 + ((ay + 2) * (ay + 2)) / 16 <= 1) set(hx + ax, hy + ay, ax < -1 ? P.steel[2] : P.steel[1]);
    for (var vx = 0; vx <= 4; vx++) set(hx + vx, hy, elem[2]);
    set(hx - 2, hy - 7, P.steel[1]); set(hx - 3, hy - 8, elem[2]);
  } else if (race === 'lizardfolk') {
    for (var cr = 0; cr < 4; cr++) { set(hx - 3 + cr * 2, hy - 6 - (cr % 2), elem[2]); set(hx - 3 + cr * 2, hy - 5, elem[1]); }
  } else {
    var spikes = hairStyle === 1 ? 3 : 0;
    for (var hy2 = -7; hy2 <= 1; hy2++) for (var hx2 = -6; hx2 <= 5; hx2++) {
      var inside = (hx2 * hx2) / 30 + ((hy2 + 2) * (hy2 + 2)) / 28 <= 1;
      if (!inside) continue;
      if (hy2 > -2 && hx2 > -2) continue; // face stays clear
      var hc = hx2 < -2 ? hair[0] : (hx2 + hy2 < -6 ? hair[2] : hair[1]);
      if (hy2 === -6 && hx2 > -3 && hx2 < 2) hc = hair[3];
      set(hx + hx2, hy + hy2, hc);
    }
    // bangs sweeping forward
    for (var bg = 0; bg < 4; bg++) { set(hx + 1 + bg, hy - 3 + Math.floor(bg / 2), hair[1]); set(hx + 2 + bg, hy - 2 + Math.floor(bg / 2), bg > 1 ? hair[0] : hair[1]); }
    if (spikes) { for (var sp = 0; sp < 4; sp++) { var spx = hx - 5 + sp * 3, tip = hy - 9 - (sp % 2); for (var sy = tip; sy <= hy - 5; sy++) { set(spx, sy, sy === tip ? hair[2] : hair[1]); if (sy > tip + 1) set(spx + 1, sy, hair[0]); } } }
    if (hairStyle === 3) { for (var pt = 0; pt < 6; pt++) set(hx - 6 - Math.floor(pt / 2) - wave * 0.3, hy - 2 + pt, pt % 2 ? hair[0] : hair[1]); }
  }
  // race headpieces
  if (race === 'beastkin') { tri([hx - 4, hy - 5], [hx, hy - 6], [hx - 3, hy - 11], function (x, y) { set(x, y, hair[1]); }); set(hx - 3, hy - 8, P.rose[2]); set(hx - 2, hy - 7, P.rose[2]); }
  if (race === 'demonkin') { limb([hx - 1, hy - 5], [hx - 4, hy - 9], 3, 2, [P.ink[2], P.ink[3], P.steel[1], P.steel[2]]); limb([hx - 4, hy - 9], [hx - 8, hy - 9], 2, 1, [P.ink[2], P.ink[3], P.steel[2], P.steel[3]]); }
  // job headgear
  if (tier > 0 && job === 'mage') {
    for (var hb = -8; hb <= 6; hb++) set(hx + hb, hy - 4, outfit[0]);
    tri([hx - 5, hy - 4], [hx + 4, hy - 4], [hx - 7, hy - 15], function (x, y) { set(x, y, x < hx - 3 ? outfit[2] : outfit[1]); });
    for (var hbb = -5; hbb <= 4; hbb++) set(hx + hbb, hy - 5, P.gold[1]);
  }
  if (tier > 0 && job === 'thief') {
    for (var hd = -6; hd <= 3; hd++) for (var hdy = -7; hdy <= 2; hdy++) if ((hd * hd) / 36 + ((hdy + 2) * (hdy + 2)) / 30 <= 1 && !(hdy > -3 && hd > -1)) set(hx + hd, hy + hdy, hd < -2 ? outfit[0] : outfit[1]);
  }
  if (tier > 0 && job === 'bard') { for (var bt = -6; bt <= 4; bt++) { set(hx + bt, hy - 4, P.ember[1]); set(hx + bt + 1, hy - 5, P.ember[2]); } set(hx - 5, hy - 6, elem[2]); set(hx - 6, hy - 7, elem[2]); set(hx - 7, hy - 8, elem[3]); }
  if (job === 'fighter' && tier >= 2) { for (var hm = -5; hm <= 4; hm++) set(hx + hm, hy - 4, P.steel[2]); set(hx + 4, hy - 3, P.steel[1]); }
  if (tier >= 4) { for (var cw = -3; cw <= 3; cw++) set(hx + cw, hy - 7, P.gold[1]); set(hx - 3, hy - 8, P.gold[2]); set(hx, hy - 8, P.gold[3]); set(hx + 3, hy - 8, P.gold[2]); }

  // ---------- Front arm and weapon ----------
  if (job === 'fighter' && tier > 0) { limb([J.fSh[0] - 1, J.fSh[1]], [J.fSh[0] + 1, J.fSh[1] + 1], 5, 4, P.steel); }
  if (weapon && job !== 'mage') {
    if (weapon[2] === 'sword') {
      limb(weapon[0], weapon[1], 2, 2, [P.steel[1], P.steel[2], P.steel[3], P.steel[3]]);
      var gx = weapon[0][0], gy = weapon[0][1];
      var dx = weapon[1][0] - gx, dy = weapon[1][1] - gy, dl = Math.hypot(dx, dy);
      for (var gq = -2; gq <= 2; gq++) set(gx + 2 * dx / dl - gq * dy / dl, gy + 2 * dy / dl + gq * dx / dl, P.gold[1]);
      set(weapon[1][0], weapon[1][1], P.steel[3]);
    } else if (weapon[2] === 'stick') limb(weapon[0], weapon[1], 2, 2, P.earth);
    else if (weapon[2] === 'crozier') { limb(weapon[0], weapon[1], 2, 2, P.earth); for (var cz = 0; cz < 5; cz++) { set(weapon[0][0] + cz - 2, weapon[0][1], P.gold[2]); set(weapon[0][0], weapon[0][1] - 2 + cz, P.gold[2]); } set(weapon[0][0], weapon[0][1] - 3, elem[2]); }
    else if (weapon[2] === 'dagger') { limb(weapon[0], weapon[1], 2, 1, [P.steel[1], P.steel[2], P.steel[3], P.steel[3]]); }
    else if (weapon[2] === 'lute') {
      limb([weapon[0][0] + 4, weapon[0][1] - 4], weapon[1], 2, 2, P.earth);
      for (var lo = -4; lo <= 4; lo++) for (var la = -4; la <= 4; la++) if ((lo * lo) / 16 + (la * la) / 12 <= 1) set(weapon[0][0] + lo, weapon[0][1] + la, lo + la < -2 ? P.earth[3] : lo + la < 2 ? P.earth[2] : P.earth[1]);
      set(weapon[0][0], weapon[0][1], P.ink[1]); set(weapon[0][0] + 1, weapon[0][1], P.ink[1]);
    }
  }
  limb(J.fSh, J.fEl, 3, 3, outfit);
  limb(J.fEl, J.fHa, 3, 2, outfit);
  set(J.fHa[0], J.fHa[1], skin[2]); set(J.fHa[0] + 1, J.fHa[1], skin[1]); set(J.fHa[0], J.fHa[1] + 1, skin[1]);
  if (job === 'mage' && pose !== 'attack') { for (var gl = 0; gl < 6; gl++) set(J.fHa[0] + Math.round(Math.cos(gl) * 3), J.fHa[1] - 2 + Math.round(Math.sin(gl) * 3), elem[3]); set(J.fHa[0], J.fHa[1] - 2, '#ffffff'); }
  if (job === 'mage' && pose === 'attack') { for (var bl = 0; bl < 8; bl++) set(J.fHa[0] + 2 + bl, J.fHa[1] - 1 + (bl % 2), bl < 4 ? elem[3] : elem[2]); }

  // Curse wisp
  if (cursed) { set(hx - 7, hy - 4, P.arcane[3]); set(hx - 8, hy - 3, P.arcane[2]); set(hx - 7, hy - 2, P.arcane[2]); set(hx - 8, hy - 1, P.arcane[1]); }

  // ---------- Outline ----------
  var line = cursed ? P.arcane[1] : P.ink[1];
  var out = [];
  for (var yy = 0; yy < H; yy++) {
    var r2 = [];
    for (var xx = 0; xx < W; xx++) {
      var c3 = g[yy][xx];
      if (!c3) {
        var n = (yy > 0 && g[yy - 1][xx]) || (yy < H - 1 && g[yy + 1][xx]) || (xx > 0 && g[yy][xx - 1]) || (xx < W - 1 && g[yy][xx + 1]);
        if (n) c3 = line;
      }
      r2.push(c3);
    }
    out.push(r2);
  }
  return { W: W, H: H, grid: out };
}
if (typeof module !== 'undefined') module.exports = hero2;
