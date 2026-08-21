// A one-dimensional world: cells in a row, food in some of them, a creature that moves and
// eats. Small enough that the interesting part stays visible, which is why the graphics
// are geometrics and emoji.
//
// The world holds a soup of its own. Once respiration entered, the creature stopped being
// a closed system: it breathes oxygen out of the air and pushes carbon dioxide back into
// it, so the atmosphere is a shared, depletable thing rather than scenery. That is the
// seam where plants belong — photosynthesis is this loop run backwards, and the reaction
// machinery already expresses it.
//
// The tick order carries real weight. Emitters fire before consolidation, so the dopamine
// from a meal still sits in the soup when the learning receptor reads it; decay runs
// after, so the signal fades once it has done its work. Reorder these and the creature
// quietly stops learning while every test that checks structure stays green.

import { Society, cell, type Cell } from "scher";
import { Soup, type ChemId } from "./chemistry.js";
import { bind, Lobe } from "./brain.js";
import { express, type Expressed } from "./expression.js";
import { Organism } from "./organism.js";
import { CHEMS, MOIETIES, type Action, type Genome, WILD_TYPE } from "./genome.js";
import { readSenses } from "./senses.js";
import { applyReaction, assertBalanced, layNetwork } from "./stoichiometry.js";
import { Dice } from "./dice.js";

export interface WorldOptions {
  width?: number;
  seed?: number;
  genome?: Genome;
  foodCount?: number;
}

/** What a creature is born holding. ATP and ADP start paired, so glycolysis has spent
 *  currency to recharge from on the first tick. */
export const BIRTH_SOUP: ReadonlyArray<readonly [ChemId, number]> = [
  [CHEMS.glucose, 0.6],
  [CHEMS.atp, 4],
  [CHEMS.adp, 12],
  [CHEMS.o2, 1.2],
  [CHEMS.lipids, 0.5],
  [CHEMS.proteins, 0.5],
];

/** The air. Oxygen the creature draws down, carbon dioxide it pushes back. */
export const ATMOSPHERE: ReadonlyArray<readonly [ChemId, number]> = [
  [CHEMS.o2, 8],
  [CHEMS.co2, 0.2],
];

/** How fast gases equalise between blood and air. */
const GAS_EXCHANGE = 0.25;

/** What each action DOES, as a table rather than a branch chain. Adding an action means
 *  adding a row here and a name to ACTIONS — the tick loop never learns about it. */
const ACTION_RULES: Record<Action, (world: World) => boolean> = {
  left: (world) => world.moveBy(-1),
  right: (world) => world.moveBy(1),
  eat: (world) => world.eatHere(),
};

export interface TickReport {
  tick: number;
  action: Action;
  succeeded: boolean;
  position: number;
  /** true when the chosen move reduced the distance to the nearest food */
  towardFood: boolean;
}

export class World {
  readonly width: number;
  readonly dice: Dice;
  readonly genome: Genome;
  /** the genome sorted into what the tick asks for — see expression.ts */
  readonly expressed: Expressed;
  readonly lobe: Lobe;
  /** the chronicle: notable events only. The muslin showed that logging every chemical
   *  reading costs little time but unbounded room, so this keeps what a life is actually
   *  made of — births, meals — and lets the metabolism perish. */
  readonly chronicle = new Society();
  /** the reaction network as a graph: laid once at birth, never per tick */
  readonly network: Society;
  /** the creature's body — ONE Organism, shared with the ecology's machinery rather than
   *  a second copy of it. The duplication this replaces was not theoretical: when amylase
   *  became an enzyme gene, World's own hand-rolled tick stopped digesting starch
   *  entirely and the creature quietly starved, because World iterated `reactions` and
   *  enzymes had moved to their own bucket. */
  readonly body: Organism;
  /** the creature's soup, held as a scher reading so a view can subscribe */
  readonly soup: Cell<Soup>;
  /** the world's soup */
  readonly air: Cell<Soup>;

  position: number;
  food = new Set<number>();
  tick = 0;
  meals = 0;

  readonly #foodCount: number;

  constructor(opts: WorldOptions = {}) {
    this.width = opts.width ?? 11;
    this.genome = opts.genome ?? WILD_TYPE;
    this.dice = new Dice(opts.seed ?? 1);
    this.#foodCount = opts.foodCount ?? 2;

    this.expressed = express(this.genome);
    // THE CONSTRAINT, checked at birth: a genome whose reactions mint atoms never runs.
    for (const [name, moiety] of MOIETIES) assertBalanced(this.expressed.allReactions, name, moiety);
    this.network = layNetwork(this.expressed.allReactions);

    this.lobe = new Lobe(this.expressed, this.dice.at("spawn"));
    this.position = Math.floor(this.width / 2);
    const body = new Soup(BIRTH_SOUP);
    this.body = new Organism({ genome: this.genome, soup: body });
    this.soup = cell(body);
    this.air = cell(new Soup(ATMOSPHERE));

    this.#spawnFood();
    this.chronicle.lay({ slug: "birth", content: `seed ${this.dice.worldSeed}`, subject: null, object: null });
  }

