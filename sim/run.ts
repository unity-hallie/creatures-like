// The long run: a large world, left going, checkpointed so it can be looked at afterwards.
//
// Nothing here decides what should happen. It builds a varied world, ticks it, and writes
// down what it finds at intervals — which is the only way to answer "what develops?"
// honestly. The frames it writes are what viewer/wireframe.html reads.
//
// Checkpoints are whole frames rather than deltas, because a frame that can only be read
// by replaying every frame before it is not a checkpoint, it is a tape.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Ecosystem } from "../src/ecology.js";
import { Geography, type Route } from "../src/geography.js";
import { COMPLETE_ROTTER, FUNGUS, GRASS, LEGUME, MOSS, SAPROPHYTE, TREE } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";

const args = new Map<string, string>();
for (const arg of process.argv.slice(2)) {
  const [k, v] = arg.replace(/^--/, "").split("=");
  args.set(k, v ?? "true");
}

const OUT = args.get("out") ?? "runs/latest";
const LOG_EVERY_MS = Number(args.get("logEvery") ?? 15_000);
const CHECKPOINT_EVERY_MS = Number(args.get("checkpointEvery") ?? 20_000);
const MAX_TICKS = Number(args.get("ticks") ?? 5_000_000);
const SEED = Number(args.get("seed") ?? 20260814);

mkdirSync(OUT, { recursive: true });

/** A world with variety in it: different producers, different decomposers, different
 *  latitudes, different sized skies. Uniform worlds have nothing to say. */
function buildWorld(): Geography {
  const places = [
    new Ecosystem({ seed: SEED + 1, name: "boreal", latitude: 0.95, plantGenome: TREE, fungusGenome: SAPROPHYTE,
      plants: 26, fungi: 10, grazers: 8, width: 24, volume: 90, soilAmmonia: 0.6 }),
    new Ecosystem({ seed: SEED + 2, name: "taiga", latitude: 0.6, plantGenome: TREE, fungusGenome: COMPLETE_ROTTER,
      plants: 26, fungi: 12, grazers: 8, width: 24, volume: 100, soilAmmonia: 0.5 }),
    new Ecosystem({ seed: SEED + 3, name: "steppe", latitude: 0.2, plantGenome: GRASS, fungusGenome: SAPROPHYTE,
      plants: 30, fungi: 12, grazers: 12, width: 24, volume: 130, soilAmmonia: 0.3 }),
    new Ecosystem({ seed: SEED + 4, name: "savanna", latitude: -0.2, plantGenome: GRASS, fungusGenome: COMPLETE_ROTTER,
      plants: 30, fungi: 12, grazers: 12, width: 24, volume: 130, soilAmmonia: 0.25 }),
    new Ecosystem({ seed: SEED + 5, name: "wetland", latitude: -0.6, plantGenome: MOSS, fungusGenome: SAPROPHYTE,
      plants: 28, fungi: 14, grazers: 6, width: 24, volume: 110, soilAmmonia: 0.8 }),
    new Ecosystem({ seed: SEED + 6, name: "scrub", latitude: -0.95, plantGenome: LEGUME, fungusGenome: FUNGUS,
      plants: 24, fungi: 10, grazers: 8, width: 24, volume: 95, soilAmmonia: 0.05 }),
  ];

  // a chain with one long way round, so the far ends are genuinely far
  const routes: Route[] = [
    { from: 0, to: 1, conductance: 0.30, cost: 0.35 },
    { from: 1, to: 2, conductance: 0.28, cost: 0.40 },
    { from: 2, to: 3, conductance: 0.34, cost: 0.30 },
    { from: 3, to: 4, conductance: 0.26, cost: 0.45 },
    { from: 4, to: 5, conductance: 0.22, cost: 0.55 },
    { from: 5, to: 0, conductance: 0.10, cost: 0.90 },
  ];

  return new Geography({ places, routes, seed: SEED, dayLength: 90, yearLength: 8, seasonality: 0.75 });
}

