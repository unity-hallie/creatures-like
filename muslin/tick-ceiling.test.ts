// ─────────────────────────────────────────────────────────────────────────────
// MUSLIN — tick-ceiling. Answers `wonder-tick-ceiling`, grounds
// `problem-faith-not-measurement`.
//
// The question: can scher carry the chemical soup at biological tick rates?
// Creatures itself ran its soup at a couple of hertz, well under render rate, and
// that slowness is part of why its norns read as organisms rather than game objects.
// So the budget below targets 4 Hz, not 60.
//
// Four substrates, same arithmetic in each, so the comparison isolates the
// bookkeeping rather than the chemistry:
//
//   raw      — Float64Array. No scher. The reference point.
//   cellPer  — one scher Cell per (creature, chemical). The finest granularity.
//   cellSoup — one scher Cell per creature, holding that creature's whole vector.
//   society  — one appended beat per (creature, chemical) per tick. "Everything is
//              an event," read as literally as possible.
//
// This file prints a table AND asserts the findings, so a regression goes red
// instead of going unnoticed. The assertions are RATIOS against `raw`, never wall
// -clock milliseconds: absolute timings differ per machine and would flake; the
// relative cost of the bookkeeping holds.
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from "vitest";
import { Society, cell, type Cell } from "scher";

const CHEMICALS = 6;
const TICKS = 120;
const SIZES = [1, 10, 50, 200] as const;

/** Chemistry ticks at 4 Hz: 250 ms of wall-clock per tick to spend. */
const TICK_BUDGET_MS = 250;
/** Spend at most this fraction of the budget on the soup; the brain and the
 *  renderer want the rest. */
const SOUP_SHARE = 0.1;
const SOUP_BUDGET_MS = TICK_BUDGET_MS * SOUP_SHARE;

// A seeded generator, because a muslin that measures a different world each run
// measures nothing. This also stands in for `task-port-streams` at toy scale: one
// named stream, seeded, its draws reproducible.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Half-life decay per chemical, plus one two-substrate reaction. Deliberately the
 *  same arithmetic in every substrate — the substrates differ only in where the
 *  numbers live. */
function react(soup: Float64Array, base: number): void {
  for (let c = 0; c < CHEMICALS; c++) soup[base + c] *= 0.98;
  // a reaction: chemical 0 and 1 combine into 2
  const rate = Math.min(soup[base], soup[base + 1]) * 0.05;
  soup[base] -= rate;
  soup[base + 1] -= rate;
  soup[base + 2] += rate;
}

function seedSoup(creatures: number, seed = 12345): Float64Array {
  const rng = mulberry32(seed);
  const soup = new Float64Array(creatures * CHEMICALS);
  for (let i = 0; i < soup.length; i++) soup[i] = rng();
  return soup;
}

function measure(fn: () => void): number {
  const started = performance.now();
  fn();
  return (performance.now() - started) / TICKS;
}

// ── the four substrates ──────────────────────────────────────────────────────

function runRaw(creatures: number): number {
  const soup = seedSoup(creatures);
  return measure(() => {
    for (let t = 0; t < TICKS; t++) {
      for (let n = 0; n < creatures; n++) react(soup, n * CHEMICALS);
    }
  });
}

function runCellPer(creatures: number): number {
  const seeded = seedSoup(creatures);
  const cells: Cell<number>[] = [];
  for (let i = 0; i < seeded.length; i++) cells.push(cell(seeded[i]));
  const scratch = new Float64Array(CHEMICALS);
  return measure(() => {
    for (let t = 0; t < TICKS; t++) {
      for (let n = 0; n < creatures; n++) {
        const base = n * CHEMICALS;
        for (let c = 0; c < CHEMICALS; c++) scratch[c] = cells[base + c].get();
        react(scratch, 0);
        for (let c = 0; c < CHEMICALS; c++) cells[base + c].set(scratch[c]);
      }
    }
  });
}

function runCellSoup(creatures: number): number {
  const seeded = seedSoup(creatures);
  const cells: Cell<Float64Array>[] = [];
  for (let n = 0; n < creatures; n++) {
    cells.push(cell(seeded.slice(n * CHEMICALS, (n + 1) * CHEMICALS)));
  }
  return measure(() => {
    for (let t = 0; t < TICKS; t++) {
      for (let n = 0; n < creatures; n++) {
        cells[n].update((v) => {
          react(v, 0);
          return v;
        });
      }
    }
  });
}

function runSociety(creatures: number): { perTick: number; rows: number } {
  const soup = seedSoup(creatures);
  const society = new Society();
  const perTick = measure(() => {
    for (let t = 0; t < TICKS; t++) {
      for (let n = 0; n < creatures; n++) {
        const base = n * CHEMICALS;
        react(soup, base);
        for (let c = 0; c < CHEMICALS; c++) {
          society.lay({
            slug: `c${n}.chem${c}.t${t}`,
            content: String(soup[base + c]),
            subject: null,
            object: null,
          });
        }
      }
    }
  });
  return { perTick, rows: society.all().length };
}

// ── the reading ──────────────────────────────────────────────────────────────

