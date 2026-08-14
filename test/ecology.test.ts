// The Carboniferous experiment.
//
// The claim: a world whose decomposers cannot rot lignin accumulates fuel and burns more
// often. Nothing in the fire code knows about lignin-eating — the only difference between
// the two worlds below is ONE enzyme gene in ONE genome. If the fire regime moves, it
// moved downstream of gene space, which is the whole thesis at planetary scale.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { FUNGUS, LIGNIN_EATER, PLANT } from "../src/flora.js";
import { Organism } from "../src/organism.js";
import { CHEMS } from "../src/genome.js";
import { accessibility, keysFor, lockEntropy, LOCKS, partialKeys, MOTIF_SLOTS } from "../src/digestion.js";

const SEEDS = [1, 2, 3, 4];

function run(fungusGenome: typeof FUNGUS, seed: number, ticks = 900) {
  const eco = new Ecosystem({ seed, fungusGenome, plants: 10, fungi: 5 });
  const carbonAtStart = eco.totalCarbon();
  for (let i = 0; i < ticks; i++) eco.step();
  return { eco, carbonAtStart };
}

test("a world that cannot rot its lignin burns more often", () => {
  for (const seed of SEEDS) {
    const stuck = run(FUNGUS, seed);
    const evolved = run(LIGNIN_EATER, seed);

    expect(stuck.eco.fuelLoad()).toBeGreaterThan(evolved.eco.fuelLoad());
    expect(stuck.eco.ignitions).toBeGreaterThan(evolved.eco.ignitions);
  }
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
