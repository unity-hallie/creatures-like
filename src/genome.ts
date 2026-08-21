// The genome: one flat list where any gene may express any layer — a reaction, a decay
// rate, an endocrine response, a receptor, an emitter, or the brain's shape. That
// flatness carries the whole thesis. Mutation and crossover run over this one list, so
// they reach chemistry, endocrine wiring, and neural structure in a single stroke, and
// evolution can invent semantics by accident: point a receptor somewhere new and a
// chemical starts meaning something it never meant before.
//
// A WARNING ABOUT THE NAMES. These carry real molecule names, which buys legibility and
// costs a hazard: folk neuroscience ("serotonin = happy", "dopamine = pleasure") will try
// to tell you what a chemical does. It does not get a vote. What dopamine does here is
// exactly what the receptor and emitter genes say it does, and a mutation may change that
// without renaming anything. The label is decoration; the wiring is the meaning. This is
// the opaque-slug law wearing a lab coat — read the relations, never the name.

import { chem, type ChemId } from "./chemistry.js";
import type { Moiety, Reaction } from "./stoichiometry.js";
import { keysFor, LOCKS, type Keys, type Lock } from "./digestion.js";
import type { Stream } from "./dice.js";

export const CHEMS = {
  // ── metabolites ────────────────────────────────────────────────────────────
  /** food as swallowed; digests slowly, which is what stops a meal from spiking glucose */
  starch: chem("starch"),
  /** blood sugar: the axis the endocrine system regulates around */
  glucose: chem("glucose"),
  /** glycolysis' output and respiration's input */
  pyruvate: chem("pyruvate"),
  /** the fat reserve — slow to fill, slow to spend */
  lipids: chem("lipids"),
  /** structure; a last-resort fuel the body eats itself to reach */
  proteins: chem("proteins"),
  /** banks surplus fuel: catalyses glucose into lipids without being spent doing it */
  insulin: chem("insulin"),

  // ── structural carbon: what plants build, what everything else wants back ──
  /** digestible structure. Fungi unlock it with an ordinary enzyme gene. */
  cellulose: chem("cellulose"),
  /** indigestible structure — until something evolves the gene for it. Lignin arriving
   *  before anything could rot it is why the Carboniferous buried coal and burned. */
  lignin: chem("lignin"),
  /** what heat has already taken apart. Cooking gelatinises starch and unfolds protein,
   *  which is decryption done OUTSIDE the body — the same carbon and nitrogen behind a
   *  much easier lock. */
  cooked: chem("cooked"),
  /** sunlight, carried as a chemical so photosynthesis can be an ordinary reaction with
   *  an ordinary limiting reagent rather than a special case */
  light: chem("light"),
  /** fermentation's output: two carbons of unspent fuel, thrown away because the yeast
   *  was in too much of a hurry to finish burning it. Somebody else's dinner. */
  ethanol: chem("ethanol"),

  // ── plant defences. Carbon and nitrogen spent on not being eaten ──────────
  /** the nightshade alkaloid. Costs nitrogen to make, which is why a plant short of
   *  nitrogen cannot afford to defend itself — a real trade, not a flavour note. */
  solanine: chem("solanine"),
  /** the gourd bitterness. Cheaper, carbon-only, and correspondingly weaker. */
  cucurbitacin: chem("cucurbitacin"),
  /** the capsicum trick: a molecule that hurts some eaters and not others, because the
   *  hurting lives in the receptor rather than in the molecule. */
  capsaicin: chem("capsaicin"),

  // ── nitrogen: the second currency, and the second thing worth fighting over ──
  /** atmospheric dinitrogen. Abundant, inert, and useless to almost everything — the
   *  triple bond costs a fortune to break, which is the whole reason nitrogen limits
   *  life on a planet that is swimming in it. */
  n2: chem("N2"),
  /** fixed nitrogen: the form anything can actually build with. */
  ammonia: chem("ammonia"),

  // ── the energy currency, as in the original: Creatures carried ATP directly ──
  atp: chem("ATP"),
  /** spent currency. ATP + ADP is a conserved moiety here, checked at birth. */
  adp: chem("ADP"),

  // ── respiratory gases: the creature's opening onto the world ───────────────
  o2: chem("O2"),
  co2: chem("CO2"),

  // ── signals ────────────────────────────────────────────────────────────────
  /** the reward gate: "that was good" */
  dopamine: chem("dopamine"),
  /** contentment; a fed creature stops foraging */
  serotonin: chem("serotonin"),
  /** the stress glucocorticoid: raises arousal AND mobilises stored fuel — literally
   *  named for raising blood glucose, and it does exactly that here */
  cortisol: chem("cortisol"),
  /** acute arousal, spent on a shock rather than a mood */
  adrenaline: chem("adrenaline"),
  /** the plasticity gate: "pay attention now", regardless of good or bad */
  acetylcholine: chem("acetylcholine"),
} as const;

