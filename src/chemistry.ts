// The soup. Chemicals carry concentrations and half-lives and nothing else — a chemical
// means whatever the genome wires around it, never what its name looks like.
//
// ChemId stays opaque on purpose (scher's opaque-slug law): splitting or matching an id
// to recover meaning smuggles substance into a name. Read a chemical's role from the
// genes that mention it, the way you read a reading from its prehensions.

declare const CHEM: unique symbol;
export type ChemId = string & { readonly [CHEM]: true };

/** Mints an id. The string serves as a label for humans and as nothing else. */
export const chem = (label: string): ChemId => label as ChemId;

/** Concentrations, keyed by id. Dense arrays would be faster; the muslin measured this
 *  layer at ~0.008 ms/tick per creature, so legibility wins until it stops winning. */
export class Soup {
  readonly #conc = new Map<ChemId, number>();

  constructor(initial: ReadonlyArray<readonly [ChemId, number]> = []) {
    for (const [id, v] of initial) this.#conc.set(id, v);
  }

  get(id: ChemId): number {
    return this.#conc.get(id) ?? 0;
  }

  /** Concentrations clamp at zero: a negative amount of a chemical means nothing. */
  add(id: ChemId, delta: number): void {
    this.#conc.set(id, Math.max(0, this.get(id) + delta));
  }

  set(id: ChemId, value: number): void {
    this.#conc.set(id, Math.max(0, value));
  }

  ids(): ChemId[] {
    return [...this.#conc.keys()];
  }

  snapshot(): Record<string, number> {
    return Object.fromEntries(this.#conc);
  }

  clone(): Soup {
    return new Soup([...this.#conc.entries()]);
  }
}

/** Moves matter between soups without creating or destroying any.
 *
 *  Every crossing in this model goes through here — a plant drawing CO2 from the air, a
 *  fungus absorbing sugar from the litter, a corpse falling to the ground. The amount is
 *  capped at what the source actually holds, for the same reason reactions run to an
 *  extent: taking more than exists would clamp, and clamping is how the first draft of
 *  this simulation invented energy. Returns what actually moved. */
export function transfer(from: Soup, to: Soup, id: ChemId, amount: number): number {
  const moved = Math.min(Math.max(0, amount), from.get(id));
  if (moved <= 0) return 0;
  from.add(id, -moved);
  to.add(id, moved);
  return moved;
}
