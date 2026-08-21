// The alarm that was missing twice.
//
// This world has now stranded a conserved quantity in a place nothing could reach it on two
// separate occasions, and both times every balance check stayed green while it happened:
//
//   carbon    86% of it settled as litter while the air emptied and production starved
//   adenine   651 of 704 locked inside corpses, leaving fungi unable to respire
//
// Neither was a leak. Both totals were exact to floating point the whole way. `assertBalanced`
// checks reactions at birth and the ecosystem tests check world totals, and a quantity can
// satisfy both while being entirely out of circulation — which is the failure mode that cost
// this project most of a session, twice.
//
// So this file asks the question the balance checks cannot: not "is it all still here" but
// "can anything still GET at it". A moiety mostly sitting in corpses or in ground it cannot
// be taken up from is stranded, however perfectly it sums.
//
// The tripwire is deliberately loose. It is not tuning; it is a smoke alarm, and it should
// stay silent through ordinary ecology — a hard winter, a population crash, a fire — and go
// off when a currency stops moving. If a legitimate world trips it, widen the bound and write
// down what made it legitimate, because that is worth knowing too.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CHEMS, MOIETIES } from "../src/genome.js";
import type { Moiety } from "../src/stoichiometry.js";

function meadow() {
  return new Ecosystem({
    seed: 3,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
  });
}

/** How much of one declared moiety sits inside bodies that have stopped living. Corpses are
 *  the one place in this world nothing can reach: `#decompose` runs once, and whatever it
 *  fails to hand back stays there for good. */
function strandedInCorpses(eco: Ecosystem, moiety: Moiety) {
  let dead = 0;
  let total = 0;
  for (const r of [...eco.plants, ...eco.fungi, ...eco.grazers]) {
    const amount = moiety.reduce((sum, [id, per]) => sum + r.organism.soup.get(id) * per, 0);
    total += amount;
    if (!r.organism.alive) dead += amount;
  }
  for (const p of eco.patches) total += moiety.reduce((s, [id, per]) => s + p.soup.get(id) * per, 0);
  total += moiety.reduce((s, [id, per]) => s + eco.air.get(id) * per, 0);
  return total > 0 ? dead / total : 0;
}

test("no declared moiety ends up mostly locked in corpses", () => {
  const eco = meadow();
  for (let t = 0; t < 20000; t++) eco.step();

  for (const [name, moiety] of MOIETIES) {
    const stranded = strandedInCorpses(eco, moiety);
    // Adenine read 0.92 here before `#decompose` learned to hand it back. Carbon never did,
    // because `matter()` always covered it — which is exactly why carbon's version of this
    // bug hid in the patches instead, and why the second test below exists.
    expect(stranded, `${name} is stranded in corpses`).toBeLessThan(0.5);
  }
});

test("adenine keeps circulating, not merely summing", () => {
  const eco = meadow();
  const adenine = MOIETIES.find(([name]) => name === "adenine")![1];
  const held = (soup: { get(id: (typeof CHEMS)["atp"]): number }) =>
    adenine.reduce((sum, [id, per]) => sum + soup.get(id) * per, 0);

  const atStart = [...eco.plants, ...eco.fungi, ...eco.grazers].reduce((a, r) => a + held(r.organism.soup), 0);
  for (let t = 0; t < 20000; t++) eco.step();

  const living = [...eco.plants, ...eco.fungi, ...eco.grazers]
    .filter((r) => r.organism.alive)
    .reduce((a, r) => a + held(r.organism.soup), 0);

  // The number that matters is not the total — that was always 704 — but the share still in
  // something alive. It fell to 52 (7%) with adenine trapped in corpses, and holds near 300
  // (43%) now. Respiration costs 30 ADP per glucose, so this fraction IS the world's
  // metabolic capacity: let it fall and the decomposers quietly stop breathing.
  expect(living / atStart).toBeGreaterThan(0.15);
});
