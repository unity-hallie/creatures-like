// Plants and fungi: the other two thirds of the carbon cycle, expressed from the same
// flat gene list as the animal. Neither has a lobe. That is the whole demonstration —
// nothing about the machinery is animal-shaped, so a photosynthesiser and a decomposer
// are ordinary genomes rather than a separate subsystem.
//
// The three of them run ONE pathway at different rates and with different capture:
//
//   plant     CO2 → sugar     (uphill, paid for by light)
//   fungus    sugar → CO2     (downhill, captures ATP, needs an enzyme per substrate)
//   animal    sugar → CO2     (downhill, captures ATP, needs a mouth)
//   fire      sugar → CO2     (downhill, captures nothing, needs only a spark)
//
// Fire is not a fourth mechanism. It is the same oxidation with no enzymes and no ATP
// capture, which is why it lives in ecology.ts as a reaction rather than as an effect.

import { CHEMS, type Genome } from "./genome.js";
import { keysFor, LOCKS } from "./digestion.js";
import type { ChemId } from "./chemistry.js";
import type { Reaction } from "./stoichiometry.js";

const term = (chem: ChemId, coeff: number) => ({ chem, coeff });

/** Burning sugar for currency. Shared by plants and fungi; the animal runs the longer
 *  two-step version (glycolysis then respiration) because that is where the detail earns
 *  its keep. Carbon: 6 in, 6 out. Adenine: 30 in, 30 out. */
/** UPKEEP: the cost of continuing to exist. Being alive spends currency even when the
 *  organism does nothing, which is what makes starvation possible — an organism with no
 *  ATP demand can idle forever in a sealed jar and never notice the air ran out.
 *
 *  No new gene kind needed. Staying alive IS a reaction: ATP to ADP, every tick, and
 *  adenine stays conserved while doing it. Its rate is a genuine evolutionary parameter —
 *  a cheap body survives famine that a costly one does not. */
export function upkeep(slug: string, rate: number): Reaction {
  return {
    slug,
    reactants: [term(CHEMS.atp, 1)],
    products: [term(CHEMS.adp, 1)],
    rate,
  };
}

export function oxidiseGlucose(slug: string, rate: number): Reaction {
  return {
    slug,
    reactants: [term(CHEMS.glucose, 1), term(CHEMS.o2, 6), term(CHEMS.adp, 30)],
    products: [term(CHEMS.co2, 6), term(CHEMS.atp, 30)],
    rate,
  };
}

/** A plant. Fixes carbon in the light, builds itself out of the proceeds, and respires
 *  like everything else. Lignin costs more to make and cannot be rotted by a fungus
 *  lacking the enzyme — which is the knob the whole fire regime hangs on. */
export const PLANT: Genome = [
  {
    kind: "reaction",
    reaction: {
      slug: "photosynthesis",
      reactants: [term(CHEMS.co2, 6), term(CHEMS.light, 6)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.o2, 6)],
      rate: 0.28,
    },
  },
  {
    kind: "reaction",
    reaction: {
      slug: "growth",
      reactants: [term(CHEMS.glucose, 1)],
      products: [term(CHEMS.cellulose, 1)],
      rate: 0.16,
    },
  },
  {
    kind: "reaction",
    reaction: {
      slug: "lignification",
      reactants: [term(CHEMS.glucose, 1)],
      products: [term(CHEMS.lignin, 1)],
      rate: 0.07,
    },
  },
  {
    // Fruiting: a plant packing sugar into a form something else can carry off. Starch is
    // the one lock nearly everything holds a key to, which is exactly the point of it —
    // a plant that wanted its storage eaten would build it out of starch, and one that
    // did not would build it out of lignin. Both happen.
    kind: "reaction",
    reaction: {
      slug: "fruiting",
      reactants: [term(CHEMS.glucose, 1)],
      products: [term(CHEMS.starch, 1)],
      rate: 0.04,
    },
  },
  { kind: "reaction", reaction: upkeep("plant-upkeep", 0.05) },
  { kind: "reaction", reaction: oxidiseGlucose("plant-respiration", 0.06) },
];

/** A fungus that can rot cellulose and nothing else. Lignin accumulates around it,
 *  untouched, exactly as it did for the sixty million years of the Carboniferous. */
