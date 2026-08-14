// Nitrogen: the second currency, and the first thing an organism cannot solve by growing
// taller.
//
// Carbon arrives free from the air for anything that photosynthesises. Nitrogen does not —
// the atmosphere is full of N2 and almost nothing can touch it, because the triple bond
// costs a fortune to break. That single fact is why nitrogen limits life on a planet
// swimming in it, and it gives the model a limiting nutrient that light cannot fix.

import { test, expect } from "vitest";
import { Soup } from "../src/chemistry.js";
import { Organism } from "../src/organism.js";
import { Ecosystem } from "../src/ecology.js";
import { LEGUME, NITROGEN_HUNGRY_PLANT, RHIZOBIUM } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";

/** Sunlight and air, on nitrogen-poor ground. */
function poorSoil(soup: Soup): void {
  soup.set(CHEMS.light, 1.4);
  soup.add(CHEMS.co2, 0.6);
  soup.add(CHEMS.o2, 0.6);
  soup.add(CHEMS.n2, 0.4);
}

test("a plant with no fixed nitrogen cannot build tissue, however much light it gets", () => {
  const plant = new Organism({
    genome: NITROGEN_HUNGRY_PLANT,
    initial: [[CHEMS.atp, 2], [CHEMS.adp, 10]],
  });
  for (let i = 0; i < 300; i++) {
    poorSoil(plant.soup);
    plant.metabolise();
  }
  // plenty of sugar, no protein: N2 is right there and entirely useless to it
  expect(plant.soup.get(CHEMS.glucose)).toBeGreaterThan(0);
  expect(plant.soup.get(CHEMS.proteins)).toBe(0);
});

test("a legume housing rhizobia builds protein out of thin air", () => {
  // The same construction as lichen: two genomes, one soup. The bacterium breaks N2 at a
  // cost of sixteen ATP it could never pay alone; the plant makes sugar it can.
  const nodule = new Soup([
    [CHEMS.atp, 2],
    [CHEMS.adp, 10],
  ]);
  const legume = new Organism({ genome: LEGUME, soup: nodule });
  const rhizobium = new Organism({ genome: RHIZOBIUM, soup: nodule });

  for (let i = 0; i < 300; i++) {
    poorSoil(nodule);
    legume.metabolise();
    rhizobium.metabolise();
  }

  expect(nodule.get(CHEMS.proteins)).toBeGreaterThan(0);
  expect(legume.alive).toBe(true);
});

test("nitrogen is conserved across a whole ecosystem", () => {
  for (const seed of [1, 2, 3]) {
    const eco = new Ecosystem({ seed, plants: 8, fungi: 4, grazers: 2, soilAmmonia: 0.4 });
    const atStart = eco.totalNitrogen();
    for (let i = 0; i < 600; i++) eco.step();
    // same law as carbon, second element — through growth, death, digestion and fire
    expect(eco.totalNitrogen()).toBeCloseTo(atStart, 6);
    expect(atStart).toBeGreaterThan(0);
  }
});

test("fixation costs what fixation costs", () => {
  // sixteen ATP per N2 is not a metaphor for expensive. A rhizobium with sugar but no
  // energy reserve makes no headway, which is exactly why it lives in somebody's roots.
  const broke = new Organism({ genome: RHIZOBIUM, initial: [[CHEMS.n2, 5], [CHEMS.adp, 10]] });
  for (let i = 0; i < 50; i++) broke.metabolise();
  expect(broke.soup.get(CHEMS.ammonia)).toBe(0);
});