  #spawnFood(): void {
    const stream = this.dice.at("spawn");
    let guard = 0;
    while (this.food.size < this.#foodCount && guard++ < 200) {
      const at = Math.floor(stream.next() * this.width);
      if (at !== this.position) this.food.add(at);
    }
  }

  moveBy(delta: number): boolean {
    const to = this.position + delta;
    if (to < 0 || to >= this.width) return false;
    this.position = to;
    return true;
  }

  /** THE RIG'S ONE FIAT. This is a controlled single-creature testbed, so food appears
   *  and is swallowed whole — carbon enters from outside the ledger here and nowhere
   *  else. The genome deliberately does NOT do this; a genome that could conjure food
   *  would conjure it in the ecosystem too, where the carbon has to balance. See
   *  ecology.ts for the version where a plant has to make the meal first. */
  static readonly MOUTHFUL: ReadonlyArray<readonly [ChemId, number]> = [
    [CHEMS.starch, 1.1],
    [CHEMS.proteins, 0.3],
  ];

  eatHere(): boolean {
    if (!this.food.has(this.position)) return false;
    this.food.delete(this.position);
    for (const [id, amount] of World.MOUTHFUL) this.soup.get().add(id, amount);
    this.meals++;
    this.chronicle.lay({
      slug: `meal-${this.meals}`,
      content: `tick ${this.tick} at ${this.position}`,
      subject: null,
      object: null,
    });
    this.#spawnFood();
    return true;
  }

  nearestFood(): number | null {
    let best: number | null = null;
    for (const at of this.food) {
      if (best === null || Math.abs(at - this.position) < Math.abs(best - this.position)) best = at;
    }
    return best;
  }

  /** What this creature's own receptors make of where it is. The trainer places food by
   *  fiat rather than growing it, so a patch here is a scratch soup holding one unit of
   *  starch — enough for a nose to find, and read through the same `readSenses` the
   *  ecosystem uses. One implementation, so the rig and the world cannot disagree. */
  sense(): number[] {
    const here = new Soup([[CHEMS.starch, 1]]);
    const empty = new Soup();
    return readSenses(this.expressed.senses, {
      self: this.soup.get(),
      at: this.position,
      soupAt: (i) => (i < 0 || i >= this.width ? undefined : this.food.has(i) ? here : empty),
      places: this.width,
    });
  }

  step(): TickReport {
    const soup = this.soup.get();
    const before = this.nearestFood();
    const distanceBefore = before === null ? 0 : Math.abs(before - this.position);

    const picked = this.lobe.choose(this.sense(), bind(this.expressed, soup), this.dice.at("tiebreak"));
    const action = this.lobe.actions[picked];
    const succeeded = ACTION_RULES[action](this);

    this.#emit(soup, action, succeeded);
    for (const cost of this.expressed.costsOf(action)) applyReaction(cost, soup);
    this.#breathe(soup);
    this.body.digest();
    this.body.secrete();
    this.body.react();
    // consolidation reads the soup as the meal left it, BEFORE the signals fade — see
    // the file header
    this.lobe.consolidate(bind(this.expressed, soup));
    this.body.decay();
    this.soup.update((s) => s); // re-observe: the held Soup mutated in place

    const distanceAfter = before === null ? 0 : Math.abs(before - this.position);
    this.tick++;
    return { tick: this.tick, action, succeeded, position: this.position, towardFood: distanceAfter < distanceBefore };
  }

  #emit(soup: Soup, action: Action, succeeded: boolean): void {
    for (const gene of this.expressed.emittersOf(action)) {
      if (gene.when === "success" && !succeeded) continue;
      if (gene.when === "failure" && succeeded) continue;
      soup.add(gene.chem, gene.amount);
    }
  }

  /** Gas exchange with the air, jittered through the diffusion port — the one place this
   *  model admits it is not simulating fluid dynamics. */
  #breathe(soup: Soup): void {
    const air = this.air.get();
    const stream = this.dice.at("diffusion");
    for (const gas of [CHEMS.o2, CHEMS.co2]) {
      const moved = (air.get(gas) - soup.get(gas)) * GAS_EXCHANGE * (0.9 + stream.next() * 0.2);
      soup.add(gas, moved);
      air.add(gas, -moved);
    }
    this.air.update((a) => a);
  }

  #decay(soup: Soup): void {
    for (const gene of this.expressed.decays) soup.set(gene.chem, soup.get(gene.chem) * gene.halfLife);
  }

  concentration(id: ChemId): number {
    return this.soup.get().get(id);
  }

  /** Total of a conserved moiety across creature and air — the number that must not
   *  drift. See `test/learning.test.ts`. */
  moietyTotal(moiety: ReadonlyArray<readonly [ChemId, number]>): number {
    const soup = this.soup.get();
    const air = this.air.get();
    return moiety.reduce((acc, [chemId, count]) => acc + (soup.get(chemId) + air.get(chemId)) * count, 0);
  }
}
