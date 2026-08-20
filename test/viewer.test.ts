// The renderer has two audiences — a human scrubbing a canvas and an agent reading a PNG —
// and the only thing worth having is that they see the SAME PICTURE. A viewer that shows
// the two parties different things is worse than no viewer, because after that they both
// trust it.
//
// Sharing the op list does not buy that. Identical ops drawn with a real font on one side
// and the 3x5 table on the other are two different pictures, and nothing would go red. So
// the sharing happens at the pixels, and these tests hold the three seams that are left:
//
//   1. the two ways one pixel buffer leaves raster.ts — PNG bytes and ImageData — agree,
//      checked by decoding the PNG rather than by reading the encoder and nodding;
//   2. the modules the SERVER hands the browser draw what the modules Node imports draw;
//   3. nothing the browser is asked to import has reached for Node, which is the way
//      seam 2 would stop being true.
//
// What none of this covers is `ctx.putImageData` and the canvas element itself — see the
// commit message, which names that as the part I am least sure of.

import { expect, test } from "vitest";
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { inflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import type { AddressInfo } from "node:net";
import ts from "typescript";

import { scene, sceneMap, sceneZoom, historyIndices, dashWidth, WIDTH, HEIGHT, type Frame, type Op } from "../viewer/scene.js";
import { Canvas, rasterise, rgba } from "../viewer/raster.js";
import { png } from "../viewer/png.js";
import { createViewerServer } from "../viewer/serve.js";

const VIEWER = resolve(dirname(new URL(import.meta.url).pathname), "../viewer");

// ── a frame built to hit the awkward paths ───────────────────────────────────
// Runs are gitignored, so the fixture is synthetic on purpose: a test that only passes on
// this machine's leftover data is not a test. It carries an extinct place (the white
// EXTINCT banner, the only user of the `over` blend), a burning patch, and a place sitting
// on enough locked carbon to trip the map's emphasis — the branches most likely to differ
// between a blend-max backend and one that doesn't.

function place(name: string, i: number, alive: { plants: number; fungi: number; grazers: number }) {
  return {
    name,
    latitude: -0.8 + i * 0.4,
    temperature: 280 + i * 7,
    pressure: 100 + i * 11,
    light: (i % 3) * 0.5,
    air: { O2: 40 + i * 9, CO2: 12 + i * 3, N2: 780 - i * 4 },
    soil: { ammonia: 0.4 * i, cellulose: 9 * i, lignin: 4 + 7 * i, starch: 2.5 * i },
    patches: Array.from({ length: 24 }, (_, p) => ({
      fuel: ((p * 7 + i * 3) % 13) / 9,
      starch: ((p * 5 + i) % 7) / 11,
      burning: p % 11 === 0 && i === 1 ? 1 : 0,
    })),
    alive,
    ignitions: i * 2,
    deaths: i * 3,
    meals: i * 5,
  };
}

function fixture(tick: number): Frame {
  return {
    tick,
    dayPhase: (tick % 1000) / 1000,
    yearPhase: (tick % 9000) / 9000,
    totals: { carbon: 1234.5 + tick / 100, nitrogen: 987.25 },
    migrations: tick % 17,
    places: [
      place("harrow", 0, { plants: 0, fungi: 0, grazers: 0 }), // extinct
      place("brake", 1, { plants: 31, fungi: 4, grazers: 9 }),
      place("thwaite", 2, { plants: 12, fungi: 19, grazers: 2 }), // locked carbon high
    ],
    routes: [
      { from: 0, to: 1, gradient: 2.5 },
      { from: 1, to: 2, gradient: -1.25 },
      { from: 2, to: 0, gradient: 0.0 },
    ],
  };
}

const HISTORY = [0, 400, 900, 1500, 2200].map(fixture);
const FRAME = fixture(3000);

const VIEWS: Array<[string, () => Op[]]> = [
  ["dash", () => scene(FRAME, HISTORY)],
  ["map", () => sceneMap(FRAME, HISTORY)],
  ["zoom", () => sceneZoom(FRAME, 1, HISTORY)],
];

function pixels(ops: Op[]): Canvas {
  const canvas = new Canvas(WIDTH, HEIGHT);
  rasterise(canvas, ops);
  return canvas;
}

/** Compare two full-frame buffers and say WHERE they part company.
 *
 *  Not `expect(a).toEqual(b)`: on a 3.6 MB pixel buffer that takes 24 seconds (measured)
 *  building a diff no one could read, and it timed this file's first test out. This scans
 *  in about a millisecond and returns the one fact a failure needs — which pixel. */
function difference(a: ArrayLike<number>, b: ArrayLike<number>): string {
  if (a.length !== b.length) return `length ${a.length} vs ${b.length}`;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return `differ at ${i}: ${a[i]} vs ${b[i]}`;
  return "identical";
}

/** Read a greyscale PNG back to pixels. Deliberately strict about the format it accepts:
 *  the point is to fail if the encoder starts writing something a decoder must guess at. */
function decodePNG(bytes: Buffer): { width: number; height: number; px: Uint8Array } {
  expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (offset + 8 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      expect({ depth: data[8], colour: data[9], interlace: data[12] }).toEqual({ depth: 8, colour: 0, interlace: 0 });
    }
    if (type === "IDAT") idat.push(Buffer.from(data));
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width + 1;
  expect(raw.length).toBe(stride * height);
  const px = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    expect(raw[y * stride]).toBe(0); // filter: none
    for (let x = 0; x < width; x++) px[y * width + x] = raw[y * stride + 1 + x];
  }
  return { width, height, px };
}

