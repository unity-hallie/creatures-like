// PNEUMAE — word-logos-spirits.
//
// A third kind of thing, after chemicals and genes. A pneuma is a word that lives in a
// creature, evokes other words, acts on the body through the algedonic channel, and
// passes to other creatures. Genes descend; pneumae spread sideways.
//
// ── THE ONE RULE: STORIED ENTIRELY RELATIONALLY ──────────────────────────────
//
// A pneuma has NO content. None. It carries no vector, no label that means anything, no
// stored valence. Its whole meaning consists of what it prehends and what prehends it —
// so to read what a word means you walk the graph, and there is nowhere else to look.
// "In language there are only differences without positive terms," which Saussure wrote
// about signs and which this file takes literally.
//
// The semantic space is LIMITED in the sense that matters: a finite set of individuated
// nodes. Not coordinates — coordinates would be positive terms, and distance between two
// pneumae here is graph distance, never vector distance. `test/pneuma.test.ts` proves the
// discipline by permuting every identifier in the lexicon and checking that behaviour does
// not move by a hair.
//
// ── WHAT MAKES THEM UNLIKE CHEMISTRY ─────────────────────────────────────────
//
// Everything else in this model conserves. Reactions run to an extent, moieties balance,
// and `transfer` moves matter without making any. Pneumae deliberately break that, and the
// break IS the point: a word given away is a word still held. Speaking costs the speaker
// nothing and leaves the hearer richer, which is precisely why memes travel differently
// from genes and why no moiety could ever be declared over them. Matter is conserved;
// meaning is not.
//
// ── HOW A WORD REACHES A BODY ────────────────────────────────────────────────
//
// Not by privilege. A pneuma gets no direct line to the brain — it acts by provoking
// SECRETION, and from there the ordinary receptors do the ordinary work. A word that
// reaches your pain pole makes cortisol, cortisol binds punishment, and consolidation
// runs negative on whatever you were just doing. Words move you the way weather does,
// through the same chemistry as everything else, which is the only way they could move you
// honestly.

import { Society } from "scher";
import type { Stream } from "./dice.js";

declare const PNEUMA: unique symbol;
export type PneumaId = string & { readonly [PNEUMA]: true };

/** Mints an identifier. The string labels it for a human reading a debugger and carries no
 *  weight whatsoever — see the permutation test. */
export const pneuma = (label: string): PneumaId => label as PneumaId;

/** The two designated poles. An idiolect's poles are ITS OWN: what hurts me is a fact
 *  about my graph, not about the word. */
export interface Poles {
  pleasure: PneumaId;
  pain: PneumaId;
}

export const DEFAULT_POLES: Poles = { pleasure: pneuma("pole:pleasure"), pain: pneuma("pole:pain") };

/** How much a moment has to matter before it leaves a word with a feeling attached, as
 *  opposed to mere company. */
const POLE_THRESHOLD = 0.25;

/** How far a walk will travel before giving up. Meaning fades with distance rather than
 *  stopping at a boundary; this only bounds the search. */
const HORIZON = 6;

/**
 * One creature's private graph of words: which pneumae it holds, what each evokes, and
 * where its own poles sit. Two creatures can hold the same token and mean different
 * things by it, because meaning consists of edges and their edges differ.
 */
export class Idiolect {
  readonly graph = new Society();
  readonly poles: Poles;
  #edges = 0;

  /** How far this mind walks before meaning fades out. A GENETIC parameter, and the
   *  cheapest honest projection of the semantic space: a short horizon reads the same
   *  graph coarsely — only close relations count, distinctions collapse — and a long one
   *  reads it finely. Nothing is stored differently; the same edges are simply read to a
   *  different depth, which keeps the projection relational rather than coordinate.
   *
   *  (The richer version is spectral: eigenvectors of the graph Laplacian, which is what
   *  PCA becomes when your space has no coordinates to begin with. Also derived at read
   *  time, never stored. Not built yet — this knob is the same idea at one dimension.) */
  readonly horizon: number;

  constructor(poles: Poles = DEFAULT_POLES, horizon = HORIZON) {
    this.poles = poles;
    this.horizon = horizon;
  }

  /** Lay a relation: hearing `from` brings `to` to mind. Direction matters and runs
   *  evoker → evoked. */
  believe(from: PneumaId, to: PneumaId): void {
    const slug = `e${this.#edges++}`;
    if (!this.graph.get(from)) this.graph.lay({ slug: from, content: "", subject: null, object: null });
    if (!this.graph.get(to)) this.graph.lay({ slug: to, content: "", subject: null, object: null });
    this.graph.lay({ slug, content: "", subject: from, object: to });
  }

  /** What this pneuma directly evokes. Read from the graph; nothing is parsed. */
  evokes(from: PneumaId): PneumaId[] {
    return this.graph.edgesFromSubject(from).map((e) => e.object as PneumaId);
  }

