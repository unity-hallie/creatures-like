// The carbon cycle, closed.
//
// Patches hold solids: living litter, fallen wood, the bodies of things that died. The
// air is one well-mixed soup — a declared simplification, and a defensible one, since
// gases mix far faster than logs move. Light arrives from outside the ledger, which is
// the one honest exception: a closed system with no external energy source runs down.
//
// WHAT AN ORGANISM EATS IS DERIVED, NOT CONFIGURED. Uptake reads each genome's own
// reaction reactants, so a fungus absorbs lignin exactly when it expresses an enzyme for
// lignin. Nothing anywhere holds a table of who-eats-what. That is what makes the
// Carboniferous experiment run: add one gene to one genome and the world's fire regime
// changes downstream, with no fire parameter touched.

import { Soup, transfer, type ChemId } from "./chemistry.js";
import { Dice } from "./dice.js";
import { CARBON, CHEMS, SUBSTRATE_LOCKS, type Genome } from "./genome.js";
import { FUNGUS, PLANT } from "./flora.js";
import { Organism } from "./organism.js";

/** Species an organism can draw from its surroundings, and where each is kept. Signals
 *  and internal intermediates are deliberately absent: a creature does not absorb
 *  cortisol from the ground. */
const ENVIRONMENT: ReadonlyArray<readonly [ChemId, "air" | "patch"]> = [
  [CHEMS.co2, "air"],
  [CHEMS.o2, "air"],
  [CHEMS.light, "patch"],
  [CHEMS.cellulose, "patch"],
  [CHEMS.lignin, "patch"],
  [CHEMS.glucose, "patch"],
  [CHEMS.starch, "patch"],
  [CHEMS.proteins, "patch"],
  [CHEMS.lipids, "patch"],
];

const CARBON_OF = new Map(CARBON);

export interface EcosystemOptions {
  width?: number;
  seed?: number;
  plantGenome?: Genome;
  fungusGenome?: Genome;
  plants?: number;
  fungi?: number;
  /** oxygen the world starts with; the fire regime is sensitive to this by design */
  oxygen?: number;
}

export class Patch {
  readonly soup = new Soup();
  /** ticks remaining in an active fire */
  burning = 0;
}

interface Resident {
  organism: Organism;
  at: number;
}

/** Sunlight delivered per patch per tick. Crosses the boundary from outside the model,
 *  like food and unlike everything else — see the file header. */
const LIGHT_PER_TICK = 1.4;
/** Fraction of a plant's structure shed as litter each tick. */
const LITTERFALL = 0.035;
/** Fraction of available substrate an organism absorbs per tick. */
const UPTAKE = 0.3;
/** Fraction of the indigestible portion egested per tick. */
const EGEST_RATE = 0.4;
/** Fuel below this will not carry a fire. */
const MIN_FUEL = 0.6;
/** Ticks a lit patch keeps burning. */
const BURN_DURATION = 3;
/** Fuel consumed per burning tick. */
const BURN_RATE = 0.5;

export class Ecosystem {
  readonly patches: Patch[];
  readonly air = new Soup();
  readonly dice: Dice;
  readonly plants: Resident[] = [];
  readonly fungi: Resident[] = [];

  tick = 0;
  ignitions = 0;
  deaths = 0;

  readonly #plantGenome: Genome;

  constructor(opts: EcosystemOptions = {}) {
    const width = opts.width ?? 12;
    this.patches = Array.from({ length: width }, () => new Patch());
    this.dice = new Dice(opts.seed ?? 1);
    this.#plantGenome = opts.plantGenome ?? PLANT;

    this.air.set(CHEMS.o2, opts.oxygen ?? 40);
    this.air.set(CHEMS.co2, 60);

    const spawn = this.dice.at("spawn");
    for (let i = 0; i < (opts.plants ?? 8); i++) {
      this.plants.push({
        organism: new Organism({
          genome: this.#plantGenome,
          initial: [
            [CHEMS.glucose, 0.4],
            [CHEMS.atp, 2],
            [CHEMS.adp, 8],
          ],
        }),
        at: Math.floor(spawn.next() * width),
      });
    }
    for (let i = 0; i < (opts.fungi ?? 4); i++) {
      this.fungi.push({
        organism: new Organism({
          genome: opts.fungusGenome ?? FUNGUS,
          initial: [
            [CHEMS.glucose, 0.3],
            [CHEMS.atp, 2],
            [CHEMS.adp, 8],
          ],
        }),
        at: Math.floor(spawn.next() * width),
      });
    }
  }

  /** Every carbon atom in the world, wherever it currently sits. The number this returns
   *  must not move — see the ecosystem conservation test. */
  totalCarbon(): number {
    let total = 0;
    const count = (soup: Soup) => {
      for (const [id, per] of CARBON) total += soup.get(id) * per;
    };
    count(this.air);
    for (const patch of this.patches) count(patch.soup);
    for (const r of [...this.plants, ...this.fungi]) count(r.organism.soup);
    return total;
  }

