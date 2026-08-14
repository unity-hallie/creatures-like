// Where symbols come from, and how they lose their grounding.
//
// The pneuma layer as first built was the END STATE of language — arbitrary tokens whose
// meaning is nothing but relations. True of a mature vocabulary, false of how one starts.
// These tests build the ladder underneath it: icon, index, symbol.

import { test, expect } from "vitest";
import { Dice } from "../src/dice.js";
import { Idiolect, census, pneuma, think, converse } from "../src/pneuma.js";
import { arbitrarySign, channelOf, icon, senseChannel, Vocabulary, witness } from "../src/stimulus.js";
import { CHEMS } from "../src/genome.js";

const die = (seed = 4) => new Dice(seed).at("mutation");

const before = new Map([
  [channelOf(CHEMS.cortisol), 0.1],
  [senseChannel("foodHere"), 0],
  [senseChannel("loud"), 0],
]);
const thunder = new Map([
  [channelOf(CHEMS.cortisol), 0.9],
  [senseChannel("foodHere"), 0],
  [senseChannel("loud"), 1],
]);

test("a symbol is a difference that got witnessed", () => {
  const seen = witness(before, thunder);
  // only what actually moved: the unchanged channel contributes nothing
  expect(seen.map((d) => d.channel).sort()).toEqual([channelOf(CHEMS.cortisol), senseChannel("loud")]);
  expect(witness(before, before)).toEqual([]);
});

test("two strangers witnessing the same event coin the same sign", () => {
  // ICONICITY, and the property that actually matters about it. Neither has met the other;
  // neither has any lexicon. The sign is the same because it derives from the event.
  const alice = new Idiolect();
  const bob = new Idiolect();
  const aliceWords = new Vocabulary();
  const bobWords = new Vocabulary();

  const a = aliceWords.coin(alice, witness(before, thunder));
  const b = bobWords.coin(bob, witness(before, thunder));

  expect(a).toBe(b);
  expect(a).not.toBeNull();
  // this is why onomatopoeia rhymes across unrelated languages and nothing else does
});

test("an arbitrary sign can never be reinvented, only taught", () => {
  const mine = arbitrarySign(die(1));
  const yours = arbitrarySign(die(2));
  expect(mine).not.toBe(yours);
  // and it stands for nothing at all until something wires it
  expect(new Idiolect().chargeOf(mine)).toBe(0);
});

test("a sign is a sign OF the sensations it was made from", () => {
  const mind = new Idiolect();
  const vocab = new Vocabulary();
  const sign = vocab.coin(mind, witness(before, thunder))!;

  // reference, as edges: the sign evokes the very differences that constituted it
  expect(mind.evokes(sign).length).toBe(2);
  expect(vocab.isGrounded(sign)).toBe(true);
});

test("most coined signs are noise and die; recurrence is the only evidence there is", () => {
  const mind = new Idiolect();
  const vocab = new Vocabulary();
  const rng = die(9);

  // a hundred one-off flickers, and one event that keeps happening
  for (let i = 0; i < 100; i++) {
    const noise = new Map([[senseChannel(`ch${i}`), 1]]);
    vocab.coin(mind, witness(new Map(), noise));
  }
  for (let i = 0; i < 5; i++) vocab.coin(mind, witness(before, thunder));

  expect(vocab.witnessed.size).toBeGreaterThan(100);
  vocab.forget(mind);
  const survivors = vocab.established(2);
  expect(survivors.length).toBe(1);
  expect(survivors[0]).toBe(icon(witness(before, thunder)));
  void rng;
});

test("a meaning keeps a sign alive after the world stops showing it", () => {
  const mind = new Idiolect();
  const vocab = new Vocabulary();
  const rng = die(3);
  const sign = vocab.coin(mind, witness(before, thunder))!;
  for (let i = 0; i < 40; i++) mind.associate([sign], -1, rng);

  vocab.forget(mind);
  // witnessed exactly once, and it stays: words outlive their occasions
  expect(vocab.witnessed.has(sign)).toBe(true);
});

test("grounding is first-hand, and bleaches in one generation of hearsay", () => {
  // THE PAYOFF, and it needed no new mechanism. Only tokens cross the air, so the witness
  // holds the sign AND what it is a sign of, while the hearer holds the sign alone.
  const rng = die(5);
  const witnessMind = new Idiolect();
  const witnessVocab = new Vocabulary();
  const sign = witnessVocab.coin(witnessMind, witness(before, thunder))!;
  for (let i = 0; i < 40; i++) witnessMind.associate([sign], -1, rng);

  const hearerMind = new Idiolect();
  const hearerVocab = new Vocabulary();
  const scare = pneuma("scare");
  for (let i = 0; i < 40; i++) hearerMind.associate([scare], -1, rng);
  for (let i = 0; i < 40; i++) converse(witnessMind, think(witnessMind, [sign]), hearerMind, [scare], rng);
  hearerVocab.overhear(sign);

  // both fear the word; only one of them knows what it is about
  expect(witnessMind.chargeOf(sign)).toBeLessThan(0);
  expect(hearerMind.chargeOf(sign)).toBeLessThan(0);
  expect(witnessVocab.isGrounded(sign)).toBe(true);
  expect(hearerVocab.isGrounded(sign)).toBe(false);
  expect(hearerMind.evokes(sign)).not.toContain(pneuma(`${channelOf(CHEMS.cortisol)}+`));
});

test("a population can share a word that only some of them have grounds for", () => {
  const rng = die(13);
  const population = Array.from({ length: 8 }, () => new Idiolect());
  const vocabs = population.map(() => new Vocabulary());
  const seen = witness(before, thunder);

  // three were there; five only heard about it
  population.forEach((mind, i) => {
    if (i < 3) vocabs[i].coin(mind, seen);
    for (let n = 0; n < 40; n++) mind.associate([icon(seen)], -1, rng);
  });

  const reading = census(population, icon(seen));
  expect(reading.held).toBe(8);
  expect(vocabs.filter((v) => v.isGrounded(icon(seen))).length).toBe(3);
});