/** Conserved groups, checked once at birth by `assertBalanced`.
 *
 *  CARBON is declared over the energy path only. Eating and breathing sit OUTSIDE it on
 *  purpose — they are the creature's boundary with a world this model does not track
 *  atom-for-atom, and pretending otherwise would be a fiction dressed as rigour. Inside
 *  the boundary the count is honest, and lipids and proteins are carried as
 *  glucose-equivalents so the arithmetic stays whole. */
export const MOIETIES: ReadonlyArray<readonly [string, Moiety]> = [
  [
    "adenine",
    [
      [CHEMS.atp, 1],
      [CHEMS.adp, 1],
    ],
  ],
  ["carbon", CARBON_COUNTS()],
  ["nitrogen", NITROGEN_COUNTS()],
];

/** Nitrogen per unit. Proteins carry one apiece — another declared simplification in the
 *  same spirit as the glucose-equivalents, and for the same reason: whole numbers make
 *  the balance check exact rather than approximate. */
function NITROGEN_COUNTS(): Moiety {
  return [
    [CHEMS.proteins, 1],
    [CHEMS.cooked, 1],
    [CHEMS.ammonia, 1],
    [CHEMS.solanine, 1],
    [CHEMS.n2, 2],
  ];
}

export const NITROGEN: ReadonlyArray<readonly [ChemId, number]> = NITROGEN_COUNTS();

/** Carbon atoms per unit, for every species that carries any. The ecosystem's
 *  conservation test sums this across every soup in the world — creatures, fungi,
 *  plants, patches, and the air — and the total must not move.
 *
 *  Lipids, proteins, cellulose and lignin are carried as glucose-equivalents (6) rather
 *  than their true formulas. That is a declared simplification, not an accident: it keeps
 *  every coefficient a whole number, which is what lets the balance check be exact
 *  instead of approximate. */
function CARBON_COUNTS(): Moiety {
  return [
    [CHEMS.starch, 6],
    [CHEMS.glucose, 6],
    [CHEMS.pyruvate, 3],
    [CHEMS.lipids, 6],
    [CHEMS.proteins, 6],
    [CHEMS.cellulose, 6],
    [CHEMS.lignin, 6],
    [CHEMS.cooked, 6],
    [CHEMS.ethanol, 2],
    [CHEMS.solanine, 6],
    [CHEMS.cucurbitacin, 6],
    [CHEMS.capsaicin, 6],
    [CHEMS.co2, 1],
  ];
}

/** The carbon ledger, as a lookup. */
export const CARBON: ReadonlyArray<readonly [ChemId, number]> = CARBON_COUNTS();

/** Which lock each energy-bearing substrate presents. Anything absent here has no lock:
 *  glucose is already open, which is exactly why every genome in the world competes for
 *  it and why unlocking something else is worth spending ATP on. */
export const SUBSTRATE_LOCKS: ReadonlyArray<readonly [ChemId, Lock]> = [
  [CHEMS.starch, LOCKS.starch],
  [CHEMS.cooked, LOCKS.cooked],
  [CHEMS.cellulose, LOCKS.cellulose],
  [CHEMS.lipids, LOCKS.lipids],
  [CHEMS.proteins, LOCKS.proteins],
  [CHEMS.lignin, LOCKS.lignin],
];

export const LOCK_OF = new Map(SUBSTRATE_LOCKS);

/** What the creature can sense and do. The lobe gene names which of these it wires, so
 *  the brain's shape stays a genetic fact rather than a hard-coded one. */
export const SENSES = ["foodLeft", "foodRight", "foodHere", "fuelLow"] as const;
export const ACTIONS = ["left", "right", "eat"] as const;
export type Sense = (typeof SENSES)[number];
export type Action = (typeof ACTIONS)[number];

