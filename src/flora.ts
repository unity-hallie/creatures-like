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
/** A trace of competence in every lineage.
 *
 *  Seeded rather than absent because mutation here is MULTIPLICATIVE: jitter on zero
 *  stays zero, so a capacity at exactly nothing can never arise. Starting small and
 *  letting selection raise or bury it is the honest version — the capacity exists faintly,
 *  and whether it is worth paying for is the population's question, not mine. */
export const TRACE_COMPETENCE = { kind: "competence" as const, donate: 0.02, uptake: 0.02 };

export const PLANT: Genome = [
  TRACE_COMPETENCE,
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
  TRACE_COMPETENCE,
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
  TRACE_COMPETENCE,
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
  TRACE_COMPETENCE,
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
  TRACE_COMPETENCE,
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
  TRACE_COMPETENCE,
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
  TRACE_COMPETENCE,
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

// ─────────────────────────────────────────────────────────────────────────────
// NITROGEN, and the things that fight over it.
//
// Carbon comes free from the air for anything that can photosynthesise. Nitrogen does
// not: the atmosphere is full of N2 and almost nothing can touch it, because the triple
// bond costs a fortune to break. That single fact is why nitrogen limits life on a
// planet swimming in it, and it gives the model its second axis of competition — the
// first one an organism cannot solve by growing taller.
// ─────────────────────────────────────────────────────────────────────────────

/** Building tissue: sugar plus fixed nitrogen. Every genome that grows protein needs
 *  ammonia from somewhere, which is exactly the dependency that makes legumes worth it. */
export function aminate(slug: string, rate: number): Reaction {
  return {
    slug,
    reactants: [term(CHEMS.glucose, 1), term(CHEMS.ammonia, 1)],
    products: [term(CHEMS.proteins, 1)],
    rate,
  };
}

/** RHIZOBIUM — half a legume, and the reason the other half wins.
 *
 *  Nitrogen fixation costs sixteen ATP per N2 broken, which is not a metaphor for
 *  expensive, it IS expensive: the bacterium spends more energy on this one reaction than
 *  on staying alive. It cannot pay for that alone, having no way to make sugar. Housed in
 *  a root nodule and fed by a plant, it can. */
export const RHIZOBIUM: Genome = [
  {
    kind: "reaction",
    reaction: {
      slug: "nitrogenase",
      reactants: [term(CHEMS.n2, 1), term(CHEMS.atp, 16)],
      products: [term(CHEMS.ammonia, 2), term(CHEMS.adp, 16)],
      rate: 0.25,
    },
  },
  { kind: "reaction", reaction: upkeep("rhizobium-upkeep", 0.05) },
  { kind: "reaction", reaction: oxidiseGlucose("rhizobium-respiration", 0.2) },
];

/** LEGUME. Ordinary in every respect except the company it keeps: paired with RHIZOBIUM
 *  on one soup (the same construction lichen uses), it trades sugar for ammonia and stops
 *  caring what the soil holds. */
export const LEGUME: Genome = [
  TRACE_COMPETENCE,
  {
    kind: "reaction",
    reaction: {
      slug: "photosynthesis",
      reactants: [term(CHEMS.co2, 6), term(CHEMS.light, 6)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.o2, 6)],
      rate: 0.3,
    },
  },
  { kind: "reaction", reaction: aminate("legume-protein", 0.12) },
  {
    kind: "reaction",
    reaction: { slug: "growth", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.cellulose, 1)], rate: 0.14 },
  },
  {
    kind: "reaction",
    reaction: { slug: "fruiting", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.starch, 1)], rate: 0.06 },
  },
  { kind: "reaction", reaction: upkeep("legume-upkeep", 0.05) },
  { kind: "reaction", reaction: oxidiseGlucose("legume-respiration", 0.05) },
];

/** A plant that must find its nitrogen in the ground, like most of them. */
export const NITROGEN_HUNGRY_PLANT: Genome = [...PLANT, { kind: "reaction", reaction: aminate("plant-protein", 0.12) }];

/** SAPROPHYTE — rots what a plant actually drops.
 *
 *  Added after the first long run went extinct. Nothing in the world could open starch:
 *  fungi had cellulase and protease, and plants pour sugar into starch, so a steppe ended
 *  the run sitting on 116 units of fuel nothing could eat. Atmospheric CO2 drained into
 *  ground it could not get back out of, photosynthesis stopped for want of carbon, and
 *  everything suffocated in a full larder — the lignin trap again, wearing a different
 *  substrate, and I had not noticed because I built the decomposers before the fruit. */
export const SAPROPHYTE: Genome = [
  ...FUNGUS,
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.starch),
    reaction: {
      slug: "fungal-amylase",
      reactants: [term(CHEMS.starch, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.3,
    },
  },
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.proteins),
    reaction: {
      slug: "saprophyte-protease",
      reactants: [term(CHEMS.proteins, 1)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.ammonia, 1)],
      rate: 0.2,
    },
  },
];

/** Everything above, plus the lignin key: a complete decomposer, and the only kind that
 *  lets a carbon cycle actually close. */
export const COMPLETE_ROTTER: Genome = [
  ...SAPROPHYTE,
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.lignin),
    reaction: {
      slug: "rotter-ligninase",
      reactants: [term(CHEMS.lignin, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.22,
    },
  },
];

