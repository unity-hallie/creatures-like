// THE WIREFRAME — one frame of the world, as drawing instructions.
//
// This file makes no pictures. It turns a checkpoint into a list of ops, and two very
// different backends draw them: a canvas in the browser, and a dependency-free rasteriser
// that writes PNGs for an agent to read. Both must show the SAME picture, because a
// renderer that shows me something different from what it shows you is worse than none.
//
// Wireframe on purpose. Outlines, ticks and bars carry magnitude honestly at small sizes;
// filled colour reads as decoration and hides its own precision. Every quantity here is
// drawn as a length against a stated scale, so a glance gives a number rather than a mood.

export interface FramePlace {
  name: string;
  latitude: number;
  temperature: number;
  pressure: number;
  light: number;
  air: Record<string, number>;
  soil: { ammonia: number; cellulose: number; lignin: number; starch: number };
  patches: Array<{ fuel: number; starch: number; burning: number }>;
  alive: { plants: number; fungi: number; grazers: number };
  ignitions: number;
  deaths: number;
  meals: number;
}

export interface Frame {
  tick: number;
  dayPhase: number;
  yearPhase: number;
  totals: { carbon: number; nitrogen: number };
  migrations: number;
  places: FramePlace[];
  routes: Array<{ from: number; to: number; gradient: number }>;
}

export type Op =
  | { op: "line"; x1: number; y1: number; x2: number; y2: number; w?: number; dim?: number }
  | { op: "rect"; x: number; y: number; w: number; h: number; dim?: number }
  | { op: "fill"; x: number; y: number; w: number; h: number; dim?: number; over?: boolean }
  | { op: "text"; x: number; y: number; s: string; dim?: number; scale?: number; over?: boolean };

export const WIDTH = 1180;
export const HEIGHT = 760;

const COL_X = 30;
const COL_W = 178;
const COL_GAP = 12;
const TOP = 96;

/** A labelled bar. Length is the quantity; the tick marks say what full scale means. */
function bar(ops: Op[], x: number, y: number, w: number, value: number, scale: number, label: string): void {
  ops.push({ op: "rect", x, y, w, h: 9, dim: 0.35 });
  const filled = Math.max(0, Math.min(1, value / scale)) * (w - 2);
  if (filled > 0) ops.push({ op: "fill", x: x + 1, y: y + 1, w: filled, h: 7, dim: 1 });
  ops.push({ op: "text", x: x + w + 6, y: y + 1, s: label, dim: 0.75 });
}

/** A sparkline: the shape of a quantity over the run so far, drawn small.
 *
 *  This is the difference between a viewer that shows STATE and one that shows what
 *  DEVELOPS. A single frame of an ecosystem is nearly unreadable — populations mean
 *  nothing without their trajectory — so every place carries its own history beside it. */
function spark(ops: Op[], x: number, y: number, w: number, h: number, series: number[], label: string): void {
  ops.push({ op: "line", x1: x, y1: y + h, x2: x + w, y2: y + h, dim: 0.25 });
  ops.push({ op: "text", x: x + w + 5, y: y + h - 5, s: label, dim: 0.6 });
  if (series.length < 2) return;
  const hi = Math.max(...series, 1e-9);
  const lo = Math.min(...series, 0);
  const span = hi - lo || 1;
  for (let i = 1; i < series.length; i++) {
    const x1 = x + ((i - 1) / (series.length - 1)) * w;
    const x2 = x + (i / (series.length - 1)) * w;
    const y1 = y + h - ((series[i - 1] - lo) / span) * h;
    const y2 = y + h - ((series[i] - lo) / span) * h;
    ops.push({ op: "line", x1, y1, x2, y2, dim: 0.95 });
  }
}

/** Which earlier frames feed the sparklines when frame `upto` is drawn.
 *
 *  The window is part of the picture, not a detail of how you loaded it: two callers that
 *  subsampled differently would draw visibly different sparklines from the same frame and
 *  both look right. So it is decided once, here, and the PNG CLI and the browser page both
 *  ask. Returns indices rather than frames so a caller reading off disk can stay lazy. */
