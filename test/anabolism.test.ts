// Why an animal is not made of anything, chased to the bottom.
//
// Predation is writable and not viable: an animal's whole body totals about 0.005 against a
// MOUTHFUL of 0.02, so a predator holding every protease in the world would find nothing to
// use them on. Four candidate causes, measured in order, three of them wrong:
//
// NOT FAT STORAGE. `lipogenesis` is gated by insulin above glucose 0.7, and I predicted from
// the rates that 0.7 was unreachable — steady-state glucose should sit near 0.167 times gut
// starch, capped by GUT_CAPACITY at about 0.23. Wrong: a big meal spikes it. Peak glucose
// observed 1.16, p99 0.64, three samples of 1093 above the threshold. So fat IS stored,
// rarely, and lipolysis burns it back whenever glucose falls under 0.4 — which is 99% of
// ticks, because a population at its crowd cap keeps its members lean. That part is ecology
// working, not a defect.
//
// NOT NITROGEN SCARCITY. Raising soil ammonia a hundredfold takes plant nitrogen from 0.04
// to 165.78 and leaves plant PROTEIN at 0.002. They hold it as ammonia and never build with
// it, because `aminate` needs glucose and glucose is scarce everywhere — everything burns it
// for ATP the moment it arrives.
//
// NOT THE MOUTH. That was the previous commit: the biting loop no longer walks one cohort and
// no longer takes one chemical by name. It changed nothing here, which is how this file got
// written.
//
// IT IS ANABOLISM. Ask each genome what it can build that another body could eat:
//
//   GRASS        cellulose | lignin | starch | proteins
//   SAPROPHYTE   nothing
//   WILD_TYPE    lipids, behind a gate that opens on 0.3% of ticks
//
// A plant has four ways to make a body and an animal has one, effectively shut. Fungi have
// none at all — the cellulose they appear to be made of is undigested food they absorbed and
// could not finish, which is why they are the only thing in this world currently worth biting.
//
// An animal here is a metabolism with no anatomy. It eats, burns, moves and breeds, and at no
// point does any of that become structure. So there is nothing for a predator to eat, nothing
// to survive a lean patch on, and nothing that a corpse could return but the sugar in transit
// through it.
//
// NOT FIXED HERE. Giving animals a structural pathway changes what an animal IS in this model
// — it is a design decision rather than a defect, and the last few of those went better for
// being measured first and built second.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CHEMS, DETRITIVORE, SUBSTRATE_LOCKS, WILD_TYPE, type Genome } from "../src/genome.js";

/** Everything this genome can synthesise that some other body could make a meal of. */
function buildsBodyFrom(genome: Genome): string[] {
  return genome
    .filter(
      (gene) =>
        gene.kind === "reaction" &&
        gene.reaction.products.some((p) => SUBSTRATE_LOCKS.some(([substrate]) => substrate === p.chem)),
    )
    .map((gene) => (gene as { reaction: { slug: string } }).reaction.slug);
}

test("a plant builds a body four ways and an animal effectively cannot", () => {
  expect(buildsBodyFrom(GRASS).length).toBeGreaterThanOrEqual(4);
  // The one animal pathway is lipogenesis, and insulin holds it shut almost always.
  expect(buildsBodyFrom(WILD_TYPE)).toEqual(["lipogenesis"]);
  expect(buildsBodyFrom(DETRITIVORE)).toEqual(["lipogenesis"]);
  // A decomposer builds nothing: what it seems to be made of is food it has not finished.
  expect(buildsBodyFrom(SAPROPHYTE)).toEqual([]);
});

test("so an animal carries no nitrogen worth speaking of", () => {
  const eco = new Ecosystem({
    seed: 3,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
    grazerGenome: DETRITIVORE,
  });
  for (let t = 0; t < 3000; t++) eco.step();

  const living = eco.grazers.filter((g) => g.organism.alive);
  expect(living.length).toBeGreaterThan(0);
  const protein = living.reduce((a, g) => a + g.organism.soup.get(CHEMS.proteins), 0);
  // 0.0001 across a hundred animals. A body made of protein is what a predator eats.
  expect(protein).toBeLessThan(0.01);
});

test("the animal's one anabolic gate is shut almost always", () => {
  const eco = new Ecosystem({
    seed: 3,
    width: 24,
    plants: 18,
    fungi: 30,
    grazers: 14,
    plantGenome: GRASS,
    fungusGenome: SAPROPHYTE,
    soilAmmonia: 0.5,
    grazerGenome: DETRITIVORE,
  });
  let samples = 0;
  let fed = 0;
  for (let t = 0; t < 600; t++) {
    eco.step();
    for (const grazer of eco.grazers) {
      if (!grazer.organism.alive) continue;
      samples++;
      // insulin's threshold in WILD_TYPE, the gate lipogenesis sits behind
      if (grazer.organism.soup.get(CHEMS.glucose) > 0.7) fed++;
    }
  }
  expect(samples).toBeGreaterThan(0);
  // Reachable, and rare: this is a lean animal, not one that cannot get there at all.
  expect(fed / samples).toBeLessThan(0.05);
});
