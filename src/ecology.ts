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
import { applyReaction } from "./stoichiometry.js";
import { Dice } from "./dice.js";
import { CARBON, CHEMS, NITROGEN, SUBSTRATE_LOCKS, competenceOf, mutate, recombine, shed, type Action, type Genome, type Packet } from "./genome.js";
import { FUNGUS, PLANT } from "./flora.js";
import { Organism } from "./organism.js";
import { bind, Lobe } from "./brain.js";
import { WILD_TYPE } from "./genome.js";

/** Species an organism can draw from its surroundings, and where each is kept. Signals
 *  and internal intermediates are deliberately absent: a creature does not absorb
 *  cortisol from the ground. */
const ENVIRONMENT: ReadonlyArray<readonly [ChemId, "air" | "patch"]> = [
  [CHEMS.co2, "air"],
  [CHEMS.o2, "air"],
  [CHEMS.n2, "air"],
  [CHEMS.ammonia, "patch"],
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
  grazers?: number;
  grazerGenome?: Genome;
  /** oxygen the world starts with; the fire regime is sensitive to this by design */
  oxygen?: number;
  dinitrogen?: number;
  /** usable nitrogen in the ground. Set it low to make legumes matter. */
  soilAmmonia?: number;
  /** how much room the air has. Pressure is n·R·T/V, so a small place pressurises fast. */
  volume?: number;
  /** in model kelvin. Drives pressure, and therefore wind. */
  temperature?: number;
  /** sunlight per patch per tick — a place, not a constant, once there are places */
  light?: number;
  /** -1 to 1: how hard the year hits here. */
  latitude?: number;
  /** a name, for a human reading a log. Nothing reads it. */
  name?: string;
}

/** Something done to the world from outside it.
 *
 *  Logged, always, and at a named port like any die. A creature's life stays
 *  `(genome, seeds, interventions)` — so a creature you trained can be replayed exactly,
 *  and "was it my training or the weather?" stays an experiment rather than a story. */
export interface Intervention {
  tick: number;
  /** who or where it landed */
  target: string;
  kind: "reward" | "punish" | "say" | "feed";
  amount: number;
  /** for `say`: the token uttered. Nothing else uses it. */
  token?: string;
}

export class Patch {
  readonly soup = new Soup();
  /** genetic material shed here and not yet taken up or perished. The naked DNA of
   *  transformation: loose in the world, going nowhere on its own. */
  packets: Packet[] = [];
  /** ticks remaining in an active fire */
  burning = 0;
}

interface Resident {
  organism: Organism;
  at: number;
}

/** An animal is a Resident that also steers. Everything else about it — metabolism,
 *  digestion, egestion, breathing — runs the same machinery a fungus runs. */
interface Grazer extends Resident {
  lobe: Lobe;
  meals: number;
  /** the last few things it did, most recent first. Reward lands on what fired RECENTLY,
   *  so a trainer has to be able to see what that was. */
  recent?: Array<{ tick: number; action: Action; succeeded: boolean }>;
}

/** Starch in a patch above this reads as food to a grazer. */
const FORAGE_THRESHOLD = 0.05;
/** Share of a patch's starch taken in one mouthful. */
const BITE = 0.5;

/** Sunlight delivered per patch per tick. Crosses the boundary from outside the model,
 *  like food and unlike everything else — see the file header. */
const LIGHT_PER_TICK = 1.4;
/** Fraction of a plant's structure shed as litter each tick. */
const LITTERFALL = 0.035;
/** Fraction of available substrate an organism absorbs per tick. */
const UPTAKE = 0.3;
/** Reserves an organism must hold before it can afford a child. */
const BREEDING_THRESHOLD = 1.2;
/** Share of the parent's matter that goes into the child. Nothing is created: a parent
 *  pays for its offspring out of its own body, which is what reproduction costs. */
