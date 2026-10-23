// Transparent digital-rain overlay at native 384 x 216.
const { Canvas } = require('./pixlib.cjs');
const W = 384, H = 216, cv = new Canvas(W, H);
let seed = 777; const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 100000) / 100000; };
const RUNES = [[7, 5, 7, 4, 7], [2, 7, 2, 2, 7], [5, 2, 7, 2, 5], [7, 1, 3, 1, 7], [4, 6, 5, 4, 4], [1, 7, 5, 7, 4], [6, 5, 6, 5, 6], [7, 2, 2, 2, 2], [5, 5, 7, 1, 1], [3, 4, 2, 1, 6]];
for (let col = 0; col < 70; col++) {
  const x = Math.floor(rnd() * (W / 4)) * 4, len = 4 + Math.floor(rnd() * 16), head = Math.floor(rnd() * (H + 40));
  for (let k = 0; k < len; k++) {
    const gy = head - k * 6; if (gy < -5 || gy > H) continue;
    const g = RUNES[Math.floor(rnd() * RUNES.length)];
    const c = k === 0 ? '#e8ffe8' : k < 3 ? '#7dff9a' : k < len * 0.6 ? '#1f8a3c' : '#145a2c';
    for (let r = 0; r < 5; r++) for (let b = 0; b < 3; b++) if (g[r] & (4 >> b)) cv.set(x + b, gy + r, c);
  }
}
cv.png(process.argv[2], '#000000', true);