export const FUNGUS: Genome = [
  {
    // Cellulose is a crystalline repeat, so one well-fitted enzyme opens all of it.
    kind: "enzyme",
    keys: keysFor(LOCKS.cellulose),
    reaction: {
      slug: "cellulase",
      reactants: [term(CHEMS.cellulose, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.3,
    },
  },
  { kind: "reaction", reaction: upkeep("fungal-upkeep", 0.07) },
  { kind: "reaction", reaction: oxidiseGlucose("fungal-respiration", 0.2) },
];

/** The Permian upgrade: one extra enzyme gene, and the buried carbon becomes food.
 *
 *  This is the thesis at planetary scale. The gene list is the same shape it has always
 *  been, one entry longer, and the consequence is not a faster fungus — it is a world
 *  that stops accumulating fuel, stops enriching its own atmosphere with oxygen, and
 *  stops burning. Nobody tunes a fire parameter to get that. */
export const LIGNIN_EATER: Genome = [
  ...FUNGUS,
  {
    // Lignin scatters across every motif, so opening it takes a key broad enough to cover
    // all twelve — a great deal more gene space than cellulase needed.
    kind: "enzyme",
    keys: keysFor(LOCKS.lignin),
    reaction: {
      slug: "ligninase",
      reactants: [term(CHEMS.lignin, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.25,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Four more ways to be alive. Every one below is DATA — new genomes, no engine
// changes — except shading, which trees needed because height finally made light
// worth competing for. That the rest cost nothing but gene lists is the return on
// the data-driven turn.
// ─────────────────────────────────────────────────────────────────────────────

/** MOSS. Bryophytes never evolved lignin, and this one hasn't either: it grows fast,
 *  cheap and low, and everything it drops rots easily. A moss world should burn LESS —
 *  which tests the fire mechanism from the opposite direction to the Carboniferous. */
export const MOSS: Genome = [
  {
    kind: "reaction",
    reaction: {
      slug: "photosynthesis",
      reactants: [term(CHEMS.co2, 6), term(CHEMS.light, 6)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.o2, 6)],
      rate: 0.34,
    },
  },
  {
    kind: "reaction",
    reaction: { slug: "growth", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.cellulose, 1)], rate: 0.2 },
  },
  {
    kind: "reaction",
    reaction: { slug: "fruiting", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.starch, 1)], rate: 0.05 },
  },
  { kind: "reaction", reaction: upkeep("moss-upkeep", 0.06) },
  { kind: "reaction", reaction: oxidiseGlucose("moss-respiration", 0.06) },
];

/** TREE. Pours carbon into lignin, which buys height, which buys first claim on the
 *  light — and leaves behind the one substrate most decomposers cannot open. The whole
 *  Carboniferous in one genome: the strategy that wins the canopy also makes the fuel. */
export const TREE: Genome = [
  {
    kind: "reaction",
    reaction: {
      slug: "photosynthesis",
      reactants: [term(CHEMS.co2, 6), term(CHEMS.light, 6)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.o2, 6)],
      rate: 0.26,
    },
  },
  {
    kind: "reaction",
    reaction: { slug: "growth", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.cellulose, 1)], rate: 0.14 },
  },
  {
    kind: "reaction",
    reaction: { slug: "lignification", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.lignin, 1)], rate: 0.16 },
  },
  {
    kind: "reaction",
    reaction: { slug: "fruiting", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.starch, 1)], rate: 0.03 },
  },
  { kind: "reaction", reaction: upkeep("tree-upkeep", 0.04) },
  { kind: "reaction", reaction: oxidiseGlucose("tree-respiration", 0.05) },
];

/** YEAST. Ferments rather than respires: glucose to ethanol and CO2, no oxygen required,
 *  two ATP where respiration takes thirty. A rate-for-yield trade, and a strategy that
 *  keeps working after the air runs out — plus it throws away four carbons of perfectly
 *  good fuel, which is why brewing works and why something always evolves to drink it. */
export const YEAST: Genome = [
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.starch),
    reaction: {
      slug: "yeast-amylase",
      reactants: [term(CHEMS.starch, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.25,
    },
  },
  { kind: "reaction", reaction: upkeep("yeast-upkeep", 0.05) },
  {
    // Carbon: 6 in, 4 as ethanol plus 2 as CO2 out. Adenine: 2 in, 2 out.
    kind: "reaction",
    reaction: {
      slug: "fermentation",
      reactants: [term(CHEMS.glucose, 1), term(CHEMS.adp, 2)],
      products: [term(CHEMS.ethanol, 2), term(CHEMS.co2, 2), term(CHEMS.atp, 2)],
      rate: 0.4,
    },
  },
];

/** ALGA — half a lichen. Photosynthesises and nothing else: no structure, no storage, no
 *  way to reach a substrate. Alone it is a poor organism. */
export const ALGA: Genome = [
  {
    kind: "reaction",
    reaction: {
      slug: "photosynthesis",
      reactants: [term(CHEMS.co2, 6), term(CHEMS.light, 6)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.o2, 6)],
      rate: 0.3,
    },
  },
  { kind: "reaction", reaction: upkeep("alga-upkeep", 0.06) },
  { kind: "reaction", reaction: oxidiseGlucose("alga-respiration", 0.05) },
];

/** MYCOBIONT — the other half. Rots what it can reach and cannot make a calorie from
 *  light. On bare ground with no litter, it starves. */
export const MYCOBIONT: Genome = [
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.cellulose),
    reaction: {
      slug: "cellulase",
      reactants: [term(CHEMS.cellulose, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.3,
    },
  },
  { kind: "reaction", reaction: upkeep("mycobiont-upkeep", 0.07) },
  { kind: "reaction", reaction: oxidiseGlucose("mycobiont-respiration", 0.18) },
];
