// The loop closed: air → plant → fruit → animal → waste → fungus → air.
//
// The test that matters is not that anything survives. It is that every carbon atom in
// the animal's dinner traces back to the atmosphere and forward to somewhere real, with
// nothing created and nothing lost on the way — through digestion, egestion, death and
// fire alike.
//
// This rig caught the worst bug of the session. The animal's genome used to emit starch
// and protein on a successful meal, which was honest while food arrived by fiat and
// became fraud the moment the animal stood in a real ecosystem: it took a mouthful from
// the patch AND conjured a second from nowhere. World carbon went 102 → 15,020 in 900
// ticks. Every other test stayed green, because every other test was checking behaviour
// rather than bookkeeping.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { LIGNIN_EATER } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";

const SEEDS = [1, 2, 3];

function forest(seed: number, ticks = 900) {
  const eco = new Ecosystem({ seed, plants: 10, fungi: 4, grazers: 3, fungusGenome: LIGNIN_EATER });
  const carbonAtStart = eco.totalCarbon();
  for (let i = 0; i < ticks; i++) eco.step();
  return { eco, carbonAtStart };
}

test("carbon is conserved through a whole ecosystem, exactly", () => {
  for (const seed of SEEDS) {
    const { eco, carbonAtStart } = forest(seed);
    expect(eco.totalCarbon()).toBeCloseTo(carbonAtStart, 6);
  }
});

test("the animal eats food a plant made out of air and light", () => {
  for (const seed of SEEDS) {
    const { eco } = forest(seed);
    // nothing places food by fiat in the ecosystem: every mouthful of starch was fixed
    // from CO2 by a plant, packed by its fruiting gene, and dropped where a grazer could
    // find it
    expect(eco.meals).toBeGreaterThan(100);
    expect(eco.patches.some((p) => p.soup.get(CHEMS.starch) > 0)).toBe(true);
  }
});

test("what the animal cannot digest becomes the fungus's problem", () => {
  const { eco } = forest(1);
  // cellulose taken with a mouthful and egested, plus litterfall, ends up on the ground
  expect(eco.patches.reduce((a, p) => a + p.soup.get(CHEMS.cellulose), 0)).toBeGreaterThan(0);
});

test("things actually die, and their carbon stays in the world", () => {
  const totalDeaths = SEEDS.reduce((acc, seed) => acc + forest(seed).eco.deaths, 0);
  // the death path is not decoration: grazers starve when they cannot find fruit, and the
  // conservation test above covers the same runs, so the bodies went somewhere real
  expect(totalDeaths).toBeGreaterThan(0);
});