const DOWRY = 0.35;
/** A ceiling per place, so a runaway cannot eat the process. Resource limits should bind
 *  first; this exists only so a bug cannot become a memory leak. */
const CROWD_LIMIT = 120;

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
  readonly grazers: Grazer[] = [];

  /** the air's room to move in */
  volume: number;
  /** current temperature. Weather writes here; pressure reads it. */
  temperature: number;
  readonly baseTemperature: number;
  /** sunlight reaching each patch. Geography writes here every tick once there is a sky
   *  — day, night and season are all this number moving. */
  light: number;
  readonly baseLight: number;
  /** -1 to 1. Which way this place leans into the year; the equator barely notices. */
  readonly latitude: number;
  readonly name: string;

  tick = 0;
  ignitions = 0;
  deaths = 0;
  births = 0;
  /** the hand's whole record. Nothing here is applied twice or forgotten. */
  readonly interventions: Intervention[] = [];
  #nextId = 0;
  recombinations = 0;
  meals = 0;

  readonly #plantGenome: Genome;

  constructor(opts: EcosystemOptions = {}) {
    const width = opts.width ?? 12;
    this.patches = Array.from({ length: width }, () => new Patch());
    this.dice = new Dice(opts.seed ?? 1);
    this.#plantGenome = opts.plantGenome ?? PLANT;
    this.volume = opts.volume ?? 100;
    this.temperature = opts.temperature ?? 288;
    this.baseTemperature = this.temperature;
    this.light = opts.light ?? LIGHT_PER_TICK;
    this.baseLight = this.light;
    this.latitude = opts.latitude ?? 0;
    this.name = opts.name ?? "place";

    this.air.set(CHEMS.o2, opts.oxygen ?? 40);
    this.air.set(CHEMS.co2, 60);
    // plenty of nitrogen, almost none of it usable — the planet's standing joke
    this.air.set(CHEMS.n2, opts.dinitrogen ?? 30);
    const ammonia = opts.soilAmmonia ?? 0.5;
    for (const patch of this.patches) patch.soup.set(CHEMS.ammonia, ammonia);

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
    for (let i = 0; i < (opts.grazers ?? 0); i++) {
      const organism = new Organism({
        genome: opts.grazerGenome ?? WILD_TYPE,
        initial: [
          [CHEMS.glucose, 0.6],
          [CHEMS.atp, 4],
          [CHEMS.adp, 12],
        ],
      });
      organism.id = this.#name("grazer");
      this.grazers.push({
        organism,
        lobe: new Lobe(organism.expressed, this.dice.at("spawn")),
        at: Math.floor(spawn.next() * width),
        meals: 0,
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

  /** Names a newborn. Deterministic and per-world, so a replay assigns the same names. */
  #name(kind: string): string {
    return `${kind}${this.#nextId++}`;
  }

  /** Everything alive here, addressable. */
  residents(): Resident[] {
    return [...this.plants, ...this.fungi, ...this.grazers];
  }

  find(id: string): Resident | undefined {
    return this.residents().find((r) => r.organism.id === id);
  }

  /**
   * THE HAND. Reward, punish, speak, feed — from outside the world, onto one target.
   *
   * Reward and punishment secrete rather than rewire: dopamine and cortisol go into the
   * soup, and the ordinary receptors do the ordinary work on whatever fired recently. So
   * TIMING IS THE WHOLE SKILL. `traceDecay` is 0.7, which leaves about three or four ticks
   * of credit — reward arriving late trains something else, exactly as with an animal.
   */
  intervene(target: string, kind: Intervention["kind"], amount = 1, token?: string): boolean {
    const record: Intervention = { tick: this.tick, target, kind, amount, token };

    if (kind === "feed") {
      const at = Number(target);
      const patch = this.patches[at];
      if (!patch) return false;
      patch.soup.add(CHEMS.starch, amount);
      this.interventions.push(record);
      return true;
    }

    const resident = this.find(target);
    if (!resident || !resident.organism.alive) return false;
    if (kind === "reward") resident.organism.soup.add(CHEMS.dopamine, amount);
    if (kind === "punish") resident.organism.soup.add(CHEMS.cortisol, amount);
    // `say` is handled by the caller that owns the idiolects; logged here regardless so the
    // record of what was done to this world stays in one place
    this.interventions.push(record);
    return true;
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
    for (const r of [...this.plants, ...this.fungi, ...this.grazers]) count(r.organism.soup);
    return total;
  }

  /** Every nitrogen atom in the world. Same law as carbon, second element. */
  totalNitrogen(): number {
    let total = 0;
    const count = (soup: Soup) => {
      for (const [id, per] of NITROGEN) total += soup.get(id) * per;
    };
    count(this.air);
    for (const patch of this.patches) count(patch.soup);
    for (const r of [...this.plants, ...this.fungi, ...this.grazers]) count(r.organism.soup);
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

  /** What a grazer can see: fruit to either side, fruit underfoot, and its own fuel
   *  state. Identical in shape to the single-creature rig, but the food is real — a
   *  patch has starch because a plant put it there out of air and light. */
  /** What a grazer can see right now. Exposed because the training view has to show the
   *  same numbers the lobe is actually reading — a second implementation would drift. */
  senseOf(grazer: Grazer): number[] {
    const patch = this.patches[grazer.at];
    let nearest: number | null = null;
    for (let i = 0; i < this.patches.length; i++) {
      if (this.patches[i].soup.get(CHEMS.starch) < FORAGE_THRESHOLD) continue;
      if (nearest === null || Math.abs(i - grazer.at) < Math.abs(nearest - grazer.at)) nearest = i;
    }
    return [
      nearest !== null && nearest < grazer.at ? 1 : 0,
      nearest !== null && nearest > grazer.at ? 1 : 0,
      patch.soup.get(CHEMS.starch) >= FORAGE_THRESHOLD ? 1 : 0,
      Math.max(0, 1 - grazer.organism.soup.get(CHEMS.glucose) / 0.6),
    ];
  }

  #forage(grazer: Grazer): void {
    const patch = this.patches[grazer.at];
    const sensed = this.senseOf(grazer);

    const picked = grazer.lobe.choose(sensed, bind(grazer.organism.expressed, grazer.organism.soup), this.dice.at("tiebreak"));
    const action = grazer.lobe.actions[picked];

    let succeeded = false;
    if (action === "left" && grazer.at > 0) {
      grazer.at--;
      succeeded = true;
    } else if (action === "right" && grazer.at < this.patches.length - 1) {
      grazer.at++;
      succeeded = true;
    } else if (action === "eat") {
      let taken = transfer(patch.soup, grazer.organism.soup, CHEMS.starch, patch.soup.get(CHEMS.starch) * BITE);
      // a mouthful takes the surrounding structure too — which no vertebrate can open,
      // so without a gut symbiont it comes out the other end for a fungus to deal with
      taken += transfer(patch.soup, grazer.organism.soup, CHEMS.cellulose, taken * 0.4);

      // GRAZING. With no fruit on the ground, take the plant itself. This is why grass
      // grows from the base: the growing point sits below the mouth, so a grazed grass is
      // pruned rather than killed, and outgrows the loss if its growth rate can.
      if (taken <= 0) {
        for (const plant of this.plants) {
          if (plant.at !== grazer.at || !plant.organism.alive) continue;
          taken += transfer(plant.organism.soup, grazer.organism.soup, CHEMS.cellulose, plant.organism.soup.get(CHEMS.cellulose) * BITE);
          // and whatever the plant spent on defending itself comes along with the bite
          for (const toxin of [CHEMS.solanine, CHEMS.cucurbitacin, CHEMS.capsaicin]) {
            transfer(plant.organism.soup, grazer.organism.soup, toxin, plant.organism.soup.get(toxin) * BITE);
          }
          break;
        }
      }

      if (taken > 0) {
        succeeded = true;
        grazer.meals++;
        this.meals++;
      }
    }

    // remember it, shortest useful history: the credit window is about three ticks
    if (!grazer.recent) grazer.recent = [];
    grazer.recent.unshift({ tick: this.tick, action, succeeded });
    if (grazer.recent.length > 12) grazer.recent.pop();

    for (const gene of grazer.organism.expressed.emittersOf(action)) {
      if (gene.when === "success" && !succeeded) continue;
      if (gene.when === "failure" && succeeded) continue;
      grazer.organism.soup.add(gene.chem, gene.amount);
    }
    for (const cost of grazer.organism.expressed.costsOf(action)) applyReaction(cost, grazer.organism.soup);
  }

  /**
   * REPRODUCTION — the loop that was missing, and whose absence made me the optimiser.
   *
   * Without it, populations can only fall: organisms died, nothing was born, `mutate` was
   * never once called in a run, and selection had nothing to act on. So the balance
   * between producers and decomposers could never correct itself, and I hand-tuned the
   * ratio across four runs instead — turning a knob on a machine built to turn its own.
   *
   * A parent pays for its child out of its own body, so nothing is created. The genome is
   * copied through `mutate`, which means the mutation port finally does something and the
   * digestion keys, endocrine thresholds and rates all become things the world can search
   * rather than things I choose.
   */
  #breed(resident: Resident, cohort: Resident[]): void {
    if (cohort.length >= CROWD_LIMIT) return;
    const parent = resident.organism;
    const reserves = parent.soup.get(CHEMS.atp) + parent.soup.get(CHEMS.glucose) + parent.soup.get(CHEMS.cellulose);
    if (reserves < BREEDING_THRESHOLD) return;

    const stream = this.dice.at("mutation");
    // MITOSIS, and only mitosis. Recombination happens elsewhere and on its own schedule
    // (see #transform), exactly as in the bacteria this is modelled on — sex and
    // reproduction are separate processes and were separate first.
    const child = new Organism({ genome: mutate(parent.genome, stream, 0.08) });
    for (const [id] of parent.matter()) transfer(parent.soup, child.soup, id, parent.soup.get(id) * DOWRY);
    for (const id of [CHEMS.atp, CHEMS.adp]) transfer(parent.soup, child.soup, id, parent.soup.get(id) * DOWRY);
    child.id = this.#name("born");
    cohort.push({ organism: child, at: resident.at });
    this.births++;
  }

  /**
   * TRANSFORMATION — shedding, and taking up what others shed.
   *
   * Reproduction stays mitotic. This runs BESIDE it, exactly as in bacteria, which is why
   * it is not a reproductive mode: an organism sheds part of its genome into the ground,
   * and another may pick it up and integrate it. Both cost ATP, so the population gets to
   * discover whether shuffling is worth its price rather than being told.
   *
   * Packets perish. Genetic material outside a body does not keep, which is why this only
   * works between neighbours and why it is a local process however global its effects.
   */
  #transform(resident: Resident): void {
    const organism = resident.organism;
    const { donate, uptake } = competenceOf(organism.genome);
    if (donate <= 0 && uptake <= 0) return;
    const patch = this.patches[resident.at];
    const stream = this.dice.at("mutation");

    if (donate > 0 && organism.soup.get(CHEMS.atp) > 0.3 && stream.next() < donate) {
      organism.soup.add(CHEMS.atp, -0.05);
      organism.soup.add(CHEMS.adp, 0.05);
      patch.packets.push(shed(organism.genome, stream));
    }

    if (uptake > 0 && patch.packets.length > 0 && organism.soup.get(CHEMS.atp) > 0.3 && stream.next() < uptake) {
      const taken = patch.packets.shift()!;
      organism.soup.add(CHEMS.atp, -0.05);
      organism.soup.add(CHEMS.adp, 0.05);
      // a genome changed mid-life: the organism keeps its body and alters its recipe,
      // which is what transformation actually does to a bacterium
      organism.adopt(recombine(organism.genome, taken, stream));
      this.recombinations++;
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
    for (const [id] of resident.organism.matter()) {
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

  /** Structural carbon a plant has laid down. Height, in effect — and the only thing
   *  lignin buys, which is what makes lignification worth its cost to a tree and not to
   *  a moss. */
  height(resident: Resident): number {
    return resident.organism.soup.get(CHEMS.cellulose) + resident.organism.soup.get(CHEMS.lignin);
  }

  step(): void {
    for (const patch of this.patches) patch.soup.set(CHEMS.light, this.light);

    // SHADING. Light is finite per patch and taken in height order, so a tall plant
    // drinks first and a short one gets the remainder. This is the only competition in
    // the model that one organism can win outright, and it is why a tree pays for lignin.
    const canopy = [...this.plants].sort((a, b) => this.height(b) - this.height(a));

    for (const resident of canopy) {
      if (!resident.organism.alive) continue;
      this.#uptakeFor(resident);
      resident.organism.metabolise();
      this.#vent(resident);
      this.#egest(resident);
      this.#litterfall(resident);
      resident.organism.checkVitality();
      if (!resident.organism.alive) this.#decompose(resident);
      else { this.#transform(resident); this.#breed(resident, this.plants); }
    }

    for (const grazer of this.grazers) {
      if (!grazer.organism.alive) continue;
      this.#forage(grazer);
      this.#uptakeFor(grazer);
      grazer.organism.digest();
      grazer.organism.secrete();
      grazer.organism.react();
      grazer.lobe.consolidate(bind(grazer.organism.expressed, grazer.organism.soup));
      grazer.organism.decay();
      this.#vent(grazer);
      this.#egest(grazer);
      grazer.organism.checkVitality();
      if (!grazer.organism.alive) this.#decompose(grazer);
      else {
        this.#transform(grazer);
        const before = this.grazers.length;
        this.#breed(grazer, this.grazers as Resident[]);
        // a newborn grazer needs a brain of its own, grown from the genome it inherited
        if (this.grazers.length > before) {
          const born = this.grazers[this.grazers.length - 1] as Grazer;
          born.lobe = new Lobe(born.organism.expressed, this.dice.at("spawn"));
          born.meals = 0;
        }
      }
    }

    for (const resident of this.fungi) {
      if (!resident.organism.alive) continue;
      this.#uptakeFor(resident);
      resident.organism.metabolise();
      this.#vent(resident);
      this.#egest(resident);
      resident.organism.checkVitality();
      if (!resident.organism.alive) this.#decompose(resident);
      else { this.#transform(resident); this.#breed(resident, this.fungi); }
    }

    for (const patch of this.patches) {
      for (const packet of patch.packets) packet.age++;
      if (patch.packets.length > 0) patch.packets = patch.packets.filter((p) => p.age < 40).slice(-8);
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

  /** Gas in the air, in model moles. Only the gases — solids sit in patches and exert no
   *  pressure, which is the whole reason to keep them apart. */
  moles(): number {
    return this.air.get(CHEMS.o2) + this.air.get(CHEMS.co2) + this.air.get(CHEMS.n2);
  }

  /** Ideal gas, with R folded into the model's units: P = nT/V.
   *
   *  This is what makes weather rather than plumbing. An earlier build kept ONE global
   *  well-mixed atmosphere and equalised it by a fixed transfer rate, which pinned oxygen
   *  at the same number in every run — the number was a property of the rate, not of the
   *  biology. Pressure gives gases a reason to move that the biology can actually push
   *  on. */
  pressure(): number {
    return this.volume <= 0 ? 0 : (this.moles() * this.temperature) / this.volume;
  }
}
