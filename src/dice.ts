// Named dice. Every draw marks a boundary of the model rather than hiding one: a
// mutation draw stands in for cosmic rays, a diffusion draw for thermodynamics, a
// tiebreak for the sub-threshold neural weather nobody simulates.
//
// One stream per port, never one global generator. A shared stream smears the ports
// together — consume an extra draw in mutation and every downstream "unrelated" roll
// shifts, which gives spooky action between systems meant to stay separately unmodeled.
//
// Separate streams also buy counterfactuals as an instrument: hold every stream fixed
// but one, replay, and "bad genes or bad weather?" becomes an experiment.

/** The ports where this model admits it stops modeling. Adding a port here declares a
 *  new such boundary; removing one means something real now covers that ground. */
export const PORTS = ["mutation", "diffusion", "tiebreak", "spawn"] as const;
export type Port = (typeof PORTS)[number];

export interface Stream {
  /** Uniform in [0, 1). */
  next(): number;
  /** How many draws this port has taken — a life's cost at this boundary, countable. */
  drawn(): number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derives a port's seed from the world seed and the port's name, so ports stay
 *  independent and a world reproduces from one number. */
function seedFor(worldSeed: number, port: Port): number {
  let h = worldSeed >>> 0;
  for (let i = 0; i < port.length; i++) h = (Math.imul(h ^ port.charCodeAt(i), 0x01000193) >>> 0);
  return h;
}

export class Dice {
  readonly #streams = new Map<Port, { gen: () => number; count: number }>();

  constructor(readonly worldSeed: number) {
    for (const port of PORTS) {
      this.#streams.set(port, { gen: mulberry32(seedFor(worldSeed, port)), count: 0 });
    }
  }

  at(port: Port): Stream {
    const s = this.#streams.get(port)!;
    return {
      next: () => {
        s.count++;
        return s.gen();
      },
      drawn: () => s.count,
    };
  }

  /** Draws taken per port. A creature's whole life reduces to
   *  (genome, world seed, these counts, interventions). */
  ledger(): Record<Port, number> {
    const out = {} as Record<Port, number>;
    for (const port of PORTS) out[port] = this.#streams.get(port)!.count;
    return out;
  }
}
