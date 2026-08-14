// Greyscale PNG encoding — the one step of the pipeline that genuinely needs Node.
//
// It used to be a method on Canvas, which put `node:zlib` at the top of raster.ts and made
// the rasteriser unservable to a browser. Splitting it out is what lets the page import the
// real rasteriser instead of growing a second one.

import { deflateSync } from "node:zlib";
import type { Canvas } from "./raster.js";

export function png(canvas: Canvas): Buffer {
  const stride = canvas.width + 1;
  const raw = Buffer.alloc(stride * canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < canvas.width; x++) {
      raw[y * stride + 1 + x] = canvas.px[y * canvas.width + x];
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
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
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
