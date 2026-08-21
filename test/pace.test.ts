// Pace of life, and what it does to the question of whether learning is worth anything.
//
// A fast animal is not a different kind of thing with a size field on it. It is the same
// recipe read quickly — `paced` multiplies every rate in the genome and nothing else, which
// is only possible because the gene list is flat and a metabolism is nothing but its rates.
//
// Measured over 3000 ticks, three seeds, median age AT DEATH (not age of survivors, which
// just reports the run length and fooled me once):
//
//   x0.25   lifespan 1869    239 deaths   231 alive
//   x1      lifespan  160    386 deaths    80 alive
//   x4      lifespan   76   4854 deaths     9 alive
//
// A 24x range out of one number.
//
// WHY IT MATTERS BEYOND SIZE. A day is 90 ticks. The x4 animal dies before one day finishes,
// so day and night are GENERATIONAL events for it — things only its lineage can adapt to.
// The x0.25 animal sees twenty-one days and three years, so the same cycle falls inside a
// single life, where experience could track it. Same world, opposite timescale relationship,
// and nothing separating them but how fast the recipe is read.
//
// Which sharpens what `plasticity.test.ts` found. Learning loses in this ecosystem, and I
// first measured that in a meadow with CONSTANT SUN — a world where nothing varies at all,
// which makes "nothing worth learning" close to a tautology. Rerun under a real sky, three
// places with day length 90 and seasons, and it still loses: 166 against 267. So the finding
// holds, and the reason is not the one I gave.
//
// It is that nothing SENSABLE varies. The senses are foodLeft, foodRight, foodHere, fuelLow,
// and the mapping from those to the right action never changes — food on the left always
// means go left. Day and night move the light, which no creature here can sense. So learning
// is a one-time acquisition of a permanent truth, and a permanent truth belongs in the
// genome, which is exactly the argument for a low-rank innate prior.
//
// The experiment that would flip it: make what the senses REPORT stop being reliable. This
// world already has the machinery — solanine, cucurbitacin and capsaicin, and NIGHTSHADE,
// GOURD and CHILLI to carry them. If some food underfoot is poison and which food changes
// faster than a lineage, then `foodHere` stops meaning "eat" and starts meaning "find out",
// and a long-lived animal that can learn should beat a short-lived one that cannot.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { PLODDER, SWIFT, WILD_TYPE, paced, type Genome } from "../src/genome.js";

function lifespans(genome: Genome): { median: number; deaths: number; alive: number } {
  const ages: number[] = [];
  let alive = 0;
  for (const seed of [1, 2, 3]) {
    const eco = new Ecosystem({
      seed,
      width: 24,
      plants: 18,
      fungi: 30,
      grazers: 14,
      plantGenome: GRASS,
      fungusGenome: SAPROPHYTE,
      soilAmmonia: 0.5,
      grazerGenome: genome,
    });
    const counted = new Set<string>();
    for (let t = 0; t < 1500; t++) {
      eco.step();
      for (const g of eco.grazers) {
        if (!g.organism.alive && !counted.has(g.organism.id)) {
          counted.add(g.organism.id);
          ages.push(g.organism.age);
        }
      }
    }
    alive += eco.grazers.filter((g) => g.organism.alive).length;
  }
  ages.sort((a, b) => a - b);
  return { median: ages[Math.floor(ages.length / 2)] ?? 0, deaths: ages.length, alive };
}

test("pace is one number and it changes everything about a life", () => {
  const swift = lifespans(SWIFT);
  const plodder = lifespans(PLODDER);

  // The whole point: an order of magnitude of lifespan, from scaling rates alone.
  expect(plodder.median).toBeGreaterThan(swift.median * 5);
  // And it is a real trade, not a free lunch — living fast burns through the world faster.
  expect(swift.deaths).toBeGreaterThan(plodder.deaths * 2);
});

test("paced touches rates and nothing else", () => {
  const half = paced(WILD_TYPE, 0.5);
  expect(half.length).toBe(WILD_TYPE.length);

  // Same genes in the same order, same kinds, same wiring — only the speeds differ. A gene
  // that carried a rate has half of it; a gene that carried none is untouched.
  for (let i = 0; i < half.length; i++) {
    expect(half[i].kind).toBe(WILD_TYPE[i].kind);
  }
  const rateOf = (g: Genome, slug: string) => {
    const gene = g.find((x) => "reaction" in x && x.reaction.slug === slug);
    return gene && "reaction" in gene ? gene.reaction.rate : undefined;
  };
  expect(rateOf(half, "glycolysis")).toBeCloseTo(rateOf(WILD_TYPE, "glycolysis")! * 0.5, 10);

  // The lobe is not a rate, so a slow animal is not a stupid one — it thinks at the same
  // speed and simply lives longer while doing it.
  const lobe = half.find((g) => g.kind === "lobe");
  expect(lobe).toEqual(WILD_TYPE.find((g) => g.kind === "lobe"));
});
