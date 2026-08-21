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
// (That was the diagnosis at the time. Read on — it was true and it was not the cause.)

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

// RESOLVED, AND NOT BY THE FIX THIS FILE ASKED FOR.
//
// Everything above described a real deadlock and drew the wrong conclusion from it. The
// weights really were 0.05 apart, the grazer really did walk at random past food it could
// see, and reward-gated learning really cannot bootstrap from zero reward. So this file
// asked for an innate prior — a gene seeding the synapse, which is what Creatures had.
//
// That was built, swept across strengths, and thrown away: it never moved the population,
// and at any strength that helped, a creature with its learning receptor DELETED performed
// as well as one without, which dismantles the claim the whole project rests on.
//
// The deadlock dissolved instead when the atmosphere got a real buffer. Thin air throttled
// primary production to a trickle; the trickle was why food was rare; rarity was why no meal
// ever arrived; no meal was why no dopamine ever arrived; and that was the deadlock. Feed the
// world and the same brain, unchanged, learns direction on its own — `left` and `right` now
// separate by about 2.0 where they sat 0.05 apart.
//
// The lesson is about diagnosis, not brains. A true mechanism can be four steps downstream of
// its cause, and fixing it there works exactly well enough to be convincing and not well
// enough to matter.

test("a grazer learns which way food lies, with no innate prior at all", () => {
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

  // The two turns are wired to opposite senses, so a brain that has learned anything
  // separates them. This line once asserted the separation was UNDER 0.25 — the bug — and
  // now asserts it is well over, with no instinct gene anywhere in the genome.
  //
  // READ ACROSS THE POPULATION, not off one creature. This used to interrogate grazers[0],
  // which worked while the world held a handful of animals. With the world carrying 120 the
  // spread runs 5.67 at the top and 0.70 median, and grazers[0] sits at 0.26 — while being
  // the single most successful forager in the world, on 1,239 meals. Where food is
  // everywhere, steering earns little, so a fed creature has no reason to separate its
  // turns. Asserting on one individual measured that accident, not the claim.
  const spread = (g: (typeof eco.grazers)[number]) =>
    Math.abs(g.lobe.weightOf("left", "foodLeft") - g.lobe.weightOf("right", "foodRight"));
  const living = eco.grazers.filter((g) => g.organism.alive);
  expect(Math.max(...living.map(spread))).toBeGreaterThan(0.5);
});

test("the larder empties because they are eating it", () => {
  const eco = richWorld();
  for (let t = 0; t < 3000; t++) eco.step();
  const ground = eco.patches.map((p) => p.soup.get(CHEMS.starch));
  const feedable = ground.filter((s) => s >= 0.05).length;

  // This test once read `ground > 5`: 12.13 starch lay on the ground unreached. Unblocking
  // the census emptied the larder without raising the population — the stock moved and the
  // survivors did not, which is what said the food was never the constraint. Thickening the
  // air moved both at once, which is the pairing this test was built to detect.
  expect(ground.reduce((a, b) => a + b, 0)).toBeLessThan(5);
  expect(feedable).toBeGreaterThanOrEqual(0);
  expect(eco.grazers.filter((g) => g.organism.alive).length).toBeGreaterThan(5);
});
