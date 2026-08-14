// Tools: sterile symbionts, built by hand, holding state outside the body.
//
// The claim these tests are for: a campfire cooks, cooking is decryption performed OUTSIDE
// the body, and a creature beside one therefore stops needing good enzymes of its own.

import { test, expect } from "vitest";
import { Soup } from "../src/chemistry.js";
import { Organism } from "../src/organism.js";
import { CHEMS, WILD_TYPE, type Genome } from "../src/genome.js";
import { CAMPFIRE_RECIPE, COOKED_EATER, construct, Tool, use } from "../src/tools.js";
import { accessibility, LOCKS, partialKeys } from "../src/digestion.js";

const carbon = (soups: Soup[]) =>
  soups.reduce(
    (total, s) =>
      total +
      [CHEMS.cellulose, CHEMS.lignin, CHEMS.proteins, CHEMS.cooked, CHEMS.glucose, CHEMS.starch, CHEMS.lipids].reduce(
        (a, c) => a + s.get(c) * 6,
        0,
      ) +
      s.get(CHEMS.co2),
    0,
  );

function builder() {
  return new Organism({ genome: WILD_TYPE, initial: [[CHEMS.atp, 4], [CHEMS.adp, 8]] });
}

function woodpile() {
  return new Soup([
    [CHEMS.cellulose, 4],
    [CHEMS.lignin, 2],
  ]);
}

test("a tool has to be built, out of real materials and real effort", () => {
  const maker = builder();
  const wood = woodpile();
  const atpBefore = maker.soup.get(CHEMS.atp);

  const fire = construct(CAMPFIRE_RECIPE, maker, wood, 0);

  expect(fire).not.toBeNull();
  expect(maker.soup.get(CHEMS.atp)).toBeLessThan(atpBefore);
  expect(wood.get(CHEMS.cellulose)).toBeLessThan(4);
});

test("no wood, no fire — and no exception either", () => {
  expect(construct(CAMPFIRE_RECIPE, builder(), new Soup(), 0)).toBeNull();
  const exhausted = new Organism({ genome: WILD_TYPE, initial: [[CHEMS.adp, 8]] });
  expect(construct(CAMPFIRE_RECIPE, exhausted, woodpile(), 0)).toBeNull();
});

test("a tool is sterile: every one that ever existed was built by somebody", () => {
  const fire = construct(CAMPFIRE_RECIPE, builder(), woodpile(), 0)!;
  expect(() => fire.reproduce()).toThrow(/STERILE/);
});

test("cooking moves food from a hard lock to an easy one", () => {
  const fire = construct(CAMPFIRE_RECIPE, builder(), woodpile(), 0)!;
  const eater = new Organism({ genome: WILD_TYPE, initial: [[CHEMS.proteins, 2], [CHEMS.atp, 2], [CHEMS.adp, 8]] });

  use(fire, eater, [[CHEMS.proteins, 1.5]]);

  expect(eater.soup.get(CHEMS.cooked)).toBeGreaterThan(0);
  // the same carbon and nitrogen, behind a lock that needs almost no enzyme at all
  expect(accessibility(LOCKS.cooked, partialKeys(LOCKS.cooked, 1))).toBe(1);
});

test("a creature with a feeble protease eats well beside a fire and badly without one", () => {
  // NICHE CONSTRUCTION, with a receipt. The fire pays the bill the enzymes used to.
  const feeble: Genome = [
    ...WILD_TYPE,
    { kind: "enzyme", keys: partialKeys(LOCKS.proteins, 1), reaction: {
      slug: "poor-protease",
      reactants: [{ chem: CHEMS.proteins, coeff: 1 }],
      products: [{ chem: CHEMS.glucose, coeff: 1 }, { chem: CHEMS.ammonia, coeff: 1 }],
      rate: 0.3,
    } },
    COOKED_EATER,
  ];

  const alone = new Organism({ genome: feeble, initial: [[CHEMS.proteins, 3], [CHEMS.atp, 3], [CHEMS.adp, 9], [CHEMS.o2, 3]] });
  const beside = new Organism({ genome: feeble, initial: [[CHEMS.proteins, 3], [CHEMS.atp, 3], [CHEMS.adp, 9], [CHEMS.o2, 3]] });
  const fire = construct(CAMPFIRE_RECIPE, builder(), woodpile(), 0)!;

  for (let i = 0; i < 25; i++) {
    alone.metabolise();
    use(fire, beside, [[CHEMS.proteins, 0.4]]);
    beside.metabolise();
  }

  // its own enzyme opens barely a third of raw protein; the fire opens all of it
  expect(accessibility(LOCKS.proteins, partialKeys(LOCKS.proteins, 1))).toBeLessThan(0.4);
  expect(beside.soup.get(CHEMS.proteins)).toBeLessThan(alone.soup.get(CHEMS.proteins));
});

test("a tool is external state: it stays where it was left", () => {
  const fire = new Tool(CAMPFIRE_RECIPE, 3, undefined);
  expect(fire.at).toBe(3);
  fire.at = 7;
  expect(fire.at).toBe(7);
  // and it can stop working, which anatomy cannot be walked away from
  fire.intact = false;
  const eater = new Organism({ genome: WILD_TYPE, initial: [[CHEMS.proteins, 2]] });
  use(fire, eater, [[CHEMS.proteins, 1]]);
  expect(eater.soup.get(CHEMS.cooked)).toBe(0);
});

test("a fire can no more mint matter than a gut can", () => {
  const maker = builder();
  const wood = woodpile();
  const eater = new Organism({ genome: WILD_TYPE, initial: [[CHEMS.proteins, 2], [CHEMS.atp, 2], [CHEMS.adp, 8]] });
  const fire = construct(CAMPFIRE_RECIPE, maker, wood, 0)!;

  const soups = [maker.soup, wood, eater.soup, fire.organism.soup];
  const before = carbon(soups);
  for (let i = 0; i < 30; i++) use(fire, eater, [[CHEMS.proteins, 0.2]]);
  expect(carbon(soups)).toBeCloseTo(before, 6);
});
