// One small lobe, floating in the soup.
//
// The mechanism that matters, and the one clones usually drop: a synapse that fires
// leaves an eligibility trace, the trace fades, and consolidation happens only when a
// reward chemical binds the learning receptor. So the brain never learns on its own — the
// chemistry decides when learning happens, and the genome decides which chemical counts
// as reward. Cut the soup out and this degenerates into arbitrary weights.

import type { Soup } from "./chemistry.js";
import type { Stream } from "./dice.js";
import { readReceptors, type Expressed } from "./expression.js";
import { senseName, type Action, type Sense } from "./genome.js";

export interface Binding {
  /** consolidation gate — "that was good" */
  learning: number;
  /** the opposite gate — "that was bad" */
  punishment: number;
  /** learning-rate multiplier — "pay attention", regardless of good or bad */
  plasticity: number;
  /** activation scale — stress and energy both feed this */
  drive: number;
  /** dampener */
  malaise: number;
}

/** Reads the soup through the genome's receptors. Nothing here inspects a chemical's
 *  name: a chemical matters only where a gene points a receptor at it. Rename every
 *  chemical and this function behaves identically, which is the test of whether meaning
 *  lives in the wiring or in the label. */
export function bind(expressed: Expressed, soup: Soup): Binding {
  return {
    learning: readReceptors(expressed, "learning", soup),
    punishment: readReceptors(expressed, "punishment", soup),
    plasticity: readReceptors(expressed, "plasticity", soup),
    drive: readReceptors(expressed, "drive", soup),
    malaise: readReceptors(expressed, "malaise", soup),
  };
}

/** How fast expectation catches up with experience. Slow enough that a rare meal still
 *  reads as a surprise; fast enough that a persistent change stops being one. */
const BASELINE_RATE = 0.02;

export class Lobe {
  readonly senses: readonly Sense[];
  readonly actions: readonly Action[];
  readonly #learnRate: number;
  readonly #traceDecay: number;
  /** weights[action][sense] */
  readonly weights: number[][];
  /** eligibility traces, same shape — what fired recently and still awaits a verdict */
  readonly traces: number[][];
  /** A slow-moving baseline for the verdict: what this creature has come to expect.
   *
   *  Consolidation reads the verdict's PHASIC component — how far it departs from this —
   *  rather than its level, which is how dopamine actually works: a burst above tonic
   *  baseline carries the signal, and a steady level carries none.
   *
   *  Without it, an always-on signal swamps a rare one no matter how weak it is. Measured:
   *  `fuelLow` is nonzero on 99.97% of ticks, so cortisol sat at ~1.6 forever while
   *  dopamine stayed 0.000. The verdict was negative on 148 ticks of 150, every action was
   *  punished about equally, all three hit the weight clamp by tick 90, and activation went
   *  identical across actions — a three-way tie that no amount of drive could break. The
   *  creature had learned that being alive is bad, which is true and useless. */
  #baseline = 0;

