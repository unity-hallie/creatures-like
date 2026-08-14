# creatures-like

A toy in the lineage of *Creatures*, the late-90s British neural-network a-life game.
Basic geometrics and emoji for graphics, deliberately — see `MUSLIN.md`.

## The thesis

Everyone remembers the norns' neural nets, but the load-bearing organ was the
**biochemistry**. Drives lived as chemical concentrations. Reinforcement happened when a
reward chemical bound to a receptor that strengthened recently-fired synapses. Death
happened when chemistry failed. The brain meant something only because it floated in that
soup.

The deeper trick: all three layers spoke **one currency**. The genome held a flat list of
genes, and any gene could express a piece of any layer — a brain lobe's parameters, a
chemical reaction, a receptor ("when punishment crosses a threshold, dampen this synapse's
learning rate"), an emitter ("when this neuron fires, secrete adrenaline"). Receptors and
emitters stitched brain to soup, and they were genes, so mutation and crossover reached the
whole loop at once. Evolution could invent new semantics by accident: add a receptor
somewhere new and a chemical suddenly *means* something it never meant before.

Meaning lived in no single layer. It ran as a circuit through all three, at three
timescales — neural (moments), endocrine (minutes), genetic (generations).

## What that implies for a first version

The scope cut has to fall on **counts, not layers**. Six chemicals, one lobe, a dozen
genes: fine. Hard-coding the chemistry and promising genetics later: not fine. That ships a
neural pet with a mood meter, and later never arrives, because the architecture grows typed
interfaces exactly where the shared substrate belonged.

Two clones-that-failed mark the road on either side. One kind builds a neural net with no
body, so behavior comes out arbitrary and nothing feels alive. The other chases full
receptor/emitter realism and never ships — Steve Grand's own follow-on, Grandroids, took
its funding and still sits in the future more than a decade on.

So the first version aims at one observable moment: **a hungry creature approaches food
because reward chemistry strengthened that synapse last time, and somebody watched it
happen.** Everything else counts as content.

## Substrate

The world runs on [scher](https://github.com/Unity-Environmental-University/scher), an
append-only reactive library whose thesis — *a view is a reading of state, re-observed; a
reading is relative to a standpoint* — happens to fit a-life exactly. A creature's life
already has the shape of an append-only log read from a standpoint. Lineage falls out of
the same structure: a birth prehends its two parents, crossover reads as a merge, and
extinct lines stay readable instead of getting collected, which hands you a fossil record
for free. The gene's-eye and creature's-eye views become two standpoints over one canon
rather than two data structures.

`scher` resolves from **source**, not from a published package: its `dist/` is gitignored
upstream and it carries no `prepare` script, so a git-dependency install would point `main`
at a file nobody built. `vitest.config.ts` aliases it to a sibling checkout; `SCHER_SRC`
overrides the path.

```bash
npm install
SCHER_SRC=/path/to/scher/src npm test
```

## Measured, not assumed

`muslin/tick-ceiling.test.ts` asks whether scher can carry the chemical soup at biological
tick rates. Creatures itself ran its soup at a couple of hertz, well under render rate, and
that slowness contributed to why its norns read as organisms rather than game objects — so
the muslin budgets for 4 Hz, not 60.

At 200 creatures × 6 chemicals, per tick:

| substrate | ms/tick | notes |
|---|---|---|
| raw `Float64Array` | ~0.004 | reference point, no scher |
| one `Cell` per creature (whole vector) | ~0.008 | cheapest scher option |
| one `Cell` per chemical | ~0.04–0.09 | finest granularity |
| one appended beat per chemical | ~1.6–1.8 | "everything is an event," read literally |

The 4 Hz tick allows 250 ms; the soup may spend 25 ms of it. **Every substrate fits,
including the append-only one** — which contradicted the prediction going in. The guess was
that appending a beat per chemical per tick would die of its own honesty. On compute, it
does not: `lay()` also holds its cost flat as the log grows, so the 400,000th append costs
what the first cost.

What runs out is **room**, not time. Every row stays retained by construction, at roughly
200 bytes each; at 4 Hz a 200-creature world appends 4,800 rows per second and reaches a
gigabyte of heap in about 19 minutes of play.

That relocates the whole question. Perishing stops being an optimization and becomes the
thing that makes chemistry-in-scher viable at all — and it needs no policy, because the
grammar already has one. An occasion perishes; what survives is what successors still
prehend. A metabolic tick nothing downstream references can perish into a gist on its own,
while a birth, prehended by the child's entire subsequent life, cannot be collected. The
retention rule reads: *still being prehended*. Objective immortality, functioning as a
garbage collector.

The price of honest perishing is **seeded determinism**: a raster plus its seeds must
regenerate any window by re-simulation, which is what makes a gist holographic rather than
lossy — and what keeps a bug observed in play reproducible as a test after its evidence has
perished.

## Dice as declared ports

Every random draw marks a boundary of the model rather than hiding one. A mutation draw
stands in for cosmic rays and copying errors; a diffusion jitter stands in for
thermodynamics; a tie-break in action selection stands in for the sub-threshold neural
weather nobody simulated. Same as dice at a tabletop: the fiction handles what it can, and
the dice take over exactly where it admits it has no mechanism.

Hence **named streams, never one global RNG.** A single shared stream smears the ports
together — consume one extra draw in mutation and every downstream "unrelated" roll shifts,
which is spooky action between systems that were supposed to stay separately unmodeled.
Named streams also buy counterfactuals as an instrument: replay a life with every stream
held fixed but one, and "bad genes or bad weather?" becomes an experiment rather than a
vibe.

The player counts as one of the dice — the least modellable system in the room. A hand
dropping 🍎 into the world logs as an exogenous event at a named port, so a creature's whole
life compresses to `(genome, seed streams, interventions)`. Creatures half-knew this: the
hand was an in-world object the norns could learn about, an interface where the
unmodellable reached in wearing a glove.

And the ports double as an honest TODO list. The day temperature deserves real modeling,
a named die already sits exactly where the splice goes — a placeholder that keeps working
at runtime instead of drifting like a comment.

## The plan

`plan/TODO-LIST-PEN.md` holds the work, modeled backwards in the Penelope grammar:
sublimes prehend wishes, and wishes prehend both the work and the Problems they resolve.
