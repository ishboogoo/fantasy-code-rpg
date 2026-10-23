// Guild Town: a walled citadel at night under falling code. The main street
// follows the quest loop: Guild Counter → Quest Board → War Room → Battle Gate,
// then back through the Treasure Vault and the Library. Drawn at the native
// 384 x 216 and scaled ×3. A building glows green when something waits there.
(function () {
  var W = 384, H = 216;
  var C = { ink: '#020806', stone0: '#0a1a12', stone1: '#122a1e', stone2: '#1e3e2c', stone3: '#3a6a4c', rim: '#7dff9a', rim2: '#1f8a3c',
    wood0: '#2a1a10', wood1: '#4a2a18', wood2: '#6c4028', roof0: '#06140c', roof1: '#0e2c1a', roof2: '#1a4a2c',
    amber: '#ffe090', amber2: '#e0b040', green: '#7dff9a', white: '#e8ffe8', parch: '#fff6d0', red: '#9a2a20', gold: '#e0b040', steel: '#a8b4c8' };
  var BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

  /** Building hotspots (native pixels) in quest-loop order, then the side streets. */
  var B = [
    { id: 'counter', x: 16, y: 78, w: 64, h: 44, plate: 'below' },
    { id: 'board', x: 92, y: 88, w: 36, h: 34, plate: 'below' },
    { id: 'warroom', x: 140, y: 46, w: 60, h: 76, plate: 'below' },
    { id: 'gate', x: 318, y: 72, w: 56, h: 52, plate: 'below' },
    { id: 'vault', x: 262, y: 168, w: 58, h: 46, plate: 'above' },
    { id: 'library', x: 188, y: 160, w: 62, h: 54, plate: 'above' },
    { id: 'tavern', x: 104, y: 166, w: 66, h: 48, plate: 'above' },
    { id: 'inn', x: 18, y: 162, w: 70, h: 52, plate: 'above' },
  ];

  function painter(ctx) {
    var px = function (x, y, c) { if (x < 0 || y < 0 || x >= W || y >= H) return; ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, 1, 1); };
    var rect = function (x0, y0, x1, y1, c) { ctx.fillStyle = c; ctx.fillRect(x0, y0, x1 - x0 + 1, y1 - y0 + 1); };
    var dith = function (x, y, f) { return f * 16 > BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5; };
    var tri = function (ax, ay, bx, by, cx, cy, c) { ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); };
    return { px: px, rect: rect, dith: dith, tri: tri };
  }

  /** Stone wall block with mortar lines and top-left light. */
  function stone(p, x0, y0, x1, y1, lit) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var row = Math.floor((y - y0) / 4), off = row % 2 ? 3 : 0;
      var mortar = (y - y0) % 4 === 3 || ((x - x0 + off) % 7 === 6);
      var c = mortar ? C.stone0 : (p.dith(x, y, (y - y0) / (y1 - y0 + 1) * 0.6) ? C.stone1 : C.stone2);
      if (x === x0 || y === y0) c = lit ? C.rim2 : C.stone2;
      p.px(x, y, c);
    }
  }
  function windowLit(p, x, y, w, h, glow) {
    p.rect(x - 1, y - 1, x + w, y + h, C.ink);
    p.rect(x, y, x + w - 1, y + h - 1, glow ? C.green : C.amber2);
    p.rect(x, y, x + w - 1, y, glow ? C.white : C.amber);
    if (w >= 3) p.rect(x + (w >> 1), y, x + (w >> 1), y + h - 1, C.ink);
  }
  function roof(p, x0, x1, top, base, glow) {
    var mid = (x0 + x1) / 2;
    p.tri(x0 - 3, base, mid, top, x1 + 3, base, C.roof1);
    p.tri(mid, top, x1 + 3, base, mid + 1, base, C.roof0);
    for (var x = x0 - 3; x <= mid; x++) { var y = Math.round(base - (x - (x0 - 3)) / (mid - x0 + 3) * (base - top)); p.px(x, y, glow ? C.rim : C.roof2); }
    for (var x2 = mid; x2 <= x1 + 3; x2++) { var y2 = Math.round(top + (x2 - mid) / (x1 + 3 - mid) * (base - top)); p.px(x2, y2, glow ? C.rim2 : C.roof1); }
  }
  function door(p, x, base, w, h) { p.rect(x, base - h, x + w - 1, base - 1, C.wood0); p.rect(x, base - h, x + w - 1, base - h, C.wood2); p.px(x + w - 2, base - (h >> 1), C.amber); }
  function outlineGlow(p, b, on) {
    if (!on) return;
    for (var x = b.x - 2; x <= b.x + b.w + 1; x++) { p.px(x, b.y + b.h + 1, C.rim); }
  }

  function paintTown(ctx, s, t) {
    var p = painter(ctx);
    ctx.clearRect(0, 0, W, H);
    var w = s.waiting, blink = t % 2 === 0;

    // Distant wireframe hills behind the wall
    for (var x = 0; x < W; x++) {
      var hy = Math.round(84 + Math.sin(x * 0.045) * 7 + Math.sin(x * 0.13) * 3);
      p.px(x, hy, C.rim2); if (x % 12 === 0) for (var y = hy; y < 96; y += 2) p.px(x, y, '#145a2c');
    }
    // Pillar of light beyond the Battle Gate while a battle is under way
    if (s.fighting) for (var y1 = 0; y1 < 100; y1++) { p.px(345, y1, y1 % 3 ? C.green : C.white); p.px(346, y1, C.rim2); p.px(344, y1, C.rim2); }

    // City wall with battlements
    stone(p, 0, 96, W - 1, 122, false);
    for (var bx = 0; bx < W; bx += 10) stone(p, bx, 90, bx + 5, 96, false);
    // Ground: the plaza, cobbled, lit from the street lamps
    for (var gy = 122; gy < H; gy++) for (var gx = 0; gx < W; gx++) {
      var cob = ((gx + (gy % 6 < 3 ? 0 : 3)) % 6 === 0) || gy % 3 === 0;
      p.px(gx, gy, cob ? '#06140c' : (p.dith(gx, gy, 0.35) ? '#0e2c1a' : '#0a2416'));
    }
    // Main street glow line along the loop
    for (var sx = 10; sx < 330; sx++) { p.px(sx, 124, C.rim2); }
    for (var sx2 = 10; sx2 < 330; sx2++) { if (sx2 % 4 === 0) p.px(sx2, 158, C.rim2); }

    // 1 Guild Counter: a long hall with a striped awning and a sign
    var b = B[0];
    stone(p, b.x, b.y + 12, b.x + b.w, b.y + b.h, false);
    roof(p, b.x, b.x + b.w, b.y - 4, b.y + 12, w.counter && blink);
    for (var ax = b.x; ax <= b.x + b.w; ax++) { p.rect(ax, b.y + 14, ax, b.y + 18, ((ax - b.x) >> 2) % 2 ? C.rim2 : C.roof0); }
    windowLit(p, b.x + 6, b.y + 24, 6, 6, w.counter); windowLit(p, b.x + b.w - 12, b.y + 24, 6, 6, w.counter);
    door(p, b.x + 26, b.y + b.h + 1, 12, 14);
    p.rect(b.x + 22, b.y + 2, b.x + 42, b.y + 8, C.wood1); p.rect(b.x + 23, b.y + 3, b.x + 41, b.y + 7, C.parch);
    outlineGlow(p, b, w.counter);

    // 2 Quest Board: a timber board on posts, one notice per open quest
    b = B[1];
    p.rect(b.x + 3, b.y + 6, b.x + 5, b.y + b.h, C.wood1); p.rect(b.x + b.w - 5, b.y + 6, b.x + b.w - 3, b.y + b.h, C.wood1);
    p.rect(b.x, b.y, b.x + b.w, b.y + 22, C.wood2); p.rect(b.x + 1, b.y + 1, b.x + b.w - 1, b.y + 21, C.wood1);
    p.tri(b.x - 3, b.y + 1, b.x + b.w / 2, b.y - 7, b.x + b.w + 3, b.y + 1, C.roof1);
    for (var n = 0; n < Math.min(s.openQuests, 6); n++) {
      var nx = b.x + 3 + (n % 3) * 11, ny = b.y + 3 + Math.floor(n / 3) * 9;
      p.rect(nx, ny, nx + 8, ny + 7, C.parch); p.rect(nx + 1, ny + 2, nx + 7, ny + 2, C.red); p.rect(nx + 1, ny + 4, nx + 5, ny + 4, C.steel);
    }

    // 3 War Room: a stone keep with battlements and a gold banner
    b = B[2];
    stone(p, b.x + 8, b.y + 10, b.x + b.w - 8, b.y + b.h, true);
    for (var kx = b.x + 8; kx <= b.x + b.w - 12; kx += 8) stone(p, kx, b.y + 4, kx + 4, b.y + 10, true);
    windowLit(p, b.x + 18, b.y + 22, 4, 8, w.warroom); windowLit(p, b.x + b.w - 22, b.y + 22, 4, 8, w.warroom);
    windowLit(p, b.x + 26, b.y + 40, 8, 8, w.warroom);
    door(p, b.x + 24, b.y + b.h + 1, 12, 16);
    p.rect(b.x + 29, b.y - 14, b.x + 29, b.y + 4, C.steel);
    for (var fy = 0; fy < 8; fy++) p.rect(b.x + 30, b.y - 14 + fy, b.x + 30 + 10 - fy, b.y - 14 + fy, fy < 2 ? C.amber : C.gold);
    outlineGlow(p, b, w.warroom);

    // 4 Battle Gate: a ring of runes set in the wall; it swirls while a battle is under way
    b = B[3];
    var gcx = b.x + b.w / 2, gcy = b.y + 28;
    for (var yy = b.y; yy <= b.y + b.h; yy++) for (var xx = b.x; xx <= b.x + b.w; xx++) {
      var d = Math.hypot(xx - gcx, yy - gcy);
      if (d < 20 && yy <= b.y + b.h) p.px(xx, yy, s.fighting ? (p.dith(xx + t, yy, 0.5 - d / 60) ? C.green : '#0a3a1e') : C.ink);
      else if (d >= 20 && d < 26) p.px(xx, yy, ((Math.atan2(yy - gcy, xx - gcx) * 8 / Math.PI + 16) | 0) % 2 ? C.stone2 : C.stone1);
    }
    for (var r = 0; r < 12; r++) { var a = r / 12 * Math.PI * 2 + (s.fighting ? t * 0.2 : 0); p.px(gcx + Math.cos(a) * 23, gcy + Math.sin(a) * 23, s.fighting || blink ? C.rim : C.rim2); }
    p.rect(b.x, b.y + b.h - 2, b.x + b.w, b.y + b.h, C.stone2);

    // Plaza: the code spire, where the rain gathers
    var sx3 = 236;
    for (var sy = 126; sy < 158; sy++) { var hw = Math.max(1, Math.round((sy - 126) / 6)); p.rect(sx3 - hw, sy, sx3 + hw, sy, sy % 4 ? '#145a2c' : C.rim2); }
    p.px(sx3, 124, C.white); p.px(sx3, 125, C.rim);
    // Street lamps
    [60, 132, 210, 300].forEach(function (lx) { p.rect(lx, 128, lx, 140, C.stone2); p.rect(lx - 1, 126, lx + 1, 127, C.green); p.px(lx, 125, C.white); });

    // 5 Treasure Vault: a domed strongroom with a chest over the door; gold when something waits
    b = B[4];
    stone(p, b.x + 4, b.y + 16, b.x + b.w - 4, b.y + b.h, false);
    for (var dy = 0; dy < 16; dy++) { var half = Math.round(Math.sqrt(Math.max(0, 16 * 16 - (16 - dy) * (16 - dy))) * 1.5); p.rect(b.x + b.w / 2 - half, b.y + dy, b.x + b.w / 2 + half, b.y + dy, dy < 2 ? C.rim2 : C.roof1); }
    var cx0 = b.x + b.w / 2 - 7, cy0 = b.y + 20;
    p.rect(cx0, cy0, cx0 + 14, cy0 + 9, w.vault && blink ? C.amber : C.gold); p.rect(cx0, cy0 + 4, cx0 + 14, cy0 + 4, C.wood1); p.rect(cx0 + 6, cy0 + 3, cx0 + 8, cy0 + 6, C.ink);
    door(p, b.x + b.w / 2 - 5, b.y + b.h + 1, 10, 12);
    outlineGlow(p, b, w.vault);

    // 6 Library: tall arched windows and a lantern tower
    b = B[5];
    stone(p, b.x, b.y + 14, b.x + b.w, b.y + b.h, false);
    roof(p, b.x, b.x + b.w, b.y, b.y + 14, false);
    stone(p, b.x + b.w - 14, b.y - 12, b.x + b.w - 4, b.y + 14, false);
    p.rect(b.x + b.w - 11, b.y - 9, b.x + b.w - 7, b.y - 5, C.green);
    for (var wi = 0; wi < 3; wi++) { windowLit(p, b.x + 6 + wi * 14, b.y + 22, 6, 12, false); p.px(b.x + 8 + wi * 14, b.y + 21, C.amber); }
    door(p, b.x + 24, b.y + b.h + 1, 10, 12);

    // 7 Tavern: timber frame, a warm glow and a hanging mug
    b = B[6];
    p.rect(b.x, b.y + 14, b.x + b.w, b.y + b.h, '#2a2016');
    for (var tx = b.x; tx <= b.x + b.w; tx += 11) p.rect(tx, b.y + 14, tx + 1, b.y + b.h, C.wood0);
    p.rect(b.x, b.y + 28, b.x + b.w, b.y + 29, C.wood0);
    roof(p, b.x, b.x + b.w, b.y - 2, b.y + 14, false);
    windowLit(p, b.x + 6, b.y + 18, 8, 6, false); windowLit(p, b.x + b.w - 14, b.y + 18, 8, 6, false);
    door(p, b.x + 28, b.y + b.h + 1, 11, 14);
    p.rect(b.x + b.w + 1, b.y + 16, b.x + b.w + 6, b.y + 16, C.wood1); p.rect(b.x + b.w + 3, b.y + 18, b.x + b.w + 7, b.y + 23, C.amber2); p.rect(b.x + b.w + 3, b.y + 18, b.x + b.w + 7, b.y + 18, C.white);

    // 8 Inn: two storeys, a chimney, and Zz when someone is resting
    b = B[7];
    stone(p, b.x, b.y + 14, b.x + b.w, b.y + b.h, false);
    roof(p, b.x, b.x + b.w, b.y - 2, b.y + 14, w.inn && blink);
    p.rect(b.x + 50, b.y - 6, b.x + 55, b.y + 6, C.stone2);
    for (var wi2 = 0; wi2 < 3; wi2++) { windowLit(p, b.x + 6 + wi2 * 22, b.y + 18, 6, 6, w.inn); windowLit(p, b.x + 6 + wi2 * 22, b.y + 32, 6, 6, false); }
    door(p, b.x + 31, b.y + b.h + 1, 10, 12);
    if (w.inn) { p.rect(b.x + 58, b.y - 12, b.x + 61, b.y - 12, C.white); p.rect(b.x + 61, b.y - 11, b.x + 58, b.y - 9, C.white); p.rect(b.x + 58, b.y - 9, b.x + 61, b.y - 9, C.white); }
    outlineGlow(p, b, w.inn);
  }

  window.Town = { W: W, H: H, buildings: B, paint: paintTown };
})();
