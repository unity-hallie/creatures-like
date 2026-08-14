// The Carboniferous experiment.
//
// The claim: a world whose decomposers cannot rot lignin accumulates fuel and burns more
// often. Nothing in the fire code knows about lignin-eating — the only difference between
// the two worlds below is ONE enzyme gene in ONE genome. If the fire regime moves, it
// moved downstream of gene space, which is the whole thesis at planetary scale.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { FUNGUS, LIGNIN_EATER, MOSS, PLANT, TREE } from "../src/flora.js";
import { Organism } from "../src/organism.js";
import { CHEMS } from "../src/genome.js";
import { accessibility, keysFor, lockEntropy, LOCKS, partialKeys, MOTIF_SLOTS } from "../src/digestion.js";

const SEEDS = [1, 2, 3, 4];

const ligninOnGround = (eco: Ecosystem) =>
  eco.patches.reduce((acc, p) => acc + p.soup.get(CHEMS.lignin), 0);

function run(fungusGenome: typeof FUNGUS, seed: number, ticks = 900) {
  const eco = new Ecosystem({ seed, fungusGenome, plants: 10, fungi: 5 });
  const carbonAtStart = eco.totalCarbon();
  for (let i = 0; i < ticks; i++) eco.step();
  return { eco, carbonAtStart };
}

test("a world that cannot rot its lignin burns more often", () => {
  // STATED AS A MEAN, and it has to be. Per-seed this held cleanly until organisms could
  // starve; once they could, the two arms stopped being the same world with one gene
  // changed. A death shifts how many draws the dice take, the trajectories diverge, and
  // by tick 900 the arms differ in plant population for reasons that have nothing to do
  // with lignin. The controlled-experiment framing was borrowed from a world without
  // mortality and did not survive contact with one.
  //
  // The effect is real and it is statistical: across eight seeds the un-rotted world
  // burns more and carries more lignin, while individual seeds go either way.
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  const stuck = seeds.map((s) => run(FUNGUS, s).eco);
  const evolved = seeds.map((s) => run(LIGNIN_EATER, s).eco);

  expect(mean(stuck.map((e) => e.ignitions))).toBeGreaterThan(mean(evolved.map((e) => e.ignitions)));
  expect(mean(stuck.map(ligninOnGround))).toBeGreaterThan(mean(evolved.map(ligninOnGround)));
});

test("carbon is conserved across the whole world, whatever burns", () => {
  for (const seed of SEEDS) {
    const { eco, carbonAtStart } = run(FUNGUS, seed, 600);
    // Exact, not approximate. Every crossing goes through `transfer`, every reaction runs
    // to an extent, and combustion balances by the same carbon counts as respiration.
    expect(eco.totalCarbon()).toBeCloseTo(carbonAtStart, 6);
  }
});

test("a lock's difficulty is its entropy, and lignin is the hard one", () => {
  // Starch sits in one motif; lignin smears across all twelve. That spread is not
  // decoration — it is why one enzyme opens cellulose and no one enzyme opens lignin.
  expect(lockEntropy(LOCKS.starch)).toBe(0);
  expect(lockEntropy(LOCKS.lignin)).toBeGreaterThan(lockEntropy(LOCKS.cellulose));
  expect(lockEntropy(LOCKS.lignin)).toBeGreaterThan(0.95);
});

test("accessibility is gradual: a lineage can digest lignin badly before digesting it well", () => {
  const full = accessibility(LOCKS.lignin, keysFor(LOCKS.lignin));
  const partial = accessibility(LOCKS.lignin, partialKeys(LOCKS.lignin, 4));
  const none = accessibility(LOCKS.lignin, new Array(MOTIF_SLOTS).fill(0));

  expect(full).toBeCloseTo(1);
  expect(partial).toBeGreaterThan(0.2);
  expect(partial).toBeLessThan(full);
  expect(none).toBe(0);

  // cellulose is a crystalline repeat: one key covers most of it
  expect(accessibility(LOCKS.cellulose, partialKeys(LOCKS.cellulose, 1))).toBeGreaterThan(0.7);
});

test("waste is the complement of accessibility, not a separate mechanism", () => {
  const cellulaseOnly = new Organism({ genome: FUNGUS });
  const ligninEater = new Organism({ genome: LIGNIN_EATER });

  expect(cellulaseOnly.accessTo(CHEMS.cellulose)).toBeCloseTo(1);
  expect(cellulaseOnly.accessTo(CHEMS.lignin)).toBe(0);
  expect(ligninEater.accessTo(CHEMS.lignin)).toBeCloseTo(1);

  // glucose carries no lock at all, which is why everything competes for it
  expect(cellulaseOnly.accessTo(CHEMS.glucose)).toBe(1);
});

test("a plant expresses no lobe and runs the same machinery anyway", () => {
  const plant = new Organism({ genome: PLANT });
  expect(plant.expressed.lobe).toBeUndefined();
  expect(plant.expressed.reactions.length).toBeGreaterThan(0);
});

test("a moss world burns less than a forest, because moss builds no lignin", () => {
  // The Carboniferous claim run backwards. Bryophytes never evolved lignin; neither has
  // MOSS. Same fungi, same fire code, same seeds — only the producer's genome differs.
  for (const seed of [1, 2, 3]) {
    const forest = new Ecosystem({ seed, plantGenome: TREE, fungusGenome: FUNGUS, plants: 10, fungi: 5 });
    const bog = new Ecosystem({ seed, plantGenome: MOSS, fungusGenome: FUNGUS, plants: 10, fungi: 5 });
    for (let i = 0; i < 900; i++) {
      forest.step();
      bog.step();
    }
    expect(ligninOnGround(bog)).toBe(0);
    expect(ligninOnGround(forest)).toBeGreaterThan(1);
    expect(bog.ignitions).toBeLessThan(forest.ignitions);
  }
});
