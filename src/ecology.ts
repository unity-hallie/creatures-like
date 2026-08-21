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
  // Spent currency, scavenged back out of the ground. Every genome here consumes ADP —
  // glycolysis takes 2 and respiration 30 — so this is the channel that lets the adenine a
  // corpse returns re-enter a living body instead of settling in the soil forever.
  [CHEMS.adp, "patch"],
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
/** The least a mouthful can be and still count as having eaten.
 *
 *  Decided HERE — where success is decided — rather than per food source, which is what
 *  went wrong twice. Guarding the starch path alone just moved the free meal to the
 *  cellulose path: grazing takes half of whatever a plant holds, which asymptotes toward
 *  zero and never reaches it, so `taken > 0` was true forever and eating never failed.
 *  One threshold at the decision point covers every source and any source added later. */
const MOUTHFUL = 0.02;

/** How much undigested food a gut holds. A stomach has volume.
 *
 *  Added because the trainer showed a creature eating 42 times in 43 ticks: all its
 *  outstanding credit sat on EAT and the movement actions had none, so there was nothing
 *  to shape. Eating that always works is not a generous world, it is a world with no
 *  choices in it.
 *
 *  A capacity rather than a cooldown, because a cooldown is a number I would be choosing
 *  and a capacity is a fact about a body — a creature that has just gorged cannot swallow,
 *  and one that digested it can. Satiety already existed as a FEELING (serotonin damping
 *  drive); this is satiety as a LIMIT, and the two are different things. */
const GUT_CAPACITY = 1.4;

/** Sunlight delivered per patch per tick. Crosses the boundary from outside the model,
 *  like food and unlike everything else — see the file header. */
const LIGHT_PER_TICK = 1.4;
/** Starting atmosphere per patch — and the number that decides how much life this world can
 *  carry. Everything else was downstream of it.
 *
 *  HOW THIN IT WAS. A settled world handed 60 CO2 drew down 59.7 of it inside ten ticks and
 *  nearly doubled its living biomass; an untouched control gained 4 over a hundred ticks.
 *  Throughput ran near 6 CO2/tick against a standing pool of 0.045 — a buffer holding well
 *  under ONE TICK of demand, so primary production was throttled to whatever decomposition
 *  happened to release that tick, and nothing above the plants could get a share of it.
 *
 *  Thickening the air is the only change measured this session that moved the population,
 *  across five seeds at 3000 ticks:
 *
 *    x1 (old)    6 grazers, 17.8 plants        x20    15 grazers, 36.4 plants
 *    x5          7 grazers, 23.2 plants        x100  147 grazers, 45.8 plants
 *
 *  x100 lands near 29 grazers per world instead of 1, which is the difference between an
 *  ecology and a deathbed — selection needs a population to act on, and one animal is not
 *  one. A buffer under a tick of demand is degenerate on physical grounds too: Earth's air
 *  holds decades of photosynthetic demand, and even x100 is only about a hundred ticks.
 *
 *  A BALANCE DECISION, flagged as one. It changes how the world feels, and it is two numbers
 *  to change back. Air is still spent down to near zero at every setting — the world eats
 *  whatever it is given — so read these as buffer depth, not as surplus. */
