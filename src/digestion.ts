// Digestibility as a lock, and digestion as paying to pick it.
//
// THE IDEA (Hallie, 2026-08-14). Every energy-bearing substance keeps its energy behind
// an accessibility barrier. An enzyme is a key that fits some of that barrier and not the
// rest. So "digestible" stops being a property of a substance and becomes a RELATION
// between a substance and a genome — which is what it actually is in biology, and which
// puts digestibility in gene space where mutation can reach it.
//
// The chemistry backs the metaphor further than it has any right to. Cellulose resists
// nothing in particular: it is a crystalline repeat of one bond, so an enzyme that
// cleaves that bond cleaves all of it. Lignin resists everything, because lignin is a
// RANDOMISED polymer — it polymerises stochastically, its bonds are heterogeneous, and no
// single enzyme fits more than a fraction. High key-space entropy, which really is why it
// took sixty million years and a fungus to crack it.
//
// Which puts fire in its place. Fire is brute force: no key, no specificity, enough
// activation energy to break every bond at once and capture none of the proceeds. A world
// that cannot decrypt its fuel burns it instead.
//
// Two things fall out for free rather than needing to be built:
//   • WASTE. What an organism cannot decrypt, it egests. The waste system is not a
//     separate mechanism; it is the complement of accessibility.
//   • GRADUAL EVOLUTION. Coverage is a sum over slots, not a boolean, so a lineage can
//     get partway into lignin and digest it badly long before it digests it well.

import type { ChemId } from "./chemistry.js";

/** Slots in the motif space. Not a claim about chemistry — a resolution choice, wide
 *  enough that partial coverage means something, narrow enough to read at a glance. */
export const MOTIF_SLOTS = 12;

/** How a substrate's mass is distributed across motifs. A regular polymer piles into one
 *  or two slots; a stochastic one smears across all twelve. */
export type Lock = readonly number[];
/** How well an enzyme cleaves each motif, 0 to 1. */
export type Keys = readonly number[];

const vec = (...values: number[]): readonly number[] => {
  if (values.length !== MOTIF_SLOTS) throw new Error(`motif vector needs ${MOTIF_SLOTS} slots, got ${values.length}`);
  return values;
};

/** Fraction of a substrate a genome's keys can open: the share of its mass sitting behind
 *  motifs the enzyme actually fits. Zero means the energy is there and unreachable — the
 *  Carboniferous condition. */
export function accessibility(lock: Lock, keys: Keys): number {
  let reachable = 0;
  let total = 0;
  for (let i = 0; i < MOTIF_SLOTS; i++) {
    const mass = lock[i] ?? 0;
    total += mass;
    reachable += mass * Math.min(1, Math.max(0, keys[i] ?? 0));
  }
  return total === 0 ? 1 : reachable / total;
}

/** How evenly a substrate spreads across motif space, 0 (one slot) to 1 (all twelve
 *  equally). This IS the difficulty: a high-entropy lock needs a broad key, and a broad
 *  key is a lot of gene space to find. */
export function lockEntropy(lock: Lock): number {
  const total = lock.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let h = 0;
  for (const mass of lock) {
    const p = mass / total;
    if (p > 0) h -= p * Math.log(p);
  }
  return h / Math.log(MOTIF_SLOTS);
}

/** The locks, written to be read. Starch sits in one slot; cellulose in two; proteins in
 *  a handful; lipids in three; lignin scatters across every slot it has, which is the
 *  entire reason it survives to become coal. */
export const LOCKS = {
  starch: vec(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  cellulose: vec(0, 0.8, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0),
  lipids: vec(0, 0, 0, 0.5, 0.3, 0.2, 0, 0, 0, 0, 0, 0),
  proteins: vec(0, 0, 0, 0, 0, 0.3, 0.3, 0.2, 0.2, 0, 0, 0),
  lignin: vec(0.05, 0.08, 0.07, 0.09, 0.08, 0.08, 0.09, 0.08, 0.09, 0.1, 0.09, 0.1),
  /** Heat has already done the hard part. One motif, the same as starch — which is the
   *  whole point of cooking: it moves a substrate from a lock that needs a good enzyme to
   *  one that needs almost none. */
  cooked: vec(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
} as const;

/** Keys that open one named lock completely — the shape a well-adapted enzyme has. */
export function keysFor(lock: Lock): Keys {
  return lock.map((mass) => (mass > 0 ? 1 : 0));
}

/** Keys covering only the first `slots` motifs of a lock: a partial enzyme, the kind a
 *  lineage holds on its way to a complete one. */
export function partialKeys(lock: Lock, slots: number): Keys {
  let seen = 0;
  return lock.map((mass) => {
    if (mass <= 0) return 0;
    return seen++ < slots ? 1 : 0;
  });
}

/** ATP to open one unit at full accessibility. */
export const BASE_UNLOCK_COST = 0.015;

/** The energy price of freeing `amount` units at a given accessibility. Divided by
 *  accessibility, so a poorly-fitting enzyme burns more energy per unit it frees — and an
 *  unpickable lock is not merely slow, it is not worth attacking at all. */
export function unlockCost(amount: number, access: number): number {
  if (access <= 0) return Infinity;
  return (BASE_UNLOCK_COST * amount) / access;
}

/** Which lock a substrate presents, by species. */
export const LOCK_OF: ReadonlyArray<readonly [ChemId, Lock]> = [];
