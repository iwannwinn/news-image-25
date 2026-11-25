'use strict';
// The World Today — Wednesday, November 25, 2026.
// Draws one 1024x1024 PNG newspaper front page summing up the day's world news.
// Pure Node stdlib only (fs, path, zlib, crypto). Hand-rolled 5x7 bitmap font
// and PNG encoder. Deterministic: two runs produce byte-identical output.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const W = 1024;
const H = 1024;
const PAPER = [247, 242, 231];
const INK = [26, 26, 26];
const RED = [163, 22, 33];
const BLUE = [29, 78, 137];
const GREEN = [46, 107, 52];
const PURPLE = [91, 42, 134];
const GREY = [107, 107, 107];
const RULE = [201, 191, 169];

// 5x7 bitmap font. Each glyph is 7 rows of 5 bits, '1' = ink.
const FONT = {
  'A': ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  'B': ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  'C': ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  'D': ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  'E': ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  'F': ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  'G': ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  'H': ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  'I': ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  'J': ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  'K': ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  'L': ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  'M': ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  'N': ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  'O': ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  'P': ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  'Q': ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  'R': ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  'S': ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  'T': ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  'U': ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  'V': ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  'W': ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  'X': ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  'Y': ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  'Z': ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '—': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '"': ['01010', '01010', '00000', '00000', '00000', '00000', '00000'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '·': ['00000', '00000', '00000', '01100', '01100', '00000', '00000'],
};

// ---- canvas ----
const img = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) {
  img[i * 3] = PAPER[0];
  img[i * 3 + 1] = PAPER[1];
  img[i * 3 + 2] = PAPER[2];
}

function px(x, y, c) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  img[o] = c[0];
  img[o + 1] = c[1];
  img[o + 2] = c[2];
}
function rect(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) px(i, j, c);
  }
}
function textWidth(s, scale) {
  return s.length * 6 * scale;
}
function drawText(s, x, y, scale, color) {
  s = s.toUpperCase();
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '1') rect(cx + col * scale, y + r * scale, scale, scale, color);
      }
    }
    cx += 6 * scale;
  }
}
function drawCentered(s, cx, y, scale, color) {
  drawText(s, cx - Math.floor(textWidth(s, scale) / 2), y, scale, color);
}
function wrap(s, maxW, scale) {
  const words = s.toUpperCase().split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textWidth(t, scale) <= maxW) {
      cur = t;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---- PNG encoder ----
const CRC_TABLE = (() => {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG() {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---- layout ----
const MX = 48; // margin
const CW = W - MX * 2; // 928

// Masthead
drawCentered('THE WORLD TODAY', 512, 48, 7, INK);
rect(MX, 116, CW, 4, INK);
rect(MX, 124, CW, 2, RED);
drawCentered('WEDNESDAY, NOVEMBER 25, 2026', 512, 140, 2, INK);

// Lead story
const LEAD_HEAD = "HOUTHIS STRIKE SAUDI OIL REFINERY AND RIYADH";
const LEAD_BODY = "Yemen's Houthis said on Wednesday they attacked the Ras Tanura oil refinery and Riyadh's financial district. Saudi defences intercepted four drones at Ras Tanura. A day earlier, 11 people were wounded in a strike on a tower in Riyadh.";
drawText('MIDDLE EAST', MX, 188, 2, RED);
let y = 214;
for (const line of wrap(LEAD_HEAD, CW, 4)) {
  drawText(line, MX, y, 4, INK);
  y += 38;
}
y += 6;
for (const line of wrap(LEAD_BODY, CW, 2)) {
  drawText(line, MX, y, 2, INK);
  y += 22;
}
rect(MX, 420, CW, 2, RULE);

// Supporting stories
const STORIES = [
  {
    tag: 'MARKETS', color: BLUE,
    head: 'ASIAN STOCKS PLUNGE ON NEW US TARIFF THREAT',
    body: "Nikkei fell 2.9%, Seoul 5.3% and Taipei 5.1% as Washington prepared new duties. Nvidia slid 6%.",
  },
  {
    tag: 'CHINA', color: RED,
    head: 'BEIJING PROBES SHANGHAI CHIEF IN GRAFT SWEEP',
    body: 'Chen Jining is the fourth Politburo member investigated since 2025.',
  },
  {
    tag: 'TECH', color: PURPLE,
    head: 'MALAYSIA SUES GOOGLE FOR $146 MILLION',
    body: 'The regulator says Google failed to act on harmful YouTube content.',
  },
  {
    tag: 'INDONESIA', color: GREEN,
    head: 'STATE FUND TAKES OVER SEIZED FOREST LAND',
    body: "A Danantara unit will run concessions taken from a tycoon-linked firm after this year's fires.",
  },
];
let sy = 444;
for (let i = 0; i < STORIES.length; i++) {
  const s = STORIES[i];
  drawText(s.tag, MX, sy, 2, s.color);
  let hy = sy + 22;
  for (const line of wrap(s.head, CW, 3)) {
    drawText(line, MX, hy, 3, INK);
    hy += 27;
  }
  let by = hy + 2;
  for (const line of wrap(s.body, CW, 2)) {
    drawText(line, MX, by, 2, INK);
    by += 22;
  }
  if (i < STORIES.length - 1) {
    rect(MX, by + 10, CW, 1, RULE);
    sy = by + 24;
  }
}

// Bottom: markets strip + footer
rect(MX, 890, CW, 3, INK);
drawCentered('NIKKEI -2.9%  |  KOSPI -5.3%  |  GOLD $3,544  |  BRENT $91  |  BITCOIN $59,258', 512, 910, 2, INK);
drawCentered('SOURCES: REUTERS · NOVEMBER 25, 2026', 512, 942, 2, GREY);
rect(MX, 976, CW, 2, RULE);

// ---- write ----
const png = encodePNG();
const outPath = path.join(__dirname, 'entry.png');
fs.writeFileSync(outPath, png);
const sha = crypto.createHash('sha256').update(png).digest('hex');
console.log('entry.png ' + png.length + ' bytes sha256 ' + sha);