export function historyIndices(upto: number, budget = 60): number[] {
  const stride = Math.max(1, Math.ceil(upto / budget));
  const out: number[] = [];
  for (let i = 0; i < upto; i += stride) out.push(i);
  return out;
}

export function scene(frame: Frame, history: Frame[] = []): Op[] {
  const ops: Op[] = [];

  // ── header ────────────────────────────────────────────────────────────────
  ops.push({ op: "text", x: COL_X, y: 22, s: `TICK ${frame.tick}` });
  ops.push({
    op: "text",
    x: COL_X + 190,
    y: 22,
    s: `YEAR ${frame.yearPhase.toFixed(2)}  DAY ${frame.dayPhase.toFixed(2)}`,
    dim: 0.8,
  });
  ops.push({
    op: "text",
    x: COL_X + 470,
    y: 22,
    s: `C ${frame.totals.carbon.toFixed(2)}  N ${frame.totals.nitrogen.toFixed(2)}  MIG ${frame.migrations}`,
    dim: 0.8,
  });

  // the year as a dial, so the season reads at a glance rather than as a decimal
  const dialX = WIDTH - 70;
  const dialY = 34;
  const r = 22;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    ops.push({
      op: "line",
      x1: dialX + Math.cos(a) * r,
      y1: dialY + Math.sin(a) * r,
      x2: dialX + Math.cos(a) * (r - 3),
      y2: dialY + Math.sin(a) * (r - 3),
      dim: 0.3,
    });
  }
  const ya = frame.yearPhase * Math.PI * 2 - Math.PI / 2;
  ops.push({ op: "line", x1: dialX, y1: dialY, x2: dialX + Math.cos(ya) * r, y2: dialY + Math.sin(ya) * r, w: 2 });

  ops.push({ op: "line", x1: COL_X, y1: 40, x2: WIDTH - COL_X, y2: 40, dim: 0.4 });

  // scales derived from the frame, so nothing clips and nothing is a sliver
  const pressureScale = Math.max(1, ...frame.places.map((p) => p.pressure)) * 1.15;
  const airScale = Math.max(1, ...frame.places.flatMap((p) => [p.air.O2 ?? 0, p.air.CO2 ?? 0, p.air.N2 ?? 0])) * 1.15;
  const soilScale = Math.max(1, ...frame.places.flatMap((p) => [p.soil.cellulose, p.soil.lignin, p.soil.starch])) * 1.15;

  // ── one column per place ──────────────────────────────────────────────────
  frame.places.forEach((place, i) => {
    const x = COL_X + i * (COL_W + COL_GAP);
    let y = TOP;

    const total = place.alive.plants + place.alive.fungi + place.alive.grazers;
    const dead = total === 0;
    ops.push({ op: "rect", x, y: y - 40, w: COL_W, h: HEIGHT - 150, dim: dead ? 0.9 : 0.45 });
    ops.push({ op: "text", x: x + 6, y: y - 34, s: place.name.toUpperCase() });
    if (dead) {
      // A place with nothing alive in it is the loudest fact a frame can carry, and the
      // first render whispered it as three small zeros. Now it takes the whole header.
      ops.push({ op: "fill", x: x + 92, y: y - 38, w: 82, h: 13, dim: 1, over: true });
      ops.push({ op: "text", x: x + 96, y: y - 35, s: "EXTINCT", dim: 0.0, over: true });
      const bottom = y - 40 + (HEIGHT - 150);
      ops.push({ op: "line", x1: x, y1: y - 40, x2: x + COL_W, y2: bottom, dim: 0.28 });
      ops.push({ op: "line", x1: x + COL_W, y1: y - 40, x2: x, y2: bottom, dim: 0.28 });
    }
    ops.push({
      op: "text",
      x: x + 6,
      y: y - 20,
      s: `lat ${place.latitude.toFixed(2)}  T ${place.temperature.toFixed(0)}`,
      dim: 0.7,
    });

    // daylight as a filled arc-substitute: a bar that empties at night
    bar(ops, x + 6, y, 70, place.light, 1.6, `sun ${place.light.toFixed(2)}`);
    y += 16;
    bar(ops, x + 6, y, 70, place.pressure, pressureScale, `P ${place.pressure.toFixed(0)}`);
    y += 20;

    // air
    ops.push({ op: "text", x: x + 6, y, s: "AIR", dim: 0.6 });
    y += 12;
    bar(ops, x + 6, y, 70, place.air.O2 ?? 0, airScale, `O2 ${(place.air.O2 ?? 0).toFixed(0)}`);
    y += 13;
    bar(ops, x + 6, y, 70, place.air.CO2 ?? 0, airScale, `CO2 ${(place.air.CO2 ?? 0).toFixed(0)}`);
    y += 13;
    bar(ops, x + 6, y, 70, place.air.N2 ?? 0, airScale, `N2 ${(place.air.N2 ?? 0).toFixed(0)}`);
    y += 20;

    // soil
    ops.push({ op: "text", x: x + 6, y, s: "GROUND", dim: 0.6 });
    y += 12;
    bar(ops, x + 6, y, 70, place.soil.cellulose, soilScale, `cel ${place.soil.cellulose.toFixed(1)}`);
    y += 13;
    bar(ops, x + 6, y, 70, place.soil.lignin, soilScale, `lig ${place.soil.lignin.toFixed(1)}`);
    y += 13;
    bar(ops, x + 6, y, 70, place.soil.starch, soilScale, `sta ${place.soil.starch.toFixed(1)}`);
    y += 13;
    bar(ops, x + 6, y, 70, place.soil.ammonia, 4, `NH3 ${place.soil.ammonia.toFixed(2)}`);
    y += 22;

    // who is alive
    ops.push({ op: "text", x: x + 6, y, s: "ALIVE", dim: 0.6 });
    y += 12;
    bar(ops, x + 6, y, 70, place.alive.plants, 40, `pla ${place.alive.plants}`);
    y += 13;
    bar(ops, x + 6, y, 70, place.alive.fungi, 20, `fun ${place.alive.fungi}`);
    y += 13;
    bar(ops, x + 6, y, 70, place.alive.grazers, 20, `grz ${place.alive.grazers}`);
    y += 20;

    ops.push({
      op: "text",
      x: x + 6,
      y,
      s: `fire ${place.ignitions}  died ${place.deaths}`,
      dim: 0.7,
    });
    y += 12;
    ops.push({ op: "text", x: x + 6, y, s: `meals ${place.meals}`, dim: 0.7 });
    y += 16;

    // ── what has been happening here ──────────────────────────────────────
    const past = [...history, frame];
    ops.push({ op: "text", x: x + 6, y, s: "HISTORY", dim: 0.6 });
    y += 8;
    spark(ops, x + 6, y, 105, 20, past.map((f) => f.places[i]?.alive.plants ?? 0), "pla");
    y += 24;
    spark(ops, x + 6, y, 105, 20, past.map((f) => f.places[i]?.alive.grazers ?? 0), "grz");
    y += 24;
    spark(ops, x + 6, y, 105, 20, past.map((f) => f.places[i]?.air.O2 ?? 0), "o2");
    y += 24;
    spark(ops, x + 6, y, 105, 20, past.map((f) => f.places[i]?.soil.lignin ?? 0), "lig");
    y += 24;
    spark(ops, x + 6, y, 105, 20, past.map((f) => f.places[i]?.ignitions ?? 0), "fire");
    y += 26;

    // ── the ground itself: one cell per patch, height = fuel, marked if burning ──
    ops.push({ op: "text", x: x + 6, y, s: "PATCHES", dim: 0.6 });
    y += 10;
    const cellW = Math.max(2, Math.floor((COL_W - 14) / place.patches.length));
    const baseline = y + 40;
    ops.push({ op: "line", x1: x + 6, y1: baseline, x2: x + 6 + cellW * place.patches.length, y2: baseline, dim: 0.5 });
    place.patches.forEach((patch, p) => {
      const px = x + 6 + p * cellW;
      const h = Math.min(38, patch.fuel * 26);
      if (h > 0.5) ops.push({ op: "rect", x: px, y: baseline - h, w: Math.max(1, cellW - 1), h, dim: 0.8 });
      const sh = Math.min(12, patch.starch * 40);
      if (sh > 0.5) ops.push({ op: "fill", x: px, y: baseline + 2, w: Math.max(1, cellW - 1), h: sh, dim: 0.55 });
      if (patch.burning > 0) {
        // a burning patch gets a hard cross — unmissable, which is the point of a mark
        ops.push({ op: "line", x1: px, y1: baseline - 40, x2: px + cellW, y2: baseline, w: 2 });
        ops.push({ op: "line", x1: px, y1: baseline, x2: px + cellW, y2: baseline - 40, w: 2 });
      }
    });
  });

  // ── routes along the bottom: wind as a signed bar ──────────────────────────
  const ry = HEIGHT - 42;
  ops.push({ op: "line", x1: COL_X, y1: ry - 22, x2: WIDTH - COL_X, y2: ry - 22, dim: 0.4 });
  ops.push({ op: "text", x: COL_X, y: ry - 16, s: "WIND (pressure gradient along each route)", dim: 0.7 });
  frame.routes.forEach((route, i) => {
    const x = COL_X + i * 190;
    const mid = x + 60;
    ops.push({ op: "text", x, y: ry + 2, s: `${route.from}>${route.to}`, dim: 0.7 });
    ops.push({ op: "line", x1: mid, y1: ry - 4, x2: mid, y2: ry + 12, dim: 0.4 });
    // auto-scaled to the largest gradient present, so nothing clips and the relative
    // sizes stay honest — a clipped bar lies about magnitude
    const peak = Math.max(1, ...frame.routes.map((r) => Math.abs(r.gradient)));
    const w = (route.gradient / peak) * 58;
    ops.push({ op: "fill", x: w >= 0 ? mid : mid + w, y: ry + 1, w: Math.abs(w), h: 6, dim: 1 });
    ops.push({ op: "text", x: mid + 66, y: ry + 2, s: route.gradient.toFixed(2), dim: 0.7 });
  });

  return ops;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE MAP. Places in space, routes as real links, wind as arrows along them.
