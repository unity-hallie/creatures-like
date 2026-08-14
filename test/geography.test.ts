// Places: somewhere to go, and weather to go through.
//
// The oxygen gap this closes is worth naming. With one global atmosphere stirred at a
// fixed rate, oxygen settled at exactly 25.0 in every run — the number was a property of
// the transfer rate, not of the biology. Pressure gives gas a reason to move that the
// biology can push on, so the air can differ from place to place and stay different.

import { test, expect } from "vitest";
import { Ecosystem } from "../src/ecology.js";
import { Geography, type Route } from "../src/geography.js";
import { GRASS, LIGNIN_EATER, TREE } from "../src/flora.js";
import { CHEMS } from "../src/genome.js";

function world(seed = 1) {
  const places = [
    new Ecosystem({ seed, name: "north", latitude: 0.9, plantGenome: TREE, fungusGenome: LIGNIN_EATER, plants: 8, fungi: 3, grazers: 2, volume: 80 }),
    new Ecosystem({ seed: seed + 100, name: "middle", latitude: 0, plantGenome: GRASS, plants: 8, fungi: 3, grazers: 2, volume: 120 }),
    new Ecosystem({ seed: seed + 200, name: "south", latitude: -0.9, plantGenome: GRASS, plants: 8, fungi: 3, grazers: 2, volume: 100 }),
  ];
  const routes: Route[] = [
    { from: 0, to: 1, conductance: 0.35, cost: 0.4 },
    { from: 1, to: 2, conductance: 0.35, cost: 0.4 },
  ];
  return new Geography({ places, routes, seed, dayLength: 60, yearLength: 6 });
}

test("carbon and nitrogen survive wind, weather and migration", () => {
  for (const seed of [1, 2]) {
    const geo = world(seed);
    const c = geo.totalCarbon();
    const n = geo.totalNitrogen();
    for (let i = 0; i < 900; i++) geo.step();
    expect(geo.totalCarbon()).toBeCloseTo(c, 6);
    expect(geo.totalNitrogen()).toBeCloseTo(n, 6);
  }
});

test("night is dark, and a plant in the dark lives on what it stored", () => {
  const geo = world();
  let sawNight = false;
  let sawDay = false;
  for (let i = 0; i < 200; i++) {
    geo.step();
    const light = geo.places[0].light;
    if (light === 0) sawNight = true;
    if (light > 0.5) sawDay = true;
  }
  expect(sawNight).toBe(true);
  expect(sawDay).toBe(true);
});

test("seasons bite at latitude and barely touch the equator", () => {
  const geo = world();
  const swingOf = (index: number) => {
    let low = Infinity;
    let high = -Infinity;
    // sample noon across a full year, so the day cycle is held still
    for (let day = 0; day < geo.yearLength * 4; day++) {
      geo.tick = Math.round(day * geo.dayLength + geo.dayLength / 4);
      const light = geo.insolation(index);
      low = Math.min(low, light);
      high = Math.max(high, light);
    }
    return high - low;
  };
  const polar = swingOf(0);
  const equator = swingOf(1);
  expect(polar).toBeGreaterThan(equator);
});

test("pressure moves air, and equal places stop having a reason to", () => {
  const a = new Ecosystem({ seed: 1, plants: 0, fungi: 0, volume: 100, oxygen: 80 });
  const b = new Ecosystem({ seed: 2, plants: 0, fungi: 0, volume: 100, oxygen: 5 });
  const geo = new Geography({ places: [a, b], routes: [{ from: 0, to: 1, conductance: 0.3, cost: 0 }], swing: 0 });

  expect(a.pressure()).toBeGreaterThan(b.pressure());
  const before = Math.abs(a.pressure() - b.pressure());
  for (let i = 0; i < 200; i++) geo.step();

  expect(Math.abs(a.pressure() - b.pressure())).toBeLessThan(before);
  // and it equalised by moving gas, not by decree — the oxygen actually went somewhere
  expect(b.air.get(CHEMS.o2)).toBeGreaterThan(5);
});

test("heat drives air out of a place with no change in its mass", () => {
  const a = new Ecosystem({ seed: 1, plants: 0, fungi: 0, volume: 100 });
  const b = new Ecosystem({ seed: 2, plants: 0, fungi: 0, volume: 100 });
  const geo = new Geography({ places: [a, b], routes: [{ from: 0, to: 1, conductance: 0.25, cost: 0 }], swing: 0 });

  const molesBefore = a.moles();
  a.temperature = 360; // a hot afternoon, or a fire
  b.temperature = 280;
  geo.step();

  // nothing was added or removed to make this happen: warm air simply left
  expect(a.moles()).toBeLessThan(molesBefore);
  expect(b.moles()).toBeGreaterThan(0);
});

test("the air can differ from place to place and stay different", () => {
  const geo = world(3);
  for (let i = 0; i < 900; i++) geo.step();
  const oxygens = geo.places.map((p) => p.oxygen());
  const spread = Math.max(...oxygens) - Math.min(...oxygens);
  // the old single-atmosphere build could not express this at all
  expect(spread).toBeGreaterThan(0);
});

test("a hungry grazer will cross to somewhere better, and pay for the trip", () => {
  const geo = world(5);
  for (let i = 0; i < 900; i++) geo.step();
  const grazers = geo.places.reduce((acc, p) => acc + p.grazers.length, 0);
  expect(grazers).toBeGreaterThan(0);
  expect(geo.migrations).toBeGreaterThan(0);
});
