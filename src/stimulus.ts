// WHERE SYMBOLS COME FROM.
//
// The pneuma layer as first built was the END STATE of language: tokens whose meaning is
// nothing but their relations, arbitrary all the way down. True of a mature vocabulary and
// false of how one starts. Words do have some reference to begin with. They lose it.
//
// ── A SYMBOL IS A DIFFERENCE THAT GOT WITNESSED ──────────────────────────────
//
// Nothing here maintains a lexicon. A creature stands in a world that changes, and every
// tick it witnesses differences between how things were and how things are — Bateson's
// difference that makes a difference. Any of those can crystallise into a symbol. Almost
// all of them are noise: witnessed once, never again, gone. A few recur, get reinforced,
// and stay. So the vocabulary of a mind is a survival statistic, not a design.
//
// ── THE LADDER: ICON, INDEX, SYMBOL ──────────────────────────────────────────
//
// Peirce's three, and the model needs all three because they arise differently:
//
//   ICON   — resembles what it stands for. Onomatopoeia. The crucial property is not
//            "sounds like" but CONVERGENT MINTABILITY: an iconic sign derives its identity
//            from the stimulus, so two creatures who witness the same event coin the SAME
//            sign independently, having never met. That is why onomatopoeia rhymes across
//            unrelated languages and nothing else does.
//
//   INDEX  — caused by, or reliably beside, what it stands for. Chemical signalling is the
//            oldest case and this model already had it: a hormone is an index of the state
//            that secreted it, and a receptor is its reader. Signalling did not wait for
//            language; language arrived late to signalling.
//
//   SYMBOL — arbitrary, held only by convention, meaning purely differential. Coined from
//            a creature's own dice, so it can NEVER be independently reinvented. It has to
//            be transmitted or it dies with its inventor.
//
// ── AND HOW A WORD LOSES ITS GROUNDING ───────────────────────────────────────
//
// This part needed no mechanism at all, which is how I knew the earlier layer was right.
// Only tokens cross the air. So a creature that witnessed the event holds the sign AND the
// edges to what it was born from — it is grounded. A creature that merely heard the sign
// holds the token and no such edges: for them, the same sign is arbitrary from birth.
//
// Grounding is therefore FIRST-HAND, and bleaches in exactly one generation of hearsay.
// Everything a creature knows only by being told is arbitrary to it, and it cannot tell.

import type { ChemId } from "./chemistry.js";
import type { Stream } from "./dice.js";
import { Idiolect, pneuma, type PneumaId } from "./pneuma.js";

/** A channel a creature can witness: a chemical in itself or its surroundings, a sense
 *  reading, a proprioceptive fact. Channels are opaque; only their identity matters. */
export type Channel = string;

/** Something that changed, and which way. The unit a symbol can be born from. */
export interface Difference {
  channel: Channel;
  /** +1 rose, -1 fell */
  direction: 1 | -1;
}

/** How much a channel must move before it counts as having happened at all. */
export const NOTICEABLE = 0.15;

/** Everything that changed enough to notice, between then and now. */
export function witness(
  before: ReadonlyMap<Channel, number>,
  now: ReadonlyMap<Channel, number>,
  threshold = NOTICEABLE,
): Difference[] {
  const out: Difference[] = [];
  const channels = new Set([...before.keys(), ...now.keys()]);
  for (const channel of channels) {
    const delta = (now.get(channel) ?? 0) - (before.get(channel) ?? 0);
    if (Math.abs(delta) < threshold) continue;
    out.push({ channel, direction: delta > 0 ? 1 : -1 });
  }
  return out;
}

/** A stable, content-free identifier for a set of differences.
 *
 *  The output is a hash: nothing anywhere reads it back, and no code recovers a channel
 *  from a sign. It is opaque in exactly the way every other identifier here is opaque. What
 *  it is NOT is random — the same event yields the same sign, which is the entire
 *  difference between an icon and a symbol, and the only reason two strangers can coin the
 *  same word for thunder. */
export function icon(differences: readonly Difference[]): PneumaId {
  const key = differences
    .map((d) => `${d.channel}${d.direction > 0 ? "+" : "-"}`)
    .sort()
    .join("|");
  let h = 2166136261 >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return pneuma(`i${h.toString(36)}`);
}

/** A sign with no relation to anything: coined from a creature's own dice, so no other
 *  creature will ever mint it by chance. It survives only by being taught. */
export function arbitrarySign(stream: Stream): PneumaId {
  return pneuma(`s${Math.floor(stream.next() * 2176782336).toString(36)}`);
}

/** A channel identifier for a chemical — the oldest index there is. A hormone stands for
 *  the state that secreted it, and a receptor is a reader that predates every word. */
export const channelOf = (chem: ChemId): Channel => `c:${chem}`;
/** A channel for a sense reading. */
export const senseChannel = (name: string): Channel => `s:${name}`;

/**
 * A mind's vocabulary as a living population: signs get born from what happened, get
 * reinforced when they happen again, and perish when they do not.
 *
 * Held beside an Idiolect rather than inside it, because the Idiolect's job is meaning and
 * this one's job is survival. A sign that dies here takes its meaning with it.
 */
export class Vocabulary {
  /** how many times each sign has been witnessed */
  readonly witnessed = new Map<PneumaId, number>();
  /** signs this mind coined or witnessed FIRST-HAND, and therefore holds grounded */
  readonly grounded = new Set<PneumaId>();

  /**
   * Witness an event: coin its sign, tie it to the sensations it was made of, and count it.
   *
   * The grounding edges are the reference. They exist because this creature was there.
   */
  coin(idiolect: Idiolect, differences: readonly Difference[]): PneumaId | null {
    if (differences.length === 0) return null;
    const sign = icon(differences);
    this.witnessed.set(sign, (this.witnessed.get(sign) ?? 0) + 1);
    this.grounded.add(sign);

    // what it is a sign OF: the very sensations that constituted it
    for (const d of differences) {
      const part = pneuma(`${d.channel}${d.direction > 0 ? "+" : "-"}`);
      if (!idiolect.holds(sign, part)) idiolect.believe(sign, part);
    }
    return sign;
  }

  /** Take up a sign heard from somebody else. The token arrives; the grounding does not,
   *  because grounding is made of edges and edges do not travel. */
  overhear(sign: PneumaId): void {
    this.witnessed.set(sign, (this.witnessed.get(sign) ?? 0) + 1);
  }

  /** Does this creature know what the sign is a sign OF, or merely know the sign? */
  isGrounded(sign: PneumaId): boolean {
    return this.grounded.has(sign);
  }

  /** Signs witnessed at least `times`. Everything else is noise that has not proved
   *  otherwise. */
  established(times = 2): PneumaId[] {
    return [...this.witnessed.entries()].filter(([, n]) => n >= times).map(([sign]) => sign);
  }

  /**
   * FORGETTING. A sign witnessed once and never again was a coincidence, and a mind that
   * kept every coincidence would drown in them. Most coined signs die here — which is the
   * point, since the ones that survive did so by recurring, and recurrence is the only
   * evidence available that a difference made a difference.
   */
  forget(idiolect: Idiolect, keepAbove = 1): number {
    let dropped = 0;
    for (const [sign, count] of [...this.witnessed.entries()]) {
      if (count > keepAbove) continue;
      // an established meaning keeps a sign alive even if the world stopped showing it —
      // words outlive their occasions
      if (idiolect.chargeOf(sign) !== 0) continue;
      this.witnessed.delete(sign);
      this.grounded.delete(sign);
      dropped++;
    }
    return dropped;
  }
}
