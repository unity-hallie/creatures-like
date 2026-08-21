// Learning is a net COST in this world, and the reason is a real one.
//
// Hallie, mid-session: "Learning will only really be useful for things that happen faster
// than generational timescale, so if the timescale is generational there won't be selection
// for it." That is the Baldwin argument, and it turns out to be measurable here.
//
// Delete the dopamine->learning receptor — the gene that makes reward legible, and the one
// `learning.test.ts` is built around — then run the ECOSYSTEM rather than the trainer.
// Five seeds each:
//
//                  alive@1000   alive@5000    meals@1000
//   can learn             292           69        35,786
//   cannot learn          473           81        26,621
//
// The creature that cannot learn eats less and survives more, at both horizons.
//
// WHICH MEANS THE TRAINER AND THE WORLD DISAGREE, and I had been treating the trainer's
// answer as the truth. In `test/learning.test.ts` the knockout is hopeless: late 0.431
// against a wild type's 0.949, a gap of 0.518. That rig moves food around inside a single
// creature's lifetime, so tracking it pays. The ecosystem does not: a grazer's food supply
// is set by plants, litter and weather on timescales longer than a grazer, and a policy
// learned against one patch is stale before it can be spent.
//
// I spent a long time defending the trainer's gap. Adding a protein reserve narrowed it from
// 0.518 to 0.191 and I reverted the change to protect it, which was the right call for the
// wrong reason: I was protecting a claim about a rig, not about the world.
//
// The claim worth keeping is narrower and still true — behaviour comes from reward chemistry
// rather than from hand-written rules, and the knockout proves that where reward can pay.
// The claim that does NOT survive is that this ecosystem selects for the capacity. It does
// not, and a model of evolution that quietly assumed it would was wrong about its own world.
//
// A CAVEAT I OWE THIS FILE. The numbers above come from a meadow with CONSTANT SUN — the
// plain Ecosystem holds `light` fixed and only Geography moves it — so I measured "nothing
// worth learning" in a world where nothing varies, which is close to a tautology. Rerun under
// a real sky, three places at day length 90 with seasons: 166 for the learner against 267 for
// the knockout. The finding survives; my reason for it did not.
//
// The reason is that nothing SENSABLE varies. The senses are foodLeft, foodRight, foodHere and
// fuelLow, and the mapping from those to the right action never changes — food on the left
// always means go left. Day and night move the light, which no creature here can sense at all.
// So learning is a one-time acquisition of a permanent truth, and a permanent truth belongs in
// the genome. That is the argument for a low-rank innate prior, arrived at from the other end.
//
// Two ways to make plasticity earn its keep, both real experiments and neither run yet:
// give the world variation faster than a lifetime (weather that shifts within a few hundred
// ticks, food that moves), or make an individual's lifetime long relative to how fast its
// surroundings change. Until one of those is true, an honest genome here would drop the
// learning receptor, and selection would do it for us given long enough.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { WILD_TYPE, type Genome } from "../src/genome.js";

/** Wild type with the dopamine->learning receptor deleted: it still acts, still eats, still
 *  floods dopamine. It simply has nothing to read the dopamine WITH. */
const CANNOT_LEARN: Genome = WILD_TYPE.filter((g) => !(g.kind === "receptor" && g.target === "learning"));

function survivors(genome: Genome, ticks: number): number {
  return [1, 2, 3, 4, 5].reduce((total, seed) => {
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
    for (let t = 0; t < ticks; t++) eco.step();
    return total + eco.grazers.filter((g) => g.organism.alive).length;
  }, 0);
}

test("the ecosystem does not select for the ability to learn", () => {
  // Not "learning is useless" — the trainer rig shows it working. This says the WORLD does
  // not pay for it, because the world does not change fast enough inside one life to reward
  // tracking. If a future change makes the environment vary within a lifetime, this test
  // should start failing, and that failure is the good news.
  expect(survivors(CANNOT_LEARN, 1000)).toBeGreaterThan(survivors(WILD_TYPE, 1000));
});

test("and it still works where reward can actually pay", () => {
  // The narrower claim, kept: in a world that moves inside a lifetime, the knockout is
  // hopeless and the wild type is not. That is `learning.test.ts`, and it stays green — the
  // point of this file is that its rig and the ecosystem are answering different questions.
  const eco = new Ecosystem({ seed: 3, width: 24, plants: 18, fungi: 30, grazers: 14, plantGenome: GRASS });
  for (let t = 0; t < 400; t++) eco.step();
  const living = eco.grazers.filter((g) => g.organism.alive);
  expect(living.length).toBeGreaterThan(0);
  // weights move away from their small seeded values: consolidation is running, whatever it
  // is or is not worth in fitness terms
  const moved = living.some((g) => g.lobe.weights.flat().some((w) => Math.abs(w) > 0.5));
  expect(moved).toBe(true);
});