/** Rotting protein returns its nitrogen to the soil. Without this the world's ammonia
 *  ends up locked in corpses and everything starves in a full larder. */
export const PROTEIN_ROTTER: Genome = [
  ...FUNGUS,
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.proteins),
    reaction: {
      slug: "protease",
      reactants: [term(CHEMS.proteins, 1)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.ammonia, 1)],
      rate: 0.2,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// DEFENCES.
//
// A toxin costs nothing to model, because the machinery already exists: a plant secretes
// a chemical, and whatever eats it either holds a receptor for that chemical or does not.
// If it does, the binding lands on `punishment`, consolidation runs negative, and the
// synapse that led to the mouthful gets weaker. The creature LEARNS to avoid the plant,
// using the identical loop that taught it to approach food.
//
// The sharp case is capsaicin. It deters mammals and not birds — and the reason is that
// deterrence lives in the receptor, never in the molecule. Here a receptor belongs to a
// genome, so the same chemical means agony to one creature and nothing at all to another,
// with no special-casing anywhere. Directed deterrence, straight out of the rule that a
// chemical means only what the wiring says.
// ─────────────────────────────────────────────────────────────────────────────

/** Alkaloids cost nitrogen — the same nitrogen the plant would otherwise build tissue
 *  from. A nitrogen-starved plant cannot afford to be poisonous, which is a real trade
 *  rather than a flavour note. */
export const NIGHTSHADE: Genome = [
  ...LEGUME.filter((g) => !(g.kind === "reaction" && g.reaction.slug === "fruiting")),
  {
    kind: "reaction",
    reaction: {
      slug: "fruiting",
      reactants: [term(CHEMS.glucose, 1)],
      products: [term(CHEMS.starch, 1)],
      rate: 0.06,
    },
  },
  {
    // carbon 6 → 6, nitrogen 1 → 1
    kind: "reaction",
    reaction: {
      slug: "alkaloid-synthesis",
      reactants: [term(CHEMS.glucose, 1), term(CHEMS.ammonia, 1)],
      products: [term(CHEMS.solanine, 1)],
      rate: 0.09,
    },
  },
];

/** Bitterness on the cheap: no nitrogen, so a gourd can defend itself in poor soil, and
 *  correspondingly it defends itself less well. */
export const GOURD: Genome = [
  ...PLANT,
  {
    kind: "reaction",
    reaction: {
      slug: "cucurbitacin-synthesis",
      reactants: [term(CHEMS.glucose, 1)],
      products: [term(CHEMS.cucurbitacin, 1)],
      rate: 0.07,
    },
  },
];

/** The chilli's bet: deter the eater that chews seeds, feed the one that swallows them
 *  whole. Same molecule, opposite outcomes, decided entirely downstream. */
export const CHILLI: Genome = [
  ...PLANT,
  {
    kind: "reaction",
    reaction: {
      slug: "capsaicin-synthesis",
      reactants: [term(CHEMS.glucose, 1)],
      products: [term(CHEMS.capsaicin, 1)],
      rate: 0.07,
    },
  },
];

/** GRASS. Cheap, fast, and built to be eaten.
 *
 *  Grasses grow from the base rather than the tip, which is why grazing prunes them
 *  instead of killing them — the growing point sits below the animal's mouth. Here that
 *  tolerance needs no special rule: a grazed grass loses cellulose and regrows it at a
 *  rate a tree cannot match. Tolerance IS the growth rate, which is data.
 *
 *  Almost no lignin, so grass makes fine fuel: quick to catch, quick to spend. A grassland
 *  burns often and lightly where a forest burns rarely and completely. */
export const GRASS: Genome = [
  TRACE_COMPETENCE,
  {
    kind: "reaction",
    reaction: {
      slug: "photosynthesis",
      reactants: [term(CHEMS.co2, 6), term(CHEMS.light, 6)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.o2, 6)],
      rate: 0.32,
    },
  },
  {
    // the basal meristem, expressed as a number: fast enough to outrun a mouth
    kind: "reaction",
    reaction: { slug: "growth", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.cellulose, 1)], rate: 0.26 },
  },
  {
    kind: "reaction",
    reaction: { slug: "lignification", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.lignin, 1)], rate: 0.01 },
  },
  {
    kind: "reaction",
    reaction: { slug: "fruiting", reactants: [term(CHEMS.glucose, 1)], products: [term(CHEMS.starch, 1)], rate: 0.05 },
  },
  { kind: "reaction", reaction: aminate("grass-protein", 0.1) },
  { kind: "reaction", reaction: upkeep("grass-upkeep", 0.05) },
  { kind: "reaction", reaction: oxidiseGlucose("grass-respiration", 0.06) },
];

/** RUMEN SYMBIONT — the third use of one soup, two genomes.
 *
 *  No vertebrate makes cellulase. Every animal that lives on grass is really a
 *  partnership: the animal chews and swallows, and a microbial population it did not
 *  build turns the cellulose into sugar it can use. Lichen, root nodule, rumen — one
 *  construction, three times, and none of them needed engine support. */
export const RUMEN_SYMBIONT: Genome = [
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.cellulose),
    reaction: {
      slug: "rumen-cellulase",
      reactants: [term(CHEMS.cellulose, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.28,
    },
  },
  { kind: "reaction", reaction: upkeep("rumen-upkeep", 0.04) },
];
