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
import type { Action, Sense } from "./genome.js";

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

export class Lobe {
  readonly senses: readonly Sense[];
  readonly actions: readonly Action[];
  readonly #learnRate: number;
  readonly #traceDecay: number;
  /** weights[action][sense] */
  readonly weights: number[][];
  /** eligibility traces, same shape — what fired recently and still awaits a verdict */
  readonly traces: number[][];

  constructor(expressed: Expressed, spawn: Stream) {
    const gene = expressed.lobe;
    this.senses = gene.senses;
    this.actions = gene.actions;
    this.#learnRate = gene.learnRate;
    this.#traceDecay = gene.traceDecay;
    // Small seeded weights: a newborn holds opinions, just weak and arbitrary ones.
    this.weights = gene.actions.map(() => gene.senses.map(() => (spawn.next() * 2 - 1) * 0.05));
    this.traces = gene.actions.map(() => gene.senses.map(() => 0));
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
    if (verdict === 0) return;
    const gain = this.#learnRate * (1 + binding.plasticity) * verdict;
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
