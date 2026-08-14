// The first learned lesson, and the control that proves the chemistry caused it.
//
// The claim under test is not "the creature moves toward food" — a hard-coded rule does
// that. It is that a creature approaches food BECAUSE reward chemistry consolidated the
// synapses that led to a meal. So the knockout matters more than the wild type: cut one
// receptor gene, change nothing else, and the learning has to disappear.

import { test, expect } from "vitest";
import { World } from "../src/world.js";
import { CHEMS, MOIETIES, WILD_TYPE, type Genome } from "../src/genome.js";

const SEEDS = [1, 2, 3];

function run(genome: Genome, seed: number, ticks = 1500) {
  const world = new World({ seed, genome });
  const toward: boolean[] = [];
  for (let i = 0; i < ticks; i++) {
    const r = world.step();
    if (r.action !== "eat") toward.push(r.towardFood);
  }
  const rate = (xs: boolean[]) => (xs.length === 0 ? 0 : xs.filter(Boolean).length / xs.length);
  return { world, early: rate(toward.slice(0, 150)), late: rate(toward.slice(-150)) };
}

/** Wild type with the dopamine→learning receptor deleted. Every other gene is untouched:
 *  the creature still eats, still floods dopamine, still has the same brain. It simply
 *  has nothing to read the dopamine WITH. */
const NO_LEARNING_RECEPTOR: Genome = WILD_TYPE.filter(
  (g) => !(g.kind === "receptor" && g.target === "learning"),
);

test("a creature learns to approach food", () => {
  for (const seed of SEEDS) {
    const { world, early, late } = run(WILD_TYPE, seed);
    expect(world.meals).toBeGreaterThan(20);
    expect(late).toBeGreaterThan(early);
    expect(late).toBeGreaterThan(0.8);
  }
});

test("delete the learning receptor and the lesson never lands", () => {
  for (const seed of SEEDS) {
    const wild = run(WILD_TYPE, seed);
    const knockout = run(NO_LEARNING_RECEPTOR, seed);

    // the knockout still acts, still eats sometimes — it just never gets better at it
    expect(knockout.late).toBeLessThan(wild.late);
    expect(knockout.late).toBeLessThan(0.8);
  }
});

test("hunger is not a substance: no chemical is named for it", () => {
  // Guards the design claim in genome.ts. Hunger is what low glucose feels like from
  // inside the loop, not a thing in the soup.
  expect(Object.keys(CHEMS)).not.toContain("hunger");
});

test("the endocrine loop regulates blood sugar rather than letting it run away", () => {
  for (const seed of SEEDS) {
    const { world } = run(WILD_TYPE, seed);
    const glucose = world.concentration(CHEMS.glucose);
    expect(glucose).toBeGreaterThan(0.05);
    expect(glucose).toBeLessThan(3);
  }
});

test("conserved moieties do not drift over a life", () => {
  const adenine = MOIETIES.find(([name]) => name === "adenine")![1];
  for (const seed of SEEDS) {
    const world = new World({ seed });
    const atBirth = world.moietyTotal(adenine);
    for (let i = 0; i < 1500; i++) world.step();
    // Exactly conserved, not approximately: extent-limited reactions cannot mint or
    // destroy a moiety, and nothing clamps afterwards. A drift here means someone
    // reintroduced a raw subtraction somewhere.
    expect(world.moietyTotal(adenine)).toBeCloseTo(atBirth, 9);
  }
});

test("the genome is already data: it round-trips through JSON and behaves identically", () => {
  // The answer to "how hard would data-driven be?". Every gene is an inert record — no
  // functions, no classes, and ChemId is a branded string, which is a plain string at
  // runtime. So a genome serialises today; what a file-driven version still needs is a
  // loader that VALIDATES (unknown gene kind, unknown chemical, malformed coefficients),
  // not a redesign. `assertBalanced` already covers the hardest of those checks.
  const parsed: Genome = JSON.parse(JSON.stringify(WILD_TYPE));

  const fromCode = run(WILD_TYPE, 7, 400);
  const fromData = run(parsed, 7, 400);

  expect(fromData.world.meals).toBe(fromCode.world.meals);
  expect(fromData.world.lobe.weights).toEqual(fromCode.world.lobe.weights);
  expect(fromData.late).toBe(fromCode.late);
});

test("an unbalanced genome is refused at birth, not discovered later", () => {
  const cheating: Genome = WILD_TYPE.map((g) =>
    g.kind === "reaction" && g.reaction.slug === "glycolysis"
      ? { ...g, reaction: { ...g.reaction, products: [{ chem: CHEMS.atp, coeff: 3 }] } }
      : g,
  );
  expect(() => new World({ genome: cheating })).toThrow(/CONSERVATION/);
});
