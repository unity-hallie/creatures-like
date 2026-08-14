// PLACES — a world with somewhere else in it.
//
// Until now the model had one place wearing a row of patches, and one global atmosphere
// stirred by a fixed rate. That rate, not the biology, decided what the air held: oxygen
// came out at 25.0 in every run because 25.0 was a property of the plumbing. A place needs
// to be somewhere you can leave, with its own air, its own weather, and its own reasons.
//
// ── PRESSURE, AND WHY IT REPLACES STIRRING ───────────────────────────────────
//
// Each place holds its own air in its own volume at its own temperature, so P = nT/V (the
// gas constant folded into the model's units). Gas crosses a route down the pressure
// gradient, carrying species in proportion to what is actually there. Nothing equalises
// by fiat: two places reach the same pressure because gas moved, and they can sit at
// different pressures indefinitely if something keeps driving them apart.
//
// That last part is weather. Heat a place and its pressure rises with no change in mass —
// air leaves. Cool it and air returns. Run that on a day-night cycle with places out of
// phase and you get wind that reverses; run it beside a fire and the fire makes its own
// draught. Both fall out of one equation rather than out of a weather subsystem.
//
// ── CONSERVATION STILL HOLDS ─────────────────────────────────────────────────
//
// Every gram that crosses a route goes through `transfer`, and every migrating organism
// carries its whole soup with it. Carbon and nitrogen are summed across all places, and
// the totals do not move — through wind, migration, fire and death alike.

import { transfer, type ChemId, type Soup } from "./chemistry.js";
import { Ecosystem } from "./ecology.js";
import { CARBON, CHEMS, NITROGEN } from "./genome.js";
import { Dice } from "./dice.js";

/** A way between two places. Conductance is how freely air moves; cost is what a body
 *  spends to walk it. A mountain pass is low conductance and high cost; an open plain is
 *  high conductance and cheap. */
export interface Route {
  from: number;
  to: number;
  /** fraction of the pressure difference resolved per tick */
  conductance: number;
  /** ATP a migrating organism spends to cross */
  cost: number;
}

export interface GeographyOptions {
  places: Ecosystem[];
  routes: Route[];
  seed?: number;
  /** ticks in a day. Weather runs on this. */
  dayLength?: number;
  /** days in a year. Seasons run on this. */
  yearLength?: number;
  /** how hard the seasons bite at latitude 1 */
  seasonality?: number;
  /** how far temperature swings between noon and midnight */
  swing?: number;
}

/** The gases. Solids stay in patches and exert no pressure — which is exactly why the
 *  model keeps them in different containers. */
const GASES: ChemId[] = [CHEMS.o2, CHEMS.co2, CHEMS.n2];

/** How much a burning patch heats the air above it. Fire making its own draught is not a
 *  special effect here; it is the same equation as the sun. */
const HEAT_PER_FIRE = 9;
/** How fast a place slides back toward its own baseline. */
const COOLING = 0.12;

export class Geography {
  readonly places: Ecosystem[];
  readonly routes: Route[];
  readonly dice: Dice;
  readonly dayLength: number;
  readonly yearLength: number;
  readonly seasonality: number;
  readonly swing: number;

  tick = 0;
  migrations = 0;

  constructor(opts: GeographyOptions) {
    this.places = opts.places;
    this.routes = opts.routes;
    this.dice = new Dice(opts.seed ?? 1);
    this.dayLength = opts.dayLength ?? 120;
    this.yearLength = opts.yearLength ?? 8;
    this.seasonality = opts.seasonality ?? 0.7;
    this.swing = opts.swing ?? 14;
  }

  /** Neighbours of a place, with the route that reaches them. */
  routesFrom(index: number): Array<{ route: Route; other: number }> {
    const out: Array<{ route: Route; other: number }> = [];
    for (const route of this.routes) {
      if (route.from === index) out.push({ route, other: route.to });
      else if (route.to === index) out.push({ route, other: route.from });
    }
    return out;
  }

  /** Where in the day this place stands: 0 at dawn, 1 at the next dawn. Places sit at
   *  different hours, which is the whole reason air has anywhere to go. */
  dayPhase(index: number): number {
    const offset = index / Math.max(1, this.places.length);
    return ((this.tick / this.dayLength + offset) % 1 + 1) % 1;
  }

  /** Where in the year the world stands. Shared — one world, one season, felt differently
   *  depending where you are standing. */
  yearPhase(): number {
    return ((this.tick / (this.dayLength * this.yearLength)) % 1 + 1) % 1;
  }

  /** Sunlight reaching a place right now. Zero at night, which is the point: a plant in
   *  the dark lives off what it stored, and storage finally has a job. */
  insolation(index: number): number {
    const place = this.places[index];
    const day = Math.max(0, Math.sin(this.dayPhase(index) * Math.PI * 2));
    const season = 1 + this.seasonality * place.latitude * Math.sin(this.yearPhase() * Math.PI * 2);
    return place.baseLight * day * Math.max(0, season);
  }

