// A bug, and the one-line change that made a bug possible.
//
// `#forage` read `CHEMS.starch` by name, in the senses and in the mouth. So an animal ate
// starch because the ecology said so, not because its genome did, and no genome could
// describe an animal that ate anything else. That is a table of who-eats-what, in the one
// file whose header opens by saying nothing anywhere holds one — uptake derived its diet from
// the genome, egestion derived it, digestion derived it, and the mouth did not.
//
// Reading accessibility instead makes the diet a genome fact. A wild grazer opens starch at
// 1.00 and cellulose at 0.00, so it eats exactly what it always ate and every existing test
// stayed green. DETRITIVORE adds one cellulase and lands in a trophic level this world did
// not have: litter was its largest standing pool and nothing with a mouth could reach it.
//
//                      grazer      bug
//   alive at t20000        21       86
//   meals              13,932   46,251
//   standing litter     1057.6      0.4
//
// Four times the population, and the litter goes to nothing.
//
// STILL MISSING, and worth naming so it does not get lost: nothing eats the bug. The grazing
// branch of `#forage` iterates `this.plants`, which is the same hardcoded-cohort mistake one
// level up — a body is edible here because of which array it lives in. Opening that loop the
// way the patch side just opened would make carnivory a genome too: `proteins` and `lipids`
// already carry real locks and `proteolysis` already exists, so the machinery for deciding
// whether a mouth can open flesh is built and running.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { Organism } from "../src/organism.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CHEMS, DETRITIVORE, WILD_TYPE, type Genome } from "../src/genome.js";

function meadow(grazerGenome: Genome, seed: number) {
  return new Ecosystem({
    seed,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
    grazerGenome,
  });
}

test("the diet is a genome fact, not an ecology fact", () => {
  const grazer = new Organism({ genome: WILD_TYPE });
  const bug = new Organism({ genome: DETRITIVORE });

  // Same animal but for one key, and the key is the whole difference in what it can eat.
  expect(grazer.accessTo(CHEMS.starch)).toBe(1);
  expect(grazer.accessTo(CHEMS.cellulose)).toBe(0);
  expect(bug.accessTo(CHEMS.starch)).toBe(1);
  expect(bug.accessTo(CHEMS.cellulose)).toBe(1);
});

test("a grazer standing on litter it cannot open still sees an empty patch", () => {
  const eco = meadow(WILD_TYPE, 3);
  const grazer = eco.grazers[0];
  const patch = eco.patches[grazer.at];
  patch.soup.set(CHEMS.starch, 0);
  patch.soup.set(CHEMS.cellulose, 5);

  // Slot 2 is the "here" smell. Five units of cellulose underfoot read as NOTHING to a
  // starch-shaped nose — perception follows the same lock-and-key the mouth does, which is
  // the agreement this file lost once and paid for.
  //
  // A reading is a saturated float now rather than a 0/1 flag: x/(1+x), so five units through
  // a perfect key reads 0.833 and not 1. Receptors saturate, and an unbounded sense would let
  // a big enough pile of anything swamp every weight in the lobe.
  expect(eco.senseOf(grazer)[2]).toBe(0);

  // And the bug smells what it eats — its three smell genes are cellulose-shaped where the
  // grazer's are starch-shaped, which is the diet showing up in the nose as well as the gut.
  const bugWorld = meadow(DETRITIVORE, 3);
  const bug = bugWorld.grazers[0];
  const bugPatch = bugWorld.patches[bug.at];
  bugPatch.soup.set(CHEMS.starch, 0);
  bugPatch.soup.set(CHEMS.cellulose, 5);
  expect(bugWorld.senseOf(bug)[2]).toBeGreaterThan(0.5);
});

test("a detritivore clears the litter and carries a bigger population", () => {
  // Two seeds at 2,000 ticks, not five at 20,000. The headline numbers above came from the
  // longer run, and the separation is already unambiguous here — alive 75 against 229, litter
  // 1425.9 against 0.9 — so the suite does not need to spend six minutes re-proving it. A
  // slow test gets skipped, and a skipped test guards nothing.
  const run = (genome: Genome) =>
    [1, 2].reduce(
      (acc, seed) => {
        const eco = meadow(genome, seed);
        for (let t = 0; t < 2000; t++) eco.step();
        return {
          alive: acc.alive + eco.grazers.filter((g) => g.organism.alive).length,
          litter: acc.litter + eco.patches.reduce((a, p) => a + p.soup.get(CHEMS.cellulose), 0),
        };
      },
      { alive: 0, litter: 0 },
    );

  const grazers = run(WILD_TYPE);
  const bugs = run(DETRITIVORE);
  expect(bugs.alive).toBeGreaterThan(grazers.alive * 2);
  expect(bugs.litter).toBeLessThan(grazers.litter / 10);
});
