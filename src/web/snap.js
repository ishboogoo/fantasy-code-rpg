// Screenshots: press P (or click the camera) to save the game screen as a PNG and copy it,
// ready to share. Uses the browser's own tab capture, so what you get is exactly what you see.
(function () {
  'use strict';
  var G = window.G;
  var busy = false;

  function stamp() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function frame(video) {
    return new Promise(function (resolve) {
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(function () { resolve(); });
      else setTimeout(resolve, 300);
    });
  }

  G.snap = function () {
    if (busy) return;
    var md = navigator.mediaDevices;
    if (!md || !md.getDisplayMedia) { G.toast(G.t('snapFail'), true); return; }
    busy = true;
    var stage = document.getElementById('stage');
    var btn = document.getElementById('snap');
    var toast = document.getElementById('toast');
    G.toast(G.t('snapPick'));
    var live = null; // the capture stream, stopped on every path so sharing never stays on
    var stop = function () { if (live) { live.getTracks().forEach(function (t) { t.stop(); }); live = null; } };
    md.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include' })
      .then(function (stream) {
        live = stream;
        // Keep our own controls and messages out of the picture.
        btn.style.visibility = 'hidden'; toast.style.display = 'none';
        var video = document.createElement('video');
        video.muted = true; video.playsInline = true; video.srcObject = stream;
        return video.play().then(function () { return frame(video); }).then(function () { return frame(video); }).then(function () {
          var r = stage.getBoundingClientRect();
          var sx = video.videoWidth / innerWidth, sy = video.videoHeight / innerHeight;
          var c = document.createElement('canvas');
          c.width = Math.round(r.width * sx); c.height = Math.round(r.height * sy);
          var g = c.getContext('2d');
          g.drawImage(video, r.left * sx, r.top * sy, r.width * sx, r.height * sy, 0, 0, c.width, c.height);
          // A small credit in the corner, so a shared picture says where it came from.
          var fs = Math.max(12, Math.round(c.height / 40));
          g.font = fs + 'px DotGothic16, monospace'; g.textAlign = 'right'; g.textBaseline = 'bottom';
          g.fillStyle = 'rgba(2,8,6,.75)'; g.fillText('Fantasy Code RPG · #fcrpg · npx fantasy-code-rpg', c.width - fs * 0.6 + 2, c.height - fs * 0.5 + 2);
          g.fillStyle = '#7dffa8'; g.fillText('Fantasy Code RPG · #fcrpg · npx fantasy-code-rpg', c.width - fs * 0.6, c.height - fs * 0.5);
          stop();
          return new Promise(function (resolve) { c.toBlob(resolve, 'image/png'); });
        });
      })
      .then(function (blob) {
        btn.style.visibility = '';
        var name = 'fantasy-code-rpg-' + (G.current() || 'game') + '-' + stamp() + '.png';
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
        var copied = navigator.clipboard && window.ClipboardItem
          ? navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(function () { return true; }, function () { return false; })
          : Promise.resolve(false);
        return copied.then(function (ok) { G.toast(G.t('snapSaved', { file: name }) + (ok ? ' ' + G.t('snapCopied') : '')); });
      })
      .catch(function () { btn.style.visibility = ''; G.toast(G.t('snapFail'), true); })
      .then(function () { stop(); busy = false; });
  };

  // The camera button, top right of the game screen.
  var btn = document.createElement('button');
  btn.id = 'snap'; btn.type = 'button'; btn.textContent = '📷';
  btn.title = G.t('snap'); btn.setAttribute('aria-label', G.t('snap'));
  btn.addEventListener('click', function () { G.snap(); });
  document.getElementById('stage').appendChild(btn);

  addEventListener('keydown', function (e) {
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if ((e.key === 'p' || e.key === 'P') && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); G.snap(); }
  });
})();
