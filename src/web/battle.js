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
    function say(text, cls) { var d = el('div', cls || '', text); d.style.cssText = 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis'; log.appendChild(d); while (log.children.length > 8) log.removeChild(log.firstChild); }
    var bt;
    function flash(text) { banner.textContent = text; banner.style.opacity = 1; clearTimeout(bt); bt = setTimeout(function () { banner.style.opacity = 0; }, 1800); }
    function pop(text, miss) { var p = el('div', 'pop' + (miss ? ' miss' : ''), text); p.style.left = '300px'; p.style.top = (miss ? 220 : 200) + 'px'; root.appendChild(p); setTimeout(function () { p.remove(); }, 1500); }
    function drawQuest(q, hp, maxHp) {
      quest.children[0].textContent = q ? q.name : t('noBattle');
      quest.children[1].textContent = q ? G.type(q.type || q.questType) + ' · ' + q.kind + ' · Lv ' + q.level : '';
      var bar = quest.children[2]; bar.innerHTML = '';
      for (var i = 0; i < (maxHp || 0); i++) { var s = el('i'); s.style.cssText = 'width:28px;height:12px;border:3px solid #020806;background:' + (i < hp ? '#ff9a70' : '#1a1428'); bar.appendChild(s); }
      foeHolder.innerHTML = ''; if (q) foeHolder.appendChild(G.foeCanvas(q, 3));
    }
    function drawHeroes(acting, pose) {
      heroes.innerHTML = '';
      (b ? b.party : []).forEach(function (id) {
        var c = G.hero(id); if (!c) return;
        var w = el('div', 'hero' + (id === acting ? ' acting' : ''));
        w.appendChild(G.heroCanvas(c, id === acting ? 'attack' : pose, 3, true));
        w.appendChild(el('div', 'tag', c.name)); heroes.appendChild(w);
      });
    }
    function drawParty() {
      party.innerHTML = '';
      var list = (b ? b.party : G.state.party.slice(0, 3)).map(G.hero).filter(Boolean);
      list.forEach(function (c) {
        var row = el('div'); row.style.cssText = 'display:grid;grid-template-columns:72px 160px 150px 1fr;align-items:center;gap:10px';
        row.appendChild(G.portraitCanvas(c));
        var n = el('div'); n.innerHTML = '<div class="h1"></div><div class="quiet"></div>'; n.children[0].textContent = c.name; n.children[1].textContent = G.title(c.title) + ' · ' + t('level') + ' ' + c.level;
        row.appendChild(n);
        row.appendChild(el('div', 'label', t('trust') + ' ' + G.stars(c.trust)));
        var m = el('div');
        if (c.mp) { m.innerHTML = '<div class="quiet"></div><div class="bar"><b></b></div>'; m.children[0].textContent = t('mp') + ' ' + c.mp.current + '/' + c.mp.max; m.querySelector('b').style.width = (100 * c.mp.current / c.mp.max) + '%'; }
        else m.appendChild(el('div', 'quiet', t('poweredBy') + ' ' + c.company));
        row.appendChild(m); party.appendChild(row);
      });
    }
    drawQuest(null, 0, 0); drawParty();

    var off = G.onEvent(function (e) {
      if (e.type === 'battle_start') {
        b = { id: e.battle, q: e.quest, party: e.party, hp: e.quest.hp };
        G.refresh().then(function () { drawParty(); drawHeroes(); });
        drawQuest(e.quest, e.quest.hp, e.quest.maxHp); drawHeroes(); flash(t('appears', { name: e.quest.name }));
      } else if (!b) {
        return;
      } else if (e.type === 'turn') {
        drawHeroes(e.hero); var c = G.hero(e.hero); if (c) say(t('acts', { who: c.name }));
      } else if (e.type === 'action') {
        var h = G.hero(e.hero), who = h ? h.name : e.hero;
        if (e.allowed === false) { flash(t('blocks', { who: who })); say('🛡 ' + who + ': ' + (e.reason || ''), 'gold'); return; }
        var line = G.say(who, e.move, e.target); flash(line); say(line);
      } else if (e.type === 'ask') {
        var ah = G.hero(e.hero); flash('🛡 ' + t('asks', { who: ah ? ah.name : e.hero })); drawHeroes(e.hero);
      } else if (e.type === 'save_point') {
        say('💾 ' + t('savePoint') + ' ' + e.sha, 'label');
      } else if (e.type === 'verdict') {
        var dmg = b.hp - e.hp; b.hp = e.hp; drawQuest(b.q, e.hp, e.maxHp);
        if (!e.replay) { if (dmg > 0) pop('-' + dmg + ' HP'); else pop('MISS', true); }
        say(t('judgedBy', { who: e.judgedBy, outcome: e.outcome.toUpperCase() }), e.outcome === 'victory' ? 'gold' : '');
        if (e.outcome === 'victory') { drawHeroes(null, 'victory'); flash(t('victory')); }
      } else if (e.type === 'battle_end') {
        Object.keys(e.xp || {}).forEach(function (id) { var c = G.hero(id); if (c && e.xp[id]) say(c.name + ' +' + e.xp[id] + ' EXP', 'gold'); });
        (e.promotions || []).forEach(function (id) { var c = G.hero(id); flash(t('promoted', { who: c ? c.name : id })); });
        if (!e.replay && e.review === 'pending') setTimeout(function () { if (G.current() === 'battle') G.go('vault'); }, 2400);
      } else if (e.type === 'say' && /✖|Treasure Vault|thrown away|Not a git|📖|🤝/.test(e.text || '')) {
        say(e.text, 'quiet');
      }
    }, true);
    G.cleanup(off);
    // (registered with replay: the latest battle is redrawn when you walk in mid-fight)
    G.onKey(function (e) { if (e.key === 'v' || e.key === 'V') { G.go('vault'); return true; } return false; });
  };
})();
