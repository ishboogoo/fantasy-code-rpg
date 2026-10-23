// The Battlefield: the live battle, drawn from the event stream.
(function () {
  var t = G.t, el = G.el;

  G.scenes.battle = function () {
    var root = G.sceneEl;
    var ground = el('div'); ground.style.cssText = 'position:absolute;left:0;top:400px;width:1152px;height:248px;background-color:#04100a;background-image:linear-gradient(#1f8a3c 3px,transparent 3px),linear-gradient(90deg,#145a2c 3px,transparent 3px);background-size:48px 24px;border-top:3px solid #7dff9a';
    root.appendChild(ground);
    var foeHolder = el('div'); foeHolder.style.cssText = 'position:absolute;left:120px;top:150px'; root.appendChild(foeHolder);
    var heroes = el('div'); heroes.style.cssText = 'position:absolute;right:60px;top:200px;display:flex;gap:18px;align-items:flex-end'; root.appendChild(heroes);
    var quest = G.win(12, 12, 560); quest.innerHTML = '<div class="h1"></div><div class="quiet"></div><div style="display:flex;gap:4px;margin-top:6px"></div>';
    var gold = G.win(1012, 12, 128); gold.innerHTML = '<span class="gold"></span> G'; gold.firstChild.textContent = G.state.treasury.gold;
    var banner = G.win(0, 96, null, null); banner.style.cssText += ';left:50%;transform:translateX(-50%);font-size:24px;opacity:0;transition:opacity .25s;white-space:nowrap';
    var party = G.win(12, 440, 660, 196); party.style.display = 'flex'; party.style.flexDirection = 'column'; party.style.gap = '6px';
    var log = G.win(684, 440, 456, 196); log.style.cssText += ';display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden';
    log.setAttribute('aria-live', 'polite');
    var hint = el('div', 'quiet', t('keys')); hint.style.cssText = 'position:absolute;right:16px;top:84px;font-size:13px;text-shadow:2px 2px 0 #020806'; root.appendChild(hint);

    var b = null; // the battle on screen
    var VIT_HP = 5;   // a hero's HP: tries left this battle (a Gatekeeper block or an error costs one)
    function say(text, cls) { var d = el('div', cls || '', text); d.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; log.appendChild(d); while (log.children.length > 8) log.removeChild(log.firstChild); }
    var bt;
    function flash(text) { banner.textContent = text; banner.style.opacity = 1; clearTimeout(bt); bt = setTimeout(function () { banner.style.opacity = 0; }, 1800); }
    function pop(text, cls, x, y) { var p = el('div', 'pop' + (cls ? ' ' + cls : ''), text); p.style.left = (x || 300) + 'px'; p.style.top = (y || 200) + 'px'; root.appendChild(p); setTimeout(function () { p.remove(); }, 1500); }
    function anim(node, cls, ms) { if (!node) return; node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); setTimeout(function () { node.classList.remove(cls); }, ms || 500); }
    function spark(x, y, cls) {
      for (var i = 0; i < 8; i++) {
        var s = el('i', 'spark' + (cls ? ' ' + cls : '')); var a = i / 8 * Math.PI * 2;
        s.style.left = x + 'px'; s.style.top = y + 'px';
        s.style.setProperty('--dx', Math.round(Math.cos(a) * (28 + (i % 3) * 10)) + 'px'); s.style.setProperty('--dy', Math.round(Math.sin(a) * (28 + (i % 3) * 10)) + 'px');
        root.appendChild(s); setTimeout(function (n) { return function () { n.remove(); }; }(s), 600);
      }
    }
    var foeEl = null;
    function drawQuest(q, hp, maxHp) {
      quest.children[0].textContent = q ? q.name : t('noBattle');
      quest.children[1].textContent = q ? G.type(q.type || q.questType) + ' · ' + q.kind + ' · Lv ' + q.level : '';
      drawHpBar(hp, maxHp);
      foeHolder.innerHTML = ''; foeEl = null;
      if (q) { foeEl = el('div', 'foe'); foeEl.appendChild(G.foeCanvas(q, 3)); foeHolder.appendChild(foeEl); }
    }
    function drawHpBar(hp, maxHp) {
      var bar = quest.children[2]; bar.innerHTML = '';
      for (var i = 0; i < (maxHp || 0); i++) { var s = el('i'); s.style.cssText = 'width:28px;height:12px;border:3px solid #020806;transition:background .4s;background:' + (i < hp ? '#ff9a70' : '#1a1428'); bar.appendChild(s); }
    }
    // Heroes on the field: one element each, so animations don't rebuild the scene.
    var heroEls = {};
    function drawHeroes(pose) {
      heroes.innerHTML = ''; heroEls = {};
      (b ? b.party : []).forEach(function (id) {
        var c = G.hero(id); if (!c) return;
        var w = el('div', 'hero');
        var cv = G.heroCanvas(c, pose || 'idle', 3, true); w.appendChild(cv);
        var bubble = el('div', 'bubble'); w.appendChild(bubble);
        w.appendChild(el('div', 'tag', c.name)); heroes.appendChild(w);
        heroEls[id] = { w: w, cv: cv, bubble: bubble, c: c };
      });
    }
    function setPose(id, pose) { var h = heroEls[id]; if (!h) return; var cv = G.heroCanvas(h.c, pose, 3, true); h.w.replaceChild(cv, h.cv); h.cv = cv; }
    function heroXY(id) { var h = heroEls[id]; if (!h) return [900, 260]; var r = h.w.getBoundingClientRect(), rr = root.getBoundingClientRect(), k = rr.width / 1152; return [(r.left - rr.left) / k + 20, (r.top - rr.top) / k + 10]; }
    function foeXY() { return [210 + Math.random() * 60, 230 + Math.random() * 60]; }
    function think(id, on, ask) { var h = heroEls[id]; if (!h) return; h.w.classList.toggle('thinking', !!on); h.w.classList.toggle('asking', !!ask); h.bubble.textContent = ask ? '?' : '…'; }

    // Party panel: HP (tries left) and MP (turns left) for every hero.
    var rows = {};
    function vit(id) { b.vit = b.vit || {}; return b.vit[id] = b.vit[id] || { hp: VIT_HP, mp: b.maxTurns || 20 }; }
    function drawParty() {
      party.innerHTML = ''; rows = {};
      var list = (b ? b.party : G.state.party.slice(0, 3)).map(G.hero).filter(Boolean);
      list.forEach(function (c) {
        var row = el('div'); row.style.cssText = 'display:grid;grid-template-columns:72px 150px 1fr 1fr;align-items:center;gap:10px';
        row.appendChild(G.portraitCanvas(c));
        var n = el('div'); n.innerHTML = '<div class="h1"></div><div class="quiet"></div>'; n.children[0].textContent = c.name; n.children[1].textContent = G.title(c.title) + ' · ' + t('level') + ' ' + c.level;
        row.appendChild(n);
        var hp = el('div'); hp.innerHTML = '<div class="quiet"></div><div class="bar hp"><b></b></div>'; row.appendChild(hp);
        var mp = el('div'); mp.innerHTML = '<div class="quiet"></div><div class="bar"><b></b></div>'; row.appendChild(mp);
        party.appendChild(row); rows[c.id] = { hp: hp, mp: mp, row: row };
        drawVitals(c.id);
      });
    }
    function drawVitals(id) {
      var r = rows[id]; if (!r) return;
      var v = b ? vit(id) : { hp: VIT_HP, mp: 20 }, max = b ? (b.maxTurns || 20) : 20;
      r.hp.children[0].textContent = t('hp') + ' ' + v.hp + '/' + VIT_HP; r.hp.querySelector('b').style.width = (100 * v.hp / VIT_HP) + '%';
      r.mp.children[0].textContent = t('mp') + ' ' + v.mp + '/' + max; r.mp.querySelector('b').style.width = (100 * v.mp / max) + '%';
    }
    function hurtHero(id, live) {
      var v = vit(id); v.hp = Math.max(0, v.hp - 1); drawVitals(id);
      if (live) { var xy = heroXY(id); pop('-1', 'hurt', xy[0], xy[1]); anim(heroEls[id] && heroEls[id].w, 'knock', 450); anim(rows[id] && rows[id].row, 'blink', 600); }
    }
    drawQuest(null, 0, 0); drawParty();

    var off = G.onEvent(function (e) {
      var live = !e.replay;
      if (e.type === 'battle_start') {
        b = { id: e.battle, q: e.quest, party: e.party, hp: e.quest.hp, maxHp: e.quest.maxHp, copies: {}, vit: {} };
        G.refresh().then(function () { drawParty(); drawHeroes(); });
        drawQuest(e.quest, e.quest.hp, e.quest.maxHp); drawHeroes(); if (live) { flash(t('appears', { name: e.quest.name })); anim(foeEl, 'enter', 700); }
      } else if (!b) {
        return;
      } else if (e.type === 'turn_limit') {
        b.maxTurns = e.maxTurns; Object.keys(b.vit).forEach(function (id) { b.vit[id].mp = Math.min(b.vit[id].mp, e.maxTurns); }); b.party.forEach(function (id) { vit(id).mp = e.maxTurns; drawVitals(id); });
      } else if (e.type === 'turn') {
        think(e.hero, true); var c = G.hero(e.hero); if (c) say(t('acts', { who: c.name }));
      } else if (e.type === 'action') {
        var h = G.hero(e.hero), who = h ? h.name : e.hero;
        var v = vit(e.hero); v.mp = Math.max(0, v.mp - 1); drawVitals(e.hero);
        if (e.allowed === false) {
          if (live) { flash(t('blocks', { who: who })); var hx = heroXY(e.hero); spark(hx[0] + 30, hx[1] + 60, 'shield'); }
          say('🛡 ' + who + ': ' + (e.reason || ''), 'gold'); hurtHero(e.hero, live); return;
        }
        var line = G.say(who, e.move, e.target); if (live) flash(line); say(line);
        if (live && heroEls[e.hero]) {
          setPose(e.hero, 'attack'); anim(heroEls[e.hero].w, 'lunge', 520); setTimeout(function () { setPose(e.hero, 'idle'); }, 520);
          setTimeout(function () { var f = foeXY(); spark(f[0], f[1], e.move === 'SCAN' || e.move === 'SCRY' ? 'scan' : ''); anim(foeEl, e.move === 'SCAN' || e.move === 'SCRY' ? 'peek' : 'hit', 360); }, 220);
        }
      } else if (e.type === 'ask') {
        think(e.hero, true, true); var ah = G.hero(e.hero); if (live) flash('🛡 ' + t('asks', { who: ah ? ah.name : e.hero }));
      } else if (e.type === 'answer') {
        think(e.hero, true, false);
        if (e.decision === 'deny' || e.expired) hurtHero(e.hero, live); // a refused or unanswered ask is a blocked try
      } else if (e.type === 'turn_end') {
        think(e.hero, false);
      } else if (e.type === 'save_point') {
        say('💾 ' + t('savePoint') + ' ' + e.sha, 'label');
        if (live) { var sx = heroXY(e.hero); pop('💾', 'save', sx[0] + 10, sx[1] - 20); }
      } else if (e.type === 'progress') {
        // The enemy's HP is the best copy's: in a Pincer, whichever approach is ahead.
        b.copies[e.copy] = e.hp;
        var best = Math.min.apply(null, Object.keys(b.copies).map(function (k) { return b.copies[k]; }));
        var d = best - b.hp; b.hp = best; drawHpBar(best, e.maxHp);
        if (d < 0) { if (live) { pop('-' + (-d) + ' HP'); anim(foeEl, 'hurt', 600); } say(t('dmg', { name: b.q.name, n: -d }), 'gold'); }
        else if (d > 0) { if (live) { pop('+' + d + ' HP', 'heal'); anim(foeEl, 'healing', 900); flash(t('heals', { name: b.q.name })); } say(t('healsWhy', { name: b.q.name, n: d }), 'label'); }
      } else if (e.type === 'rally') {
        // The helper the Council called joins the field and the party panel.
        if (e.hero && b.party.indexOf(e.hero) < 0) { b.party.push(e.hero); drawHeroes(); drawParty(); }
        if (live) { anim(foeEl, 'rally', 1200); flash(t('rally', { name: b.q.name })); }
        say(t('rally', { name: b.q.name }), 'label');
      } else if (e.type === 'verdict') {
        var dmg = b.hp - e.hp; b.hp = e.hp; drawHpBar(e.hp, e.maxHp);
        if (live) { if (dmg > 0) { pop('-' + dmg + ' HP'); anim(foeEl, 'hurt', 600); } else if (e.outcome !== 'victory') pop('MISS', 'miss'); }
        say(t('judgedBy', { who: e.judgedBy, outcome: e.outcome.toUpperCase() }), e.outcome === 'victory' ? 'gold' : '');
        b.party.forEach(function (id) { think(id, false); });
        if (e.outcome === 'victory') { drawHeroes('victory'); if (live) { flash(t('victory')); anim(foeEl, 'defeat', 1600); setTimeout(function () { if (foeEl) foeEl.style.opacity = 0; }, 1500); } else if (foeEl) foeEl.style.opacity = 0; }
      } else if (e.type === 'battle_end') {
        b.party.forEach(function (id) { think(id, false); });
        Object.keys(e.xp || {}).forEach(function (id) { var c = G.hero(id); if (c && e.xp[id]) say(c.name + ' +' + e.xp[id] + ' EXP', 'gold'); });
        (e.promotions || []).forEach(function (id) { var c = G.hero(id); flash(t('promoted', { who: c ? c.name : id })); });
        if (live && e.review === 'pending') setTimeout(function () { if (G.current() === 'battle') G.go('vault'); }, 2400);
      } else if (e.type === 'say' && /✖/.test(e.text || '')) {
        say(e.text, 'quiet');
        var m = /^\s*✖/.test(e.text) && b.last; if (m) hurtHero(m, live);
      } else if (e.type === 'say' && /Treasure Vault|thrown away|Not a git|📖|🤝/.test(e.text || '')) {
        say(e.text, 'quiet');
      }
      if (e.type === 'turn') b.last = e.hero;
    }, true);
    G.cleanup(off);
    // (registered with replay: the latest battle is redrawn when you walk in mid-fight)
    G.onKey(function (e) { if (e.key === 'v' || e.key === 'V') { G.go('vault'); return true; } return false; });
  };
})();
