// Tiny pixel-art toolkit: an indexed canvas, dithering, sprite stamping, PNG output.
const fs = require('fs');
const zlib = require('zlib');

const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }

class Canvas {
  constructor(w, h) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h && c) this.px[y * this.w + x] = c; }
  get(x, y) { return (x >= 0 && y >= 0 && x < this.w && y < this.h) ? this.px[y * this.w + x] : null; }
  rect(x0, y0, x1, y1, c) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, c); }
  // Vertical gradient through colour stops, with ordered dithering between neighbours.
  gradient(y0, y1, stops, x0 = 0, x1 = this.w - 1) {
    const n = stops.length - 1;
    for (let y = y0; y <= y1; y++) {
      const t = (y - y0) / Math.max(1, y1 - y0) * n;
      const i = Math.min(n - 1, Math.floor(t)), f = t - i;
      for (let x = x0; x <= x1; x++) this.set(x, y, f * 16 > BAYER[y % 4][x % 4] + 0.5 ? stops[i + 1] : stops[i]);
    }
  }
  dither(x, y, f) { return f * 16 > BAYER[((y % 4) + 4) % 4][((x % 4) + 4) % 4] + 0.5; }
  circle(cx, cy, r, fn) { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) fn(x, y, d); } }
  stamp(grid, ox, oy, flip = false) {
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x]; if (c) this.set(ox + (flip ? grid[y].length - 1 - x : x), oy + y, c);
    }
  }
  png(file, bg = '#000000', alpha = false) {
    const ch = alpha ? 4 : 3;
    const raw = Buffer.alloc((this.w * ch + 1) * this.h);
    for (let y = 0; y < this.h; y++) {
      raw[y * (this.w * ch + 1)] = 0;
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        const [r, g, b] = hex(c || bg);
        const p = y * (this.w * ch + 1) + 1 + x * ch;
        raw[p] = r; raw[p + 1] = g; raw[p + 2] = b; if (alpha) raw[p + 3] = c ? 255 : 0;
      }
    }
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(this.w, 0); ihdr.writeUInt32BE(this.h, 4); ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2;
    fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
  }
  // Upscaled copy for previewing
  scaled(k) { const c = new Canvas(this.w * k, this.h * k); for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const v = this.get(x, y); if (v) c.rect(x * k, y * k, x * k + k - 1, y * k + k - 1, v); } return c; }
}

function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); }

// Load the canvas Hero generator so title art uses the exact same characters.
function heroFn(dcPath) {
  const src = fs.readFileSync(dcPath, 'utf8');
  const body = src.slice(src.indexOf('renderVals() {') + 'renderVals() {'.length, src.indexOf('// Outline pass'));
  const fn = new Function('pr', body.replace('var pr = this.props;', '') + `
    var line = cursed ? P.arcane[1] : ink; var out = [];
    for (var yy = 0; yy < H; yy++) { var r = []; for (var xx = 0; xx < W; xx++) { var c = g[yy][xx];
      if (!c) { var n = (yy > 0 && g[yy-1][xx]) || (yy < H-1 && g[yy+1][xx]) || (xx > 0 && g[yy][xx-1]) || (xx < W-1 && g[yy][xx+1]); if (n) c = line; }
      r.push(c); } out.push(r); }
    return out;`);
  return (props) => fn(props);
}

module.exports = { Canvas, heroFn, hex };
