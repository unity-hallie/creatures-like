// Yeast and lichen: two strategies that test the machinery rather than the ecology.
//
// Yeast asks whether metabolism really is genome-deep — a fermenter has no oxygen
// dependency, and nothing in the engine knows that. Lichen asks something sharper:
// whether an "organism" has to correspond to one genome. It does not, and the mechanism
// arrived by accident — `Organism` accepts an existing Soup, added an hour earlier purely
// to stop World keeping a second copy of the metabolism. Two genomes on one soup is a
// symbiosis, and the refactor turned out to be the endosymbiosis primitive.

import { test, expect } from "vitest";
import { Soup } from "../src/chemistry.js";
import { Organism } from "../src/organism.js";
import { ALGA, MYCOBIONT, YEAST } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";

/** Bare rock in daylight: light and air, no litter, nothing to rot. */
function bareGround(soup: Soup): void {
  soup.set(CHEMS.light, 1.4);
  soup.add(CHEMS.co2, 0.6);
  soup.add(CHEMS.o2, 0.6);
}

/** A sealed jar of sugar: no oxygen, ever. */
function airlessSugar(soup: Soup): void {
  soup.add(CHEMS.starch, 0.3);
  soup.set(CHEMS.o2, 0);
}

test("yeast makes a living with no oxygen at all", () => {
  // a little starting currency: picking even the easiest lock costs ATP, so a cell with
  // none cannot begin digesting its way to more
  const yeast = new Organism({ genome: YEAST, initial: [[CHEMS.adp, 10], [CHEMS.atp, 1]] });
  for (let i = 0; i < 200; i++) {
    airlessSugar(yeast.soup);
    yeast.metabolise();
    yeast.checkVitality();
  }
  expect(yeast.alive).toBe(true);
  expect(yeast.soup.get(CHEMS.atp)).toBeGreaterThan(0.5);
  // and it throws away four of the six carbons it started with — which is why brewing
  // works, and why something always evolves to drink the leftovers
  expect(yeast.soup.get(CHEMS.ethanol)).toBeGreaterThan(0);
});

test("an aerobe in the same sealed jar cannot", () => {
  const aerobe = new Organism({ genome: MYCOBIONT, initial: [[CHEMS.adp, 10], [CHEMS.atp, 1]] });
  for (let i = 0; i < 200; i++) {
    airlessSugar(aerobe.soup);
    aerobe.soup.add(CHEMS.cellulose, 0.3); // plenty to eat, no way to burn it
    aerobe.metabolise();
    aerobe.checkVitality();
  }
  expect(aerobe.alive).toBe(false);
});

test("neither lichen partner survives bare rock alone", () => {
  const fungus = new Organism({ genome: MYCOBIONT, initial: [[CHEMS.adp, 10], [CHEMS.atp, 1]] });
  for (let i = 0; i < 200; i++) {
    bareGround(fungus.soup);
    fungus.metabolise();
    fungus.checkVitality();
  }
  // all the light in the world is no use to something that cannot photosynthesise
  expect(fungus.alive).toBe(false);
});

test("together on one soup, they live where neither could", () => {
  // THE WHOLE POINT: one body, two genomes, no new machinery. The alga fixes carbon it
  // cannot defend; the fungus burns sugar it cannot make.
  const body = new Soup([[CHEMS.adp, 10], [CHEMS.atp, 1]]);
  const photobiont = new Organism({ genome: ALGA, soup: body });
  const mycobiont = new Organism({ genome: MYCOBIONT, soup: body });

  for (let i = 0; i < 200; i++) {
    bareGround(body);
    photobiont.metabolise();
    mycobiont.metabolise();
    photobiont.checkVitality();
    mycobiont.checkVitality();
  }

  expect(photobiont.alive).toBe(true);
  expect(mycobiont.alive).toBe(true);
  expect(body.get(CHEMS.atp)).toBeGreaterThan(0.5);
});