test("the PNG an agent reads and the ImageData a human sees are the same picture", () => {
  for (const [name, build] of VIEWS) {
    const canvas = pixels(build());
    const decoded = decodePNG(png(canvas));
    const shown = rgba(canvas);

    expect({ view: name, w: decoded.width, h: decoded.height }).toEqual({ view: name, w: WIDTH, h: HEIGHT });

    // Compared whole, not sampled: a difference in one corner is exactly the kind of
    // divergence that would survive spot checks and mislead somebody later.
    const fromPNG = new Uint8ClampedArray(decoded.px.length * 4);
    for (let i = 0; i < decoded.px.length; i++) {
      const v = decoded.px[i];
      fromPNG[i * 4] = v;
      fromPNG[i * 4 + 1] = v;
      fromPNG[i * 4 + 2] = v;
      fromPNG[i * 4 + 3] = 255;
    }
    expect({ view: name, pixels: difference(shown, fromPNG) }).toEqual({ view: name, pixels: "identical" });

    // and the picture is not blank — an all-paper canvas would pass every check above
    expect(new Set(decoded.px).size).toBeGreaterThan(3);
  }
});

test("the modules the server hands the browser draw the same pixels as the ones Node imports", async () => {
  const server = createViewerServer();
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    // Everything the server has to say is collected first, then checked. The gap matters:
    // undici pools keep-alive sockets and the server drops idle ones after five seconds,
    // so verification work interleaved with fetches shows up as ECONNRESET rather than as
    // whatever it really is.
    const served = new Map<string, string>();
    for (const name of ["scene", "raster", "page"]) {
      const res = await fetch(`${base}/viewer/${name}.js`);
      expect({ name, status: res.status }).toEqual({ name, status: 200 });
      served.set(name, await res.text());
    }

    // Every import the page asks for must actually be reachable, import map included — a
    // specifier the server cannot answer is a blank page, not a red test.
    const map = JSON.parse(
      /<script type="importmap">([\s\S]*?)<\/script>/.exec(readFileSync(join(VIEWER, "index.html"), "utf8"))![1],
    ) as { imports: Record<string, string> };
    for (const specifier of ts.preProcessFile(served.get("page")!, true, true).importedFiles.map((f) => f.fileName)) {
      const prefix = Object.keys(map.imports).find((p) => specifier.startsWith(p));
      const url = specifier.startsWith(".")
        ? `${base}/viewer/${specifier.replace(/^\.\//, "")}`
        : `${base}${map.imports[prefix!]}${specifier.slice(prefix!.length)}`;
      expect({ specifier, status: (await fetch(url)).status }).toEqual({ specifier, status: 200 });
    }

    const dir = mkdtempSync(join(tmpdir(), "creatures-served-"));
    for (const [name, source] of served) writeFileSync(join(dir, `${name}.js`), source);
    const servedScene = await import(pathToFileURL(join(dir, "scene.js")).href);
    const servedRaster = await import(pathToFileURL(join(dir, "raster.js")).href);

    const servedViews: Array<[string, Op[]]> = [
      ["dash", servedScene.scene(FRAME, HISTORY)],
      ["map", servedScene.sceneMap(FRAME, HISTORY)],
      ["zoom", servedScene.sceneZoom(FRAME, 1, HISTORY)],
    ];
    for (const [name, servedOps] of servedViews) {
      const mine = VIEWS.find(([n]) => n === name)![1]();
      expect(servedOps).toEqual(mine);

      const theirs = new servedRaster.Canvas(WIDTH, HEIGHT);
      servedRaster.rasterise(theirs, servedOps);
      expect({ view: name, pixels: difference(theirs.px, pixels(mine).px) }).toEqual({
        view: name,
        pixels: "identical",
      });
    }
  } finally {
    await new Promise<void>((done) => server.close(() => done()));
  }
});

