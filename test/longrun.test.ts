// What happens after the fix, over a long enough run to see it.
//
// Thickening the atmosphere took the meadow from about one grazer to about thirty and moved
// their extinction from roughly tick 200 out past tick 10,000. That is real and it is not the
// end of the story, which this file exists to say out loud before anyone reads the earlier
// commits as a victory lap.
//
//   t 1000: plants  98  fungi 120  grazers  37 | CO2  7.1  O2 284  litterC 5855
//   t 5000: plants  39  fungi 120  grazers  26 | CO2  3.6  O2 131  litterC 3092
//   t10000: plants  35  fungi 120  grazers   7 | CO2  0.3  O2 101  litterC  964
//   t20000: plants  25  fungi 120  grazers   0 | CO2  0.2  O2  64  litterC  296
//
// The same slow drain still runs; it just takes fifty times longer to finish. And this time
// the sink is in plain sight: FUNGI SIT PINNED AT CROWD_LIMIT FOR THE ENTIRE RUN. Litter
// falls from 5855 to 296 and the air falls to 0.2, so of roughly 12,000 total carbon the
// bulk ends up inside about 145 living bodies — on the order of 80 carbon each.
//
// Those fungi cannot breed, because the cap refuses them. Nothing eats them, because nothing
// in this world eats anything living except a plant. And they do not starve, because litter
// keeps arriving. So they accumulate carbon they have no way to spend, and the atmosphere
// ends up inside them.
//
// CROWD_LIMIT's own comment says resource limits should bind first and that it exists only so
// a bug cannot become a memory leak. For fungi it is the binding limit, permanently, and that
// makes it a population control doing ecology's job — the same mistake as the census that
// counted corpses, wearing different clothes.
//
// NOT FIXED HERE, deliberately. The last time a diagnosis got a same-session fix it was the
// instinct gene: built, measured, and thrown away because it treated a symptom four steps
// downstream. The candidates worth measuring, in the order I would try them: let a capped
// fungus spend surplus carbon instead of hoarding it (an upkeep or a respiratory floor);
// give the world something that eats fungi; or make the cap scale with the place the way the
// atmosphere now does. Each is a real change and none should land without a population
// measurement beside it.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CARBON, CHEMS } from "../src/genome.js";

function meadow() {
  return new Ecosystem({
    seed: 3,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
  });
}

test("the atmosphere fix buys thousands of ticks, not permanence", () => {
  const eco = meadow();
  for (let t = 0; t < 3000; t++) eco.step();
  // Where the earlier commits stop looking, and the number they report.
  expect(eco.grazers.filter((g) => g.organism.alive).length).toBeGreaterThan(5);

  for (let t = 3000; t < 20000; t++) eco.step();
  // And where it actually goes. If a future change keeps grazers alive out here, this line
  // fails and the file above needs rewriting — which is the point of pinning it.
  expect(eco.grazers.filter((g) => g.organism.alive).length).toBeLessThan(3);
});

test("a capped fungus population becomes the carbon sink", () => {
  const eco = meadow();
  for (let t = 0; t < 20000; t++) eco.step();

  const living = [...eco.plants, ...eco.fungi, ...eco.grazers].filter((r) => r.organism.alive);
  const carbonIn = (soup: { get(id: (typeof CHEMS)["co2"]): number }) =>
    CARBON.reduce((total, [id, per]) => total + soup.get(id) * per, 0);
  const inBodies = living.reduce((a, r) => a + carbonIn(r.organism.soup), 0);

  // Fungi hold the cap the whole way, unable to spend surplus on offspring and with nothing
  // to eat them, so the world's carbon accumulates in their bodies instead of cycling.
  expect(eco.fungi.filter((f) => f.organism.alive).length).toBe(120);
  expect(inBodies / eco.totalCarbon()).toBeGreaterThan(0.8);
  expect(eco.air.get(CHEMS.co2)).toBeLessThan(1);
});
