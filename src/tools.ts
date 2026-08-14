// TOOLS — sterile symbionts that have to be built by hand.
//
// Hallie's framing, 2026-08-14, and it closes three threads at once.
//
// A tool is an ORGANISM: a genome, a soup, reactions it runs that its user cannot. A
// campfire oxidises cellulose; no animal can do that inside itself and survive it.
//
// A tool is a SYMBIONT: it shares a soup with whoever is using it, which makes it the
// fourth use of one-soup-two-genomes after the lichen, the root nodule and the rumen. The
// campfire runs its chemistry in the same pot the creature eats from, and neither could
// have got there alone.
//
// A tool is STERILE: it never reproduces. Every campfire that has ever existed was built,
// one at a time, by somebody. That is the whole difference between a tool and a gut
// microbe, and it is why technique has to be transmitted culturally — the thing itself
// cannot carry itself forward, so the KNOWING has to.
//
// And a tool is EXTERNAL STATE. Fire's memory is the landscape; a creature's tool is a
// piece of itself it left lying around. It stays in a place, it can be found, and it can
// be lost — which anatomy cannot be.
//
// ── CONSTRUCTION IS COMBINATION ──────────────────────────────────────────────
//
// cellulose × fire = campfire. That is otter-centaur's little_alchemy domain, arrived at
// from the other direction: a recipe is a pair, a result, and the provenance of what it
// came from. The combination table this repo needed turned out to be the one already
// written in the repository Hallie pointed at hours earlier.
//
// ── WHY THIS MATTERS MORE THAN IT LOOKS ──────────────────────────────────────
//
// A campfire cooks, and cooking is DECRYPTION PERFORMED OUTSIDE THE BODY. Heat moves
// protein from a lock needing a real enzyme to one needing almost none. So a creature with
// a feeble protease eats well beside a fire and badly without one — and selection on its
// own digestive genes slackens, because the fire is paying the bill its enzymes used to.
// That is niche construction with a receipt, and it is the mechanism behind the claim that
// fire colonised us rather than the other way about.

import { Soup, transfer, type ChemId } from "./chemistry.js";
import { CHEMS, type Genome } from "./genome.js";
import { Organism } from "./organism.js";
import { keysFor, LOCKS } from "./digestion.js";

const term = (chem: ChemId, coeff: number) => ({ chem, coeff });

/** What a tool is made of and what it takes to make it. A recipe is a combination, in
 *  little_alchemy's sense: named inputs, a result, and no path from one to the other
 *  except somebody doing the work. */
export interface Recipe {
  slug: string;
  /** consumed from the builder's surroundings */
  inputs: ReadonlyArray<readonly [ChemId, number]>;
  /** ATP the builder spends. Tools cost effort, which is why they are worth keeping. */
  effort: number;
  /** the genome the resulting tool runs */
  genome: Genome;
  /** what the finished tool starts out holding */
  endowment: ReadonlyArray<readonly [ChemId, number]>;
}

/**
 * THE CAMPFIRE.
 *
 * It burns cellulose for nobody's benefit — no ATP is captured, because fire captures
 * nothing — and while burning it cooks: protein and starch pass into `cooked`, the same
 * carbon and nitrogen behind a far easier lock. That second reaction is the entire reason
 * to build one.
 */
export const CAMPFIRE: Genome = [
  {
    // combustion: the same oxidation a fungus runs, with no enzymes and nothing captured
    kind: "reaction",
    reaction: {
      slug: "campfire-burn",
      reactants: [term(CHEMS.cellulose, 1), term(CHEMS.o2, 6)],
      products: [term(CHEMS.co2, 6)],
      rate: 0.12,
    },
  },
  {
    // cooking protein: carbon 6 → 6, nitrogen 1 → 1, and the lock falls off
    kind: "reaction",
    reaction: {
      slug: "cook-protein",
      reactants: [term(CHEMS.proteins, 1)],
      products: [term(CHEMS.cooked, 1)],
      rate: 0.35,
    },
  },
];

export const CAMPFIRE_RECIPE: Recipe = {
  slug: "campfire",
  inputs: [
    [CHEMS.cellulose, 1.5],
    [CHEMS.lignin, 0.5],
  ],
  effort: 0.6,
  genome: CAMPFIRE,
  endowment: [[CHEMS.o2, 2]],
};

/** An enzyme for cooked matter — the easiest lock there is, and the one a creature beside
 *  a fire barely needs to pay for. */
export const COOKED_EATER = {
  kind: "enzyme" as const,
  keys: keysFor(LOCKS.cooked),
  reaction: {
    slug: "cooked-digestion",
    reactants: [term(CHEMS.cooked, 1)],
    products: [term(CHEMS.glucose, 1), term(CHEMS.ammonia, 1)],
    rate: 0.3,
  },
};

/**
 * A built thing, standing somewhere.
 *
 * It holds an Organism because it IS one in every respect but two: it never reproduces,
 * and nothing selects it. Whatever survives about a campfire survives in the heads of the
 * people who know how to build one.
 */
export class Tool {
  readonly organism: Organism;
  readonly recipe: Recipe;
  /** where it was left. A tool is external state and can be walked away from. */
  at: number;
  /** tools wear out; nothing here repairs itself */
  intact = true;

  constructor(recipe: Recipe, at: number, soup?: Soup) {
    this.recipe = recipe;
    this.at = at;
    this.organism = new Organism({ genome: recipe.genome, initial: recipe.endowment, soup });
  }

  /** STERILITY, stated rather than assumed. Nothing in this file makes another Tool from
   *  an existing one, and this is here so that a future version cannot quietly start. */
  reproduce(): never {
    throw new Error(
      "[STERILE] a tool cannot make another tool. Every one that ever existed was built by " +
        "somebody, one at a time — which is why the knowing has to be transmitted when the " +
        "thing cannot be.",
    );
  }
}

/**
 * Building. The materials come out of the surroundings and the effort out of the builder,
 * and if either falls short nothing gets made.
 *
 * Returns null on failure rather than throwing: not knowing how, or lacking the wood, is
 * an ordinary afternoon and not an exceptional condition.
 */
export function construct(recipe: Recipe, builder: Organism, materials: Soup, at: number): Tool | null {
  if (builder.soup.get(CHEMS.atp) < recipe.effort) return null;
  for (const [chem, amount] of recipe.inputs) {
    if (materials.get(chem) < amount) return null;
  }

  // the effort, as a conversion — adenine stays conserved even here
  builder.soup.add(CHEMS.atp, -recipe.effort);
  builder.soup.add(CHEMS.adp, recipe.effort);

  const tool = new Tool(recipe, at);
  for (const [chem, amount] of recipe.inputs) {
    transfer(materials, tool.organism.soup, chem, amount);
  }
  return tool;
}

/**
 * USING a tool: share a soup with it for as long as the work lasts.
 *
 * The creature's food goes in, the tool's chemistry runs on it, and what comes out is
 * behind an easier lock. Everything crosses through `transfer`, so a tool can no more mint
 * matter than a gut can.
 */
export function use(tool: Tool, user: Organism, offering: ReadonlyArray<readonly [ChemId, number]>): void {
  if (!tool.intact) return;
  for (const [chem, amount] of offering) {
    transfer(user.soup, tool.organism.soup, chem, Math.min(amount, user.soup.get(chem)));
  }
  tool.organism.metabolise();
  // take back everything the fire has finished with
  for (const chem of [CHEMS.cooked, CHEMS.glucose, CHEMS.ammonia]) {
    transfer(tool.organism.soup, user.soup, chem, tool.organism.soup.get(chem));
  }
}