  /**
   * WEATHER. Sunlight warms, night cools, fire adds its own heat, and every place slides
   * back toward its baseline. Places sit at different hours of the day, which is what
   * gives air anywhere to go — a world in uniform daylight has no wind.
   */
  #weather(): void {
    for (let i = 0; i < this.places.length; i++) {
      const place = this.places[i];
      place.light = this.insolation(i);
      const fires = place.patches.filter((p) => p.burning > 0).length;
      // warmth tracks the sun it actually received, plus whatever is on fire
      const solar = (place.baseLight > 0 ? place.light / place.baseLight : 0) * this.swing;
      const target = place.baseTemperature + solar - this.swing / 2 + fires * HEAT_PER_FIRE;
      place.temperature += (target - place.temperature) * COOLING;
    }
  }

  /**
   * WIND. Gas crosses a route down the pressure gradient, carrying each species in
   * proportion to its share of the air it leaves. Nothing here equalises anything by
   * decree — it moves gas, and equality is what happens when it stops having a reason to.
   */
  #wind(): void {
    for (const route of this.routes) {
      const a = this.places[route.from];
      const b = this.places[route.to];
      const gradient = a.pressure() - b.pressure();
      if (gradient === 0) continue;

      const [source, sink] = gradient > 0 ? [a, b] : [b, a];
      const moles = source.moles();
      if (moles <= 0) continue;

      // how much air moves: enough to resolve part of the difference, expressed as a
      // fraction of the source's contents
      const share = Math.min(0.5, (Math.abs(gradient) * route.conductance * source.volume) / (moles * source.temperature));
      for (const gas of GASES) {
        transfer(source.air, sink.air, gas, source.air.get(gas) * share);
      }
    }
  }

  /**
   * MIGRATION. A hungry grazer with somewhere better to go, goes — and pays for it.
   *
   * "Better" is read from the place it can reach, not from a plan: more fruit on the
   * ground than here. The cost is ATP, so a starving animal may be unable to afford the
   * journey that would save it, which is the honest shape of that trap.
   */
  #migrate(): void {
    const stream = this.dice.at("spawn");
    for (let i = 0; i < this.places.length; i++) {
      const here = this.places[i];
      const fruitHere = fruitOf(here);

      for (let g = here.grazers.length - 1; g >= 0; g--) {
        const grazer = here.grazers[g];
        if (!grazer.organism.alive) continue;
        // content animals stay put
        if (grazer.organism.soup.get(CHEMS.glucose) > 0.35) continue;

        for (const { route, other } of this.routesFrom(i)) {
          const there = this.places[other];
          if (fruitOf(there) <= fruitHere) continue;
          if (grazer.organism.soup.get(CHEMS.atp) < route.cost) continue;
          if (stream.next() > 0.25) continue;

          // the journey costs currency, as a conversion — adenine stays conserved
          grazer.organism.soup.add(CHEMS.atp, -route.cost);
          grazer.organism.soup.add(CHEMS.adp, route.cost);

          here.grazers.splice(g, 1);
          grazer.at = Math.min(grazer.at, there.patches.length - 1);
          there.grazers.push(grazer);
          this.migrations++;
          break;
        }
      }
    }
  }

  step(): void {
    // weather first: a place should meet the day it is actually having
    this.#weather();
    for (const place of this.places) place.step();
    this.#wind();
    this.#migrate();
    this.tick++;
  }

  #sum(ledger: ReadonlyArray<readonly [ChemId, number]>): number {
    let total = 0;
    const count = (soup: Soup) => {
      for (const [id, per] of ledger) total += soup.get(id) * per;
    };
    for (const place of this.places) {
      count(place.air);
      for (const patch of place.patches) count(patch.soup);
      for (const r of [...place.plants, ...place.fungi, ...place.grazers]) count(r.organism.soup);
    }
    return total;
  }

  /** Every carbon atom in the world, wherever it is and whatever it is doing. */
  totalCarbon(): number {
    return this.#sum(CARBON);
  }

  totalNitrogen(): number {
    return this.#sum(NITROGEN);
  }

  /** Where the wind currently blows, as signed flow along each route. Useful for looking
   *  at, which the model still needs more of. */
  winds(): Array<{ route: Route; gradient: number }> {
    return this.routes.map((route) => ({
      route,
      gradient: this.places[route.from].pressure() - this.places[route.to].pressure(),
    }));
  }
}

function fruitOf(place: Ecosystem): number {
  return place.patches.reduce((acc, p) => acc + p.soup.get(CHEMS.starch), 0);
}
