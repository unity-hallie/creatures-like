// Plant defence, which cost no engine work at all.
//
// A toxin is a chemical plus a receptor in whatever eats it. The binding lands on
// `punishment`, consolidation runs negative, and the synapse that led to the mouthful
// weakens — so the creature LEARNS to avoid the plant using the same loop that taught it
// to approach food. Nothing was added to make that happen.
//
// The last test is the one worth the trouble. Capsaicin deters mammals and not birds
// because deterrence lives in the receptor rather than in the molecule. Here a receptor
// belongs to a genome, so one chemical means agony to one creature and nothing to
// another, with no special-casing anywhere in the engine.

import { test, expect } from "vitest";
import { World } from "../src/world.js";
import { CHEMS, WILD_TYPE, type Genome } from "../src/genome.js";
import { Organism } from "../src/organism.js";
import { bind } from "../src/brain.js";
import { NIGHTSHADE } from "../src/flora.js";

/** A creature that finds solanine painful. */
const TASTER: Genome = [
  ...WILD_TYPE,
  { kind: "receptor", chem: CHEMS.solanine, target: "punishment", gain: 1.4 },
];

/** The same creature, minus that one receptor gene. */
const INSENSITIVE: Genome = WILD_TYPE;

/** A poisoned meal: every mouthful carries the toxin along with the food. */
function poisonedRun(genome: Genome, seed: number, ticks = 1200) {
  const world = new World({ seed, genome });
  let eaten = 0;
  const before = world.lobe.weightOf("eat", "foodHere");
  for (let i = 0; i < ticks; i++) {
    const r = world.step();
    if (r.action === "eat" && r.succeeded) {
      world.soup.get().add(CHEMS.solanine, 0.9);
      eaten++;
    }
  }
  return { world, eaten, before, after: world.lobe.weightOf("eat", "foodHere") };
}

test("a toxin binds punishment and drives consolidation negative", () => {
  const organism = new Organism({ genome: TASTER });
  organism.soup.add(CHEMS.solanine, 1);
  const binding = bind(organism.expressed, organism.soup);

  expect(binding.punishment).toBeGreaterThan(0);
  // dopamine absent, punishment present: the verdict on whatever just fired runs negative
  expect(binding.learning - binding.punishment).toBeLessThan(0);
});

test("a creature learns to stop eating what poisons it", () => {
  for (const seed of [1, 2, 3]) {
    const taster = poisonedRun(TASTER, seed);
    const insensitive = poisonedRun(INSENSITIVE, seed);

    // the sensitive creature eats markedly less of the poisoned food than the one that
    // cannot taste it — same world, same seed, one receptor gene apart
    expect(taster.eaten).toBeLessThan(insensitive.eaten);
  }
});

test("the same molecule means agony to one genome and nothing to another", () => {
  const mammal = new Organism({
    genome: [...WILD_TYPE, { kind: "receptor", chem: CHEMS.capsaicin, target: "punishment", gain: 1.5 }],
  });
  const bird = new Organism({ genome: WILD_TYPE });

  mammal.soup.add(CHEMS.capsaicin, 1);
  bird.soup.add(CHEMS.capsaicin, 1);

  expect(bind(mammal.expressed, mammal.soup).punishment).toBeGreaterThan(1);
  expect(bind(bird.expressed, bird.soup).punishment).toBe(0);

  // and the engine holds no list of who-is-deterred-by-what. The difference lives
  // entirely in one gene, which is the point.
});

test("alkaloids cost nitrogen, so a poor plant cannot afford to be poisonous", () => {
  // NIGHTSHADE synthesises solanine from glucose AND ammonia. With no fixed nitrogen
  // available, the reaction simply cannot run — the limiting reagent decides, exactly as
  // it does everywhere else.
  const starved = new Organism({ genome: NIGHTSHADE, initial: [[CHEMS.glucose, 5], [CHEMS.atp, 5], [CHEMS.adp, 5]] });
  const fed = new Organism({
    genome: NIGHTSHADE,
    initial: [[CHEMS.glucose, 5], [CHEMS.ammonia, 5], [CHEMS.atp, 5], [CHEMS.adp, 5]],
  });

  for (let i = 0; i < 40; i++) {
    starved.metabolise();
    fed.metabolise();
  }

  expect(starved.soup.get(CHEMS.solanine)).toBe(0);
  expect(fed.soup.get(CHEMS.solanine)).toBeGreaterThan(0);
});
