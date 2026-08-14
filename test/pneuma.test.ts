// Pneumae: words that live in a creature, move it, and pass to other creatures.
//
// The first test is the load-bearing one. If meaning is stored anywhere in a pneuma —
// a label, a valence, a vector — then permuting every identifier in the lexicon would
// change behaviour. It does not. Meaning is the graph and nothing else.

import { test, expect } from "vitest";
import { Dice } from "../src/dice.js";
import { census, converse, hear, Idiolect, feeling, pneuma, prevalence, think, utter, type PneumaId } from "../src/pneuma.js";
import { Organism } from "../src/organism.js";
import { CHEMS, WILD_TYPE } from "../src/genome.js";
import { bind } from "../src/brain.js";

const WORDS = ["snake", "grass", "fruit", "dark", "warm", "kin"].map(pneuma);
const [SNAKE, GRASS, FRUIT, DARK, WARM, KIN] = WORDS;

function stream(seed = 7) {
  return new Dice(seed).at("mutation");
}

test("a word connected to nothing is worth nothing", () => {
  const mind = new Idiolect();
  // not neutral by decree — empty because there is no path, which is the same fact
  expect(mind.chargeOf(SNAKE)).toBe(0);
});

test("meaning is the graph: permute every identifier and nothing moves", () => {
  // Build a mind, then build the SAME mind with every word renamed to an opaque token.
  // If any behaviour differs, something is reading a name.
  const build = (w: Record<string, PneumaId>) => {
    const mind = new Idiolect({ pleasure: w.good, pain: w.bad });
    mind.believe(w.snake, w.dark);
    mind.believe(w.dark, w.bad);
    mind.believe(w.fruit, w.warm);
    mind.believe(w.warm, w.good);
    return mind;
  };

  const named = build({
    snake: SNAKE,
    dark: DARK,
    fruit: FRUIT,
    warm: WARM,
    good: pneuma("pole:pleasure"),
    bad: pneuma("pole:pain"),
  });
  const scrambled = build({
    snake: pneuma("x91"),
    dark: pneuma("x44"),
    fruit: pneuma("x02"),
    warm: pneuma("x77"),
    good: pneuma("x13"),
    bad: pneuma("x58"),
  });

  expect(scrambled.chargeOf(pneuma("x91"))).toBe(named.chargeOf(SNAKE));
  expect(scrambled.chargeOf(pneuma("x02"))).toBe(named.chargeOf(FRUIT));
  expect(scrambled.evoke(pneuma("x91")).length).toBe(named.evoke(SNAKE).length);

  // and the charges are real, not merely equal
  expect(named.chargeOf(SNAKE)).toBeLessThan(0);
  expect(named.chargeOf(FRUIT)).toBeGreaterThan(0);
});

test("nearer counts for more: a word beside the pole outweighs one three hops away", () => {
  const mind = new Idiolect();
  mind.believe(SNAKE, mind.poles.pain);
  mind.believe(DARK, GRASS);
  mind.believe(GRASS, WARM);
  mind.believe(WARM, mind.poles.pain);

  expect(mind.chargeOf(SNAKE)).toBeLessThan(mind.chargeOf(DARK));
  expect(mind.chargeOf(DARK)).toBeLessThan(0);
});

test("a word learns its meaning by standing in mind while something was at stake", () => {
  const mind = new Idiolect();
  const die = stream();
  expect(mind.chargeOf(SNAKE)).toBe(0);

  // heard while frightened, repeatedly — nothing declares the word frightening
  for (let i = 0; i < 12; i++) mind.associate([SNAKE, DARK], -1, die);

  expect(mind.chargeOf(SNAKE)).toBeLessThan(0);
});

test("and it can learn the other way just as well", () => {
  const mind = new Idiolect();
  const die = stream(11);
  for (let i = 0; i < 12; i++) mind.associate([FRUIT, WARM], 1, die);
  expect(mind.chargeOf(FRUIT)).toBeGreaterThan(0);
});

test("a word reaches the body only through hormones", () => {
  const mind = new Idiolect();
  mind.believe(SNAKE, mind.poles.pain);

  const creature = new Organism({ genome: WILD_TYPE });
  const before = creature.soup.get(CHEMS.cortisol);
  creature.feel(feeling(mind, think(mind, [SNAKE])));

  expect(creature.soup.get(CHEMS.cortisol)).toBeGreaterThan(before);
  // and from there the ordinary receptors do the ordinary work: the punishment channel
  // cannot tell a frightening thought from an empty stomach, because in a body it is the
  // same substance
  expect(bind(creature.expressed, creature.soup).punishment).toBeGreaterThan(0);
});

test("speaking costs the speaker nothing, and sends nothing but a token", () => {
  const elder = new Idiolect();
  elder.believe(SNAKE, elder.poles.pain);
  const held = elder.utterances().length;

  const said = utter(elder, think(elder, [SNAKE]), stream());

  // matter is conserved; meaning is not. And what crossed was an identifier, not a graph.
  expect(elder.utterances().length).toBe(held);
  expect(said).toBe(SNAKE);
  expect(typeof said).toBe("string");
});

test("a warning teaches nothing to a hearer with no charged words to hear it beside", () => {
  // The elder has learned the hard way. The child has an empty mind and a calm afternoon.
  // The token lands, gets tied to nothing that matters, and means nothing.
  const die = stream(3);
  const elder = new Idiolect();
  for (let i = 0; i < 12; i++) elder.associate([SNAKE], -1, die);

  const innocent = new Idiolect();
  for (let i = 0; i < 20; i++) converse(elder, think(elder, [SNAKE]), innocent, [GRASS], die);

  expect(innocent.chargeOf(SNAKE)).toBe(0);
});

