// Shared plumbing for every scene: the stage, the code rain, the server API,
// the live event stream, sprites from the shared generators, windows, menus and words.
(function () {
  var G = window.G = {};
  var T = new URLSearchParams(location.search).get('t');
  var stage = document.getElementById('stage');
  G.stage = stage;
  G.sceneEl = document.getElementById('scene');

  // ---- Fit the 1152 x 648 stage to the window at any size ----
  function fit() { var k = Math.min(innerWidth / 1152, innerHeight / 648); stage.style.transform = 'translate(-50%, -50%) scale(' + k + ')'; }
  addEventListener('resize', fit); fit();

  // ---- Local preferences (per browser; game settings live on the server) ----
  G.pref = function (k, v) {
    try { if (v === undefined) return localStorage.getItem('fcr.' + k); localStorage.setItem('fcr.' + k, v); } catch (e) { return null; }
  };
  G.applyPrefs = function () {
    document.body.classList.toggle('classic', G.pref('window') === 'classic');
    document.body.classList.toggle('reduce', G.pref('reduce') === 'on' || matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  G.applyPrefs();

  // ---- Words ----
  G.lang = function () { return (G.state && G.state.settings && G.state.settings.language) || 'en'; };
  G.t = function (key, vars) {
    var d = I18N[G.lang()] || I18N.en;
    var s = key.split('.').reduce(function (o, k) { return o && o[k]; }, d);
    if (s === undefined) s = key.split('.').reduce(function (o, k) { return o && o[k]; }, I18N.en);
    if (typeof s !== 'string') return s;
    return s.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? vars[k] : ''; });
  };
  G.say = function (who, move, target) {
    var m = G.t('moves.' + move) || G.t('moves.USE');
    return G.lang() === 'ja' ? who + m + ' ' + target : who + ' ' + m + ' ' + target;
  };

  // ---- Code rain at native resolution ----
  var rc = document.getElementById('rain'), rx = rc.getContext('2d');
  var RUNES = [[7,5,7,4,7],[2,7,2,2,7],[5,2,7,2,5],[7,1,3,1,7],[4,6,5,4,4],[1,7,5,7,4],[6,5,6,5,6],[7,2,2,2,2],[5,5,7,1,1],[3,4,2,1,6]];
  var cols = [];
  for (var i = 0; i < 70; i++) {
    var c = { x: Math.floor(Math.random() * 96) * 4, y: Math.random() * 260 - 40, v: .25 + Math.random() * .6, len: 4 + Math.floor(Math.random() * 14), g: [] };
    for (var k = 0; k < 24; k++) c.g.push(RUNES[Math.floor(Math.random() * RUNES.length)]);
    cols.push(c);
  }
  G.rainPace = 1;
  function rain() {
    rx.clearRect(0, 0, 384, 216);
    cols.forEach(function (c) {
      c.y += c.v * G.rainPace; if (c.y - c.len * 6 > 216) { c.y = -6; c.x = Math.floor(Math.random() * 96) * 4; }
      for (var k = 0; k < c.len; k++) {
        var gy = Math.floor(c.y) - k * 6; if (gy < -5 || gy > 216) continue;
        rx.fillStyle = k === 0 ? '#e8ffe8' : k < 3 ? '#7dff9a' : k < c.len * .6 ? '#1f8a3c' : '#145a2c';
        var g = c.g[k % c.g.length];
        for (var r = 0; r < 5; r++) for (var b = 0; b < 3; b++) if (g[r] & (4 >> b)) rx.fillRect(c.x + b, gy + r, 1, 1);
      }
    });
    if (!document.body.classList.contains('reduce')) requestAnimationFrame(rain); else setTimeout(rain, 1000);
  }
  rain();
  G.showRain = function (on) { rc.style.display = on ? 'block' : 'none'; };

  // ---- Server ----
  G.api = function (path, body) {
    var opts = { headers: { 'x-savepoint-token': T, 'content-type': 'application/json' } };
    if (body) { opts.method = 'POST'; opts.body = JSON.stringify(body); }
    return fetch(path, opts).then(function (r) { return r.json(); });
  };
  G.cmd = function (cmd, extra) {
    var b = Object.assign({ cmd: cmd }, extra || {});
    return G.api('/api/cmd', b).then(function (r) { if (!r.ok) { G.toast(r.message, true); throw new Error(r.message); } return r; });
  };
  G.refresh = function () { return G.api('/api/state').then(function (s) { G.state = s; return s; }); };
  G.hero = function (id) { return G.state && G.state.party.filter(function (c) { return c.id === id; })[0]; };
  G.quest = function (id) { return G.state && G.state.quests.filter(function (q) { return q.id === id; })[0]; };

  // ---- Live events: every scene can listen ----
  var listeners = [], recent = [];
  /** Listen to live events. With replayLastBattle, first replay everything since the latest battle began. */
  G.onEvent = function (fn, replayLastBattle) {
    if (replayLastBattle) {
      var from = -1; recent.forEach(function (e, i) { if (e.type === 'battle_start') from = i; });
      if (from >= 0) recent.slice(from).forEach(function (e) { fn(Object.assign({}, e, { replay: true })); });
    }
    listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  };
  G.connect = function () {
    var es = new EventSource('/api/events?t=' + T);
    var replaying = true; setTimeout(function () { replaying = false; }, 600);
    es.onmessage = function (m) {
      var e; try { e = JSON.parse(m.data); } catch (err) { return; }
      recent.push(e); if (recent.length > 200) recent.shift();
      e.replay = replaying; listeners.forEach(function (f) { f(e); });
    };
  };

  // ---- Sprites ----
  var RACES = ['human', 'elf', 'dwarf', 'beastkin', 'lizardfolk', 'demonkin', 'automaton', 'fae'];
  G.RACES = RACES;
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  G.look = function (c) { var h = hash(c.id); return { race: (c.look && c.look.race) || RACES[h % RACES.length], build: (c.look && c.look.build) || ((h >> 3) % 2 ? 'feminine' : 'masculine') }; };
  G.paint = function (canvas, sprite, k, flip) {
    canvas.width = sprite.W * k; canvas.height = sprite.H * k;
    var x = canvas.getContext('2d');
    for (var y = 0; y < sprite.H; y++) for (var i = 0; i < sprite.W; i++) {
      var col = sprite.grid[y] && sprite.grid[y][i]; if (!col) continue;
      x.fillStyle = col; x.fillRect((flip ? sprite.W - 1 - i : i) * k, y * k, k, k);
    }
    return canvas;
  };
  G.heroCanvas = function (c, pose, k, flip) {
    var l = G.look(c);
    return G.paint(G.el('canvas', 'px'), hero2({ job: c.job, tier: c.tier, seed: c.id, adapter: c.adapter, race: l.race, build: l.build, pose: pose || 'idle', cursed: (c.status || []).indexOf('cursed') >= 0 }), k || 3, flip);
  };
  G.portraitCanvas = function (c) {
    var l = G.look(c);
    var cv = G.paint(G.el('canvas', 'px portrait'), portrait({ job: c.job, tier: c.tier, seed: c.id, adapter: c.adapter, race: l.race, build: l.build, mood: 'determined', age: 'adult', turn: '-1', gaze: 'ahead', facial: 'none', gear: 'none' }), 1);
    cv.setAttribute('aria-label', c.name);
    return cv;
  };
  G.foeCanvas = function (q, k) { return G.paint(G.el('canvas', 'px'), foe2({ kind: q.kind, stage: 0, biome: 'ui', seed: q.id }), k || 3, false); };

  // ---- DOM helpers ----
  G.el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  G.win = function (x, y, w, h, cls) {
    var d = G.el('div', 'win' + (cls ? ' ' + cls : ''));
    d.style.left = x + 'px'; d.style.top = y + 'px'; if (w) d.style.width = w + 'px'; if (h) d.style.height = h + 'px';
    G.sceneEl.appendChild(d); return d;
  };
  var toastTimer;
  G.toast = function (text, bad) {
    var t = document.getElementById('toast'); t.textContent = text; t.style.color = bad ? 'var(--red)' : 'var(--white)'; t.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.style.display = 'none'; }, 3200);
  };

  /** A classic RPG menu: ▶ cursor, arrow keys, Enter, mouse. Remembers its cursor if given a memory key. */
  var activeMenu = null;
  G.menu = function (parent, items, opts) {
    opts = opts || {};
    var box = G.el('div', 'menu' + (opts.row ? ' row' : '') + (opts.small ? ' small' : ''));
    var buttons = items.map(function (it, i) {
      var b = G.el('button', '', it.label); b.type = 'button';
      if (it.disabled) b.disabled = true;
      b.addEventListener('mousemove', function () { if (!it.disabled && cur !== i) select(i); });
      b.addEventListener('click', function () { if (!it.disabled) { select(i); it.action(); } });
      box.appendChild(b); return b;
    });
    var cur = 0;
    if (opts.memory && G.pref('cur.' + opts.memory)) cur = Math.min(+G.pref('cur.' + opts.memory), items.length - 1);
    while (items[cur] && items[cur].disabled && cur < items.length - 1) cur++;
    function select(i) { cur = i; buttons.forEach(function (b, j) { b.classList.toggle('sel', j === i); }); if (opts.memory) G.pref('cur.' + opts.memory, i); }
    select(cur);
    var m = {
      el: box,
      key: function (e) {
        var next = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (next) { var j = cur; do { j = (j + next + items.length) % items.length; } while (items[j].disabled && j !== cur); select(j); e.preventDefault(); return true; }
        if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') { if (!items[cur].disabled) items[cur].action(); e.preventDefault(); return true; }
        return false;
      },
    };
    parent.appendChild(box);
    activeMenu = m;
    return m;
  };
  G.setMenu = function (m) { activeMenu = m; };

  // ---- Scenes and keys ----
  G.scenes = {};
  var current = null, sceneKey = null, cleanups = [];
  G.cleanup = function (fn) { cleanups.push(fn); };
  G.go = function (name, params) {
    cleanups.forEach(function (f) { f(); }); cleanups = [];
    G.sceneEl.innerHTML = ''; activeMenu = null; sceneKey = null;
    current = name; G.showRain(name !== 'title');
    G.pref('scene', name);
    return G.refresh().then(function () { G.scenes[name](params || {}); });
  };
  G.current = function () { return current; };
  G.onKey = function (fn) { sceneKey = fn; };
  addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT')) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (sceneKey && sceneKey(e)) return;
    if (activeMenu && activeMenu.key(e)) return;
    if ((e.key === 'Escape' || e.key === 'x' || e.key === 'X') && current !== 'title') { G.go(current === 'town' ? 'title' : 'town'); e.preventDefault(); }
    if ((e.key === 'b' || e.key === 'B') && current !== 'battle') G.go('battle');
  });

  // ---- Common bits ----
  G.backButton = function (parent) {
    var m = G.menu(parent, [{ label: G.t('toTown'), action: function () { G.go('town'); } }], { small: true });
    return m;
  };
  /** Rank titles and quest types arrive in English from the engine; show them in the chosen language. */
  G.title = function (x) { var d = G.t('titles'); return (d && d[x]) || x; };
  G.type = function (x) { var d = G.t('types'); return (d && d[x]) || x; };
  G.stars = function (trust) { var n = Math.round(trust * 5); return '●●●●●'.slice(0, n) + '○○○○○'.slice(0, 5 - n); };
  G.proofWords = function (p) { return G.t(p === 'command' ? 'proofCommand' : p === 'human' ? 'proofHuman' : 'proofJudge'); };
})();
