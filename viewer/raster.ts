// A PNG writer with no dependencies, so the wireframe can be LOOKED AT by whoever is
// driving — including an agent, which is the point. Node ships zlib; everything else here
// is a few dozen lines of arithmetic.
//
// The font is 3x5 because labels are what make a wireframe readable, and a picture of
// unlabelled bars is a mood ring. Small, blocky and legible beats absent.

import { deflateSync } from "node:zlib";
import type { Op } from "./scene.js";

const FONT: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"], B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"], D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"], F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"], H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"], J: ["001", "001", "001", "101", "010"],
  K: ["101", "110", "100", "110", "101"], L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"], N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"], P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "111", "011"], R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"], T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "011"], V: ["101", "101", "101", "010", "010"],
  W: ["101", "101", "111", "111", "101"], X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"], Z: ["111", "001", "010", "100", "111"],
  "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "011", "001", "111"],
  "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "001", "001", "001"],
  "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
  ".": ["000", "000", "000", "000", "010"], ",": ["000", "000", "000", "010", "100"],
  "-": ["000", "000", "111", "000", "000"], "+": ["000", "010", "111", "010", "000"],
  "/": ["001", "001", "010", "100", "100"], ">": ["100", "010", "001", "010", "100"],
  "<": ["001", "010", "100", "010", "001"], "(": ["001", "010", "010", "010", "001"],
  ")": ["100", "010", "010", "010", "100"], ":": ["000", "010", "000", "010", "000"],
  "%": ["101", "001", "010", "100", "101"], "=": ["000", "111", "000", "111", "000"],
  " ": ["000", "000", "000", "000", "000"], "?": ["110", "001", "010", "000", "010"],
};

export class Canvas {
  readonly width: number;
  readonly height: number;
  /** greyscale, 0 = ink, 255 = paper. A wireframe wants no colour to say what it means. */
  readonly px: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.px = new Uint8Array(width * height).fill(16); // near-black ground
  }

  /** Paint. `over` forces the value down as well as up.
   *
   *  Without it this canvas could only ever get brighter, so dark-on-light was impossible
   *  — a white banner silently erased its own label, which is exactly the bug that made
   *  "EXTINCT" render as a blank white box. Max-blending is right for overlapping
   *  wireframe strokes and wrong for anything that means to cover what is under it. */
  #plot(x: number, y: number, ink: number, over = false): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= this.width || yi >= this.height) return;
    const i = yi * this.width + xi;
    if (over || ink > this.px[i]) this.px[i] = ink;
  }

  line(x1: number, y1: number, x2: number, y2: number, ink: number, weight = 1): void {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t;
      for (let w = 0; w < weight; w++) this.#plot(x, y + w, ink);
    }
  }

  rect(x: number, y: number, w: number, h: number, ink: number): void {
    this.line(x, y, x + w, y, ink);
    this.line(x, y + h, x + w, y + h, ink);
    this.line(x, y, x, y + h, ink);
    this.line(x + w, y, x + w, y + h, ink);
  }

  fill(x: number, y: number, w: number, h: number, ink: number, over = false): void {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.#plot(x + xx, y + yy, ink, over);
  }

  text(x: number, y: number, s: string, ink: number, scale = 1, over = false): void {
    let cx = x;
    for (const raw of s.toUpperCase()) {
      const glyph = FONT[raw] ?? FONT["?"];
      for (let gy = 0; gy < 5; gy++) {
        for (let gx = 0; gx < 3; gx++) {
          if (glyph[gy][gx] !== "1") continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) this.#plot(cx + gx * scale + sx, y + gy * scale + sy, ink, over);
          }
        }
      }
      cx += 4 * scale;
    }
  }

  /** Greyscale PNG. */
  png(): Buffer {
    const raw = Buffer.alloc((this.width + 1) * this.height);
    for (let y = 0; y < this.height; y++) {
      raw[y * (this.width + 1)] = 0; // filter: none
      for (let x = 0; x < this.width; x++) {
        raw[y * (this.width + 1) + 1 + x] = this.px[y * this.width + x];
      }
    }
    const chunk = (type: string, data: Buffer): Buffer => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(body) >>> 0);
      return Buffer.concat([len, body, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(this.width, 0);
    ihdr.writeUInt32BE(this.height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 0; // greyscale
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}

let CRC_TABLE: number[] | null = null;
function crc32(buf: Buffer): number {
  if (!CRC_TABLE) {
    CRC_TABLE = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return crc ^ 0xffffffff;
}

/** Draw a scene's ops onto a canvas. The ONLY place ops become pixels. */
export function rasterise(canvas: Canvas, ops: readonly Op[]): void {
  const ink = (dim?: number) => Math.round(40 + 215 * (dim ?? 1));
  for (const o of ops) {
    switch (o.op) {
      case "line":
        canvas.line(o.x1, o.y1, o.x2, o.y2, ink(o.dim), o.w ?? 1);
        break;
      case "rect":
        canvas.rect(o.x, o.y, o.w, o.h, ink(o.dim));
        break;
      case "fill":
        canvas.fill(o.x, o.y, o.w, o.h, ink(o.dim), o.over ?? false);
        break;
      case "text":
        canvas.text(o.x, o.y, o.s, ink(o.dim), o.scale ?? 1, o.over ?? false);
        break;
    }
  }
}