test("but it teaches a hearer who already fears something to say it beside", () => {
  // Testimony works through vocabulary the hearer ALREADY holds. The child fears DARK on
  // its own account; hearing SNAKE beside DARK is what does the work — and the meaning
  // the child ends up with is one the child built, out of the child's own graph.
  const die = stream(5);
  const elder = new Idiolect();
  for (let i = 0; i < 12; i++) elder.associate([SNAKE], -1, die);

  // Enough repetitions that the result does not hang on a lucky window of the stream.
  // An earlier version used 14 and happened to open on a run of seventeen draws above
  // the threshold — the die is sound (mean 0.4990, longest high run 17 in 20,000, which
  // is what log2(20000) predicts), the test was simply knife-edge.
  const child = new Idiolect();
  for (let i = 0; i < 40; i++) child.associate([DARK], -1, die);
  expect(child.chargeOf(SNAKE)).toBe(0);

  for (let i = 0; i < 40; i++) converse(elder, think(elder, [SNAKE]), child, [DARK], die);

  expect(child.chargeOf(SNAKE)).toBeLessThan(0);
});

test("two creatures can use one word for a lifetime and never mean the same thing", () => {
  // The structural lossiness, made explicit. Same token, same conversations, opposite
  // charge — because each built its meaning from its own context and neither can check.
  const die = stream(19);
  const speaker = new Idiolect();
  for (let i = 0; i < 12; i++) speaker.associate([KIN], -1, die);

  const optimist = new Idiolect();
  for (let i = 0; i < 14; i++) optimist.associate([WARM], 1, die);
  for (let i = 0; i < 24; i++) converse(speaker, think(speaker, [KIN]), optimist, [WARM], die);

  expect(speaker.chargeOf(KIN)).toBeLessThan(0);
  expect(optimist.chargeOf(KIN)).toBeGreaterThan(0);
  // neither has any way to discover the disagreement: nothing but the token ever crossed
});

test("the token survives its own meaning", () => {
  // SEMANTIC DRIFT with no drift parameter anywhere. Each hearer rebuilds the word from
  // their own context, so meaning moves down a chain of speakers by ordinary transmission
  // — while the word looks, to everyone involved, like the same word.
  const die = stream(23);
  const source = new Idiolect();
  for (let i = 0; i < 12; i++) source.associate([KIN], -1, die);

  let current = source;
  const contexts = [[DARK], [GRASS], [WARM], [FRUIT], [WARM], [FRUIT]];
  for (const context of contexts) {
    const next = new Idiolect();
    for (let i = 0; i < 10; i++) next.associate(context, 1, die);
    for (let i = 0; i < 20; i++) converse(current, think(current, [KIN]), next, context, die);
    current = next;
  }

  expect(source.chargeOf(KIN)).toBeLessThan(0);
  expect(current.chargeOf(KIN)).toBeGreaterThan(0);
  expect(KIN).toBe(pneuma("kin"));
});

// ─── the genome move, one layer up ───────────────────────────────────────────

test("an innate token means nothing until something wires it", () => {
  // The toxin trick applied to language: a genome supplies vocabulary the way it supplies
  // solanine — an arbitrary pattern with no meaning of its own.
  const speaker = new Organism({
    genome: [...WILD_TYPE, { kind: "vocabulary", token: "w4417" }, { kind: "resolution", horizon: 4 }],
  });
  const innate = speaker.expressed.vocabulary.map(pneuma);
  expect(innate.length).toBe(1);

  const mind = new Idiolect(undefined, speaker.expressed.horizon);
  expect(mind.chargeOf(innate[0])).toBe(0);

  // die hoisted out of the loop: a fresh Dice per iteration would redraw the same first
  // value thirty times, which is a deterministic seed behaving exactly as promised
  const die = stream(2);
  for (let i = 0; i < 30; i++) mind.associate([innate[0]], -1, die);
  expect(mind.chargeOf(innate[0])).toBeLessThan(0);
});

test("a gene sets how coarsely a mind reads the very same graph", () => {
  // The relational stand-in for PCA: no coordinates anywhere, just how far the walk goes.
  const build = (horizon: number) => {
    const mind = new Idiolect(undefined, horizon);
    mind.believe(SNAKE, DARK);
    mind.believe(DARK, GRASS);
    mind.believe(GRASS, WARM);
    mind.believe(WARM, mind.poles.pain);
    return mind;
  };

  const nearsighted = build(2);
  const farsighted = build(6);

  // identical edges, different reach: the far-walker feels a threat the near one cannot
  expect(nearsighted.chargeOf(SNAKE)).toBe(0);
  expect(farsighted.chargeOf(SNAKE)).toBeLessThan(0);
});

test("a word is a distribution across idiolects, with no canonical copy", () => {
  // The allele move. There is no master meaning of KIN anywhere — only many copies of its
  // associative self, one per mind, none authoritative.
  const die = stream(31);
  const population = Array.from({ length: 12 }, () => new Idiolect());

  // half learn it beside something they fear, half beside something they like
  population.forEach((mind, i) => {
    const context = i % 2 === 0 ? DARK : WARM;
    for (let n = 0; n < 40; n++) mind.associate([context], i % 2 === 0 ? -1 : 1, die);
    for (let n = 0; n < 30; n++) mind.associate([KIN, context], i % 2 === 0 ? -1 : 1, die);
  });

  const reading = census(population, KIN);
  expect(reading.held).toBe(12);
  expect(reading.charged).toBeGreaterThan(0);
  // a split population: the word is common and contested, which variance reports and no
  // single meaning could
  expect(reading.variance).toBeGreaterThan(0);
  expect(prevalence(population, KIN)).toBe(1);

  // and a word nobody has heard has no population-level existence at all
  expect(prevalence(population, pneuma("unspoken"))).toBe(0);
});
