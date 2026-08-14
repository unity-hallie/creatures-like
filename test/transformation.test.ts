// Sex, arriving the way it actually arrived: as a side channel, not a mode.
//
// Reproduction here is mitotic and stays mitotic. What evolves is competence — the ability
// to shed genetic material and to take up what others shed. Bacteria do exactly this:
// they reproduce by fission and SEPARATELY swap DNA by transformation. Sex and
// reproduction were separate processes first, and nothing in this engine knows the word.

import { test, expect } from "vitest";
import { Dice } from "../src/dice.js";
import { competenceOf, recombine, shed, WILD_TYPE, type Genome } from "../src/genome.js";
import { Organism } from "../src/organism.js";
import { Ecosystem } from "../src/ecology.js";
import { PLANT, SAPROPHYTE } from "../src/flora.js";

const die = (seed = 8) => new Dice(seed).at("mutation");

test("a lineage stripped of competence sheds nothing and takes nothing", () => {
  // Every seeded genome now carries a TRACE of competence, because mutation here is
  // multiplicative and jitter on zero stays zero — a capacity at exactly nothing could
  // never arise. So being incompetent is now something you have to be built as.
  const barren: Genome = SAPROPHYTE.filter((g) => g.kind !== "competence");
  expect(competenceOf(barren)).toEqual({ donate: 0, uptake: 0 });
  expect(competenceOf(SAPROPHYTE).donate).toBeGreaterThan(0);
});

test("shedding takes part of a genome, never the whole of one", () => {
  const packet = shed(WILD_TYPE, die(), 0.25);
  expect(packet.genes.length).toBeGreaterThan(0);
  expect(packet.genes.length).toBeLessThan(WILD_TYPE.length);
});

test("integration lands only where the kinds agree", () => {
  // not a safety rail bolted on — it is why the result is an organism rather than a
  // corpse, and why real transformation needs homology too
  const donor: Genome = [...SAPROPHYTE];
  const packet = shed(donor, die(2), 1);
  const recipient: Genome = [...SAPROPHYTE];
  const merged = recombine(recipient, packet, die(3));
  expect(merged.length).toBe(recipient.length);
  merged.forEach((gene, i) => expect(gene.kind).toBe(recipient[i].kind));
});

test("an organism can take on a changed genome without dying of it", () => {
  const cell = new Organism({ genome: SAPROPHYTE });
  const before = cell.expressed.reactions.length;
  cell.adopt(recombine(cell.genome, shed(SAPROPHYTE, die(4), 0.5), die(5)));
  // the body keeps living and runs on different instructions from here
  expect(cell.alive).toBe(true);
  expect(cell.expressed.reactions.length).toBe(before);
});

test("competent populations recombine; incompetent ones never do", () => {
  const competent: Genome = [...SAPROPHYTE, { kind: "competence", donate: 0.5, uptake: 0.5 }];
  const withIt = new Ecosystem({ seed: 4, plants: 6, fungi: 10, fungusGenome: competent });
  // the whole world has to be barren, not just its fungi: recombination is counted across
  // every organism present, and plants carry the trace too
  const strip = (g: Genome): Genome => g.filter((x) => x.kind !== "competence");
  const withoutIt = new Ecosystem({
    seed: 4,
    plants: 6,
    fungi: 10,
    fungusGenome: strip(SAPROPHYTE),
    plantGenome: strip(PLANT),
  });
  for (let i = 0; i < 400; i++) {
    withIt.step();
    withoutIt.step();
  }
  expect(withIt.recombinations).toBeGreaterThan(0);
  expect(withoutIt.recombinations).toBe(0);
});

test("reproduction happens, and the world still balances while it does", () => {
  const eco = new Ecosystem({ seed: 6, plants: 8, fungi: 10, grazers: 3 });
  const carbon = eco.totalCarbon();
  const nitrogen = eco.totalNitrogen();
  for (let i = 0; i < 600; i++) eco.step();
  expect(eco.births).toBeGreaterThan(0);
  // a parent pays for its child out of its own body, so nothing is created
  expect(eco.totalCarbon()).toBeCloseTo(carbon, 6);
  expect(eco.totalNitrogen()).toBeCloseTo(nitrogen, 6);
});
