// An organism: a soup, an expressed genome, and a life that can end.
//
// Plant, fungus and animal all sit on this. What differs between them is which genes
// their genome holds — not which code path they run. The animal adds a brain on top; it
// does not get a different metabolism.
//
// Death matters here for an ecological reason rather than a dramatic one. Decomposers
// need something to decompose, and until something could die, the carbon cycle had no
// source of detritus and no way to close.

import { Soup, type ChemId } from "./chemistry.js";
import { express, type Expressed } from "./expression.js";
import { CARBON, CHEMS, LOCK_OF, type Genome } from "./genome.js";
import { accessibility, unlockCost } from "./digestion.js";
import { applyReaction } from "./stoichiometry.js";

export interface OrganismOptions {
  genome: Genome;
  initial?: ReadonlyArray<readonly [ChemId, number]>;
  /** ticks of energy failure tolerated before death */
  tolerance?: number;
}

export class Organism {
  readonly expressed: Expressed;
  readonly soup: Soup;
  alive = true;
  age = 0;

  #failing = 0;
  readonly #tolerance: number;

  constructor(opts: OrganismOptions) {
    this.expressed = express(opts.genome);
    this.soup = new Soup(opts.initial ?? []);
    this.#tolerance = opts.tolerance ?? 40;
  }

  /** How much of a substrate this genome's best enzyme can actually open. Zero means the
   *  energy sits there unreachable — and whatever the organism took up gets egested. */
  accessTo(substrate: ChemId): number {
    const lock = LOCK_OF.get(substrate);
    if (!lock) return 1; // no lock: already open, e.g. glucose
    let best = 0;
    for (const enzyme of this.expressed.enzymes) {
      if (enzyme.reaction.reactants[0]?.chem !== substrate) continue;
      best = Math.max(best, accessibility(lock, enzyme.keys));
    }
    return best;
  }

  /** Digestion: spend ATP to open what the keys fit.
   *
   *  Two limits bind, and both matter. Accessibility caps how much of the substrate is
   *  reachable at all, and ATP caps how much reaching the organism can afford this tick —
   *  so a starving decomposer digests slowly precisely when it most needs not to, which
   *  is the shape real starvation has. */
  #digest(): void {
    const soup = this.soup;
    for (const enzyme of this.expressed.enzymes) {
      const substrate = enzyme.reaction.reactants[0]?.chem;
      if (!substrate) continue;
      const access = this.accessTo(substrate);
      if (access <= 0) continue;

      const reachable = soup.get(substrate) * enzyme.reaction.rate * access;
      if (reachable <= 0) continue;

      const atp = soup.get(CHEMS.atp);
      const wanted = unlockCost(reachable, access);
      const affordable = wanted <= atp ? reachable : (reachable * atp) / wanted;
      const freed = applyReaction(enzyme.reaction, soup, affordable);
      if (freed <= 0) continue;

      // pay for it — a conversion, so adenine stays conserved
      const spent = Math.min(unlockCost(freed, access), soup.get(CHEMS.atp));
      soup.add(CHEMS.atp, -spent);
      soup.add(CHEMS.adp, spent);
    }
  }

  /** Glands, then digestion, then reactions, then decay. The animal inserts its brain
   *  between emitters and consolidation; a plant has nothing to insert, so this is its
   *  whole tick. */
  metabolise(): void {
    const soup = this.soup;
    this.#digest();
    for (const gene of this.expressed.endocrine) {
      const level = soup.get(gene.watches);
      const firing = gene.when === "above" ? level > gene.threshold : level < gene.threshold;
      if (firing) soup.add(gene.secretes, gene.amount);
    }
    for (const reaction of this.expressed.reactions) applyReaction(reaction, soup);
    for (const gene of this.expressed.decays) soup.set(gene.chem, soup.get(gene.chem) * gene.halfLife);
    this.age++;
  }

  /** An organism that cannot make energy for long enough stops being one.
   *
   *  Read against ATP rather than against food: a creature surrounded by food it cannot
   *  metabolise is starving, and a creature with reserves is not, which is the honest
   *  version of the same test. */
  checkVitality(): void {
    if (!this.alive) return;
    const energised = this.soup.get(CHEMS.atp) > 0.05;
    this.#failing = energised ? 0 : this.#failing + 1;
    if (this.#failing > this.#tolerance) this.alive = false;
  }

  /** Everything this organism is made of, as carbon-bearing matter. Called when it dies:
   *  the body does not vanish, it becomes litter. */
  carbonBearing(): Array<readonly [ChemId, number]> {
    return CARBON.map(([id]) => [id, this.soup.get(id)] as const).filter(([, amount]) => amount > 0);
  }
}
