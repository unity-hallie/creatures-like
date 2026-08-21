// Does food reach the animals, does a tick mean one tick, and can a brain still change?
//
// Three bugs, none of which any existing test could see, because every existing test asked
// whether the machinery RAN rather than whether it fed or taught anyone. A grazer starving
// in a world full of fruit reads exactly like a grazer in a world with none, and a brain
// pinned against its own clamp reads exactly like a brain that has finished learning.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";

const meadow = (grazers: number) =>
  new Ecosystem({
    seed: 3,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
  });

test("grazers eat with their mouths, not their skin", () => {
  // `#uptakeFor` walks each genome's reactants and pulls them from the patch. A grazer's
  // genome lists starch (amylase consumes it), so every grazer silently drank 30% of its
  // patch's starch every tick — no forage threshold, no bite, no `eat` action, no meal
  // counted, no dopamine. Food never accumulated to the level `senseOf` calls visible, so
  // the animals stood in a larder they could not perceive and starved.
  //
  // Measured over 2000 ticks with three founders: 9 meals before, 482 after.
  const eco = meadow(3);
  for (let t = 0; t < 2000; t++) eco.step();
  expect(eco.meals).toBeGreaterThan(100);
});

test("a newborn does not live a tick it was not born for", () => {
  // `#breed` pushes onto the same array the tick loop walks, and `for...of` reads a live
  // array — so a newborn foraged, metabolised and bred inside the tick it was born, and
  // its child did too. The population grew by generations per tick rather than by one.
  //
  // Bounded by what a single round of breeding can do: every founder may breed once, so
  // the cohort can at most double. Above that, a generation ran twice in one tick.
  const eco = meadow(14);
  const founders = eco.grazers.length;
  eco.step();
  expect(eco.grazers.length).toBeLessThanOrEqual(founders * 2);
});

test("a brain that is always unhappy can still change its mind", () => {
  // Consolidation read the verdict's LEVEL, so a chronic weak punishment swamped a rare
  // strong reward: `fuelLow` fires on 99.97% of ticks, cortisol sat pinned, and every
  // action got punished about equally until all of them hit the weight clamp. Activation
  // then went identical across actions — a three-way tie no drive could break. The
  // creature had learned that being alive is bad, which is true and useless.
  //
  // Reading the PHASIC component instead — how far the verdict departs from what this
  // creature has come to expect — is how dopamine actually works. Measured at tick 400:
  // 39 of 108 weights pinned at the clamp before, 4 of 96 after.
  const eco = meadow(3);
  for (let t = 0; t < 400; t++) eco.step();

  const live = eco.grazers.filter((g) => g.organism.alive);
  expect(live.length).toBeGreaterThan(0);

  // WHY THE PROXY CHANGED. Counting pinned weights read 36% before the phasic fix and 4%
  // after, so it stood in well for "stuck". Once the atmosphere stopped throttling the food
  // supply it climbed back to 23% — and that is a creature with strong opinions, not a stuck
  // one: `left` and `right` now sit about 2.0 apart where they used to sit 0.05 apart.
  // Pinned-and-tied and pinned-and-decided look identical to a clamp count, so the clamp
  // count was never the thing worth asserting. The claim underneath was that the brain can
  // still DISCRIMINATE, so assert that instead.
  // BY POSITION, not by name. A sense's name is derived from its keys, and `mutate` drifts
  // keys — so a creature two generations down has a differently-named nose and `weightOf`
  // returns NaN for it. Names are handles for a human reading a trainer; the wiring is the
  // index. Slots 0 and 1 are the left and right smell genes, in the order the genome lists.
  const spreads = live.map((g) =>
    Math.abs(g.lobe.weights[g.lobe.actions.indexOf("left")][0] - g.lobe.weights[g.lobe.actions.indexOf("right")][1]),
  );
  expect(Math.max(...spreads)).toBeGreaterThan(0.25);
});