//
// The column dashboard hides the one thing that matters most about this world: it is
// COUPLED. Run 02 went extinct because a single place could not rot its own fruit, and the
// shared atmosphere carried that failure to five places that could. In columns that reads
// as six unrelated obituaries. On a map it reads as one event with a source.
// ─────────────────────────────────────────────────────────────────────────────

function arrow(ops: Op[], x1: number, y1: number, x2: number, y2: number, dim: number): void {
  ops.push({ op: "line", x1, y1, x2, y2, dim });
  const a = Math.atan2(y2 - y1, x2 - x1);
  const head = 7;
  ops.push({ op: "line", x1: x2, y1: y2, x2: x2 - Math.cos(a - 0.4) * head, y2: y2 - Math.sin(a - 0.4) * head, dim });
  ops.push({ op: "line", x1: x2, y1: y2, x2: x2 - Math.cos(a + 0.4) * head, y2: y2 - Math.sin(a + 0.4) * head, dim });
}

function ring(ops: Op[], cx: number, cy: number, r: number, dim: number, steps = 40): void {
  for (let i = 0; i < steps; i++) {
    const a1 = (i / steps) * Math.PI * 2;
    const a2 = ((i + 1) / steps) * Math.PI * 2;
    ops.push({
      op: "line",
      x1: cx + Math.cos(a1) * r, y1: cy + Math.sin(a1) * r,
      x2: cx + Math.cos(a2) * r, y2: cy + Math.sin(a2) * r,
      dim,
    });
  }
}