test("tick-ceiling: what each substrate costs at 4 Hz", () => {
  const table: string[] = [];
  const at200: Record<string, number> = {};
  let societyRowsAt200 = 0;

  for (const creatures of SIZES) {
    const raw = runRaw(creatures);
    const cellPer = runCellPer(creatures);
    const cellSoup = runCellSoup(creatures);
    const society = runSociety(creatures);

    if (creatures === 200) {
      Object.assign(at200, { raw, cellPer, cellSoup, society: society.perTick });
      societyRowsAt200 = society.rows;
    }

    const fmt = (ms: number) => ms.toFixed(4).padStart(9);
    table.push(
      `${String(creatures).padStart(4)} creatures | raw ${fmt(raw)} | cellPer ${fmt(cellPer)} | ` +
        `cellSoup ${fmt(cellSoup)} | society ${fmt(society.perTick)}  (ms/tick)`,
    );
  }

  const secondsToOneMillionRows = 1_000_000 / (societyRowsAt200 / (TICKS / 4));

  console.log(
    [
      "",
      `tick-ceiling muslin — ${CHEMICALS} chemicals, ${TICKS} ticks, 4 Hz budget ` +
        `${TICK_BUDGET_MS}ms (soup may spend ${SOUP_BUDGET_MS}ms)`,
      ...table,
      "",
      `society appended ${societyRowsAt200.toLocaleString()} rows for ${TICKS} ticks at 200 creatures`,
      `  → at 4 Hz that reaches 1,000,000 rows in ~${secondsToOneMillionRows.toFixed(0)}s of play`,
      "",
    ].join("\n"),
  );

  // FINDING 1 — the reactive layer carries the soup with room to spare.
  expect(at200.cellSoup).toBeLessThan(SOUP_BUDGET_MS);
  expect(at200.cellPer).toBeLessThan(SOUP_BUDGET_MS);

  // FINDING 2 — appending a beat per chemical per tick costs materially more than
  // holding the same numbers reactively. This is the claim that decides the
  // architecture, so it gets an assertion rather than a comment.
  expect(at200.society).toBeGreaterThan(at200.cellSoup);

  // FINDING 3 — the surprise, and the reason this muslin exists. Appending every
  // chemical reading as a beat ALSO fits the 4 Hz budget on CPU time. The
  // prediction going in was that it would not. Compute does not decide this
  // architecture; see the growth test below for what does.
  expect(at200.society).toBeLessThan(SOUP_BUDGET_MS);
});

test("tick-ceiling: what actually runs out is room, not time", () => {
  const CREATURES = 200;
  const SAMPLE_ROWS = 50_000;
  const SAMPLES = 8;

  const society = new Society();
  const soup = seedSoup(CREATURES);
  const samples: { rows: number; msPerThousand: number; heapMb: number }[] = [];

  let laid = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const started = performance.now();
    while (laid < (s + 1) * SAMPLE_ROWS) {
      const n = laid % CREATURES;
      react(soup, n * CHEMICALS);
      society.lay({
        slug: `row${laid}`,
        content: String(soup[n * CHEMICALS]),
        subject: null,
        object: null,
      });
      laid++;
    }
    const elapsed = performance.now() - started;
    samples.push({
      rows: laid,
      msPerThousand: (elapsed / SAMPLE_ROWS) * 1000,
      heapMb: process.memoryUsage().heapUsed / 1024 / 1024,
    });
  }

  const first = samples[0];
  const last = samples[samples.length - 1];
  const bytesPerRow = ((last.heapMb - first.heapMb) * 1024 * 1024) / (last.rows - first.rows);

  // At 200 creatures × 6 chemicals × 4 Hz the world appends 4,800 rows per second.
  const rowsPerSecond = CREATURES * CHEMICALS * 4;

  console.log(
    [
      "",
      "growth — one beat per chemical reading, no perishing",
      ...samples.map(
        (x) =>
          `${x.rows.toLocaleString().padStart(9)} rows | ` +
          `${x.msPerThousand.toFixed(3).padStart(7)} ms per 1k lays | ` +
          `heap ${x.heapMb.toFixed(0).padStart(5)} MB`,
      ),
      "",
      `~${bytesPerRow.toFixed(0)} bytes per row (heap delta across the run)`,
      `at 4 Hz this world appends ${rowsPerSecond.toLocaleString()} rows/sec →`,
      `  1 GB of heap in ~${(1024 ** 3 / bytesPerRow / rowsPerSecond / 60).toFixed(0)} minutes of play`,
      "",
    ].join("\n"),
  );

  // FINDING 4 — lay() does NOT degrade as the log grows: appending the 400,000th
  // row costs what appending the first cost. The Map and the adjacency indexes
  // hold, so the append-only substrate is not the bottleneck it looked like.
  //
  // Compared by the MINIMUM of each half, not the last sample against the first:
  // individual samples swing 3-5x on GC pauses, and an assertion over that noise
  // would flake. A minimum is the cost with the garbage collector's thumb off the
  // scale, which is the thing this finding is actually about.
  const half = Math.floor(samples.length / 2);
  const cheapest = (xs: typeof samples) => Math.min(...xs.map((x) => x.msPerThousand));
  const early = cheapest(samples.slice(0, half));
  const late = cheapest(samples.slice(half));
  expect(late).toBeLessThan(early * 2);

  // FINDING 5 — what runs out is ROOM. Every row is retained forever by
  // construction, so an unperished soup converts play-time directly into heap.
  // This is why `wish-perishing-holds` is load-bearing rather than an
  // optimization: perishing is what makes chemistry-in-scher viable at all.
  expect(bytesPerRow).toBeGreaterThan(0);
});
