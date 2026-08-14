// Reactions with real stoichiometry, and a constraint that refuses to let them cheat.
//
// WHY THIS EXISTS. The first draft applied reactions imperatively and clamped
// concentrations at zero afterwards. Clamping creates matter: spend 0.05 ATP when only
// 0.02 remains and the spend silently becomes 0.02, while the paired 0.05 ADP arrives in
// full. Over 1,500 ticks the ATP/ADP pool inflated from 1.2 to 13.8 and the creature
// invented energy. Nothing threw; the tests stayed green; the metabolism was a
// perpetual-motion machine.
//
// The fix is the one chemistry already knows: a reaction runs to an EXTENT, and the
// limiting reagent sets it. Nothing can go negative, so nothing needs clamping, so
// nothing gets created. Conservation then follows from the coefficients — and a declared
// MOIETY lets that get checked once at birth rather than trusted forever.
//
// The shape owes a debt to otter-centaur's little_alchemy domain, where a combination is
// a pair plus the provenance of what it came from. Here the network itself gets laid into
// a scher Society, so a reaction prehends its reactants and the chemistry is readable as
// a graph. Per the tick-ceiling muslin, only the NETWORK goes in the log — a fixed,
// birth-time structure — never the per-tick concentrations, which would convert play-time
// into heap.

import { Society } from "scher";
import type { ChemId, Soup } from "./chemistry.js";

export interface Term {
  chem: ChemId;
  coeff: number;
}

export interface Reaction {
  slug: string;
  reactants: readonly Term[];
  products: readonly Term[];
  /** Species required present but NOT consumed — they scale the rate instead. This is how
   *  cortisol drives lipolysis without being eaten by it, and it keeps hormones out of
   *  the mass balance, where they do not belong. */
  catalysts?: readonly ChemId[];
  /** fraction of the limiting reagent consumed per tick */
  rate: number;
}

/** A conserved group of atoms, given as how many the group contributes per molecule.
 *  Species not listed contribute zero. */
export type Moiety = ReadonlyArray<readonly [ChemId, number]>;

/** How far the reaction can run this tick: rate, limited by whichever reactant runs out
 *  first. With no reactants (a source), the rate itself is the extent. */
export function extentOf(reaction: Reaction, soup: Soup): number {
  let limit = Infinity;
  for (const t of reaction.reactants) {
    if (t.coeff <= 0) continue;
    limit = Math.min(limit, soup.get(t.chem) / t.coeff);
  }
  let drive = reaction.rate;
  for (const c of reaction.catalysts ?? []) drive *= Math.min(1, soup.get(c));
  if (limit === Infinity) return drive;
  return Math.max(0, limit * drive);
}

/** Runs the reaction to its extent. No clamping happens here, and none is needed: the
 *  extent already guarantees every reactant stays at or above zero. */
export function applyReaction(reaction: Reaction, soup: Soup, extentLimit = Infinity): number {
  const extent = Math.min(extentOf(reaction, soup), extentLimit);
  if (extent <= 0) return 0;
  for (const t of reaction.reactants) soup.add(t.chem, -t.coeff * extent);
  for (const t of reaction.products) soup.add(t.chem, t.coeff * extent);
  return extent;
}

function moietyCount(moiety: Moiety, terms: readonly Term[]): number {
  const table = new Map(moiety);
  return terms.reduce((acc, t) => acc + t.coeff * (table.get(t.chem) ?? 0), 0);
}

/** THE CONSTRAINT. Throws when a reaction does not balance a moiety it touches.
 *
 *  Deliberately a tripwire rather than a warning, following scher's own assert* guards:
 *  the failure it catches has no runtime symptom — an unbalanced reaction just quietly
 *  mints atoms while everything keeps running. Checked once at birth, since the network
 *  is fixed and per-tick checking would cost the muslin's whole budget. */
export function assertBalanced(reactions: readonly Reaction[], name: string, moiety: Moiety): void {
  for (const r of reactions) {
    const left = moietyCount(moiety, r.reactants);
    const right = moietyCount(moiety, r.products);
    if (Math.abs(left - right) > 1e-9) {
      throw new Error(
        `[CONSERVATION] reaction '${r.slug}' does not balance ${name}: ` +
          `${left} in, ${right} out. A reaction that touches a conserved group must ` +
          `return every atom of it. Fix the coefficients, or drop ${name} from the ` +
          `declared moieties if it is genuinely not conserved here.`,
      );
    }
  }
}

/** Lays the reaction network into a Society: a node per species, a node per reaction, and
 *  a prehension from each reaction to what it consumes. Fixed at birth, so this costs one
 *  small graph per creature rather than one row per tick.
 *
 *  Provenance, in otter-centaur's sense: a product carries which pair it came from, and
 *  the graph can be walked to ask what feeds what. */
export function layNetwork(reactions: readonly Reaction[]): Society {
  const society = new Society();
  const species = new Set<string>();
  for (const r of reactions) {
    for (const t of [...r.reactants, ...r.products]) species.add(t.chem);
  }
  for (const s of species) society.lay({ slug: `species:${s}`, content: s, subject: null, object: null });
  for (const r of reactions) {
    society.lay({ slug: `reaction:${r.slug}`, content: `rate ${r.rate}`, subject: null, object: null });
    for (const t of r.reactants) {
      society.lay({
        slug: `reaction:${r.slug}~consumes~${t.chem}`,
        content: `${t.coeff}`,
        subject: `reaction:${r.slug}`,
        object: `species:${t.chem}`,
      });
    }
    for (const t of r.products) {
      society.lay({
        slug: `reaction:${r.slug}~yields~${t.chem}`,
        content: `${t.coeff}`,
        subject: `species:${t.chem}`,
        object: `reaction:${r.slug}`,
      });
    }
  }
  return society;
}
