// THE TRAINING WORLD — small, live, and driven a tick at a time.
//
// The run viewer scrubs a tape: frames twenty seconds apart, already written. Training
// cannot work that way. Reward lands on whatever fired recently and the eligibility trace
// decays at 0.7, so the credit window is three or four ticks — under a second of world
// time. A tape has no "now" to press a button in.
//
// So this owns a LIVE ecosystem and steps it on request. Small on purpose: one place, a
// handful of creatures, enough food to make choices meaningful and not enough to make them
// free.
//
// Every intervention is logged at a named port, like a die. A trained creature's life is
// still `(genome, seeds, interventions)`, so it replays exactly — which is what keeps
// "did my training do that?" an experiment instead of a story.

import { Ecosystem } from "../src/ecology.js";
import { GRASS, SAPROPHYTE } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";
import { bind } from "../src/brain.js";
import { Idiolect, feeling, pneuma, think, hear, type PneumaId } from "../src/pneuma.js";
import { Dice } from "../src/dice.js";
import type { CreatureView } from "./scene.js";

const CHEM_LABEL = Object.fromEntries(Object.entries(CHEMS).map(([k, v]) => [v as string, k]));

export class TrainingWorld {
  readonly eco: Ecosystem;
  /** one mind per creature. The ecosystem has no language wired into it yet, so the
   *  trainer owns the idiolects — which is honest rather than tidy: saying a word to a
   *  creature is currently something the trainer does, not something the world does. */
  readonly minds = new Map<string, Idiolect>();
  readonly verdicts = new Map<string, number[]>();
  readonly dice: Dice;

  constructor(seed = 7) {
    this.dice = new Dice(seed);
    this.eco = new Ecosystem({
      seed,
      name: "pen",
      width: 12,
      // A POOR pen, deliberately. Ten plants across twelve patches restocked the ground
      // faster than one grazer could strip it, so eating succeeded 199 times in 200 ticks
      // and every scrap of credit sat on EAT. Scarcity is what makes a choice a choice, and
      // this is scenario design rather than tuning physics — the pen is a room I built, not
      // a law I bent.
      plants: 3,
      fungi: 6,
      grazers: 4,
      plantGenome: GRASS,
      fungusGenome: SAPROPHYTE,
      soilAmmonia: 0.8,
    });
  }

  ids(): string[] {
    return this.eco.grazers.map((g) => g.organism.id);
  }

  step(n = 1): void {
    for (let i = 0; i < n; i++) {
      this.eco.step();
      // record the gate over time, so a trainer can see whether they hit the window
      for (const g of this.eco.grazers) {
        const b = bind(g.organism.expressed, g.organism.soup);
        const series = this.verdicts.get(g.organism.id) ?? [];
        series.push(b.learning - b.punishment);
        if (series.length > 240) series.shift();
        this.verdicts.set(g.organism.id, series);
      }
    }
  }

  mindOf(id: string): Idiolect {
    let mind = this.minds.get(id);
    if (!mind) {
      mind = new Idiolect();
      this.minds.set(id, mind);
    }
    return mind;
  }

  /**
   * Speak a word to a creature.
   *
   * The token crosses; the meaning does not. It binds to whatever the creature had in mind,
   * under its own feeling about the moment — so saying "food" while it is frightened
   * teaches it that "food" is frightening, and it will not tell you.
   */
  say(id: string, token: string): boolean {
    const grazer = this.eco.grazers.find((g) => g.organism.id === id);
    if (!grazer || !grazer.organism.alive) return false;
    const mind = this.mindOf(id);
    // its present context: the senses that are actually firing, as words
    const sensed = this.eco.senseOf(grazer);
    const context = grazer.lobe.senses.filter((_, i) => sensed[i] > 0.5).map((s) => pneuma(`sense:${s}`));
    hear(mind, pneuma(token), context, this.dice.at("tiebreak"));
    // and a word in mind moves the body only through hormones
    grazer.organism.feel(feeling(mind, think(mind, [pneuma(token), ...context])));
    this.eco.intervene(id, "say", 1, token);
    return true;
  }

  view(id: string): CreatureView | null {
    const grazer = this.eco.grazers.find((g) => g.organism.id === id);
    if (!grazer) return null;
    const organism = grazer.organism;
    const sensed = this.eco.senseOf(grazer);
    const mind = this.minds.get(id);
    const active: PneumaId[] = mind
      ? think(mind, grazer.lobe.senses.filter((_, i) => sensed[i] > 0.5).map((s) => pneuma(`sense:${s}`)))
      : [];

    const soup: Record<string, number> = {};
    for (const chemId of organism.soup.ids()) {
      soup[CHEM_LABEL[chemId] ?? chemId] = organism.soup.get(chemId);
    }

    return {
      id,
      tick: this.eco.tick,
      place: this.eco.name,
      at: grazer.at,
      alive: organism.alive,
      age: organism.age,
      soup,
      binding: bind(organism.expressed, organism.soup),
      // the lobe names its own senses, derived from the sense genes it was wired from —
      // so a creature with a different nose shows different rows here without any edit
      senses: grazer.lobe.senses.map((name, i) => ({ name, value: sensed[i] ?? 0 })),
      actions: [...grazer.lobe.actions],
      weights: grazer.lobe.weights.map((row) => [...row]),
      traces: grazer.lobe.traces.map((row) => [...row]),
      recent: (grazer.recent ?? []).map((r) => ({ ...r })),
      mind: active.map((token) => ({
        token: String(token),
        charge: mind ? mind.chargeOf(token) : 0,
        grounded: true,
      })),
      meals: grazer.meals,
    };
  }

  /** Reward, punish, feed. `say` has its own door because it needs the idiolect. */
  hand(kind: "reward" | "punish" | "feed", target: string, amount: number): boolean {
    return this.eco.intervene(target, kind, amount);
  }
}
