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
// THE QUESTION THIS FILE LEFT OPEN, NOW ANSWERED. CO2 pinned near zero could mean a stalled
// world or a tight steady state, and a standing stock cannot tell them apart. Only flux can,
// so: pulse-chase. Hand a settled world 60 CO2 and watch.
//
//   untouched, +100 ticks   living biomass 32.8 -> 36.8   (+4.0)
//   after the pulse, +10t   living biomass 32.8 -> 58.7   (+25.9, 59.7 of the 60 drawn down)
//   after the pulse, +100t  living biomass          71.4  (+38.6)
//
// Hungry, decisively — not stalled. The world converts carbon into life as fast as it is
// given any, at roughly ten times the untouched growth rate, with conservation exact
// throughout. Throughput runs near 6 CO2/tick against a standing pool of 0.045: the buffer
// held well under ONE TICK of demand.
//
// That was the constraint behind all seven failed hypotheses. Thin air throttled primary
// production; the throttle was why food was scarce; scarcity was why grazers never ate; never
// eating was why they never learned. Giving the air a real buffer took the meadow from about
// 1 grazer to about 30 and let the same unchanged brain learn direction on its own.
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

test("the atmosphere is spent within fifty ticks, then recovers", () => {
  const eco = meadow(SAPROPHYTE);
  const co2AtStart = eco.air.get(CHEMS.co2);
  expect(co2AtStart).toBeGreaterThan(50);

  for (let t = 0; t < 50; t++) eco.step();
  expect(eco.air.get(CHEMS.co2)).toBeLessThan(co2AtStart / 10);

  for (let t = 50; t < 3000; t++) eco.step();
  // AND THEN IT COMES BACK, which it never used to. This line read `< 1` for as long as
  // adenine stayed locked in corpses: fungi without ADP cannot respire, so carbon stopped
  // returning to the air. Recycling a corpse's adenine lets them burn their fuel again and
  // CO2 recovers to a few units instead of pinning at zero. The drawdown above is still real
  // — a young world spends its air fast — but it is now a dip rather than a floor.
  expect(eco.air.get(CHEMS.co2)).toBeGreaterThan(1);
  expect(eco.patches.reduce((a, p) => a + p.soup.get(CHEMS.light), 0)).toBeGreaterThan(20);
});

test("carbon is conserved exactly, and no longer stranded", () => {
  const eco = meadow(SAPROPHYTE);
  const before = eco.totalCarbon();
  for (let t = 0; t < 3000; t++) eco.step();

  // Conservation holds — which is the point. This is what a perfectly balanced ledger looks
  // like when the balance is beside the question.
  expect(eco.totalCarbon()).toBeCloseTo(before, 6);

  const carbonIn = (soup: { get(id: (typeof CHEMS)["co2"]): number }) =>
    CARBON.reduce((total, [id, per]) => total + soup.get(id) * per, 0);
  // Was 86% stranded as litter when the air held under a tick of CO2 demand. With a real
  // buffer the cycle turns and it settles near 40% — litter now, biomass and air later,
  // rather than litter permanently.
  const inPatches = eco.patches.reduce((a, p) => a + carbonIn(p.soup), 0);
  expect(inPatches / before).toBeLessThan(0.7);
});

test("a decomposer that cannot eat fruit leaves more of it for the animals", () => {
  // Three seeds at 800 ticks. This ran five at 3,000 and passed alone while timing out in
  // the full suite — thickening the atmosphere put 100+ organisms in every world and made
  // every ecosystem test roughly ten times more expensive, which is a real cost of that
  // change and worth paying down here rather than raising the limit. The separation is wider
  // at the shorter horizon anyway: 108 against 221.
  const survivors = (genome: typeof SAPROPHYTE) =>
    [1, 2, 3].reduce((total, seed) => {
      const eco = meadow(genome, seed);
      for (let t = 0; t < 800; t++) eco.step();
      return total + eco.grazers.filter((g) => g.organism.alive).length;
    }, 0);

  // LIGNIN_EATER reads starch at 0.00 and SAPROPHYTE at 1.00, so swapping them takes the
  // decomposers out of the competition for fallen fruit. Roughly doubles the grazers, which
  // matches what deleting every fungus outright did. Read this as competition, not rot: both
  // genomes open cellulose equally well.
  expect(survivors(LIGNIN_EATER)).toBeGreaterThan(survivors(SAPROPHYTE));
});
