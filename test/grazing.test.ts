// Grass, and the animal that cannot digest it alone.
//
// No vertebrate makes cellulase. Every animal living on grass is really a partnership —
// which makes the rumen the THIRD use of one soup with two genomes, after lichen and the
// root nodule. None of the three needed engine support.

import { test, expect } from "vitest";
import { Soup } from "../src/chemistry.js";
import { Organism } from "../src/organism.js";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, RUMEN_SYMBIONT, TREE } from "../src/flora.js";
import { CHEMS, WILD_TYPE } from "../src/genome.js";

test("an animal alone cannot open cellulose, and passes it straight through", () => {
  const animal = new Organism({ genome: WILD_TYPE });
  expect(animal.accessTo(CHEMS.cellulose)).toBe(0);
});

test("with a rumen symbiont on the same soup, grass becomes food", () => {
  const gut = new Soup([
    [CHEMS.atp, 3],
    [CHEMS.adp, 10],
    [CHEMS.o2, 2],
    [CHEMS.cellulose, 4],
  ]);
  const animal = new Organism({ genome: WILD_TYPE, soup: gut });
  const microbes = new Organism({ genome: RUMEN_SYMBIONT, soup: gut });

  const cellulose = gut.get(CHEMS.cellulose);
  for (let i = 0; i < 60; i++) {
    gut.add(CHEMS.o2, 0.5);
    microbes.metabolise();
    animal.metabolise();
  }

  // the microbes opened what the animal could not, and the animal burned the proceeds
  expect(gut.get(CHEMS.cellulose)).toBeLessThan(cellulose);
  expect(animal.alive).toBe(true);
});

test("grass builds almost no lignin, so grassland is fine fuel rather than deep fuel", () => {
  const grassland = new Ecosystem({ seed: 2, plantGenome: GRASS, plants: 10, fungi: 4 });
  const forest = new Ecosystem({ seed: 2, plantGenome: TREE, plants: 10, fungi: 4 });
  for (let i = 0; i < 900; i++) {
    grassland.step();
    forest.step();
  }
  const lignin = (e: Ecosystem) => e.patches.reduce((a, p) => a + p.soup.get(CHEMS.lignin), 0);
  expect(lignin(grassland)).toBeLessThan(lignin(forest));
});

test("a grazer will eat the plant itself when no fruit is on the ground", () => {
  const eco = new Ecosystem({ seed: 1, plantGenome: GRASS, plants: 8, fungi: 3, grazers: 3 });
  for (let i = 0; i < 600; i++) eco.step();
  expect(eco.meals).toBeGreaterThan(50);
  // and grass tolerates it: tolerance is the growth rate, not a special rule
  expect(eco.plants.filter((p) => p.organism.alive).length).toBeGreaterThan(0);
});

test("carbon and nitrogen both survive being grazed", () => {
  const eco = new Ecosystem({ seed: 3, plantGenome: GRASS, plants: 8, fungi: 3, grazers: 3 });
  const c = eco.totalCarbon();
  const n = eco.totalNitrogen();
  for (let i = 0; i < 600; i++) eco.step();
  expect(eco.totalCarbon()).toBeCloseTo(c, 6);
  expect(eco.totalNitrogen()).toBeCloseTo(n, 6);
});
