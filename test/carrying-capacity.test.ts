// How many animals does this world actually feed?
//
// The question `closed-loop.test.ts` asked and left open: "a forest of eighteen plants over
// twenty-four patches barely supports one animal. Whether that is a fact about the model or
// about my stocking is the next question."
//
// Measured, it is neither. It is a fact about the FOOD SUPPLY, and it holds no matter how
// the world is stocked. Three runs, identical but for how rich the founding grazers start:
//
//   founder capital 1.00x (as shipped)     peak 120   alive@3000  1
//   founder capital 0.35x (a child's share) peak  56   alive@3000  1
//   founder capital 0.20x                   peak  35   alive@3000  1
//
// Capital sets the peak and nothing else. Every run converges on one grazer, and that grazer
// ends comfortable rather than starving (ATP 2.16, still eating at tick 3000, 653 meals). So
// the deaths are not an overshoot artefact and not a breeding bug: the world has room for
// about one animal, and everything above that number starves on the way down to it.
//
// That matters because it is the third hypothesis for these deaths to fail. Passive uptake
// stealing food, a runaway breeding rule, and founder overshoot were all real defects, all
// fixed, and none of them moved this number. What is left is the supply itself — how much
// starch a living plant actually leaves where an animal can reach it, which `#egest` governs
// through accessibility.
//
// SO THIS TEST IS WRITTEN TO FAIL when that gets fixed. It pins a number nobody should want
// to keep. Raise the ceiling and come delete it.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";

function meadow(seed: number) {
  return new Ecosystem({
    seed,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
  });
}

test("the meadow settles on the same tiny number of grazers however it starts", () => {
  // Poorer founders, smaller crowd, same destination — which is what makes this a statement
  // about the supply rather than about the stocking.
  for (const capital of [1, 0.35, 0.2]) {
    const eco = meadow(3);
    for (const grazer of eco.grazers) {
      for (const id of [CHEMS.atp, CHEMS.adp, CHEMS.glucose]) {
        grazer.organism.soup.set(id, grazer.organism.soup.get(id) * capital);
      }
    }
    for (let t = 0; t < 3000; t++) eco.step();
    const alive = eco.grazers.filter((g) => g.organism.alive).length;
    expect(alive).toBeGreaterThan(0);
    expect(alive).toBeLessThan(4);
  }
});

test("the last grazer starves for company, not for food", () => {
  const eco = meadow(3);
  for (let t = 0; t < 3000; t++) eco.step();
  const survivor = eco.grazers.find((g) => g.organism.alive);
  expect(survivor).toBeDefined();
  // A world too poor to feed anyone would leave its last animal on the edge of the vitality
  // threshold (0.05). This one leaves it fat, which is the whole finding: the food exists,
  // and there is exactly not very much of it.
  expect(survivor!.organism.soup.get(CHEMS.atp)).toBeGreaterThan(1);
  expect(eco.meals).toBeGreaterThan(300);
});
