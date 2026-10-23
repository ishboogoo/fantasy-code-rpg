// Boot: load the world, follow the live events, open the title screen.
(function () {
  G.refresh().then(function () {
    document.documentElement.lang = G.lang();
    G.onEvent(function (e) {
      if (e.replay) return;
      if (e.type === 'battle_start' && G.current() !== 'battle') G.toast(G.t('battleBegins'));
      if (e.type === 'idle' && G.current() === 'town') G.go('town');
      if (e.type === 'ask') G.refresh().then(function (s) { G.showAsk(s.asks.filter(function (a) { return a.id === e.ask; })[0]); });
      if (e.type === 'answer') G.closeAsk(e.ask);
    });
    G.connect();
    G.go('title').then(function () { if (G.state.asks && G.state.asks.length) G.showAsk(G.state.asks[0]); });
  });
})();