interface Frame {
  tick: number;
  dayPhase: number;
  yearPhase: number;
  totals: { carbon: number; nitrogen: number };
  migrations: number;
  places: Array<{
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
  }>;
  routes: Array<{ from: number; to: number; gradient: number }>;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function snapshot(geo: Geography): Frame {
  return {
    tick: geo.tick,
    dayPhase: geo.dayPhase(0),
    yearPhase: geo.yearPhase(),
    totals: { carbon: geo.totalCarbon(), nitrogen: geo.totalNitrogen() },
    migrations: geo.migrations,
    places: geo.places.map((p) => ({
      name: p.name,
      latitude: p.latitude,
      temperature: p.temperature,
      pressure: p.pressure(),
      light: p.light,
      air: {
        O2: p.air.get(CHEMS.o2),
        CO2: p.air.get(CHEMS.co2),
        N2: p.air.get(CHEMS.n2),
      },
      soil: {
        ammonia: sum(p.patches.map((q) => q.soup.get(CHEMS.ammonia))),
        cellulose: sum(p.patches.map((q) => q.soup.get(CHEMS.cellulose))),
        lignin: sum(p.patches.map((q) => q.soup.get(CHEMS.lignin))),
        starch: sum(p.patches.map((q) => q.soup.get(CHEMS.starch))),
      },
      patches: p.patches.map((q) => ({
        fuel: q.soup.get(CHEMS.cellulose) + q.soup.get(CHEMS.lignin),
        starch: q.soup.get(CHEMS.starch),
        burning: q.burning,
      })),
      alive: {
        plants: p.plants.filter((r) => r.organism.alive).length,
        fungi: p.fungi.filter((r) => r.organism.alive).length,
        grazers: p.grazers.filter((r) => r.organism.alive).length,
      },
      ignitions: p.ignitions,
      deaths: p.deaths,
      meals: p.meals,
    })),
    routes: geo.winds().map((w) => ({ from: w.route.from, to: w.route.to, gradient: w.gradient })),
  };
}

// ── resume, if there is anything to resume from ──────────────────────────────
const manifestPath = join(OUT, "manifest.json");
interface Manifest {
  seed: number;
  frames: Array<{ file: string; tick: number }>;
  startedAt: string;
  note?: string;
}
const manifest: Manifest = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest)
  : { seed: SEED, frames: [], startedAt: new Date().toISOString() };

const geo = buildWorld();
const carbonAtStart = geo.totalCarbon();
const nitrogenAtStart = geo.totalNitrogen();

let frameNo = manifest.frames.length;
function checkpoint(reason: string): void {
  const frame = snapshot(geo);
  const file = `frame-${String(frameNo).padStart(5, "0")}.json`;
  writeFileSync(join(OUT, file), JSON.stringify(frame));
  manifest.frames.push({ file, tick: frame.tick });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  frameNo++;
  console.log(`[checkpoint] ${reason} tick=${frame.tick} -> ${file} (${manifest.frames.length} frames)`);
}

function logLine(): void {
  const f = snapshot(geo);
  const drift = Math.abs(f.totals.carbon - carbonAtStart);
  const nDrift = Math.abs(f.totals.nitrogen - nitrogenAtStart);
  const parts = f.places.map(
    (p) => `${p.name.slice(0, 4)} ${p.alive.plants}/${p.alive.fungi}/${p.alive.grazers} f${p.ignitions}`,
  );
  console.log(
    `t=${String(f.tick).padStart(7)} yr=${f.yearPhase.toFixed(2)} ` +
      `C=${f.totals.carbon.toFixed(2)} (drift ${drift.toExponential(1)}) ` +
      `N=${f.totals.nitrogen.toFixed(2)} (drift ${nDrift.toExponential(1)}) ` +
      `mig=${f.migrations} | ${parts.join(" | ")}`,
  );
}

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopping) process.exit(1);
    stopping = true;
    checkpoint(`shutdown:${signal}`);
    process.exit(0);
  });
}

console.log(`[start] seed=${SEED} places=${geo.places.length} out=${OUT}`);
console.log(`[start] carbon=${carbonAtStart.toFixed(4)} nitrogen=${nitrogenAtStart.toFixed(4)}`);
checkpoint("initial");
logLine();

let lastLog = Date.now();
let lastCheckpoint = Date.now();

while (geo.tick < MAX_TICKS && !stopping) {
  // a slab of ticks between clock checks, so the clock is not read per tick
  for (let i = 0; i < 200; i++) geo.step();

  const now = Date.now();
  if (now - lastLog >= LOG_EVERY_MS) {
    logLine();
    lastLog = now;
  }
  if (now - lastCheckpoint >= CHECKPOINT_EVERY_MS) {
    checkpoint("interval");
    lastCheckpoint = now;
  }
}

checkpoint("final");
console.log("[done]");
