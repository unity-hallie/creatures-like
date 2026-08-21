// What actually limits life here: the air.
//
// Seven hypotheses died before this one — passive uptake, the breeding gate, founder
// capital, fungal competition, the food supply, the missing innate prior, and a census that
// counted corpses. Five were real defects and all five were fixed. None moved the number of
// surviving grazers, because none of them touched what was actually binding.
//
// Follow the energy instead of the animals and it shows up immediately:
//
//   t50    air CO2 2.3   light on ground 19.5 (input 33.6/tick, piling up unused)
//   t2999  air CO2 0.0   light on ground 29.4
//
// Photosynthesis is 6 CO2 + 6 light -> 1 glucose. The world starts with CO2 60 — a third of
// all its carbon — and strips it inside fifty ticks. After that, sunlight is free and
// useless. A carbon census says where it went:
//
//   t2999  total 207.6 = air 0.0 + patches 178.7 + bodies 28.8
//          in patches: cellulose 134.9, lignin 24.4
//
// 86% of the world's carbon ends as litter. And the two gases deadlock: decomposers need O2
// to burn litter back into CO2, plants need CO2 to make the O2, and the opening population
// boom spends both inside fifty ticks. Neither can restart the other.
//
// WHICH MAKES THE DECOMPOSER THE MOST IMPORTANT CHOICE IN THE WORLD, and I had it wrong all
// session. SAPROPHYTE carries keys for starch and protein only — it cannot touch cellulose
// or lignin, which is where 159 of the 207 carbon goes. The probe rig I inherited used it,
// so every measurement I took came from a world whose carbon cycle could not close by
// construction. Swap the decomposer and the ceiling moves further than any of the five
// genuine bug fixes did:
//
//   SAPROPHYTE (starch+protein)              4 survivors across 5 seeds
//   LIGNIN_EATER                            11
//   LIGNIN_EATER + 10x O2 + light stocking  15
//
// The lesson worth keeping is not about fungi. It is that I spent seven rounds asking why
// the animals died and none asking where the carbon was, and the carbon was the answer the
// whole time. Conservation held perfectly throughout — 1e-12 drift — which is exactly why it
// never raised an alarm. A quantity can be perfectly conserved and still be in the wrong
// place, and the balance check that made this world trustworthy is blind to that by design.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, LIGNIN_EATER, SAPROPHYTE } from "../src/flora.js";
import { CARBON, CHEMS } from "../src/genome.js";

function meadow(fungusGenome: typeof SAPROPHYTE, seed = 3) {
  return new Ecosystem({
    seed,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome,
    soilAmmonia: 0.5,
  });
}

test("the atmosphere is spent within fifty ticks, and sunlight piles up unused", () => {
  const eco = meadow(SAPROPHYTE);
  const co2AtStart = eco.air.get(CHEMS.co2);
  expect(co2AtStart).toBeGreaterThan(50);

  for (let t = 0; t < 50; t++) eco.step();
  expect(eco.air.get(CHEMS.co2)).toBeLessThan(co2AtStart / 10);

  for (let t = 50; t < 3000; t++) eco.step();
  // It never comes back, and the light nobody can use keeps arriving.
  expect(eco.air.get(CHEMS.co2)).toBeLessThan(1);
  expect(eco.patches.reduce((a, p) => a + p.soup.get(CHEMS.light), 0)).toBeGreaterThan(20);
});

test("carbon is conserved exactly and stranded almost entirely as litter", () => {
  const eco = meadow(SAPROPHYTE);
  const before = eco.totalCarbon();
  for (let t = 0; t < 3000; t++) eco.step();

  // Conservation holds — which is the point. This is what a perfectly balanced ledger looks
  // like when the balance is beside the question.
  expect(eco.totalCarbon()).toBeCloseTo(before, 6);

  const carbonIn = (soup: { get(id: (typeof CHEMS)["co2"]): number }) =>
    CARBON.reduce((total, [id, per]) => total + soup.get(id) * per, 0);
  const inPatches = eco.patches.reduce((a, p) => a + carbonIn(p.soup), 0);
  expect(inPatches / before).toBeGreaterThan(0.8);
});

test("a decomposer that can open structure raises the ceiling further than any bug fix did", () => {
  const survivors = (genome: typeof SAPROPHYTE) =>
    [1, 2, 3, 4, 5].reduce((total, seed) => {
      const eco = meadow(genome, seed);
      for (let t = 0; t < 3000; t++) eco.step();
      return total + eco.grazers.filter((g) => g.organism.alive).length;
    }, 0);

  // Structure is where the carbon is, so the key that opens structure is what decides how
  // much life the world can carry. Nothing else measured this session came close.
  expect(survivors(LIGNIN_EATER)).toBeGreaterThan(survivors(SAPROPHYTE));
});