export type ReceptorTarget =
  /** gates Hebbian consolidation — the binding that makes learning happen at all */
  | "learning"
  /** the opposite gate: weakens whatever fired recently */
  | "punishment"
  /** multiplies the learning rate without judging the outcome */
  | "plasticity"
  /** scales neural activation: stress and available energy both feed this */
  | "drive"
  /** dampens activation */
  | "malaise";

/** When an emitter fires relative to the action's outcome. Failure matters: walking into
 *  a wall has to be able to hurt, or nothing teaches the creature to stop. */
export type EmitWhen = "success" | "failure" | "always";

export type DecayGene = { kind: "decay"; chem: ChemId; halfLife: number };
export type ReactionGene = { kind: "reaction"; reaction: Reaction };
/** An enzyme: a reaction whose rate is gated by how much of the substrate's lock these
 *  keys actually fit, and which costs ATP to run. See digestion.ts. */
export type EnzymeGene = { kind: "enzyme"; reaction: Reaction; keys: Keys };
/** an act's energy cost, as a conversion rather than a subtraction — so it can never
 *  spend currency the creature does not have */
export type CostGene = { kind: "cost"; onAction: Action; reaction: Reaction };
export type EndocrineGene = {
  kind: "endocrine";
  watches: ChemId;
  when: "above" | "below";
  threshold: number;
  secretes: ChemId;
  amount: number;
};
export type ReceptorGene = { kind: "receptor"; chem: ChemId; target: ReceptorTarget; gain: number };
/** THE ALGEDONIC CHANNEL for words. What is currently in mind provokes SECRETION, and
 *  from there the ordinary receptors do the ordinary work — a pneuma gets no direct line
 *  to the brain. A word that reaches your pain pole makes cortisol; cortisol binds
 *  punishment; consolidation runs negative on whatever you were just doing. Words move a
 *  creature the way weather does, through the same chemistry as everything else. */
/**
 * COMPETENCE — the ability to shed genetic material, and to take up what others shed.
 *
 * Not a switch between sexual and asexual. Sex and reproduction were separate processes
 * originally and still are in bacteria: they reproduce by fission and SEPARATELY swap DNA
 * by transformation, conjugation, transduction. So reproduction here stays mitotic
 * throughout, and what evolves is this side channel.
 *
 * `donate` is the rate of shedding a packet of one's own genes into the surroundings.
 * `uptake` is the rate of taking a stray packet up and integrating it. Neither alone does
 * anything interesting; together, across a population, they ARE recombination — and a
 * lineage that pays for both has invented sex without anything in the engine knowing the
 * word.
 *
 * Both cost ATP, which is the whole question sex poses: shuffling is not free, so it has
 * to earn its price against simply cloning. Selection gets to answer that rather than me.
 */
export type CompetenceGene = { kind: "competence"; donate: number; uptake: number };
export type PsycheGene = { kind: "psyche"; when: "pleasant" | "unpleasant"; secretes: ChemId; amount: number };
/** AN INNATE, MEANINGLESS TOKEN.
 *
 *  The same trick as a toxin: a molecule is arbitrary until a receptor makes it mean
 *  something, and a word is arbitrary until experience wires it. So a genome supplies
 *  vocabulary the way it supplies solanine — a randomised pattern with no meaning of its
 *  own, which an individual then learns to hook to its neurotransmitters. Birdsong
 *  templates and phoneme inventories arrive this way in the real thing.
 *
 *  The token here is genuinely arbitrary: mutation may replace it wholesale, and nothing
 *  breaks, because nothing ever read it for content. */
export type VocabularyGene = { kind: "vocabulary"; token: string };
/** How far this mind walks before meaning fades — a genetic projection of the semantic
 *  space. Short reads coarse, long reads fine, over the very same edges. */
export type ResolutionGene = { kind: "resolution"; horizon: number };
export type EmitterGene = { kind: "emitter"; onAction: Action; when: EmitWhen; chem: ChemId; amount: number };
export type LobeGene = {
  kind: "lobe";
  senses: readonly Sense[];
  actions: readonly Action[];
  learnRate: number;
  traceDecay: number;
};

export type Gene =
  | DecayGene
  | ReactionGene
  | EnzymeGene
  | CostGene
  | EndocrineGene
  | ReceptorGene
  | PsycheGene
  | CompetenceGene
  | VocabularyGene
  | ResolutionGene
  | EmitterGene
  | LobeGene;

export type Genome = readonly Gene[];

