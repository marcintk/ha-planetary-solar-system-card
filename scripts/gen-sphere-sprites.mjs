import zlib from "node:zlib";

const N = 128;

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(gray2) { // gray2: Uint8Array length N*N*2 (gray, alpha)
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4);
  ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = N * 2;
  const raw = Buffer.alloc((stride + 1) * N);
  for (let y = 0; y < N; y++) {
    raw[y * (stride + 1)] = 0;
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = gray2[y * stride + i];
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}
function norm(x, y, z) { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }

// lo/hi remap the diffuse term through a smoothstep: N·L below `lo` is fully dark, above
// `hi` fully lit, and the transition happens only in that band — a narrower band = a sharper
// terminator without moving where it sits (the light direction is unchanged).
function sprite(L, ambient, k, lo = 0, hi = 1) {
  const [Lx, Ly, Lz] = norm(...L);
  const out = new Uint8Array(N * N * 2);
  // rad = half -> the disc reaches the very edge of the box, so the sprite's visible radius
  // matches a 2d <circle r> at the same box size (was half-1 + a fat feather, which made 3d
  // planets read ~6% small).
  const half = N / 2, rad = half;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const nx = (x - half) / rad, ny = (y - half) / rad, d2 = nx * nx + ny * ny;
    const o = (y * N + x) * 2;
    const dist = Math.sqrt(d2);
    if (d2 > 1) { out[o] = 0; out[o + 1] = 0; continue; }
    const nz = Math.sqrt(1 - d2);
    // Keep N·L signed: with lo/hi straddling 0 the sharp band is centred on the true
    // terminator (the great circle where N·L = 0), so the lit face is a full hemisphere.
    const diff = nx * Lx + ny * Ly + nz * Lz;
    let t = (diff - lo) / (hi - lo);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    if (hi - lo < 0.9) t = t * t * (3 - 2 * t); // smoothstep — only for the tight LIT band
    let v = ambient + k * t; if (v > 1) v = 1;
    out[o] = Math.round(v * 255);
    // Solid almost to the edge; only a ~1px anti-alias feather in the last 2%.
    out[o + 1] = dist > 0.98 ? Math.max(0, Math.round(255 * (1 - (dist - 0.98) / 0.02))) : 255;
  }
  return out;
}

const soft = png(sprite([-0.3, -0.36, 1.05], 0.34, 0.66, 0, 1));
// LIT: in-plane light, bright side = local +x. The lo/hi band centre is the "how much of the
// disc is lit" knob — more positive shrinks the lit cap. 0.14 mid puts the whole lit+penumbra
// inside ~87° of the sub-solar point, so the dark side is a clear ~half+ of the disc.
// ambient 0.14 keeps the dark side clearly dark without a black hole.
const lit = png(sprite([0.96, 0.02, 0.3], 0.28, 0.72, 0.02, 0.26));
console.log("SOFT_LEN", soft.length, "b64", Math.ceil(soft.length / 3) * 4);
console.log("LIT_LEN", lit.length, "b64", Math.ceil(lit.length / 3) * 4);
import { writeFileSync } from "node:fs";
writeFileSync("/tmp/sprite-soft.b64", soft.toString("base64"));
writeFileSync("/tmp/sprite-lit.b64", lit.toString("base64"));