  /** What this organism's own genes say it consumes from outside itself. */
  #uptakeFor(resident: Resident): void {
    const wanted = new Set<ChemId>();
    for (const reaction of resident.organism.expressed.allReactions) {
      for (const t of reaction.reactants) wanted.add(t.chem);
    }
    const patch = this.patches[resident.at];
    for (const [id, where] of ENVIRONMENT) {
      if (!wanted.has(id)) continue;
      const source = where === "air" ? this.air : patch.soup;
      transfer(source, resident.organism.soup, id, source.get(id) * UPTAKE);
    }
  }

  /** Gases the organism made and does not hold onto go back to the air. Solids stay in
   *  the body until litterfall or death moves them. */
  #vent(resident: Resident): void {
    for (const gas of [CHEMS.co2, CHEMS.o2]) {
      transfer(resident.organism.soup, this.air, gas, resident.organism.soup.get(gas) * 0.6);
    }
  }

  /** Waste, as the complement of accessibility: whatever an organism took up and cannot
   *  open goes back to the ground for something else to try. Nothing here decides what
   *  counts as waste — the genome's keys do, by failing to fit. */
  #egest(resident: Resident): void {
    const patch = this.patches[resident.at];
    for (const [substrate] of SUBSTRATE_LOCKS) {
      const held = resident.organism.soup.get(substrate);
      if (held <= 0) continue;
      const indigestible = 1 - resident.organism.accessTo(substrate);
      if (indigestible <= 0) continue;
      transfer(resident.organism.soup, patch.soup, substrate, held * indigestible * EGEST_RATE);
    }
  }

  #litterfall(resident: Resident): void {
    const patch = this.patches[resident.at];
    for (const structural of [CHEMS.cellulose, CHEMS.lignin]) {
      transfer(resident.organism.soup, patch.soup, structural, resident.organism.soup.get(structural) * LITTERFALL);
    }
  }

  /** A body does not vanish. Everything carbon-bearing falls to the patch as litter,
   *  where a decomposer may or may not be able to reach it. */
  #decompose(resident: Resident): void {
    const patch = this.patches[resident.at];
    for (const [id] of resident.organism.carbonBearing()) {
      transfer(resident.organism.soup, patch.soup, id, resident.organism.soup.get(id));
    }
    this.deaths++;
  }

  /** Combustion: the same oxidation a fungus runs, with no enzymes and no ATP captured.
   *  Carbon balances by the same counts every other reaction uses. */
  #burn(patch: Patch): void {
    let budget = BURN_RATE;
    for (const fuel of [CHEMS.cellulose, CHEMS.lignin]) {
      if (budget <= 0) break;
      const carbonPer = CARBON_OF.get(fuel) ?? 6;
      const oxygenAvailable = this.air.get(CHEMS.o2) / carbonPer;
      const burned = Math.min(patch.soup.get(fuel), budget, oxygenAvailable);
      if (burned <= 0) continue;
      patch.soup.add(fuel, -burned);
      this.air.add(CHEMS.o2, -burned * carbonPer);
      this.air.add(CHEMS.co2, burned * carbonPer);
      budget -= burned;
    }
  }

  #fuelAt(patch: Patch): number {
    return patch.soup.get(CHEMS.cellulose) + patch.soup.get(CHEMS.lignin);
  }

  /** Ignition through its own named port. The atmosphere loads the die — richer air, more
   *  starts — but the die decides, because lightning and hot afternoons are exactly the
   *  sort of thing this model should decline to simulate. */
  #ignite(): void {
    const stream = this.dice.at("ignition");
    const oxygen = this.air.get(CHEMS.o2);
    const total = oxygen + this.air.get(CHEMS.co2);
    const richness = total > 0 ? oxygen / total : 0;
    const lit: number[] = [];

    for (let i = 0; i < this.patches.length; i++) {
      const patch = this.patches[i];
      if (patch.burning > 0 || this.#fuelAt(patch) < MIN_FUEL) continue;
      const neighbourBurning = [i - 1, i + 1].some((j) => this.patches[j]?.burning > 0);
      // below roughly a fifth oxygen a fire will not carry; above that it climbs steeply
      const chance = Math.max(0, richness - 0.2) ** 2 * (neighbourBurning ? 0.9 : 0.02);
      if (stream.next() < chance) lit.push(i);
    }
    for (const i of lit) {
      this.patches[i].burning = BURN_DURATION;
      this.ignitions++;
    }
  }

  step(): void {
    for (const patch of this.patches) patch.soup.set(CHEMS.light, LIGHT_PER_TICK);

    for (const resident of this.plants) {
      if (!resident.organism.alive) continue;
      this.#uptakeFor(resident);
      resident.organism.metabolise();
      this.#vent(resident);
      this.#egest(resident);
      this.#litterfall(resident);
      resident.organism.checkVitality();
      if (!resident.organism.alive) this.#decompose(resident);
    }

    for (const resident of this.fungi) {
      if (!resident.organism.alive) continue;
      this.#uptakeFor(resident);
      resident.organism.metabolise();
      this.#vent(resident);
      this.#egest(resident);
      resident.organism.checkVitality();
      if (!resident.organism.alive) this.#decompose(resident);
    }

    this.#ignite();
    for (const patch of this.patches) {
      if (patch.burning > 0) {
        this.#burn(patch);
        patch.burning--;
      }
    }

    this.tick++;
  }

  /** Standing dead fuel across the whole world — the thing that piles up when nothing can
   *  rot it. */
  fuelLoad(): number {
    return this.patches.reduce((acc, p) => acc + this.#fuelAt(p), 0);
  }

  oxygen(): number {
    return this.air.get(CHEMS.o2);
  }
}
