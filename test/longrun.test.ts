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
// SOLVED THE NEXT TICK, and by none of the three candidates I listed here. Those were an
// upkeep floor, a fungus predator, and a scaling cap. What was actually wrong: a corpse kept
// its adenine forever. `matter()` reads CARBON union NITROGEN and ATP and ADP sit in neither,
// so `#decompose` returned a body's carbon and left its adenine behind. Over 20,000 ticks and
// 606 deaths the world's 704 adenine went from all-living to 651 stranded in corpses.
//
// That is why the fungi hoarded. Respiration costs 30 ADP per glucose, so a fungus down to
// 0.07 ADP burns 0.002 glucose a tick while holding 16 — not greedy, just unable to spend.
// Return the adenine and it burns its fuel again:
//
//                        before      after
//   adenine in corpses      651          0
//   adenine in the living    52        300
//   fungal glucose hoard   16.17       2.24
//   grazers at t20000          0          4
//
// CONFIRMED WORLD-WIDE, at the surface this project is meant to be read through. Rendering
// the twelve-place sim shows FUN 120 in every single biome at two different ticks — the
// fungal cap is not an artefact of this one 24-patch meadow, it binds everywhere, and FLA
// sits at 120 in most places too. Ground lignin climbs in all twelve.
//
// Two things the picture corrected rather than confirmed, both of which I would have called
// bugs from a console. Boreal grazers fall 50 to 4 across 600 ticks — that is POLAR NIGHT,
// not a crash: boreal sits at latitude 1.00 and its SUN reads 2.07 then 0.00 as the year
// rolls over. And world carbon reads 209572.00 at both ticks, so the whole twelve-place
// ledger is exact while all of this happens.
//
// The old numbers below are kept because the shape of the mistake is worth more than the
// fix: this is the SECOND time this world stranded a conserved quantity where nothing could
// reach it, and the second time every balance check stayed green while it happened. Carbon
// and nitrogen have world-level conservation tests. Adenine had none, so nothing could say
// where it had gone — only that it had not gone missing.

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

test("the population survives the long run, thinly", () => {
  const eco = meadow();
  for (let t = 0; t < 3000; t++) eco.step();
  // Where the earlier commits stop looking, and the number they report.
  expect(eco.grazers.filter((g) => g.organism.alive).length).toBeGreaterThan(5);

  for (let t = 3000; t < 20000; t++) eco.step();
  // This line read `< 3` and was written to fail when the decline got fixed. It failed the
  // next day. Recycling adenine keeps the population off zero out here — thin, but alive,
  // where it used to be extinct.
  expect(eco.grazers.filter((g) => g.organism.alive).length).toBeGreaterThan(0);
});

test("a capped fungus population is no longer a one-way carbon sink", () => {
  const eco = meadow();
  for (let t = 0; t < 20000; t++) eco.step();

  const living = [...eco.plants, ...eco.fungi, ...eco.grazers].filter((r) => r.organism.alive);
  const carbonIn = (soup: { get(id: (typeof CHEMS)["co2"]): number }) =>
    CARBON.reduce((total, [id, per]) => total + soup.get(id) * per, 0);
  const inBodies = living.reduce((a, r) => a + carbonIn(r.organism.soup), 0);

  // The fungi still hold the cap — that part was never about adenine, and a population
  // control still does ecology's job here. What changed is that a capped fungus is no longer
  // a one-way carbon sink: it can respire what it takes in, so the air is not swallowed.
  expect(eco.fungi.filter((f) => f.organism.alive).length).toBe(120);
  expect(inBodies / eco.totalCarbon()).toBeLessThan(0.95);
});
