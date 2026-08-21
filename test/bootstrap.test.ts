// The reason grazers die, after five wrong answers.
//
// The wrong ones, each real and each fixed, none of which moved the death curve: passive
// uptake siphoning patch starch; a breeding gate that let a parent spend itself to nothing;
// founder birth-capital driving overshoot; decomposers outcompeting grazers for fallen
// fruit; and the food supply itself. That last one died hardest. Scaled to 96 patches and
// 72 plants the ground holds 12.13 starch across 8 feedable patches — twenty-three times
// the baseline, visibly piling up uneaten — and the world still ends with one grazer. More
// food does not make more grazers. It never did.
//
// Everything works except the part that has to learn:
//
//   food supply   fine — 12.13 on the ground, accumulating
//   perception    fine — grazer0 sensed food on 99 of its 118 ticks
//   movement      fine — 78 moves in 119 ticks
//   policy        a random walk, and unable to become anything else
//
// A lobe consolidates only when a reward chemical binds its learning receptor, and the
// genome secretes dopamine on a successful meal. So a grazer that has never eaten has never
// had a positive signal at all. The only verdict that ever arrives is cortisol from
// `fuelLow`, which punishes whatever fired — and since every action fires sometimes, every
// action gets punished about equally. Measured after 118 ticks:
//
//   weights[left]  = -0.87  -0.91  -0.00  -1.81
//   weights[right] = -0.82  -0.88   0.02  -1.81
//   weights[eat]   = -0.92  -0.93  -0.02  -1.88
//                     foodLeft foodRight foodHere fuelLow
//
// `weights[left][foodLeft]` wants to be positive — see food to the left, go left. It is
// -0.87, and its mirror is -0.88, and left and right sit 0.05 apart. The creature cannot
// tell one direction from the other, so it walks at random, so it does not eat, so it never
// learns to. A grazer must reach food to learn to reach food.
//
// The survivor in every run is not skilled. It started near food and won a lottery.
//
// This is a bootstrapping problem, not a tuning one, and no threshold, rate or population
// number reaches it. It wants what Creatures actually had and this genome does not: an
// INNATE REFLEX — a gene that seeds a synapse with a prior, so a newborn arrives already
// leaning toward food and has something for reward to sharpen rather than invent.
//
// The first test pins the deadlock and is written to FAIL when instincts land. The second
// guards the thing that makes it a real deadlock rather than a supply problem, and should
// stay green forever.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";

function richWorld() {
  return new Ecosystem({
    seed: 3,
    width: 96,
    plants: 72,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
  });
}

test("a grazer cannot tell which way food lies", () => {
  const eco = richWorld();
  const grazer = eco.grazers[0];
  let sensedFood = 0;
  let ticks = 0;
  for (let t = 0; t < 1500 && grazer.organism.alive; t++) {
    eco.step();
    ticks++;
    const [left, right, here] = eco.senseOf(grazer);
    if (left || right || here) sensedFood++;
  }

  // It could see food nearly the whole time it was alive.
  expect(sensedFood / ticks).toBeGreaterThan(0.5);

  // And steering costs it nothing to want: the two turns are wired to opposite senses, so a
  // brain that had learned anything would separate them. This asserts that it has NOT, which
  // is the bug — give the genome an innate reflex and this line should start failing.
  const lobe = grazer.lobe;
  const towardLeft = lobe.weightOf("left", "foodLeft");
  const towardRight = lobe.weightOf("right", "foodRight");
  expect(Math.abs(towardLeft - towardRight)).toBeLessThan(0.25);
  expect(towardLeft).toBeLessThan(0);
  expect(towardRight).toBeLessThan(0);
});

test("the food is there — they are starving in a full larder", () => {
  const eco = richWorld();
  for (let t = 0; t < 3000; t++) eco.step();
  const ground = eco.patches.map((p) => p.soup.get(CHEMS.starch));
  const feedable = ground.filter((s) => s >= 0.05).length;

  // Food accumulates on the ground, unreached, while the population collapses. If a future
  // change makes grazers actually forage, this stock should DROP and the population rise —
  // so read a failure here as "check which of the two moved" rather than as a regression.
  expect(ground.reduce((a, b) => a + b, 0)).toBeGreaterThan(5);
  expect(feedable).toBeGreaterThan(3);
  expect(eco.grazers.filter((g) => g.organism.alive).length).toBeLessThan(4);
});