test("nothing the browser is asked to import reaches for Node", () => {
  const bare: string[] = [];
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    for (const found of ts.preProcessFile(readFileSync(file, "utf8"), true, true).importedFiles) {
      const specifier = found.fileName;
      expect({ file, specifier, node: specifier.startsWith("node:") }).toEqual({ file, specifier, node: false });
      if (!specifier.startsWith(".")) {
        bare.push(specifier);
        continue;
      }
      const target = resolve(dirname(file), specifier.replace(/\.js$/, ".ts"));
      expect(existsSync(target)).toBe(true);
      walk(target);
    }
  };
  walk(join(VIEWER, "page.ts"));

  // the graph must actually have reached the renderer, or this test is checking nothing
  expect([...seen].map((f) => f.split("/").pop())).toEqual(
    expect.arrayContaining(["page.ts", "scene.ts", "raster.ts"]),
  );
  // png.ts is the Node half and must stay out of the browser's graph
  expect([...seen].some((f) => f.endsWith("png.ts"))).toBe(false);
  // whatever bare specifiers remain are the page's business, and the served-modules test
  // above proves the import map answers them
  expect(bare).toEqual(["scher/cell.js"]);
});

test("the history window stays bounded as a run grows", () => {
  // The sparklines read a subsample of every earlier frame. Unbounded, a long run would
  // make each redraw O(run length) and the scrubber would go treacly hours in — the sort
  // of thing that gets blamed on "the browser" rather than on this line.
  for (const upto of [0, 1, 59, 60, 61, 500, 100_000]) {
    const indices = historyIndices(upto);
    expect(indices.length).toBeLessThanOrEqual(61);
    expect(indices.every((n) => n >= 0 && n < upto)).toBe(true);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
  }
  expect(historyIndices(0)).toEqual([]);
});

test("the dashboard shows every place, however many there are", () => {
  // WIDTH was chosen when a world had six places. Cranking it to twelve did not widen the
  // canvas, so `scene` kept drawing all twelve columns and the rasteriser silently dropped
  // everything past 1180px: five whole places and half the routes absent from the surface
  // this project is checked on, with nothing about the image saying so.
  //
  // Asserted against the ops rather than the pixels, because the failure was that ops fell
  // outside the canvas — checking the picture would have compared two equally truncated
  // pictures and passed.
  const wide: Frame = {
    ...FRAME,
    places: Array.from({ length: 12 }, (_, i) => place(`place${i}`, i % 3, { plants: 3, fungi: 2, grazers: 1 })),
    routes: Array.from({ length: 12 }, (_, i) => ({ from: i, to: (i + 1) % 12, gradient: 1 - i / 6 })),
  };

  const width = dashWidth(wide);
  expect(width).toBeGreaterThan(WIDTH);

  for (const op of scene(wide, [])) {
    const xs = op.op === "line" ? [op.x1, op.x2] : op.op === "text" ? [op.x + op.s.length * 4] : [op.x + op.w];
    for (const x of xs) expect(x).toBeLessThanOrEqual(width);
  }

  // and a world small enough to fit keeps the composition it was designed with
  expect(dashWidth(FRAME)).toBe(WIDTH);
});