const MAP_CX = WIDTH / 2 - 130;
const MAP_CY = HEIGHT / 2 + 10;
const MAP_R = 250;

/** Where the map puts place `index` of `count`.
 *
 *  Exported because the page hit-tests clicks against it to pick a place to zoom. If the
 *  click and the drawing worked this out separately they would drift, and a viewer whose
 *  clicks land next to what they appear to land on is the same lie as a viewer that draws
 *  the wrong picture — just slower to notice. */
export function mapPlaceAt(index: number, count: number): { x: number; y: number } {
  const a = (index / count) * Math.PI * 2 - Math.PI / 2;
  return { x: MAP_CX + Math.cos(a) * MAP_R, y: MAP_CY + Math.sin(a) * MAP_R * 0.72 };
}

export function sceneMap(frame: Frame, history: Frame[] = []): Op[] {
  const ops: Op[] = [];

  ops.push({ op: "text", x: COL_X, y: 22, s: `MAP  TICK ${frame.tick}`, scale: 2 });
  ops.push({ op: "text", x: COL_X, y: 46, s: `YEAR ${frame.yearPhase.toFixed(2)}  C ${frame.totals.carbon.toFixed(1)}  N ${frame.totals.nitrogen.toFixed(1)}  MIG ${frame.migrations}`, dim: 0.8 });
  ops.push({ op: "line", x1: COL_X, y1: 58, x2: WIDTH - COL_X, y2: 58, dim: 0.4 });

  const at = (i: number) => mapPlaceAt(i, frame.places.length);

  // routes first, so nodes sit on top
  const peak = Math.max(1e-9, ...frame.routes.map((r) => Math.abs(r.gradient)));
  for (const route of frame.routes) {
    const a = at(route.from);
    const b = at(route.to);
    const from = route.gradient >= 0 ? a : b;
    const to = route.gradient >= 0 ? b : a;
    const strength = Math.abs(route.gradient) / peak;
    // the arrow shows which way the air is actually going, and how hard
    const mx = from.x + (to.x - from.x) * (0.25 + 0.5 * strength);
    const my = from.y + (to.y - from.y) * (0.25 + 0.5 * strength);
    ops.push({ op: "line", x1: a.x, y1: a.y, x2: b.x, y2: b.y, dim: 0.3 });
    arrow(ops, from.x + (to.x - from.x) * 0.22, from.y + (to.y - from.y) * 0.22, mx, my, 0.4 + 0.6 * strength);
    const lx = (a.x + b.x) / 2;
    const ly = (a.y + b.y) / 2;
    ops.push({ op: "text", x: lx - 10, y: ly - 8, s: route.gradient.toFixed(2), dim: 0.65 });
  }

  frame.places.forEach((place, i) => {
    const p = at(i);
    const alive = place.alive.plants + place.alive.fungi + place.alive.grazers;
    const dead = alive === 0;

    // size carries standing biomass; the ring carries whether anything is home
    const r = 16 + Math.min(34, alive * 0.9);
    ring(ops, p.x, p.y, r, dead ? 0.35 : 0.95);
    if (!dead) {
      // inner rings: one per kingdom, so composition reads without labels
      ring(ops, p.x, p.y, Math.max(3, r * 0.66), 0.6);
      ring(ops, p.x, p.y, Math.max(2, r * 0.33), 0.45);
    } else {
      ops.push({ op: "line", x1: p.x - r, y1: p.y - r, x2: p.x + r, y2: p.y + r, dim: 0.7 });
      ops.push({ op: "line", x1: p.x + r, y1: p.y - r, x2: p.x - r, y2: p.y + r, dim: 0.7 });
    }

    // fire ring: burning patches as ticks around the edge
    const burning = place.patches.filter((q) => q.burning > 0).length;
    for (let f = 0; f < burning; f++) {
      const a = (f / Math.max(1, place.patches.length)) * Math.PI * 2;
      ops.push({ op: "line", x1: p.x + Math.cos(a) * (r + 3), y1: p.y + Math.sin(a) * (r + 3),
        x2: p.x + Math.cos(a) * (r + 9), y2: p.y + Math.sin(a) * (r + 9), w: 2 });
    }

    const lx = p.x - 30;
    const ly = p.y + r + 8;
    ops.push({ op: "text", x: lx, y: ly, s: place.name.toUpperCase(), dim: dead ? 0.6 : 1 });
    ops.push({ op: "text", x: lx, y: ly + 10, s: `${place.alive.plants}/${place.alive.fungi}/${place.alive.grazers}`, dim: 0.8 });
    ops.push({ op: "text", x: lx, y: ly + 20, s: `o2 ${(place.air.O2 ?? 0).toFixed(0)} co2 ${(place.air.CO2 ?? 0).toFixed(0)}`, dim: 0.65 });
    // the carbon this place is SITTING ON — the thing that killed run 02
    const locked = place.soil.starch + place.soil.cellulose + place.soil.lignin;
    ops.push({ op: "text", x: lx, y: ly + 30, s: `locked ${locked.toFixed(0)}`, dim: locked > 40 ? 1 : 0.5 });
    if (locked > 40) {
      ops.push({ op: "fill", x: lx - 4, y: ly + 29, w: 3, h: 7, dim: 1 });
    }
  });

  // ── world panel on the right: where the carbon actually is ────────────────
  const px = WIDTH - 290;
  let py = 90;
  ops.push({ op: "text", x: px, y: py, s: "WHERE THE CARBON IS" });
  py += 16;
  const inAir = frame.places.reduce((a, p) => a + (p.air.CO2 ?? 0), 0);
  const inGround = frame.places.reduce((a, p) => a + (p.soil.starch + p.soil.cellulose + p.soil.lignin) * 6, 0);
  const scale = Math.max(inAir, inGround, 1) * 1.1;
  bar(ops, px, py, 150, inAir, scale, `air ${inAir.toFixed(0)}`);
  py += 16;
  bar(ops, px, py, 150, inGround, scale, `ground ${inGround.toFixed(0)}`);
  py += 26;

  ops.push({ op: "text", x: px, y: py, s: "WORLD HISTORY", dim: 0.8 });
  py += 12;
  const past = [...history, frame];
  spark(ops, px, py, 150, 30, past.map((f) => f.places.reduce((a, p) => a + p.alive.plants + p.alive.grazers + p.alive.fungi, 0)), "alive");
  py += 38;
  spark(ops, px, py, 150, 30, past.map((f) => f.places.reduce((a, p) => a + (p.air.CO2 ?? 0), 0)), "co2");
  py += 38;
  spark(ops, px, py, 150, 30, past.map((f) => f.places.reduce((a, p) => a + (p.air.O2 ?? 0), 0)), "o2");
  py += 38;
  spark(ops, px, py, 150, 30, past.map((f) => f.places.reduce((a, p) => a + p.ignitions, 0)), "fires");
  return ops;
}

