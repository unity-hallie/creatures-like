// Expression: genome → organism, once, at birth.
//
// WHY THIS EXISTS. The tick loop used to walk the whole gene list six times, each pass
// opening with `if (gene.kind !== "decay") continue`. That is a scan and a branch per
// gene per pass per tick to rediscover something that never changes — a genome does not
// rearrange itself while the creature is alive. Worse, it put the interpreter's shape in
// the hot loop, so every new gene kind meant another pass and another chain.
//
// Sorting the genes once turns the tick into iteration over prepared lists with no kind
// checks at all, and it names a step that was always implicitly there. A genome is not an
// organism; it is a recipe that gets EXPRESSED into one. Creatures drew that line too.
//
// The other payoff is that gene kinds become extensible from data: adding one means
// adding a bucket here, not another branch in five methods.

import type { Soup } from "./chemistry.js";
import type { Reaction } from "./stoichiometry.js";
import {
  reactionsOf,
  type Action,
  type DecayGene,
  type EmitterGene,
  type EndocrineGene,
  type Genome,
  type LobeGene,
  type ReceptorGene,
  type ReceptorTarget,
} from "./genome.js";

/** A genome, sorted into the shapes the tick actually asks for. */
export interface Expressed {
  lobe: LobeGene;
  decays: readonly DecayGene[];
  reactions: readonly Reaction[];
  endocrine: readonly EndocrineGene[];
  /** every reaction in the genome, including action costs — for birth-time checks */
  allReactions: readonly Reaction[];
  costsOf(action: Action): readonly Reaction[];
  emittersOf(action: Action): readonly EmitterGene[];
  receptorsOf(target: ReceptorTarget): readonly ReceptorGene[];
}

function group<K, V>(items: readonly V[], key: (v: V) => K): Map<K, V[]> {
  const out = new Map<K, V[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

const NONE: readonly never[] = [];

export function express(genome: Genome): Expressed {
  const lobe = genome.find((g): g is LobeGene => g.kind === "lobe");
  if (!lobe) throw new Error("genome expresses no lobe: this creature has no brain to run");

  const costs = group(
    genome.filter((g) => g.kind === "cost"),
    (g) => g.onAction,
  );
  const emitters = group(
    genome.filter((g): g is EmitterGene => g.kind === "emitter"),
    (g) => g.onAction,
  );
  const receptors = group(
    genome.filter((g): g is ReceptorGene => g.kind === "receptor"),
    (g) => g.target,
  );

  return {
    lobe,
    decays: genome.filter((g): g is DecayGene => g.kind === "decay"),
    reactions: genome.filter((g) => g.kind === "reaction").map((g) => g.reaction),
    endocrine: genome.filter((g): g is EndocrineGene => g.kind === "endocrine"),
    allReactions: reactionsOf(genome),
    costsOf: (action) => costs.get(action)?.map((g) => g.reaction) ?? NONE,
    emittersOf: (action) => emitters.get(action) ?? NONE,
    receptorsOf: (target) => receptors.get(target) ?? NONE,
  };
}

/** Sums a receptor family against the soup. Nothing here reads a chemical's name — a
 *  chemical matters only where a gene points a receptor at it. */
export function readReceptors(expressed: Expressed, target: ReceptorTarget, soup: Soup): number {
  let total = 0;
  for (const r of expressed.receptorsOf(target)) total += soup.get(r.chem) * r.gain;
  return total;
}