  /** Everything a word brings to mind, out to the horizon. The spreading activation that
   *  turns one word into a thought. */
  evoke(seed: PneumaId, horizon = this.horizon): PneumaId[] {
    const seen = new Set<string>([seed]);
    const out: PneumaId[] = [];
    let frontier: PneumaId[] = [seed];
    for (let depth = 0; depth < horizon && frontier.length > 0; depth++) {
      const next: PneumaId[] = [];
      for (const node of frontier) {
        for (const to of this.evokes(node)) {
          if (seen.has(to)) continue;
          seen.add(to);
          out.push(to);
          next.push(to);
        }
      }
      frontier = next;
    }
    return out;
  }

  /** Hops to a target, or Infinity. The only notion of semantic distance here, and it is
   *  entirely a property of the graph. */
  distanceTo(from: PneumaId, to: PneumaId): number {
    if (from === to) return 0;
    const seen = new Set<string>([from]);
    let frontier: PneumaId[] = [from];
    for (let depth = 1; depth <= this.horizon; depth++) {
      const next: PneumaId[] = [];
      for (const node of frontier) {
        for (const step of this.evokes(node)) {
          if (step === to) return depth;
          if (seen.has(step)) continue;
          seen.add(step);
          next.push(step);
        }
      }
      frontier = next;
      if (frontier.length === 0) break;
    }
    return Infinity;
  }

  /**
   * What a word is worth to this creature: positive if it reaches pleasure, negative if it
   * reaches pain, nearer counting for more. A word connected to nothing is worth nothing —
   * not neutral by decree, but empty because there is no path, which is the same fact.
   */
  chargeOf(word: PneumaId): number {
    const near = (pole: PneumaId) => {
      const d = this.distanceTo(word, pole);
      return d === Infinity ? 0 : 1 / (1 + d);
    };
    return near(this.poles.pleasure) - near(this.poles.pain);
  }

  /**
   * ASSOCIATION — the same rule as the synapse, one storey up.
   *
   * Words that stand in mind together get linked, and the link consolidates in proportion
   * to how much the moment mattered. Fire together, wire together, gated by whether
   * anything was at stake — which is exactly what the lobe does with dopamine, running
   * here over words instead of over sensory channels.
   *
   * The consequence worth noticing: THE POLE EDGES ARE LEARNED, not authored. Nothing
   * declares that a word is frightening. A word becomes frightening by standing in mind
   * while its holder was afraid, and it stops being frightening the same way. Meaning is
   * acquired, and acquired relationally, which is the only way it could be acquired in a
   * space with no positive terms.
   */
  associate(active: readonly PneumaId[], gate: number, stream: Stream, strength = 0.5): number {
    if (active.length === 0 || gate === 0) return 0;
    const weight = Math.min(1, Math.abs(gate)) * strength;
    let laid = 0;

    // co-occurrence: what stood together becomes what evokes the other
    for (const a of active) {
      for (const b of active) {
        if (a === b || this.holds(a, b)) continue;
        if (stream.next() < weight) {
          this.believe(a, b);
          laid++;
        }
      }
    }

    // and what it felt like — but only if it felt like anything. Below the threshold a
    // word still gathers company and gains no valence, which is how most vocabulary is
    // learned: an unremarkable afternoon teaches you what goes with what and leaves you
    // with no opinion about it.
    if (Math.abs(gate) < POLE_THRESHOLD) return laid;

    const pole = gate > 0 ? this.poles.pleasure : this.poles.pain;
    for (const word of active) {
      if (word === pole || this.holds(word, pole)) continue;
      if (stream.next() < weight) {
        this.believe(word, pole);
        laid++;
      }
    }
    return laid;
  }

  /** Every relation this creature holds, as portable pairs. What gets said. */
  utterances(): Array<readonly [PneumaId, PneumaId]> {
    return this.graph
      .all()
      .filter((e) => e.subject !== null && e.object !== null)
      .map((e) => [e.subject as PneumaId, e.object as PneumaId] as const);
  }

  /** Does this creature hold this relation already? */
  holds(from: PneumaId, to: PneumaId): boolean {
    return this.evokes(from).includes(to);
  }
}

/**
 * SPEECH — and the thing that makes it unlike every other transfer here.
 *
 * ONLY THE TOKEN CROSSES. A speaker cannot hand over what a word means to them; meaning
 * consists of edges, and edges live inside a mind. What leaves the mouth is a bare
 * identifier. The hearer then attaches it to whatever THEY happened to have in mind, and
 * the meaning they end up with is one they built themselves out of their own graph.
 *
 * So the lossiness is not noise sprinkled on for realism — it is structural, and
 * unavoidable. Two creatures can use one word confidently for a lifetime and never mean
 * the same thing by it, with no way for either to find out. Quine's field linguist
 * pointing at a rabbit; Wittgenstein's beetle nobody else can see in the box.
 *
 * It also explains how testimony actually works: an elder's warning teaches a child
 * nothing by itself. It teaches only if the child already holds charged words to hear it
 * beside. Vocabulary is inherited through vocabulary.
 */