/** ZOOM: one place, close up — every patch drawn individually. */
export function sceneZoom(frame: Frame, index: number, history: Frame[] = []): Op[] {
  const ops: Op[] = [];
  const place = frame.places[index];
  if (!place) return ops;

  ops.push({ op: "text", x: COL_X, y: 22, s: `${place.name.toUpperCase()}  TICK ${frame.tick}`, scale: 2 });
  ops.push({
    op: "text", x: COL_X, y: 48, dim: 0.8,
    s: `lat ${place.latitude.toFixed(2)}  T ${place.temperature.toFixed(1)}  P ${place.pressure.toFixed(0)}  sun ${place.light.toFixed(2)}`,
  });
  ops.push({ op: "line", x1: COL_X, y1: 60, x2: WIDTH - COL_X, y2: 60, dim: 0.4 });

  // each patch as a tall column: fuel above the line, fruit below, fire as a cross
  const n = place.patches.length;
  const cw = Math.floor((WIDTH - 2 * COL_X - 300) / n);
  const base = 330;
  const fuelScale = Math.max(0.6, ...place.patches.map((q) => q.fuel));
  const fruitScale = Math.max(0.3, ...place.patches.map((q) => q.starch));

  ops.push({ op: "text", x: COL_X, y: 80, s: `PATCHES (fuel up, fruit down)  fuel max ${fuelScale.toFixed(1)}  fruit max ${fruitScale.toFixed(1)}`, dim: 0.7 });
  ops.push({ op: "line", x1: COL_X, y1: base, x2: COL_X + cw * n, y2: base, dim: 0.6 });

  place.patches.forEach((patch, i) => {
    const x = COL_X + i * cw;
    const fh = (patch.fuel / fuelScale) * 210;
    if (fh > 0.5) ops.push({ op: "rect", x, y: base - fh, w: Math.max(2, cw - 2), h: fh, dim: 0.85 });
    const sh = (patch.starch / fruitScale) * 120;
    if (sh > 0.5) ops.push({ op: "fill", x, y: base + 2, w: Math.max(2, cw - 2), h: sh, dim: 0.6 });
    if (patch.burning > 0) {
      ops.push({ op: "line", x1: x, y1: base - fh - 14, x2: x + cw - 2, y2: base - fh - 2, w: 2 });
      ops.push({ op: "line", x1: x + cw - 2, y1: base - fh - 14, x2: x, y2: base - fh - 2, w: 2 });
    }
    if (i % 4 === 0) ops.push({ op: "text", x: x + 1, y: base + 128, s: String(i), dim: 0.5 });
  });

  // detail column on the right
  const px = WIDTH - 270;
  let py = 90;
  const airScale = Math.max(1, place.air.O2 ?? 0, place.air.CO2 ?? 0, place.air.N2 ?? 0) * 1.15;
  ops.push({ op: "text", x: px, y: py, s: "AIR" });
  py += 14;
  for (const gas of ["O2", "CO2", "N2"] as const) {
    bar(ops, px, py, 120, place.air[gas] ?? 0, airScale, `${gas} ${(place.air[gas] ?? 0).toFixed(1)}`);
    py += 15;
  }
  py += 12;
  ops.push({ op: "text", x: px, y: py, s: "GROUND" });
  py += 14;
  const gScale = Math.max(1, place.soil.cellulose, place.soil.lignin, place.soil.starch) * 1.15;
  for (const [k, v] of [["cel", place.soil.cellulose], ["lig", place.soil.lignin], ["sta", place.soil.starch], ["nh3", place.soil.ammonia]] as const) {
    bar(ops, px, py, 120, v as number, k === "nh3" ? Math.max(1, place.soil.ammonia) * 1.15 : gScale, `${k} ${(v as number).toFixed(2)}`);
    py += 15;
  }
  py += 12;
  ops.push({ op: "text", x: px, y: py, s: "ALIVE" });
  py += 14;
  ops.push({ op: "text", x: px, y: py, s: `plants  ${place.alive.plants}`, dim: 0.85 });
  py += 12;
  ops.push({ op: "text", x: px, y: py, s: `fungi   ${place.alive.fungi}`, dim: 0.85 });
  py += 12;
  ops.push({ op: "text", x: px, y: py, s: `grazers ${place.alive.grazers}`, dim: 0.85 });
  py += 18;
  ops.push({ op: "text", x: px, y: py, s: `fires ${place.ignitions}  died ${place.deaths}`, dim: 0.7 });
  py += 12;
  ops.push({ op: "text", x: px, y: py, s: `meals ${place.meals}`, dim: 0.7 });
  py += 22;

  const past = [...history, frame];
  ops.push({ op: "text", x: px, y: py, s: "HISTORY", dim: 0.8 });
  py += 12;
  spark(ops, px, py, 120, 26, past.map((f) => f.places[index]?.alive.plants ?? 0), "pla");
  py += 34;
  spark(ops, px, py, 120, 26, past.map((f) => f.places[index]?.soil.starch ?? 0), "sta");
  py += 34;
  spark(ops, px, py, 120, 26, past.map((f) => f.places[index]?.air.CO2 ?? 0), "co2");
  return ops;
}