const term = (chem: ChemId, coeff: number) => ({ chem, coeff });

/** The one hand-written genome.
 *
 *  Read it as a loop rather than a list. Food is swallowed as starch and digested slowly
 *  into glucose. Glycolysis splits glucose into pyruvate and a little ATP; respiration
 *  burns pyruvate with oxygen for a lot more, breathing out CO2 — so energy depends on
 *  the world's air, not only on the creature's larder. Low glucose secretes cortisol,
 *  which raises drive AND catalyses lipids and proteins back into glucose, so a hungry
 *  creature both forages and burns its reserves. Eating floods dopamine and acetylcholine
 *  at once: dopamine opens the learning gate, acetylcholine widens it, and whatever fired
 *  just beforehand gets consolidated. High glucose secretes insulin, which banks the
 *  surplus as lipids, and serotonin, which quiets the drive until the fuel burns down.
 *
 *  Nothing here mentions hunger, because hunger is not a substance. It is what low
 *  glucose feels like from inside the loop. */
export const WILD_TYPE: Genome = [
  { kind: "lobe", senses: SENSES, actions: ACTIONS, learnRate: 0.22, traceDecay: 0.7 },

  // ── the energy path ────────────────────────────────────────────────────────
  {
    // Amylase. The animal's own lock-picking, on the easiest lock there is: starch sits
    // in a single motif, so one key opens all of it cheaply. An animal that lost this
    // gene would starve surrounded by fruit.
    kind: "enzyme",
    keys: keysFor(LOCKS.starch),
    reaction: { slug: "amylase", reactants: [term(CHEMS.starch, 1)], products: [term(CHEMS.glucose, 1)], rate: 0.05 },
  },
  {
    // Protease. Opens the nitrogen half of the diet, which this animal had no way into at
    // all: it carried `proteolysis` and no route to a single unit of protein, so the gene
    // had never once fired in the history of this world.
    //
    // The food was already lying there. A plant cannot open its own protein either, so it
    // egests what it builds — 3.065 on the ground across 24 patches, six of them over the
    // forage threshold, untouched because nothing in the animal kingdom held a key.
    kind: "enzyme",
    keys: keysFor(LOCKS.proteins),
    reaction: {
      slug: "protease",
      reactants: [term(CHEMS.proteins, 1)],
      products: [term(CHEMS.glucose, 1), term(CHEMS.ammonia, 1)],
      rate: 0.04,
    },
  },
  // AND NOT THE WAY BACK UP, which is the harder half and is not here. `protein-synthesis`
  // (glucose + ammonia -> proteins, rate 0.02) was written, measured and taken out, because
  // it and the protease together dismantle the claim this project rests on:
  //
  //                      wild   knockout   gap
  //    neither           0.949     0.431  0.518
  //    protease only     0.958     0.496  0.462
  //    synthesis only    0.973     0.531  0.442
  //    both              0.989     0.798  0.191
  //
  // Neither gene alone costs much. Together they cost almost everything, because together
  // they are a CYCLE: the protease turns protein into glucose and ammonia, synthesis turns
  // glucose and ammonia back into protein. That is a buffer, and a buffered creature does not
  // need to learn — it survives its own bad decisions. A learning knockout goes from hopeless
  // at 0.431 to nearly competent at 0.798 with no ability to consolidate anything.
  //
  // Which is a real finding about reserves rather than a bug: resilience is what makes
  // reward-driven learning optional, and this world is built to insist that behaviour comes
  // from reward chemistry. So an animal here still has no anatomy, bodies are still not worth
  // preying on, and buying either would cost the thesis. That trade wants a person, not me.
  {
    kind: "reaction",
    reaction: {
      slug: "glycolysis",
      reactants: [term(CHEMS.glucose, 1), term(CHEMS.adp, 2)],
      products: [term(CHEMS.pyruvate, 2), term(CHEMS.atp, 2)],
      rate: 0.3,
    },
  },
  {
    // Krebs plus the electron transport chain, lumped: the yield is what matters at this
    // resolution, and splitting them would add species without adding behaviour.
    kind: "reaction",
    reaction: {
      slug: "respiration",
      reactants: [term(CHEMS.pyruvate, 1), term(CHEMS.o2, 3), term(CHEMS.adp, 14)],
      products: [term(CHEMS.co2, 3), term(CHEMS.atp, 14)],
      rate: 0.32,
    },
  },

  // ── storage, and the two ways back out of it ───────────────────────────────
  {
    kind: "reaction",
    reaction: {
      slug: "lipogenesis",
      reactants: [term(CHEMS.glucose, 1)],
      products: [term(CHEMS.lipids, 1)],
      catalysts: [CHEMS.insulin],
      rate: 0.22,
    },
  },
  {
    kind: "reaction",
    reaction: {
      slug: "lipolysis",
      reactants: [term(CHEMS.lipids, 1)],
      products: [term(CHEMS.glucose, 1)],
      catalysts: [CHEMS.cortisol],
      rate: 0.18,
    },
  },
  {
    kind: "reaction",
    reaction: {
      slug: "proteolysis",
      reactants: [term(CHEMS.proteins, 1)],
      // burning protein for sugar frees its nitrogen, which has to go somewhere — this is
      // why starving animals excrete nitrogen and why the balance check insists on it
      products: [term(CHEMS.glucose, 1), term(CHEMS.ammonia, 1)],
      catalysts: [CHEMS.cortisol],
      rate: 0.03,
    },
  },

  // ── every act spends currency, and spending makes the ADP respiration needs ──
  {
    kind: "cost",
    onAction: "left",
    reaction: { slug: "cost:left", reactants: [term(CHEMS.atp, 1)], products: [term(CHEMS.adp, 1)], rate: 0.06 },
  },
  {
    kind: "cost",
    onAction: "right",
    reaction: { slug: "cost:right", reactants: [term(CHEMS.atp, 1)], products: [term(CHEMS.adp, 1)], rate: 0.06 },
  },
  {
    kind: "cost",
    onAction: "eat",
    reaction: { slug: "cost:eat", reactants: [term(CHEMS.atp, 1)], products: [term(CHEMS.adp, 1)], rate: 0.04 },
  },

  // ── the signals fade at their own speeds; that spread IS the endocrine timescale ──
  { kind: "decay", chem: CHEMS.dopamine, halfLife: 0.4 },
  { kind: "decay", chem: CHEMS.acetylcholine, halfLife: 0.55 },
  { kind: "decay", chem: CHEMS.adrenaline, halfLife: 0.7 },
  { kind: "decay", chem: CHEMS.insulin, halfLife: 0.8 },
  { kind: "decay", chem: CHEMS.cortisol, halfLife: 0.92 },
  { kind: "decay", chem: CHEMS.serotonin, halfLife: 0.88 },

  // ── the glands ─────────────────────────────────────────────────────────────
  { kind: "endocrine", watches: CHEMS.glucose, when: "below", threshold: 0.4, secretes: CHEMS.cortisol, amount: 0.14 },
  { kind: "endocrine", watches: CHEMS.glucose, when: "above", threshold: 0.7, secretes: CHEMS.insulin, amount: 0.16 },
  { kind: "endocrine", watches: CHEMS.glucose, when: "above", threshold: 0.55, secretes: CHEMS.serotonin, amount: 0.12 },
  // air hunger: CO2 buildup, not oxygen lack, is what makes a body panic
  { kind: "endocrine", watches: CHEMS.co2, when: "above", threshold: 0.6, secretes: CHEMS.adrenaline, amount: 0.1 },

  // ── what the brain reads the soup for ──────────────────────────────────────
  { kind: "receptor", chem: CHEMS.dopamine, target: "learning", gain: 1.0 },
  { kind: "receptor", chem: CHEMS.acetylcholine, target: "plasticity", gain: 0.8 },
  { kind: "receptor", chem: CHEMS.cortisol, target: "drive", gain: 0.8 },
  { kind: "receptor", chem: CHEMS.adrenaline, target: "drive", gain: 0.5 },
  // capacity, not motivation: a creature out of ATP cannot act however much it wants to
  { kind: "receptor", chem: CHEMS.atp, target: "drive", gain: 0.5 },
  { kind: "receptor", chem: CHEMS.cortisol, target: "punishment", gain: 0.1 },
  { kind: "receptor", chem: CHEMS.serotonin, target: "malaise", gain: 0.5 },
  { kind: "receptor", chem: CHEMS.co2, target: "malaise", gain: 0.3 },

  // ── what words do to a body ────────────────────────────────────────────────
  { kind: "psyche", when: "unpleasant", secretes: CHEMS.cortisol, amount: 0.5 },
  { kind: "psyche", when: "pleasant", secretes: CHEMS.dopamine, amount: 0.45 },

  // ── what doing things does to the soup ─────────────────────────────────────
  //
  // SIGNALS ONLY. Emitters here secrete hormones, which a body genuinely makes out of
  // almost nothing; they must never mint MATTER. An earlier version had eating emit
  // starch and protein — honest while food arrived by fiat, fraud the moment the animal
  // was placed in a real ecosystem, where it took a mouthful from the patch AND conjured
  // a second one from nowhere. Total world carbon went from 102 to 15,020 in 900 ticks.
  // Where food actually comes from is the world's business, not the genome's.
  { kind: "emitter", onAction: "eat", when: "success", chem: CHEMS.dopamine, amount: 1.0 },
  { kind: "emitter", onAction: "eat", when: "success", chem: CHEMS.acetylcholine, amount: 0.5 },
  { kind: "emitter", onAction: "eat", when: "failure", chem: CHEMS.adrenaline, amount: 0.12 },
  { kind: "emitter", onAction: "left", when: "failure", chem: CHEMS.adrenaline, amount: 0.3 },
  { kind: "emitter", onAction: "right", when: "failure", chem: CHEMS.adrenaline, amount: 0.3 },
];

