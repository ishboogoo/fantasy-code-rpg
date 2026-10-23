// The launch scenes. Each scene builds its own windows inside #scene and
// cleans up after itself. Everything a scene does goes through G.cmd, so the
// browser and the command line share one set of rules.
(function () {
  var S = G.scenes, t = G.t, el = G.el;

  function waiting(s) {
    return {
      counter: s.quests.filter(function (q) { return q.questions.length; }).length,
      warroom: s.quests.filter(function (q) { return !q.approved && !q.questions.length && q.status !== 'defeated'; }).length,
      vault: s.battles.filter(function (b) { return b.review === 'pending'; }).length,
      inn: s.party.filter(function (c) { return c.status.indexOf('resting') >= 0 || (c.mp && c.mp.current <= 0); }).length,
      open: s.quests.filter(function (q) { return q.status !== 'defeated'; }).length,
    };
  }

  // ---------------- Title ----------------
  S.title = function () {
    var img = el('img', 'px'); img.src = '/brand/cover.png'; img.alt = 'Fantasy Code RPG';
    img.style.cssText = 'position:absolute;left:0;top:0;width:1152px;height:648px';
    G.sceneEl.appendChild(img);
    var w = G.win(828, 462, 300);
    var hasGame = G.state.party.length > 0;
    var won = G.state.battles.filter(function (b) { return b.outcome === 'victory'; }).length;
    G.menu(w, [
      { label: t('continue'), disabled: !hasGame, action: function () { G.go('town'); } },
      { label: t('newGame'), action: function () { G.go('tavern', { welcome: true }); } },
      { label: t('settings'), action: function () { G.go('settings', { from: 'title' }); } },
    ], { memory: 'title' });
    if (hasGame) w.appendChild(el('div', 'quiet', won + ' ' + t('chapterOf')));
    var f = el('div', '', t('footer'));
    f.style.cssText = 'position:absolute;left:0;bottom:10px;width:1152px;text-align:center;font-size:16px;color:#e0e8f0;letter-spacing:2px;text-shadow:2px 2px 0 #020806';
    G.sceneEl.appendChild(f);
  };

  // ---------------- Guild Town ----------------
  S.town = function () {
    var s = G.state, wt = waiting(s);
    var cv = el('canvas', 'px'); cv.width = Town.W; cv.height = Town.H;
    cv.style.cssText = 'position:absolute;left:0;top:0;width:1152px;height:648px';
    cv.setAttribute('aria-label', t('town'));
    G.sceneEl.appendChild(cv);
    var ctx = cv.getContext('2d');
    var glow = { counter: wt.counter > 0, warroom: wt.warroom > 0, vault: wt.vault > 0, inn: wt.inn > 0 };
    var tick = 0;
    function draw() { Town.paint(ctx, { waiting: glow, fighting: s.fighting, openQuests: wt.open }, tick++); }
    draw();
    var timer = setInterval(draw, 500); G.cleanup(function () { clearInterval(timer); });
    // Rain falls faster when heroes are busy.
    G.rainPace = s.fighting ? 2.2 : 1; G.cleanup(function () { G.rainPace = 1; });

    var loc = G.win(12, 12, 250); loc.innerHTML = '<div class="h1"></div><div class="quiet"></div>';
    loc.children[0].textContent = t('town');
    loc.children[1].textContent = s.battles.filter(function (b) { return b.outcome === 'victory'; }).length + ' ' + t('chapterOf');
    var gold = G.win(1012, 12, 128); gold.innerHTML = '<span class="gold"></span> ' + t('gold'); gold.firstChild.textContent = s.treasury.gold;
    var info = G.win(300, 12, 680); info.innerHTML = '<div class="h1 gold"></div><div></div><div class="quiet" style="font-size:13px"></div>';

    var status = {
      counter: wt.counter ? t('counterWait', { n: wt.counter }) : t('counterIdle'),
      board: wt.open ? t('boardOpen', { n: wt.open }) : t('boardIdle'),
      warroom: wt.warroom ? t('warroomWait', { n: wt.warroom }) : t('warroomIdle'),
      gate: s.fighting ? t('gateBusy') : t('gateIdle'),
      vault: wt.vault ? t('vaultWait', { n: wt.vault }) : t('vaultIdle'),
      library: t('libraryIdle'),
      tavern: s.party.length ? t('tavernIdle', { n: s.party.length }) : t('tavernEmpty'),
      inn: wt.inn ? t('innWait', { n: wt.inn }) : t('innIdle'),
    };
    var targets = { counter: 'counter', board: 'board', warroom: 'warroom', gate: 'battle', vault: 'vault', library: 'library', tavern: 'tavern', inn: 'inn' };
    var plates = {}, cursor = el('div', 'cursor', '▼');
    G.sceneEl.appendChild(cursor);
    Town.buildings.forEach(function (b) {
      var p = el('div', 'plate');
      var waitingHere = (b.id === 'counter' && wt.counter) || (b.id === 'warroom' && wt.warroom) || (b.id === 'vault' && wt.vault) || (b.id === 'inn' && wt.inn) || (b.id === 'gate' && s.fighting);
      p.textContent = (waitingHere ? '● ' : '') + t(b.id);
      p.style.left = (b.x + b.w / 2) * 3 + 'px';
      p.style.top = (b.plate === 'below' ? (b.y + b.h + 3) * 3 : (b.y - 9) * 3) + 'px';
      G.sceneEl.appendChild(p); plates[b.id] = p;
      // Click a building to enter.
      var hit = el('div'); hit.style.cssText = 'position:absolute;cursor:pointer;left:' + b.x * 3 + 'px;top:' + b.y * 3 + 'px;width:' + b.w * 3 + 'px;height:' + b.h * 3 + 'px';
      hit.addEventListener('mousemove', function () { if (Town.buildings[cur] !== b) select(Town.buildings.indexOf(b)); });
      hit.addEventListener('click', function () { G.go(targets[b.id]); });
      G.sceneEl.appendChild(hit);
    });
    var cur = Math.max(0, +(G.pref('cur.town') || 0));
    function select(i) {
      cur = i; G.pref('cur.town', i);
      var b = Town.buildings[i];
      Object.keys(plates).forEach(function (k) { plates[k].classList.toggle('sel', k === b.id); });
      cursor.style.left = (b.x + b.w / 2) * 3 + 'px'; cursor.style.top = Math.max(84, (b.y - 14) * 3 - (b.plate === 'above' ? 30 : 0)) + 'px';
      info.children[0].textContent = t(b.id); info.children[1].textContent = status[b.id]; info.children[2].textContent = t('keys');
    }
    select(cur);
    G.onKey(function (e) {
      var n = Town.buildings.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { select((cur + 1) % n); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { select((cur - 1 + n) % n); return true; }
      if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') { G.go(targets[Town.buildings[cur].id]); return true; }
      return false;
    });
  };

  // ---------------- Guild Counter (Request) ----------------
  function questCard(parent, q) {
    parent.innerHTML = '';
    var head = el('div', 'h1'); head.textContent = q.name; parent.appendChild(head);
    var meta = el('div', 'quiet'); meta.textContent = G.type(q.type) + ' · ' + q.kind + ' · Lv ' + q.level + ' · ' + t('budget') + ' ' + q.budget + ' G'; parent.appendChild(meta);
    parent.appendChild(el('div', 'label', t('conditions')));
    q.conditions.forEach(function (k) {
      var d = el('div'); d.textContent = (k.met ? '✔ ' : '• ') + k.text; parent.appendChild(d);
      var p = el('div', 'quiet'); p.style.cssText = 'font-size:13px;line-height:18px;padding-left:18px';
      p.textContent = t('provenBy') + ': ' + G.proofWords(k.proof) + (k.check ? ' (' + k.check + ')' : ''); parent.appendChild(p);
    });
  }

  S.counter = function (params) {
    var clerk = { id: 'clerk-of-the-guild', name: 'Clerk', job: 'bard', tier: 3, adapter: 'mock', status: [], look: { race: 'elf', build: 'feminine' } };
    var top = G.win(12, 12, 1128, 112);
    top.style.display = 'flex'; top.style.gap = '16px'; top.style.alignItems = 'center';
    top.appendChild(G.portraitCanvas(clerk));
    var line = el('div', 'h1 typing'); line.textContent = t('clerkHello'); top.appendChild(line);

    var left = G.win(12, 140, 540, 496); left.style.display = 'flex'; left.style.flexDirection = 'column'; left.style.gap = '10px';
    left.appendChild(el('div', 'label', t('yourRequest')));
    var ta = el('textarea'); ta.rows = 6; ta.setAttribute('aria-label', t('yourRequest')); left.appendChild(ta);
    var sendBox = el('div'); left.appendChild(sendBox);
    var right = G.win(568, 140, 572, 496, 'scroll');

    // Questions still open on any quest are listed on the right when nothing else is shown.
    function showOpen() {
      right.innerHTML = '';
      var open = G.state.quests.filter(function (q) { return q.questions.length; });
      if (!open.length) { right.appendChild(el('div', 'quiet', t('counterIdle'))); return; }
      showQuest(open[0]);
    }
    function showQuest(q) {
      right.innerHTML = '';
      var card = el('div'); right.appendChild(card); questCard(card, q);
      if (q.questions.length) {
        right.appendChild(el('div', 'gold', t('clerkQuestions')));
        q.questions.forEach(function (x) { right.appendChild(el('div', '', '? ' + x)); });
        var ans = el('textarea'); ans.rows = 3; ans.setAttribute('aria-label', t('answers')); right.appendChild(ans);
        G.menu(right, [{ label: t('answers'), action: function () {
          if (!ans.value.trim()) return;
          G.cmd('answer', { id: q.id, text: ans.value }).then(function () { return G.refresh(); }).then(function () { showQuest(G.quest(q.id)); });
        } }], { small: true });
        return;
      }
      var items = [];
      if (!q.approved) items.push({ label: t('approve'), action: function () { G.cmd('approve', { id: q.id }).then(function () { return G.refresh(); }).then(function () { showQuest(G.quest(q.id)); }); } });
      items.push({ label: t('toWarRoom'), action: function () { G.go('warroom', { id: q.id }); } });
      items.push({ label: t('toTown'), action: function () { G.go('town'); } });
      G.menu(right, items, { small: true });
    }
    G.menu(sendBox, [
      { label: t('send'), action: function () {
        if (!ta.value.trim()) { ta.focus(); return; }
        line.textContent = t('clerkWorking');
        G.cmd('request', { text: ta.value }).then(function (r) {
          ta.value = ''; return G.refresh().then(function () {
            var q = G.quest(r.quest); line.textContent = q.questions.length ? t('clerkQuestions') : t('clerkDone'); showQuest(q);
          });
        }).catch(function () { line.textContent = t('clerkHello'); });
      } },
      { label: t('toTown'), action: function () { G.go('town'); } },
    ], { small: true, row: true });
    if (params.id && G.quest(params.id)) showQuest(G.quest(params.id)); else showOpen();
    ta.focus();
  };

  // ---------------- Quest Board ----------------
  S.board = function () {
    var head = G.win(12, 12, 1128); head.innerHTML = '<span class="h1"></span> <span class="quiet"></span>';
    head.children[0].textContent = t('board'); head.children[1].textContent = '· ' + t('keys');
    var open = G.state.quests.filter(function (q) { return q.status !== 'defeated'; }).slice(0, 6);
    if (!open.length) {
      var w = G.win(300, 240, 552); w.appendChild(el('div', 'h1', t('noQuests')));
      G.menu(w, [{ label: t('counter'), action: function () { G.go('counter'); } }, { label: t('toTown'), action: function () { G.go('town'); } }], { small: true });
      return;
    }
    var posters = open.map(function (q, i) {
      var p = el('div', 'poster'); p.style.left = 24 + i * 186 + 'px'; p.style.top = (i % 2 ? 120 : 100) + 'px';
      p.appendChild(el('div', 'wanted', t('wanted')));
      var f = G.foeCanvas(q, 2); f.style.maxWidth = '148px'; f.style.maxHeight = '120px'; p.appendChild(f);
      p.appendChild(el('div', '', q.name));
      p.appendChild(el('div', 'tag', q.type + ' · Lv ' + q.level + ' · ' + q.hp + '/' + q.maxHp + ' HP'));
      p.appendChild(el('div', 'tag', q.questions.length ? t('needsAnswer') : !q.approved ? t('needsApproval') : t('open')));
      p.appendChild(el('div', 'tag', t('budget') + ' ' + q.budget + ' G'));
      p.addEventListener('mouseenter', function () { select(i); });
      p.addEventListener('click', function () { openQuest(q); });
      G.sceneEl.appendChild(p); return p;
    });
    function openQuest(q) { G.go(q.questions.length ? 'counter' : 'warroom', { id: q.id }); }
    var cur = 0;
    function select(i) { cur = i; posters.forEach(function (p, j) { p.classList.toggle('sel', j === i); }); }
    select(0);
    var foot = G.win(12, 560, 1128); G.backButton(foot);
    G.onKey(function (e) {
      if (e.key === 'ArrowRight') { select((cur + 1) % open.length); return true; }
      if (e.key === 'ArrowLeft') { select((cur - 1 + open.length) % open.length); return true; }
      if (e.key === 'Enter' || e.key === 'z' || e.key === 'Z') { openQuest(open[cur]); return true; }
      return false;
    });
  };

  // ---------------- War Room (Scout, Plan, Party) ----------------
  S.warroom = function (params) {
    var s = G.state;
    var q = params.id ? G.quest(params.id) : s.quests.filter(function (x) { return x.status !== 'defeated'; })[0];
    if (!q) { G.go('board'); return; }
    var left = G.win(12, 12, 400, 624, 'scroll'); questCard(left, q);
    var mid = G.win(424, 12, 400, 548, 'scroll');
    var right = G.win(836, 12, 304, 548);
    var foot = G.win(424, 572, 716, 64);

    function showPlan(qq) {
      mid.innerHTML = '';
      if (qq.scouting) { mid.appendChild(el('div', 'label', t('scoutReport'))); var sr = el('div'); sr.style.whiteSpace = 'pre-wrap'; sr.textContent = qq.scouting; mid.appendChild(sr); }
      if (qq.plan) { mid.appendChild(el('div', 'label', t('plan'))); var pl = el('div'); pl.style.whiteSpace = 'pre-wrap'; pl.textContent = qq.plan; mid.appendChild(pl); }
      if (!qq.scouting && !qq.plan) mid.appendChild(el('div', 'quiet', t('noPlan')));
      if (qq.questions.length) { mid.appendChild(el('div', 'gold', t('unclear'))); qq.questions.forEach(function (x) { mid.appendChild(el('div', '', '? ' + x)); }); }
    }
    showPlan(q);

    // Party slots: Lead, Support; judges are chosen at the end.
    var picks = { lead: null, support: null }, order = ['lead', 'support'];
    var slotEls = {};
    right.appendChild(el('div', 'label', t('party')));
    order.forEach(function (role) {
      var sl = el('div', 'slot'); sl.setAttribute('role', 'button'); sl.tabIndex = 0;
      sl.addEventListener('click', function () { cycle(role); });
      sl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { cycle(role); e.preventDefault(); } });
      right.appendChild(el('div', 'quiet', t(role))); right.appendChild(sl); slotEls[role] = sl;
    });
    right.appendChild(el('div', 'quiet', t('judge'))); var jn = el('div', '', t('judgeAuto')); jn.style.fontSize = '13px'; jn.style.lineHeight = '18px'; right.appendChild(jn);
    var warn = el('div', 'warn'); warn.style.cssText = 'font-size:13px;line-height:18px;margin-top:8px'; right.appendChild(warn);
    var note = el('div', 'quiet', t('clickToSwap')); note.style.cssText = 'font-size:13px;line-height:18px;margin-top:6px'; right.appendChild(note);

    function drawSlot(role) {
      var sl = slotEls[role]; sl.innerHTML = '';
      var c = picks[role] && G.hero(picks[role]);
      if (!c) { sl.appendChild(el('div', 'quiet', t('none'))); return; }
      sl.appendChild(G.portraitCanvas(c));
      var d = el('div'); d.innerHTML = '<div></div><div class="quiet" style="font-size:13px;line-height:18px"></div>';
      d.children[0].textContent = c.name; d.children[1].textContent = G.title(c.title) + ' · ' + t('poweredBy') + ' ' + c.company;
      sl.appendChild(d);
    }
    function cycle(role) {
      var ids = [null].concat(G.state.party.map(function (c) { return c.id; }));
      if (role === 'lead') ids = ids.slice(1);
      var other = role === 'lead' ? picks.support : picks.lead;
      ids = ids.filter(function (id) { return id === null || id !== other; });
      var i = ids.indexOf(picks[role]);
      picks[role] = ids[(i + 1) % ids.length];
      drawSlot(role); check();
    }
    function check() {
      var list = [];
      if (picks.lead) list.push({ id: picks.lead, role: 'lead' });
      if (picks.support) list.push({ id: picks.support, role: 'support' });
      G.cmd('check', { id: q.id, picks: list }).then(function (r) {
        warn.textContent = r.warnings.filter(function (w) { return !/No judge/.test(w); }).map(function (w) { return '⚠ ' + w; }).join('\n');
        warn.style.whiteSpace = 'pre-wrap';
      }).catch(function () {});
    }
    G.cmd('suggest', { id: q.id }).then(function (r) {
      r.members.forEach(function (m) { if (m.role === 'lead' && !picks.lead) picks.lead = m.id; else if (m.role === 'support' && !picks.support) picks.support = m.id; });
      drawSlot('lead'); drawSlot('support');
      if (!r.councilSure) note.textContent = t('councilUnsure') + ' ' + t('clickToSwap');
      check();
    }).catch(function () { drawSlot('lead'); drawSlot('support'); });

    var items = [];
    items.push({ label: t('scoutPlan'), action: function () {
      mid.innerHTML = ''; mid.appendChild(el('div', 'typing', t('planning')));
      G.cmd('plan', { id: q.id }).then(function (r) {
        return G.refresh().then(function () {
          var qq = G.quest(q.id); showPlan(qq);
          if (r.verdict === 'split') { mid.appendChild(el('div', 'gold', t('split'))); r.splits.forEach(function (x) { mid.appendChild(el('div', '', '• ' + x)); }); }
          if (!qq.approved) G.toast(t('needsApproval'));
        });
      }).catch(function () { showPlan(q); });
    } });
    if (!q.approved) items.push({ label: t('approve'), action: function () { G.cmd('approve', { id: q.id }).then(function () { G.go('warroom', { id: q.id }); }); } });
    items.push({ label: t('depart'), disabled: !q.approved || q.questions.length > 0 || !!s.fighting, action: function () {
      var party = [picks.lead, picks.support].filter(Boolean);
      G.cmd('battle', { id: q.id, party: party }).then(function () { G.go('battle'); });
    } });
    items.push({ label: t('back'), action: function () { G.go('board'); } });
    G.menu(foot, items, { row: true, small: true });
  };

  // ---------------- Treasure Vault (Review) ----------------
  S.vault = function () {
    var pending = G.state.battles.filter(function (b) { return b.review === 'pending'; });
    var w = G.win(176, 60, 800, null, 'scroll'); w.style.maxHeight = '528px';
    w.appendChild(el('div', 'h2', t('vaultTitle')));
    if (!pending.length) { w.appendChild(el('div', 'quiet', t('nothingWaiting'))); G.backButton(w); return; }
    var b = pending[pending.length - 1], q = G.quest(b.quest);
    w.appendChild(el('div', 'h1', q ? q.name : b.quest));
    w.appendChild(el('div', 'quiet', t('judgedBy', { who: b.judgedBy, outcome: b.outcome.toUpperCase() })));
    if (q) q.conditions.forEach(function (k) {
      var waits = b.awaitingYou.indexOf(k.id) >= 0;
      var d = el('div', waits ? 'gold' : ''); d.textContent = (k.met ? '✔ ' : waits ? '? ' : '✖ ') + k.text + ' — ' + G.proofWords(k.proof); w.appendChild(d);
    });
    if (b.awaitingYou.length) w.appendChild(el('div', 'gold', t('onlyYou') + ' ' + b.awaitingYou.length));
    if (b.notes) { var n = el('div', 'quiet'); n.style.fontSize = '13px'; n.style.lineHeight = '18px'; n.textContent = b.notes; w.appendChild(n); }
    w.appendChild(el('div', '', t('vaultExplain')));
    G.menu(w, [
      { label: t('keep'), action: function () { G.cmd('keep', { id: b.id }).then(function (r) { G.toast(r.message); G.go('vault'); }); } },
      { label: t('undo'), action: function () { G.cmd('undo', { id: b.id }).then(function (r) { G.toast(r.message); G.go('vault'); }); } },
      { label: t('later'), action: function () { G.go('town'); } },
    ], { row: true });
  };

  // ---------------- Tavern (recruit) ----------------
  S.tavern = function (params) {
    var list = G.win(12, 12, 560, 624, 'scroll');
    list.appendChild(el('div', 'h1', t('tavern')));
    if (!G.state.party.length) list.appendChild(el('div', 'quiet', t('tavernEmpty')));
    G.state.party.forEach(function (c) {
      var row = el('div'); row.style.cssText = 'display:flex;gap:12px;align-items:center;margin:8px 0';
      row.appendChild(G.portraitCanvas(c));
      var d = el('div'); d.innerHTML = '<div class="h1"></div><div class="quiet"></div><div class="label"></div>';
      d.children[0].textContent = c.name; d.children[1].textContent = G.title(c.title) + ' · ' + t('level') + ' ' + c.level + ' · ' + t('poweredBy') + ' ' + c.company;
      d.children[2].textContent = t('trust') + ' ' + G.stars(c.trust) + ' · ' + c.role;
      row.appendChild(d); list.appendChild(row);
    });
    var form = G.win(584, 12, 556, 624);
    form.appendChild(el('div', 'h1', t('recruit')));
    function field(label, input) { var l = el('label'); l.style.cssText = 'display:grid;grid-template-columns:150px 1fr;align-items:center;margin:8px 0;gap:8px'; l.appendChild(el('span', 'label', label)); l.appendChild(input); form.appendChild(l); return input; }
    var name = field(t('name'), el('input')); name.maxLength = 24;
    var job = field(t('job'), el('select'));
    Object.keys(I18N.en.jobs).forEach(function (k) { var o = el('option', '', t('jobs.' + k) + ' — ' + t('jobHelp.' + k)); o.value = k; job.appendChild(o); });
    var conn = field(t('connection'), el('select'));
    var race = field(t('race'), el('select'));
    G.RACES.forEach(function (r) { var o = el('option', '', t('races.' + r)); o.value = r; race.appendChild(o); });
    var build = field(t('build'), el('select'));
    ['feminine', 'masculine'].forEach(function (b) { var o = el('option', '', t(b)); o.value = b; build.appendChild(o); });
    var preview = el('div'); preview.style.cssText = 'display:flex;gap:16px;align-items:flex-end;justify-content:center;margin:10px 0;min-height:170px'; form.appendChild(preview);
    function drawPreview() {
      preview.innerHTML = '';
      var fake = { id: (name.value || 'hero').toLowerCase(), name: name.value || '?', job: job.value, tier: 0, adapter: conn.value || 'mock', status: [], look: { race: race.value, build: build.value } };
      preview.appendChild(G.portraitCanvas(fake)); preview.appendChild(G.heroCanvas(fake, 'victory', 3, false));
    }
    [name, job, race, build, conn].forEach(function (i) { i.addEventListener('input', drawPreview); i.addEventListener('change', drawPreview); });
    var labels = { 'claude-code': 'Claude Code', codex: 'Codex CLI', 'gemini-cli': 'Gemini CLI', 'anthropic-api': 'Anthropic API', 'openai-compatible': 'OpenAI-compatible API', mock: t('practice') };
    G.api('/api/connections').then(function (have) {
      Object.keys(labels).forEach(function (k) {
        var o = el('option', '', labels[k] + (have[k] ? ' ✓' : ' (' + t('notFound') + ')')); o.value = k; o.disabled = !have[k]; conn.appendChild(o);
      });
      var first = Object.keys(labels).filter(function (k) { return have[k]; })[0]; conn.value = first; drawPreview();
    });
    var actions = el('div'); form.appendChild(actions);
    G.menu(actions, [
      { label: t('recruit'), action: function () {
        if (!name.value.trim()) { name.focus(); return; }
        G.cmd('recruit', { name: name.value, job: job.value, adapter: conn.value, race: race.value, build: build.value })
          .then(function (r) { G.toast(r.message); G.go('tavern'); });
      } },
      { label: t('toTown'), action: function () { G.go('town'); } },
    ], { row: true, small: true });
    drawPreview();
    if (params.welcome) name.focus();
  };

  // ---------------- Inn (MP) ----------------
  S.inn = function () {
    var w = G.win(176, 40, 800, 568, 'scroll');
    w.appendChild(el('div', 'h2', t('inn')));
    G.state.party.forEach(function (c) {
      var row = el('div'); row.style.cssText = 'display:grid;grid-template-columns:72px 200px 1fr;gap:12px;align-items:center;margin:10px 0';
      row.appendChild(G.portraitCanvas(c));
      var n = el('div'); n.innerHTML = '<div class="h1"></div><div class="quiet"></div>'; n.children[0].textContent = c.name; n.children[1].textContent = c.title;
      row.appendChild(n);
      var m = el('div');
      if (c.mp) {
        m.innerHTML = '<div></div><div class="bar"><b></b></div><div class="quiet" style="font-size:13px"></div>';
        m.children[0].textContent = t('mp') + ' ' + c.mp.current + ' / ' + c.mp.max;
        m.querySelector('b').style.width = (100 * c.mp.current / c.mp.max) + '%';
        var left = Math.max(0, c.mp.refillHours - (Date.now() - Date.parse(c.mp.lastRefill)) / 3.6e6);
        m.children[2].textContent = c.mp.current < c.mp.max ? t('refillIn', { h: left.toFixed(1) }) : '';
      } else m.appendChild(el('div', 'quiet', t('payPerUse')));
      row.appendChild(m); w.appendChild(row);
    });
    G.backButton(w);
  };

  // ---------------- Library (Debrief) ----------------
  S.library = function () {
    var a = G.win(12, 12, 560, 300, 'scroll'); a.appendChild(el('div', 'h1', t('lore')));
    if (!G.state.lore.length) a.appendChild(el('div', 'quiet', t('noLore')));
    G.state.lore.forEach(function (l) { a.appendChild(el('div', '', '• ' + l)); });
    var b = G.win(12, 324, 560, 312, 'scroll'); b.appendChild(el('div', 'h1', t('recent')));
    G.state.battles.slice().reverse().slice(0, 12).forEach(function (x) {
      var q = G.quest(x.quest); b.appendChild(el('div', x.outcome === 'victory' ? 'gold' : '', x.outcome.toUpperCase() + ' · ' + (q ? q.name : x.quest) + (x.review ? ' · ' + x.review : '')));
    });
    var c = G.win(584, 12, 556, 624, 'scroll'); c.appendChild(el('div', 'h1', t('council')));
    if (!G.state.council.length) c.appendChild(el('div', 'quiet', t('noCouncil')));
    G.state.council.forEach(function (r) {
      var d = el('div'); d.style.margin = '6px 0';
      d.innerHTML = '<div></div><div class="quiet"></div>';
      d.children[0].textContent = t('kinds.' + r.kind) + ' · ' + t('seats.' + r.seat);
      d.children[1].textContent = t('decided', { n: r.decided }) + (r.judged ? ' · ' + t('right') + ' ' + r.right + '/' + r.judged + ' (' + Math.round(100 * r.right / r.judged) + '%)' : '');
      c.appendChild(d);
    });
    G.backButton(c);
  };

  // ---------------- Settings ----------------
  S.settings = function (params) {
    var w = G.win(176, 40, 800, 568);
    w.appendChild(el('div', 'h2', t('settings')));
    var st = G.state.settings;
    function row(label, options, current, onPick, help) {
      var r = el('div'); r.style.cssText = 'display:grid;grid-template-columns:220px 1fr;align-items:start;margin:12px 0';
      r.appendChild(el('div', 'h1', label));
      var box = el('div'); r.appendChild(box);
      var line = el('div'); line.style.cssText = 'display:flex;gap:18px;flex-wrap:wrap';
      options.forEach(function (o) {
        var b = el('button', '', o.label); b.type = 'button';
        b.style.cssText = 'font:inherit;font-size:24px;background:none;border:0;cursor:pointer;text-shadow:3px 3px 0 #020806;color:' + (o.value === current ? '#ffffff' : '#3a8a5a');
        b.addEventListener('click', function () { onPick(o.value); });
        line.appendChild(b);
      });
      box.appendChild(line);
      if (help) box.appendChild(el('div', 'quiet', help));
      w.appendChild(r);
    }
    row(t('language'), [{ label: 'English', value: 'en' }, { label: '日本語', value: 'ja' }], st.language || 'en',
      function (v) { G.cmd('settings', { language: v }).then(function () { G.go('settings', params); }); });
    row(t('playStyle'), [{ label: t('story'), value: 'story' }, { label: t('adventurer'), value: 'adventurer' }, { label: t('tactician'), value: 'tactician' }], st.playStyle,
      function (v) { G.cmd('settings', { playStyle: v }).then(function () { G.go('settings', params); }); }, t(st.playStyle + 'Help'));
    row(t('windowStyle'), [{ label: t('code'), value: 'code' }, { label: t('classic'), value: 'classic' }], G.pref('window') || 'code',
      function (v) { G.pref('window', v); G.applyPrefs(); G.go('settings', params); });
    row(t('reduceMotion'), [{ label: t('on'), value: 'on' }, { label: t('off'), value: 'off' }], G.pref('reduce') || 'off',
      function (v) { G.pref('reduce', v); G.applyPrefs(); G.go('settings', params); });
    G.menu(w, [{ label: t('back'), action: function () { G.go(params.from === 'title' ? 'title' : 'town'); } }], { small: true });
  };
})();
