// Why nothing eats anything, after the last table of who-eats-what came out.
//
// `#forage`'s biting branch walked `this.plants` and took cellulose by name — a body was
// edible because of which array it lived in, which is the same mistake the patch side shed
// one commit earlier, one level up. It now walks every resident and takes what the target's
// body actually holds, and success reads NUTRITION rather than mass, so an animal is no
// longer taught to swallow what it cannot open.
//
// Both are real cleanups and neither moved the population: animals 103 -> 101 for a grazer
// and 349 -> 356 for a bug across three seeds, with meals up about a fifth. Carnivory became
// WRITABLE and is still not VIABLE, and this file exists to say why, because the reason is
// not where anyone would look for it.
//
// A BODY IS NOT MADE OF ANYTHING. Measured at tick 2000:
//
//   plants   starch 0.001  cellulose 0.008  lipids 0.000  proteins 0.000
//   fungi    starch 0.000  cellulose 0.264  lipids 0.000  proteins 0.000
//   animals  starch 0.004  cellulose 0.005  lipids 0.000  proteins 0.000
//
// MOUTHFUL is 0.02 and a bite takes half of what is there, so an entire animal is worth
// about 0.005 to whatever eats it — a quarter of the least that counts as a meal. A predator
// with every protease in the world would find nothing to use them on. Fungi are the one
// exception, holding enough cellulose to be worth biting, which is why the opened loop shows
// up as more meals rather than none.
//
// The cause is upstream of predation entirely: `lipogenesis` sits in WILD_TYPE and never
// runs, because insulin gates it above glucose 0.7 and a creature here lives hand to mouth
// below that. Nothing ever banks a reserve, so nothing is ever worth eating. Give animals a
// reason to store fat and a predator becomes possible with no further change to the mouth —
// which is the part worth knowing, and the part I would have missed by building the predator
// first and wondering why it starved.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CHEMS, DETRITIVORE, SUBSTRATE_LOCKS } from "../src/genome.js";

function world() {
  const eco = new Ecosystem({
    seed: 3,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
    grazerGenome: DETRITIVORE,
  });
  for (let t = 0; t < 2000; t++) eco.step();
  return eco;
}

test("an animal's body is not worth a mouthful", () => {
  const eco = world();
  const living = eco.grazers.filter((g) => g.organism.alive);
  expect(living.length).toBeGreaterThan(0);

  const bodyMass = (r: (typeof living)[number]) =>
    SUBSTRATE_LOCKS.reduce((total, [substrate]) => total + r.organism.soup.get(substrate), 0);
  const average = living.reduce((a, r) => a + bodyMass(r), 0) / living.length;

  // Under a quarter of MOUTHFUL (0.02), and a bite only takes half of it. This is the whole
  // reason a predator cannot live here, and it has nothing to do with mouths or keys.
  expect(average).toBeLessThan(0.02);
});

test("nothing banks a reserve, which is why nothing is worth eating", () => {
  const eco = world();
  const living = [...eco.plants, ...eco.fungi, ...eco.grazers].filter((r) => r.organism.alive);

  // lipogenesis is in the genome and never fires: insulin gates it above glucose 0.7 and
  // nothing here gets that far. Fat is the store that would make a body food.
  // 0.016 across every living thing in the world — call it nothing each, against a MOUTHFUL
  // of 0.02. Read per-body, which is what a predator would have to bite.
  const fat = living.reduce((a, r) => a + r.organism.soup.get(CHEMS.lipids), 0);
  expect(fat / living.length).toBeLessThan(0.001);

  // Fungi are the exception that proves the rule — they hold structure, so they ARE bitable,
  // and that is what the opened loop actually bought.
  const fungalStructure = eco.fungi
    .filter((f) => f.organism.alive)
    .reduce((a, f) => a + f.organism.soup.get(CHEMS.cellulose), 0);
  expect(fungalStructure).toBeGreaterThan(1);
});

test("a mouthful of what you cannot open is not a meal", () => {
  // Every patch cellulose-only, and no plants to bite — otherwise the grazer simply walks
  // somewhere better, which is what my first version of this test actually measured.
  const eco = new Ecosystem({ seed: 3, width: 24, plants: 0, fungi: 0, grazers: 4 });
  const grazer = eco.grazers[0];
  for (const patch of eco.patches) {
    patch.soup.set(CHEMS.starch, 0);
    patch.soup.set(CHEMS.cellulose, 10);
  }

  // A wild grazer holds no cellulase. It may well swallow this; it must not be REWARDED for
  // it, because dopamine on an empty meal teaches the animal to keep taking them.
  expect(grazer.organism.accessTo(CHEMS.cellulose)).toBe(0);
  for (let t = 0; t < 40; t++) eco.step();
  expect(grazer.meals).toBe(0);
});