/** A DETRITIVORE — a bug. The same animal, plus one key.
 *
 *  Everything here is WILD_TYPE: the same brain, the same glycolysis and respiration, the
 *  same hormones, the same actions. The only addition is a cellulase, and that single gene
 *  moves it into a trophic level the world did not previously have. Litter was the largest
 *  standing pool in this ecosystem and nothing with a mouth could touch it; fungi worked it
 *  slowly and everything else waited.
 *
 *  Measured over 20,000 ticks against a wild grazer, five seeds each:
 *
 *                        grazer      bug
 *    alive at t20000         21       86
 *    meals               13,932   46,251
 *    standing litter      1057.6      0.4
 *
 *  Four times the population, and the litter pool goes to nothing. It is worth being clear
 *  about what made this WRITABLE: `#forage` used to read CHEMS.starch by name, in both the
 *  senses and the mouth, so an animal ate starch because the ecology said so and no genome
 *  could describe one that ate anything else. Once the diet came from accessibility instead,
 *  this genome was four lines and no change to the ecology at all.
 *
 *  What it still lacks is anything that eats IT. `#forage`'s grazing branch iterates
 *  `this.plants`, so a bug is food for nothing — see the note there. */
export const DETRITIVORE: Genome = [
  ...WILD_TYPE,
  {
    kind: "enzyme",
    keys: keysFor(LOCKS.cellulose),
    reaction: {
      slug: "bug-cellulase",
      reactants: [term(CHEMS.cellulose, 1)],
      products: [term(CHEMS.glucose, 1)],
      rate: 0.25,
    },
  },
];


