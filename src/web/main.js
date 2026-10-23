// Boot: load the world, follow the live events, open the title screen.
(function () {
  G.refresh().then(function () {
    document.documentElement.lang = G.lang();
    G.onEvent(function (e) {
      if (e.replay) return;
      if (e.type === 'battle_start' && G.current() !== 'battle') G.toast(G.t('battleBegins'));
      if (e.type === 'idle' && G.current() === 'town') G.go('town');
    });
    G.connect();
    G.go('title');
  });
})();
