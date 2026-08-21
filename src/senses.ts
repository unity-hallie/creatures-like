// Reading the world through whatever receptors a genome happens to express.
//
// ONE IMPLEMENTATION, deliberately. The senses used to be computed twice — once by the
// ecosystem and once by the single-creature trainer — from a shared list of four names. That
// is the arrangement this file exists to prevent: perception and action already drifted apart
// here once, when the senses reported "no food" below a threshold and the mouth took whatever
// was there, and a creature scored 119 meals in 120 ticks off patches its own eyes called
// empty. Two implementations of "what is out there" is how that happens.
//
// So both callers hand this module a way to look up a soup by position and it does the rest.

import type { ChemId, Soup } from "./chemistry.js";
import type { Keys } from "./digestion.js";
import { accessibility } from "./digestion.js";
import { LOCK_OF, SUBSTRATE_LOCKS, sensesByShape, type SenseGene } from "./genome.js";

/** How fast a smell falls off with distance. A gradient is the whole point of having two
 *  nostrils, so the far patches have to count for less than the near ones. */
const FALLOFF = 1;

/** Receptors saturate. Without this a sense is unbounded and a big enough pile of anything
 *  swamps every weight in the lobe, which is a numerical accident rather than a perception.
 *  x/(1+x) keeps a reading in [0,1) while staying monotonic, so more always reads as more. */
function saturate(x: number): number {
  return x < 0 ? -saturate(-x) : x / (1 + x);
}

/** How strongly one nose answers to each locked substrate — a fact about the GENE, not about
 *  where the creature is standing, so it is settled once and remembered.
 *
 *  It has to be. Scoring keys against six substrates at twelve motifs each, for every patch,
 *  for every bearing sense, for every creature, every tick, is roughly a hundred and forty
 *  times the work the old `soup.get(starch)` did — and it duly blew the tick budget and timed
 *  the suite out. Digestion learned this lesson first: see `accessBySubstrate` in
 *  expression.ts, settled at birth for exactly the same reason. */
const affinities = new WeakMap<object, ReadonlyArray<readonly [ChemId, number]>>();

function affinityOf(keys: Keys): ReadonlyArray<readonly [ChemId, number]> {
  const found = affinities.get(keys as object);
  if (found) return found;
  const made: Array<readonly [ChemId, number]> = [];
  for (const [substrate, lock] of SUBSTRATE_LOCKS) {
    const fit = accessibility(lock, keys);
    if (fit > 0) made.push([substrate, fit]);
  }
  affinities.set(keys as object, made);
  return made;
}

/** What one receptor makes of one soup. A set of keys is a SMELL — scored against every
 *  locked substrate by the same `accessibility` that decides what an enzyme can open, so a
 *  nose shaped for starch also fires at whatever shares starch's motifs and cannot tell them
 *  apart. A single species is a DIRECT READ, for what has no motif structure to match:
 *  light, a hormone, glucose. */
function response(gene: SenseGene, soup: Soup): number {
  if (!sensesByShape(gene.of)) return soup.get(gene.of);
  let total = 0;
  for (const [substrate, fit] of affinityOf(gene.of)) total += soup.get(substrate) * fit;
  return total;
}

export interface Surroundings {
  /** the creature's own soup — what an interoceptor reads */
  self: Soup;
  /** where it stands */
  at: number;
  /** the soup at a position, or undefined past the edge of the world */
  soupAt(index: number): Soup | undefined;
  /** how many positions there are */
  places: number;
}

/** One reading, in [0,1) or its negative. */
export function readSense(gene: SenseGene, world: Surroundings): number {
  if (gene.from === "self") return saturate(response(gene, world.self) * gene.gain);

  if (gene.from === "here") {
    const soup = world.soupAt(world.at);
    return soup ? saturate(response(gene, soup) * gene.gain) : 0;
  }

  // A bearing. Sum everything that way, nearer counting for more — so a creature is drawn
  // toward the stronger side rather than toward the single nearest source, which is what a
  // gradient means and what lets two smells compete.
  let total = 0;
  const step = gene.from === "left" ? -1 : 1;
  for (let i = world.at + step; i >= 0 && i < world.places; i += step) {
    const soup = world.soupAt(i);
    if (!soup) continue;
    total += response(gene, soup) / (1 + FALLOFF * Math.abs(i - world.at));
  }
  return saturate(total * gene.gain);
}

/** Every reading this genome's receptors produce, in the order the lobe wires them. */
export function readSenses(genes: readonly SenseGene[], world: Surroundings): number[] {
  return genes.map((gene) => readSense(gene, world));
}

/** Whether anything a given nose can smell is present at a position, above a threshold. Used
 *  where the world needs to ask "is there something here for THIS body" without committing to
 *  a chemical by name. */
export function smellsSomethingAt(gene: SenseGene, world: Surroundings, threshold: number): boolean {
  const soup = world.soupAt(world.at);
  return soup !== undefined && response(gene, soup) >= threshold;
}

export { LOCK_OF };
