# TODO-LIST-PEN — creatures-like

Sublimes prehend wishes; wishes prehend both the work and the Problems they resolve.

**Not yet laid into the graph** — written 2026-08-14 with no route to `:8014`. Once laid in,
this file becomes a reading of the graph, not a substitute.

Edges read subject-first, future → past (*the abiding thing is the subject*,
`charge-direction-inversion`). Wishes prehend their tasks — Hallie, 2026-08-14, agreeing
with the claim `penelope-planning` struck.

## Sublimes

- **`sublime-the-circuit`** — meaning as the loop through gene, soup, synapse.
- **`sublime-one-grammar`** — engine agrees with game: all layers as readings of one
  append-only substrate.
- **`sublime-honest-edges`** — the model marks where it stops modeling.

The first two may prehend each other (cycles hold lawful here; walks need visited-sets).
Three, not six — a sublime that's a feature in a trenchcoat falls out of the pleroma.

## The graph

```
sublime-the-circuit  ──▶ wish-first-learned-lesson ──▶ task-soup
                                                   ──▶ task-genome
                                                   ──▶ task-lobe
                                                   ──▶ task-viewer
                                                   ──▶ problem-genre-graveyard
                     ──▶ lure-the-hand

sublime-one-grammar  ──▶ wonder-tick-ceiling   ──▶ task-muslin-tick-ceiling   [DONE]
                                               ──▶ problem-faith-not-measurement [quiet]
                     ──▶ wish-perishing-holds  ──▶ task-gist-raster-window
                                               ──▶ problem-unbounded-soup-log [NEW]
                     ──▶ wish-lineage-readable ──▶ task-birth-prehends-parents

sublime-honest-edges ──▶ wish-named-dice       ──▶ task-port-streams
                                               ──▶ problem-rng-smear
```

## Wishes

- **`wish-first-learned-lesson`** — v0's heartbeat: a hungry creature approaches food because
  reward chemistry strengthened that synapse, *and somebody watched it*.
- **`wonder-tick-ceiling`** — can scher carry the soup at biological tick rates? **Answered.**
- **`wish-perishing-holds`** — retention needs no policy: a tick nothing prehends may perish;
  a birth, prehended by a whole life, cannot. The actual window IS the reversibility budget.
- **`wish-lineage-readable`** — ancestry as prehension walks. Birth prehends two parents;
  crossover is a merge (the shape `succession-war` already plays). Gene's-eye and
  creature's-eye: two standpoints, one canon.
- **`wish-named-dice`** — one named seeded stream per port. A life = `(genome, seeds,
  interventions)`.
- **`lure-the-hand`** — player drops 🍎 so creatures can learn from the hand.

## Tasks

- **`task-soup`** — chemicals as opaque IDs + concentration + half-life. Meaning lives in the
  relations, never parsed from the name (scher's opaque-slug law in a lab coat).
- **`task-genome`** — reactions, receptors, emitters, lobe shape all gene-expressed, even
  with one hand-written genome and no breeding yet. Breeding then costs almost nothing.
- **`task-lobe`** — one small Hebbian lobe in the soup.
- **`task-viewer`** — brain + chemistry instrument, day one. The fun was always *watching*.
- **`task-port-streams`** — named streams (mutation, diffusion, tie-break, spawn);
  interventions as exogenous events. Buys counterfactuals: hold every stream but one and
  "bad genes or bad weather?" becomes an experiment. `mulberry32` in the muslin is the seed.
- **`task-gist-raster-window`** — actual recent window, gists behind, rasters behind that.
  Seeded determinism pays for perishing: raster + seed regenerates by re-simulation.
- **`task-birth-prehends-parents`** — the lineage edges.

## Problems

Log + future hook, whining until grounded. Each passes through a wish, never straight to an
End.

- **`problem-genre-graveyard`** → `wish-first-learned-lesson`. Clones die as brainless pets or
  as unshipped realism (Grandroids, funded, still future a decade on).
- **`problem-faith-not-measurement`** → `wonder-tick-ceiling`. **Quiet** — got its number.
- **`problem-rng-smear`** → `wish-named-dice`. One global RNG means an extra mutation draw
  shifts every unrelated roll: spooky action between separately-unmodeled systems.
- **`problem-unbounded-soup-log`** *(minted by measurement)* → `wish-perishing-holds`.
  ~200 bytes/row × 4,800 rows/sec = 1 GB in ~19 min.

## Findings — tick-ceiling, 2026-08-14

200 creatures × 6 chemicals, 4 Hz tick, 25 ms soup allowance:

| substrate | ms/tick |
|---|---|
| raw `Float64Array` | ~0.004 |
| `Cell` per creature | ~0.008 |
| `Cell` per chemical | ~0.04–0.09 |
| appended beat per chemical | ~1.6–1.8 |

1. Everything fits, including append-only — **contradicting the prediction** that it would
   die of its own honesty.
2. `lay()` stays flat to 400k rows.
3. Room runs out, not time.
4. So `wish-perishing-holds` is load-bearing, not polish.

The correction matters more than the confirmation: the session guessed the right mechanism
and the wrong symptom. Take the numbers over any earlier prose.

## Open

- Not yet in the graph (needs someone with a route to `:8014`).
- Whether these three sublimes are the right three.
- How a gist of a perished window is shaped, and what a raster keeps — finding 3 makes this
  the next design question, not a later one.