/** What leaves the mouth: one token, drawn from what stands in the speaker's mind.
 *
 *  POLES CANNOT BE SAID. A pole is not vocabulary — it is the felt end a word may reach,
 *  and a creature has no word for its own pain any more than it has a word for the fact
 *  that it is the one in pain. Left sayable, a pole would cross the air and wire itself
 *  straight into the hearer's own pole, which is telepathy through a side door: agony
 *  transmitted rather than described. Everything a creature can say about how it feels, it
 *  has to say with ordinary words that merely reach there. */
export function utter(speaker: Idiolect, active: readonly PneumaId[], stream: Stream): PneumaId | null {
  const sayable = active.filter((w) => w !== speaker.poles.pleasure && w !== speaker.poles.pain);
  if (sayable.length === 0) return null;
  // the speaker says what weighs on them — the most charged thing in mind, most of the
  // time, and otherwise whatever surfaces
  const sorted = sayable.sort((a, b) => Math.abs(speaker.chargeOf(b)) - Math.abs(speaker.chargeOf(a)));
  const deliberate = stream.next() < 0.7;
  return deliberate ? sorted[0] : sorted[Math.floor(stream.next() * sorted.length)];
}

/**
 * Hearing: the token arrives, and the hearer binds it to their OWN present context, under
 * their OWN feeling about that context. Nothing of the speaker's graph comes with it.
 */
export function hear(
  hearer: Idiolect,
  token: PneumaId,
  context: readonly PneumaId[],
  stream: Stream,
  strength = 0.5,
): number {
  const heard = think(hearer, [token, ...context]);
  // the hearer's own verdict on the moment — not the speaker's
  const gate = feeling(hearer, heard);
  if (gate === 0) {
    // nothing at stake: the token still gets tied to what was around, just weakly, which
    // is how a word can be learned before it means anything much
    return hearer.associate([token, ...context], 0.15, stream, strength);
  }
  return hearer.associate([token, ...context], gate, stream, strength);
}

/** One creature speaks, another listens, in a shared moment. */
export function converse(
  speaker: Idiolect,
  speakerMind: readonly PneumaId[],
  hearer: Idiolect,
  hearerContext: readonly PneumaId[],
  stream: Stream,
): PneumaId | null {
  const said = utter(speaker, speakerMind, stream);
  if (said === null) return null;
  hear(hearer, said, hearerContext, stream);
  return said;
}

/**
 * A creature's whole pneumatic state this tick: which words currently stand active.
 *
 * Sense readings enter as words. That is the "sensory and proprioception into other words"
 * step, and it needs no separate mechanism: a sense is a pneuma like any other, and what
 * it means to the creature is whatever its idiolect connects it to.
 */
export function think(idiolect: Idiolect, sensed: readonly PneumaId[]): PneumaId[] {
  const active = new Set<PneumaId>(sensed);
  for (const seed of sensed) for (const evoked of idiolect.evoke(seed)) active.add(evoked);
  return [...active];
}

/** The felt weight of everything currently in mind. Positive lifts, negative hurts. */
export function feeling(idiolect: Idiolect, active: readonly PneumaId[]): number {
  return active.reduce((total, word) => total + idiolect.chargeOf(word), 0);
}


// ─────────────────────────────────────────────────────────────────────────────
// THE KOINE — a word as a population, not a thing.
//
// This is the genome move applied one layer up (Hallie, 2026-08-14). An allele has no
// canonical copy: it exists as a distribution over a population, and "the" allele is a
// statistical object. A pneuma is the same. There is no master copy of what a word means
// — only many copies of its associative self, one per idiolect, each slightly different,
// none authoritative.
//
// So the population-level reading of a word is a DISTRIBUTION, and the interesting
// quantities are the ones you would ask of an allele: how common, how varied, how fixed.
// Consensus here means low variance rather than agreement about content, because there is
// no content to agree about.
// ─────────────────────────────────────────────────────────────────────────────

export interface WordCensus {
  /** how many idiolects hold the word at all */
  held: number;
  /** how many give it any valence */
  charged: number;
  /** average charge among those that hold it */
  mean: number;
  /** spread of charge — LOW means the population agrees, which is the only sense in
   *  which a population can agree about a word */
  variance: number;
}

/** Read one word across a population. Nothing is aggregated into a canonical meaning;
 *  the distribution IS the word at this scale. */
export function census(population: readonly Idiolect[], word: PneumaId): WordCensus {
  const charges: number[] = [];
  let held = 0;
  for (const mind of population) {
    const has = mind.graph.get(word) !== undefined;
    if (!has) continue;
    held++;
    charges.push(mind.chargeOf(word));
  }
  const charged = charges.filter((c) => c !== 0).length;
  if (charges.length === 0) return { held, charged, mean: 0, variance: 0 };
  const mean = charges.reduce((a, b) => a + b, 0) / charges.length;
  const variance = charges.reduce((acc, c) => acc + (c - mean) ** 2, 0) / charges.length;
  return { held, charged, mean, variance };
}

/** How much of the population holds this word at all — an allele frequency, for a word. */
export function prevalence(population: readonly Idiolect[], word: PneumaId): number {
  return population.length === 0 ? 0 : census(population, word).held / population.length;
}
