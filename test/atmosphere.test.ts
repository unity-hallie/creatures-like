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
// 86% of the world's carbon ends as litter, and both gases go near zero inside fifty ticks —
// decomposers need O2 to burn litter back into CO2, and plants need CO2 to make that O2. I
// first called that a deadlock neither side could break. It is not: handing the world more
// oxygen does free the litter (see below). So the two gases are coupled and both scarce,
// which is a weaker and truer claim than the one I made.
//
// A CORRECTION, because the first version of this file got the mechanism wrong. It claimed
// SAPROPHYTE could not open cellulose or lignin. Measured, per genome:
//
//   SAPROPHYTE     starch 1.00  cellulose 1.00  lignin 0.00  protein 1.00
//   LIGNIN_EATER   starch 0.00  cellulose 1.00  lignin 1.00  protein 0.00
//
// SAPROPHYTE opens cellulose perfectly. Only lignin is shut to it, and lignin is 24 of the
// litter, not the 159 the old comment blamed. So cellulose piles to 134.9 while a perfect
// key for it sits in every fungus in the world — the block was never the key.
//
// Oxygen is a real gate on decomposition: raising the starting O2 from 40 to 200 drops
// standing cellulose from 22.5 to 2.5. But it does not raise CO2 (0.04 either way) and it
// does not raise grazers. The carbon moves out of the litter and into fungal bodies rather
// than back into the air.
//
// And LIGNIN_EATER helps grazers for a reason unrelated to rot: it cannot digest starch at
// all, so it stops competing with them for fallen fruit. That is a competition effect, and
// it roughly doubles the population (about 1 grazer per world to about 2), consistent with
// the earlier measurement where deleting every fungus did the same.
//
//   SAPROPHYTE                               4 survivors across 5 seeds
//   LIGNIN_EATER                            11
//   LIGNIN_EATER + 10x O2 + light stocking  15
//
// WHAT REMAINS OPEN. CO2 pinned near zero while plants live and carbon cycles is what a
// tight steady state looks like — production throttled to exactly the rate decomposition
// releases — and that is a closed system with a small atmospheric buffer working correctly,
// not obviously a broken one. Whether this world's buffer is too thin to be interesting is a
// judgement about the model, and it should be settled by measuring FLUX rather than the
// standing stock this file reads. I have not done that yet, and the tests below deliberately
// assert only what was measured.
//
// The transferable lesson is not about fungi or air. It is that conservation held perfectly
// throughout — 1e-12 drift — which is exactly why nothing raised an alarm for seven rounds.
// A quantity can be exactly conserved and still be in the wrong place, and the balance check
// that makes this world trustworthy is blind to that by design.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { Organism } from "../src/organism.js";
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

test("what each decomposer can open, stated as a fact rather than read off the source", () => {
  // I got this wrong by reading flora.ts instead of asking an organism, and then wrote the
  // mistake into a commit. SAPROPHYTE spreads ...FUNGUS, and FUNGUS carries the cellulase —
  // so the key is there even though SAPROPHYTE's own gene list shows only amylase and
  // protease. Composition hides what a genome can do; expression is where you find out.
  const opens = (genome: typeof SAPROPHYTE, substrate: (typeof CHEMS)["starch"]) =>
    new Organism({ genome }).accessTo(substrate);

  expect(opens(SAPROPHYTE, CHEMS.cellulose)).toBe(1);
  expect(opens(SAPROPHYTE, CHEMS.starch)).toBe(1);
  expect(opens(SAPROPHYTE, CHEMS.lignin)).toBe(0);

  expect(opens(LIGNIN_EATER, CHEMS.cellulose)).toBe(1);
  expect(opens(LIGNIN_EATER, CHEMS.lignin)).toBe(1);
  // The one that explains the population difference: it cannot eat fruit.
  expect(opens(LIGNIN_EATER, CHEMS.starch)).toBe(0);
});

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

test("a decomposer that cannot eat fruit leaves more of it for the animals", () => {
  const survivors = (genome: typeof SAPROPHYTE) =>
    [1, 2, 3, 4, 5].reduce((total, seed) => {
      const eco = meadow(genome, seed);
      for (let t = 0; t < 3000; t++) eco.step();
      return total + eco.grazers.filter((g) => g.organism.alive).length;
    }, 0);

  // LIGNIN_EATER reads starch at 0.00 and SAPROPHYTE at 1.00, so swapping them takes the
  // decomposers out of the competition for fallen fruit. Roughly doubles the grazers, which
  // matches what deleting every fungus outright did. Read this as competition, not rot: both
  // genomes open cellulose equally well.
  expect(survivors(LIGNIN_EATER)).toBeGreaterThan(survivors(SAPROPHYTE));
});
