// Hero cards: a shareable trading card for a hero, with a big artwork window.
//
// Art, in order of preference: the player's own art for this hero (.fcrpg/art/), then the hero's
// pixel sprite on a background. Backgrounds and rank frames can come from the community: files
// listed in assets/cards/manifest.json (see docs/ART_GUIDE.md, "Card art"); without them the card
// is drawn here. The PNG it saves carries the hero inside it, so the card is also the file another
// player recruits the hero from.
(function () {
  'use strict';
  var G = window.G;
  var W = 600, H = 840;
  // Art window, in card pixels.
  var ART = { x: 30, y: 96, w: 540, h: 360 };
  var RANK = [
    { name: 'novice', a: '#46584a', b: '#748a7a', c: '#141e18' },
    { name: 'bronze', a: '#6c4028', b: '#c8a070', c: '#2a160c' },
    { name: 'silver', a: '#6c7890', b: '#e0e8f0', c: '#1a1e28' },
    { name: 'gold', a: '#9a7018', b: '#ffe090', c: '#2a1e06' },
    { name: 'mythic', a: '#1f8a3c', b: '#7dff9a', c: '#04140c' },
  ];
  var JOB_SKY = { fighter: ['#0a1148', '#2a3c9c'], mage: ['#2a1e44', '#9a68e0'], cleric: ['#2458a8', '#d8f0ff'], thief: ['#2c5020', '#80b060'], bard: ['#9a2a20', '#ff9a70'] };
  var manifest = null;

  function loadManifest() {
    if (manifest) return Promise.resolve(manifest);
    return fetch('/cards/manifest.json').then(function (r) { return r.ok ? r.json() : {}; }, function () { return {}; })
      .then(function (m) { manifest = m || {}; return manifest; });
  }
  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) return resolve(null);
      var img = new Image(); img.onload = function () { resolve(img); }; img.onerror = function () { resolve(null); }; img.src = src;
    });
  }
  function heroArt(c) {
    if (!c.art) return Promise.resolve(null);
    return G.blob('/api/art/' + encodeURIComponent(c.art)).then(function (b) { return b ? loadImage(URL.createObjectURL(b)) : null; });
  }
  /** Draw an image to cover a box, cropping the overflow, with crisp pixels for small pixel art. */
  function cover(g, img, box) {
    var s = Math.max(box.w / img.width, box.h / img.height);
    var w = img.width * s, h = img.height * s;
    g.imageSmoothingEnabled = img.width * 3 > box.w ? true : false;
    g.drawImage(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h);
    g.imageSmoothingEnabled = false;
  }
  function text(g, s, x, y, size, color, align) {
    g.font = size + 'px DotGothic16, monospace'; g.textAlign = align || 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = 'rgba(2,8,6,.85)'; g.fillText(s, x + 2, y + 2);
    g.fillStyle = color; g.fillText(s, x, y);
  }
  function fit(g, s, max, size) {
    g.font = size + 'px DotGothic16, monospace';
    if (g.measureText(s).width <= max) return s;
    while (s.length > 1 && g.measureText(s + '…').width > max) s = s.slice(0, -1);
    return s + '…';
  }

  /** Render a hero's card. Resolves with the canvas. */
  G.cardCanvas = function (c) {
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    var tier = Math.max(0, Math.min(4, c.tier)), rank = RANK[tier];
    var best = c.career && c.career.bestTier > tier ? c.career.bestTier : tier;
    return Promise.all([loadManifest(), heroArt(c), document.fonts ? document.fonts.load('24px DotGothic16') : null]).then(function (r) {
      var m = r[0], art = r[1];
      var bgSrc = m.backgrounds && (m.backgrounds[c.job] || m.backgrounds['default']);
      var frSrc = m.frames && m.frames[rank.name];
      return Promise.all([loadImage(bgSrc ? '/cards/' + bgSrc : null), loadImage(frSrc ? '/cards/' + frSrc : null)]).then(function (imgs) {
        var bg = imgs[0], frame = imgs[1];
        // Card body.
        var grad = g.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#0e3a22'); grad.addColorStop(1, '#020a06');
        g.fillStyle = grad; g.fillRect(0, 0, W, H);
        // Art window: background, then art or sprite.
        g.save(); g.beginPath(); g.rect(ART.x, ART.y, ART.w, ART.h); g.clip();
        if (bg) cover(g, bg, ART);
        else {
          var sky = JOB_SKY[c.job] || JOB_SKY.fighter, sg = g.createLinearGradient(0, ART.y, 0, ART.y + ART.h);
          sg.addColorStop(0, sky[0]); sg.addColorStop(1, sky[1]); g.fillStyle = sg; g.fillRect(ART.x, ART.y, ART.w, ART.h);
          // Falling code, the game's signature.
          var seed = 0; for (var i = 0; i < c.id.length; i++) seed = (seed * 31 + c.id.charCodeAt(i)) >>> 0;
          g.font = '18px DotGothic16, monospace'; g.textAlign = 'left';
          for (var col = 0; col < 24; col++) {
            seed = (seed * 1103515245 + 12345) >>> 0;
            var x = ART.x + col * 23, len = 3 + seed % 8, y0 = ART.y + (seed >> 8) % ART.h;
            for (var k = 0; k < len; k++) { g.fillStyle = 'rgba(125,255,154,' + (0.08 + 0.3 * k / len) + ')'; g.fillText('01アイウエオカキクケ'.charAt((seed >> k) % 10), x, y0 + k * 20 - 100); }
          }
          g.fillStyle = 'rgba(2,8,6,.35)'; g.fillRect(ART.x, ART.y + ART.h - 40, ART.w, 40);
        }
        if (art) cover(g, art, ART);
        else {
          var sprite = G.heroCanvas(c, 'victory', 6, false); // 42 x 54 → 252 x 324
          g.drawImage(sprite, ART.x + (ART.w - sprite.width) / 2, ART.y + ART.h - sprite.height - 12);
        }
        g.restore();
        // Frame: community art for this rank, or one drawn in the rank's colours.
        if (frame) g.drawImage(frame, 0, 0, W, H);
        else {
          g.lineWidth = 12; g.strokeStyle = rank.c; g.strokeRect(6, 6, W - 12, H - 12);
          g.lineWidth = 6; g.strokeStyle = rank.a; g.strokeRect(12, 12, W - 24, H - 24);
          g.lineWidth = 3; g.strokeStyle = rank.b; g.strokeRect(18, 18, W - 36, H - 36);
          g.lineWidth = 4; g.strokeStyle = rank.b; g.strokeRect(ART.x - 2, ART.y - 2, ART.w + 4, ART.h + 4);
          if (tier >= 3) { g.fillStyle = rank.b; [[24, 24], [W - 36, 24], [24, H - 36], [W - 36, H - 36]].forEach(function (p) { g.fillRect(p[0], p[1], 12, 12); }); }
        }
        // Header: name and level.
        text(g, fit(g, c.name, 400, 40), 36, 72, 40, '#ffffff');
        text(g, G.t('level') + ' ' + c.level, W - 36, 72, 30, '#ffe090', 'right');
        // Title, rank and trust under the art.
        var ty = ART.y + ART.h + 44;
        text(g, fit(g, G.title(c.title) + ' · ' + G.t('rank') + ' ' + tier + (best > tier ? ' (' + G.t('bestRank', { n: best }) + ')' : ''), 520, 26), 36, ty, 26, rank.b);
        text(g, G.t('trust') + ' ' + G.stars(c.trust) + '  ' + Math.round(c.trust * 100) + '%', 36, ty + 40, 24, '#e8ffe8');
        // Career.
        var k = c.career || { wins: 0, losses: 0, guilds: 1, byType: {} };
        text(g, G.t('cardRecord', { won: k.wins, lost: k.losses, guilds: k.guilds }), 36, ty + 80, 22, '#e8ffe8');
        var types = Object.keys(k.byType || {}).map(function (t) { return [t, k.byType[t].won]; }).filter(function (p) { return p[1] > 0; })
          .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 3);
        if (types.length) text(g, fit(g, types.map(function (p) { return G.type(p[0].charAt(0).toUpperCase() + p[0].slice(1)) + ' ×' + p[1]; }).join('   '), 528, 22), 36, ty + 116, 22, '#7dff9a');
        // Skills.
        var sy = ty + 160;
        text(g, G.t('cardSkills'), 36, sy, 20, '#ffe090');
        (c.skills || []).slice(-3).reverse().forEach(function (s, i) { text(g, fit(g, '• ' + s, 528, 18), 36, sy + 30 + i * 26, 18, '#e8ffe8'); });
        if (!(c.skills || []).length) text(g, G.t('cardNoSkills'), 36, sy + 30, 18, '#748a7a');
        // Proof and credit.
        var proof = c.proofCount ? G.t('cardProof', { n: c.proofCount }) + (c.proof[0] && c.proof[0].repo ? ' · ' + c.proof[0].repo.replace(/^https:\/\//, '') : '') : G.t('cardNoProof');
        text(g, fit(g, proof, 528, 16), 36, H - 62, 16, '#a8b4c8');
        text(g, 'Fantasy Code RPG · npx fantasy-code-rpg', W - 36, H - 34, 16, '#7dff9a', 'right');
        if (c.veteran) text(g, G.t('cardVeteran'), 36, H - 34, 16, '#ffe090');
        return cv;
      });
    });
  };

  // ---- The hero inside the PNG: a tEXt chunk "fcrpg-hero" holding base64 JSON ----
  var CRC = (function () { var t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { var c = 0xffffffff; for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  function u32(n) { return [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255]; }
  /** PNG bytes with a text chunk inserted before IEND. */
  G.pngWithText = function (pngBytes, key, value) {
    var data = []; for (var i = 0; i < key.length; i++) data.push(key.charCodeAt(i)); data.push(0);
    for (var j = 0; j < value.length; j++) data.push(value.charCodeAt(j) & 255);
    var typed = [116, 69, 88, 116].concat(data); // "tEXt"
    var chunk = u32(data.length).concat(typed, u32(crc32(typed)));
    var end = pngBytes.length - 12; // IEND is the last 12 bytes
    var out = new Uint8Array(pngBytes.length + chunk.length);
    out.set(pngBytes.subarray(0, end), 0); out.set(chunk, end); out.set(pngBytes.subarray(end), end + chunk.length);
    return out;
  };
  G.toBase64 = function (s) { return btoa(unescape(encodeURIComponent(s))); };
  G.bytesToBase64 = function (bytes) { var s = ''; for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };

  /** Save a hero's card as a PNG (carrying the hero) and copy it. */
  G.shareCard = function (c) {
    return Promise.all([G.cardCanvas(c), G.cmd('heroExport', { id: c.id })]).then(function (r) {
      var cv = r[0], data = r[1].hero;
      return new Promise(function (resolve) { cv.toBlob(resolve, 'image/png'); }).then(function (blob) { return blob.arrayBuffer(); }).then(function (buf) {
        var bytes = G.pngWithText(new Uint8Array(buf), 'fcrpg-hero', G.toBase64(JSON.stringify(data)));
        var file = new Blob([bytes], { type: 'image/png' });
        var name = c.name.replace(/[^\w-]+/g, '-') + '.hero.png';
        var a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        var copied = navigator.clipboard && window.ClipboardItem
          ? navigator.clipboard.write([new ClipboardItem({ 'image/png': file })]).then(function () { return true; }, function () { return false; }) : Promise.resolve(false);
        return copied.then(function (ok) { G.toast(G.t('cardSaved', { file: name }) + (ok ? ' ' + G.t('snapCopied') : '')); });
      });
    });
  };
})();