  constructor(expressed: Expressed, spawn: Stream) {
    const gene = expressed.lobe;
    // Plants and fungi legitimately express no lobe; a thing being given a brain must
    // have the genes for one.
    if (!gene) throw new Error("genome expresses no lobe: this creature has no brain to run");
    // A brain is wired from the sense GENES this genome expresses, in their order — not from
    // a list of names on the lobe gene. Gaining, losing or retuning a sense is then an
    // ordinary mutation instead of an edit to a hardcoded enum, and a creature with no sense
    // genes has a brain that reads nothing, which is the honest result rather than a crash.
    this.senses = expressed.senses.map(senseName);
    this.actions = gene.actions;
    this.#learnRate = gene.learnRate;
    this.#traceDecay = gene.traceDecay;
    // Small seeded weights: a newborn holds opinions, just weak and arbitrary ones.
    //
    // ARBITRARY ON PURPOSE, and it costs something real, so here is the receipt. In the
    // ecosystem a grazer sensed food on 99 of its 118 ticks, walked at random, ate nothing,
    // and died with `left` and `right` 0.05 apart. Reward-gated learning cannot start where
    // the reward requires the behaviour: it must reach food to be taught to reach food.
    //
    // So I built the obvious fix — an `instinct` gene seeding these weights with an
    // inherited prior, mutable, reversible, Creatures had them. Swept its strength:
    //
    //   weight | early  late | knockout late | pop across 5 seeds
    //     0.00 | 0.74  0.95  |         0.43  | 1
    //     0.10 | 0.69  0.99  |         0.44  | 0
    //     0.35 | 0.92  0.76  |         0.75  | 1
    //     1.00 | 1.00  0.76  |         1.00  | 2
    //
    // Read the last column first: population never moves. Then read the third: by weight
    // 0.5 the learning knockout — a creature that CANNOT learn — scores as well as wild
    // type, because the reflex already decided everything and consolidation had nothing
    // left to contribute. `learning.test.ts` went red on exactly that, which is what it is
    // for. And above 0.2 the creature gets WORSE over its life (late < early): a prior
    // strong enough to help is strong enough to fight what experience is trying to write.
    //
    // The mechanism was sound and bought nothing, so it went back out. The instinct gene is
    // not the missing piece; something that limits the population is, and it is not the
    // food supply either (see test/bootstrap.test.ts). Build this again only with a
    // measurement showing the population move.
    this.weights = gene.actions.map(() => this.senses.map(() => (spawn.next() * 2 - 1) * 0.05));
    this.traces = gene.actions.map(() => this.senses.map(() => 0));
  }

  /** Picks an action, then marks every synapse that contributed to it. Selection reads
   *  softmax over activation, with the tiebreak port covering the neural weather this
   *  model does not simulate. */
  choose(sensed: ReadonlyArray<number>, binding: Binding, tiebreak: Stream): number {
    const scale = Math.max(0.05, binding.drive - binding.malaise);
    const activation = this.weights.map((row) => row.reduce((acc, w, s) => acc + w * sensed[s], 0) * scale);

    const hottest = Math.max(...activation);
    const exps = activation.map((a) => Math.exp((a - hottest) * 3));
    const total = exps.reduce((a, b) => a + b, 0);

    let roll = tiebreak.next() * total;
    let picked = exps.length - 1;
    for (let i = 0; i < exps.length; i++) {
      roll -= exps[i];
      if (roll <= 0) {
        picked = i;
        break;
      }
    }

    for (let a = 0; a < this.weights.length; a++) {
      for (let s = 0; s < this.senses.length; s++) {
        this.traces[a][s] *= this.#traceDecay;
        if (a === picked) this.traces[a][s] += sensed[s];
      }
    }
    return picked;
  }

  /** Consolidation. Runs only as far as the chemistry opens it — no dopamine in the soup,
   *  no learning, however hard the creature just tried. Punishment drives the same
   *  machinery negative, weakening whatever fired; acetylcholine widens the gate without
   *  judging which way it swings. */
  consolidate(binding: Binding): void {
    const verdict = binding.learning - binding.punishment;
    // what departs from expectation is what teaches; chronic anything teaches nothing
    const surprise = verdict - this.#baseline;
    this.#baseline += (verdict - this.#baseline) * BASELINE_RATE;
    if (surprise === 0) return;
    const gain = this.#learnRate * (1 + binding.plasticity) * surprise;
    for (let a = 0; a < this.weights.length; a++) {
      for (let s = 0; s < this.senses.length; s++) {
        const next = this.weights[a][s] + gain * this.traces[a][s];
        this.weights[a][s] = Math.max(-3, Math.min(3, next));
      }
    }
  }

  weightOf(action: Action, sense: Sense): number {
    return this.weights[this.actions.indexOf(action)][this.senses.indexOf(sense)];
  }
}