export function lobeGene(genome: Genome): LobeGene {
  const gene = genome.find((g): g is LobeGene => g.kind === "lobe");
  if (!gene) throw new Error("genome expresses no lobe: this creature has no brain to run");
  return gene;
}

export function receptorsFor(genome: Genome, target: ReceptorTarget): ReceptorGene[] {
  return genome.filter((g): g is ReceptorGene => g.kind === "receptor" && g.target === target);
}

/**
 * CROSSOVER. Two flat gene lists become one, gene by gene.
 *
 * The flatness that has carried this whole design pays again here: because every layer
 * lives in one list, a single crossover reshuffles chemistry, endocrine wiring, digestion
 * keys and brain shape together. A child can inherit its mother's ligninase and its
 * father's cortisol threshold, and nothing had to be taught how to combine them.
 *
 * Lists of unequal length keep the longer tail — a gene the other parent lacks is not a
 * reason to lose it.
 */
export function crossover(a: Genome, b: Genome, stream: Stream): Genome {
  const shared = Math.min(a.length, b.length);
  const child: Gene[] = [];
  for (let i = 0; i < shared; i++) child.push(stream.next() < 0.5 ? a[i] : b[i]);
  const longer = a.length > b.length ? a : b;
  for (let i = shared; i < longer.length; i++) child.push(longer[i]);
  return child;
}

/** A shed packet: some of an organism's genes, with the slots they came from. Loose in
 *  the world, going nowhere on its own — the naked DNA of transformation. */
