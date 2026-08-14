# creatures-like

A toy in the lineage of *Creatures*, the late-90s a-life game. Geometrics and emoji for
graphics, on purpose (`MUSLIN.md`).

## The thesis

The famous part was the neural nets. The load-bearing part was the **biochemistry** — drives
as chemical concentrations, learning as a reward chemical strengthening recently-fired
synapses, death as chemistry failing.

The trick: all three layers spoke one currency. Any gene could express any layer — a
reaction, a receptor, an emitter, a lobe's parameters — so mutation reached the whole loop
at once. Meaning lived in no layer; it ran as a circuit through all three.

So the scope cut falls on **counts, not layers**: six chemicals and one lobe, fine;
hard-coded chemistry with "genetics later", not fine. v0 aims at one watched moment — *a
hungry creature approaches food because reward chemistry strengthened that synapse.*

## Run

```bash
npm install
npm test                    # SCHER_SRC=/path/to/scher/src if not a sibling checkout
npm run muslin:ceiling      # prints the table below
```

Built on [scher](https://github.com/Unity-Environmental-University/scher), consumed from
source — its `dist/` is gitignored upstream with no `prepare` script, so a git-dependency
install would point `main` at a file nobody built.

## The one measurement so far

`muslin/tick-ceiling.test.ts` — can scher carry the soup at biological tick rates? (Creatures
ran its soup at ~2 Hz, well under render rate.) At 200 creatures × 6 chemicals, 4 Hz tick,
25 ms allowed for the soup:

| substrate | ms/tick |
|---|---|
| raw `Float64Array` | ~0.004 |
| one `Cell` per creature | ~0.008 |
| one `Cell` per chemical | ~0.04–0.09 |
| one appended beat per chemical | ~1.6–1.8 |

Everything fits, including the append-only substrate — which contradicted the prediction.
`lay()` also stays flat out to 400k rows.

**Room runs out, not time.** ~200 bytes/row × 4,800 rows/sec = 1 GB in ~19 min of play. That
makes perishing load-bearing rather than an optimization, and the grammar already has the
rule: what survives is what successors still prehend.

## Plan

`plan/TODO-LIST-PEN.md` — modeled in the Penelope grammar, sublimes down to work.