const O2_PER_PATCH = 1000 / 3;
const CO2_PER_PATCH = 500;
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

    // AN ATMOSPHERE IS A VOLUME, so it scales with the place like everything else here.
    //
    // Light arrives per patch. Soil ammonia is set per patch. The air was a flat 60 CO2 and
    // 40 O2 no matter how wide the world got — so a 96-patch world had four times the light,
    // four times the soil nitrogen, four times the plants, and the same air. Scaling the
    // world up made it MORE crowded per unit atmosphere, not less, which is why every
    // experiment that grew the world measured worse instead of better.
    //
    // The per-patch figures below reproduce the old totals exactly at the default width of
    // 12, so a default world is unchanged and only wider ones differ. `opts.oxygen` stays an
    // absolute override: geography's wind tests set two places to different pressures on
    // purpose, and that has to keep meaning what it says.
    this.air.set(CHEMS.o2, opts.oxygen ?? O2_PER_PATCH * width);
    this.air.set(CHEMS.co2, CO2_PER_PATCH * width);
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
  #uptakeFor(resident: Resident, absorbsSolids = true): void {
    const wanted = resident.organism.expressed.reactantSpecies;
    const patch = this.patches[resident.at];
    for (const [id, where] of ENVIRONMENT) {
      if (!wanted.has(id)) continue;
      // AN ANIMAL DOES NOT ABSORB FOOD THROUGH ITS SKIN.
      //
      // This loop was a second, always-on feeding channel: because a grazer's genome lists
      // starch as a reactant (amylase consumes it), every grazer silently drank 30% of its
      // patch's starch every tick — no forage threshold, no bite, no `eat` action, no meal
      // recorded. The deliberate eating mechanic I had been tuning sat on top of a siphon
      // that kept concentrations pinned below the level at which food could even be sensed.
      // Measured: 11 of 48,662 grazer-ticks ever saw forage above threshold, and the moment
      // the last grazer died, patch starch went from 0.01 to 1.73.
      //
      // Absorption is right for a fungus, which secretes enzymes outward and takes up what
      // dissolves, and for a plant drawing ammonia from soil. It is wrong for an animal,
      // which has to go and get it. So solids are gated on strategy, and gases are not:
      // everything breathes.
      if (!absorbsSolids && where === "patch" && id !== CHEMS.light) continue;
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

  /** The most of any one thing lying in this patch that THIS body has a key for.
   *
   *  WHAT AN ANIMAL EATS IS DERIVED, NOT CONFIGURED — which the file header has claimed
   *  since it was written, and which was true of uptake and egestion and false right here.
   *  Both perception and eating read `CHEMS.starch` by name, so a grazer was an animal that
   *  ate starch because the ecology said so rather than because its genome said so, and no
   *  genome could describe an animal that ate anything else. A detritivore was unwritable.
   *
   *  Asking accessibility instead makes the diet a genome fact, the same lock and key that
   *  already governs digestion. A wild grazer opens starch at 1.00 and cellulose at 0.00, so
   *  it goes on eating exactly what it ate. Give a genome cellulase and it can make a meal of
   *  litter — no branch here changes, and nothing anywhere holds a table of who eats what.
   *
   *  Returns null when nothing here clears the threshold. */
  #edibleAt(organism: Organism, at: number): { chem: ChemId; amount: number } | null {
    const soup = this.patches[at].soup;
    let best: { chem: ChemId; amount: number } | null = null;
    for (const [substrate] of SUBSTRATE_LOCKS) {
      if (organism.accessTo(substrate) <= 0) continue;
      const amount = soup.get(substrate);
      if (amount < FORAGE_THRESHOLD) continue;
      if (!best || amount > best.amount) best = { chem: substrate, amount };
    }
    return best;
  }

  /** What a grazer can see right now: food to either side, food underfoot, and its own fuel
   *  state. Exposed because the training view has to show the same numbers the lobe is
   *  actually reading — a second implementation would drift.
   *
   *  Reads `#edibleAt`, which is the same call `#forage` makes. PERCEPTION AND ACTION HAVE TO
   *  AGREE: they disagreed once already, when senses reported no food below the threshold and
   *  eating took whatever was there, and a creature scored 119 meals in 120 ticks off patches
   *  its own eyes called empty. Two implementations of "is there food here" is how that
   *  happens, so now there is one. */
  senseOf(grazer: Grazer): number[] {
    let nearest: number | null = null;
    for (let i = 0; i < this.patches.length; i++) {
      if (!this.#edibleAt(grazer.organism, i)) continue;
      if (nearest === null || Math.abs(i - grazer.at) < Math.abs(nearest - grazer.at)) nearest = i;
    }
    return [
      nearest !== null && nearest < grazer.at ? 1 : 0,
      nearest !== null && nearest > grazer.at ? 1 : 0,
      this.#edibleAt(grazer.organism, grazer.at) ? 1 : 0,
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
      // a full gut refuses the mouthful, and the refusal is a real failure: the emitters
      // fire their failure branch, adrenaline rises, and consolidation reads it
      // PERCEPTION AND ACTION HAVE TO AGREE. `senseOf` reports no food when a patch holds
      // less than FORAGE_THRESHOLD, but this branch used to take whatever was there — so a
      // creature nibbling 0.001 off a patch its own senses called empty registered a
      // successful meal, 119 times in 120 ticks. The gut capacity below never bound because
      // the mouthfuls were minuscule. A world where the wrong action always works has no
      // choices in it, and nothing to train.
      // The same `#edibleAt` the senses read, so the two cannot drift apart. A gut fills on
      // whatever it swallowed, so capacity is read against that substrate rather than against
      // starch by name — otherwise an animal that ate anything else would never feel full.
      const edible = this.#edibleAt(grazer.organism, grazer.at);
      const worthEating = edible !== null && grazer.organism.soup.get(edible.chem) < GUT_CAPACITY;
      let taken = worthEating
        ? transfer(patch.soup, grazer.organism.soup, edible.chem, edible.amount * BITE)
        : 0;
      // a mouthful takes the surrounding structure too — which no vertebrate can open,
      // so without a gut symbiont it comes out the other end for a fungus to deal with
      taken += transfer(patch.soup, grazer.organism.soup, CHEMS.cellulose, taken * 0.4);

      // NOT NUCLEOTIDES, and the reason is measured. Animals have no adenine route at all:
      // `#uptakeFor` runs with absorbsSolids false for them, so a lineage gets a birth dowry,
      // halves it into every child, and returns the rest to soil it can never draw on. Fungi
      // and plants hold steady near 2.0 adenine each; grazers sit at 0.78 while 404 ADP piles
      // up in the ground.
      //
      // Adding `transfer(patch.soup, ..., CHEMS.adp, taken * 0.4)` here — nucleotides swallowed
      // with the mouthful, the same shape as the cellulose line — does fix that asymmetry, and
      // it is a net loss. Adenine per grazer 0.62 -> 1.16, population across five seeds 21 ->
      // 18 at tick 20,000, and CO2 at tick 3000 falls 3.76 -> 0.99. It takes ADP from the
      // decomposers, who were turning it into respiration and returned carbon, and hands it to
      // animals that do not convert it into anything.
      //
      // So adenine is NOT what limits the grazers, and the soil pool is not idle just because
      // animals cannot reach it. What the detritus half of this world actually lacks is
      // something that eats litter and can itself be eaten — a detritivore, which wants the
      // hardcoded `this.plants` loop below opened up rather than another line here.

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

      if (taken >= MOUTHFUL) {
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
    // THE CENSUS COUNTS THE LIVING. It used to read `cohort.length`, and nothing ever
    // removes a dead resident from these arrays — so every corpse kept its seat forever.
    //
    // A cohort reached 120 by about tick 60, and from that moment breeding was disabled for
    // good, however many of the 120 were dead. Measured at tick 3000: one living grazer, 119
    // corpses, reserves 2.20 and comfortably over the breeding gate, unable to reproduce.
    // World births went 240 by tick 200 and 242 by tick 3000 — two births in 2,800 ticks, in
    // a world that was still eating.
    //
    // This is why six earlier hypotheses all measured as no-ops. More food, weaker founders,
    // fewer competitors, innate reflexes — none of them could matter, because after tick 60
    // the world could only lose. A population that cannot breed does not have an ecology; it
    // has a half-life.
    let living = 0;
    for (const other of cohort) if (other.organism.alive) living++;
    if (living >= CROWD_LIMIT) return;
    const parent = resident.organism;
    // Reserves count what this body can OPEN, not what it contains. A grazer holds no
    // cellulase — `accessTo(cellulose)` reads 0 for it and nonzero for a rotter — so a gut
    // packed with grazed cellulose used to read as capital and fund a child on it. That is
    // the same lock-and-key that governs digestion, asked one question earlier: wealth is
    // not what you are carrying, it is what you can get into.
    const reserves = [CHEMS.atp, CHEMS.glucose, CHEMS.cellulose].reduce(
      (total, id) => total + parent.soup.get(id) * parent.accessTo(id),
      0,
    );
    // The threshold reads what the parent keeps, not what it holds. Read the other way, a
    // well-fed newborn bred every tick until it had given nearly everything away: measured
    // at six breeds in six consecutive ticks, adenine 16 → 1.21, ×0.65 each time, all of it
    // before the creature had eaten once. 14 founders became 290 births and 309 deaths by
    // tick 500 with no food income to fund any of it.
    //
    // Still a capacity rather than a cooldown, and still a fact about a body: an animal that
    // starves itself to term leaves no parent, and the reserve a child needs to survive on
    // is the same reserve its parent needs. Whether reproduction runs away from here is now
    // a question for the food supply, which is where CROWD_LIMIT's comment always said the
    // limit belonged.
    if (reserves * (1 - DOWRY) < BREEDING_THRESHOLD) return;

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

  /** Structure sheds. Fruit does NOT fall here, and the reason is worth keeping.
   *
   *  I added a FRUITFALL rate to this method, believing a plant's starch had no way to the
   *  ground short of death. It has one: `#egest` moves whatever an organism cannot open
   *  back to the patch, and a plant's own amylase does not fully open its own starch, so
   *  fruit already falls — under the name waste, by the accessibility rule that governs
   *  every other solid. Adding a second channel measured WORSE than adding none (ground
   *  starch 0.86 against 1.09 at tick 60), because it drains the pool egestion draws from.
   *
   *  The general shape: before adding a mechanism, check whether an existing rule already
   *  implies it. Accessibility was doing this job the whole time. */
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

    // AND THE ADENINE, which used to stay in the corpse forever. `matter()` reads CARBON
    // union NITROGEN, and ATP and ADP sit in neither, so every death took its adenine out of
    // circulation permanently. Measured over 20,000 ticks and 606 deaths: the world's 704
    // adenine went from all living to 651 stranded in bodies, leaving 52 for everything
    // still alive.
    //
    // That is what was strangling the world. Respiration costs 30 ADP per glucose, so a
    // fungus down to 0.07 ADP can burn 0.002 glucose a tick while holding 16 — drowning in
    // fuel it cannot touch. Carbon then stays locked in fungal bodies, CO2 never comes back,
    // and primary production starves. The carbon story was downstream of this one.
    //
    // Nothing was destroyed and no balance check could have complained: adenine summed to
    // exactly 704 the whole way. Carbon and nitrogen have world-level conservation tests and
    // adenine had none, and a quantity can be perfectly conserved and still be in the wrong
    // place — the same lesson this world already taught once, in a different currency.
    //
    // It returns as ADP rather than ATP because death spends what the body was holding. The
    // moiety counts both at one adenine each, so the ledger does not move.
    //
    // Verified by reverting just these lines: test/circulation.test.ts then reports adenine
    // 92.5% stranded and 7.5% circulating. An alarm that cannot detect its own fire is
    // decoration, so it was worth the two minutes to check.
    const soup = resident.organism.soup;
    const adenine = soup.get(CHEMS.atp) + soup.get(CHEMS.adp);
    if (adenine > 0) {
      soup.set(CHEMS.atp, 0);
      soup.set(CHEMS.adp, 0);
      patch.soup.add(CHEMS.adp, adenine);
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

    // A SNAPSHOT, because a tick is a slice of simultaneous time.
    //
    // `#breed` pushes onto this same array, and `for...of` walks a live array — so a
    // newborn used to get a whole tick of life inside the tick it was born: forage,
    // metabolise, and breed again. Its child got one too. The cascade ran until reserves
    // fell under threshold, all before the tick ended. Measured: 14 grazers became 120 —
    // the crowd cap — in NINE ticks, then 199 of them starved together by tick 200.
    //
    // The plants loop never had this, purely by accident: `canopy` is a sorted copy. The
    // accident was doing real work, so it stops being one here.
    for (const grazer of [...this.grazers]) {
      if (!grazer.organism.alive) continue;
      this.#forage(grazer);
      this.#uptakeFor(grazer, false);
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

    for (const resident of [...this.fungi]) {
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