export interface Packet {
  genes: Array<{ index: number; gene: Gene }>;
  /** packets perish; genetic material outside a body does not keep */
  age: number;
}

/** Shed a fragment. A haploid donation in the only sense this model can mean it: part of
 *  a genome, not a whole one, offered without any partner in view. */
export function shed(genome: Genome, stream: Stream, share = 0.25): Packet {
  const genes: Packet["genes"] = [];
  for (let i = 0; i < genome.length; i++) {
    if (stream.next() < share) genes.push({ index: i, gene: genome[i] });
  }
  return { genes, age: 0 };
}

/**
 * Take up a packet and integrate it, slot by slot.
 *
 * Integration only lands where the KINDS agree — a receptor gene can replace a receptor
 * gene and cannot replace a lobe. That is not a safety rail bolted on; it is what makes
 * the result a viable organism instead of a corpse, and it is why real transformation
 * needs homology too.
 */
export function recombine(genome: Genome, packet: Packet, stream: Stream): Genome {
  const next = [...genome];
  for (const { index, gene } of packet.genes) {
    if (index >= next.length) continue;
    if (next[index].kind !== gene.kind) continue;
    if (stream.next() < 0.6) next[index] = gene;
  }
  return next;
}

export function competenceOf(genome: Genome): { donate: number; uptake: number } {
  const gene = genome.find((g): g is CompetenceGene => g.kind === "competence");
  return { donate: gene?.donate ?? 0, uptake: gene?.uptake ?? 0 };
}

export function reactionsOf(genome: Genome): Reaction[] {
  return genome
    .filter((g): g is ReactionGene | CostGene | EnzymeGene =>
      g.kind === "reaction" || g.kind === "cost" || g.kind === "enzyme")
    .map((g) => g.reaction);
}

/** Perturbs numeric parameters through the mutation port. Structural mutation — adding or
 *  dropping whole genes — belongs to breeding, which v0 does not have; this much already
 *  shows one stroke reaching every layer, since the list holds all of them.
 *
 *  Stoichiometric COEFFICIENTS are deliberately left alone: perturbing them by a random
 *  float would unbalance the conserved moieties, and `assertBalanced` would then refuse
 *  the child at birth. Coefficient mutation needs whole-number steps and a rebalance,
 *  which belongs with breeding. */
export function mutate(genome: Genome, stream: Stream, strength = 0.1): Genome {
  const jitter = () => 1 + (stream.next() * 2 - 1) * strength;
  return genome.map((gene): Gene => {
    switch (gene.kind) {
      case "decay":
        return { ...gene, halfLife: Math.min(0.999, gene.halfLife * jitter()) };
      case "reaction":
      case "cost":
        return { ...gene, reaction: { ...gene.reaction, rate: gene.reaction.rate * jitter() } };
      case "enzyme":
        // Keys drift as well as rate: this is the gene-space search that lets a lineage
        // creep into a lock it could not previously open. Clamped to [0,1] — a key that
        // fits a motif more than completely means nothing.
        return {
          ...gene,
          reaction: { ...gene.reaction, rate: gene.reaction.rate * jitter() },
          keys: gene.keys.map((k) => Math.min(1, Math.max(0, k + (stream.next() * 2 - 1) * strength))),
        };
      case "endocrine":
        return { ...gene, threshold: gene.threshold * jitter(), amount: gene.amount * jitter() };
      case "receptor":
        return { ...gene, gain: gene.gain * jitter() };
      case "psyche":
        return { ...gene, amount: gene.amount * jitter() };
      case "competence":
        return {
          ...gene,
          donate: Math.max(0, gene.donate * jitter()),
          uptake: Math.max(0, gene.uptake * jitter()),
        };
      case "vocabulary":
        // a mutated token is simply a DIFFERENT arbitrary token. Nothing downstream reads
        // it for content, so nothing downstream notices anything but the change of
        // identity — which is what makes a vocabulary heritable and meaningless at once.
        return stream.next() < strength ? { ...gene, token: `w${Math.floor(stream.next() * 1e6)}` } : gene;
      case "resolution":
        return { ...gene, horizon: Math.max(1, Math.round(gene.horizon * jitter())) };
      case "emitter":
        return { ...gene, amount: gene.amount * jitter() };
      case "lobe":
        return { ...gene, learnRate: gene.learnRate * jitter(), traceDecay: Math.min(0.999, gene.traceDecay * jitter()) };
    }
  });
}
