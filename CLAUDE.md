# creatures-like — how we work

Each rule is a question. Answer it well and you already hold the rule. The answers are in
`git log` — the commit messages here explain reasoning, not changes, on purpose.

## Before you touch a file

1. **Does the render show it?**
   `npm run shot` is the surface. Every real finding this repo has came from looking at a
   frame, not from querying JSON. Search the data when the renderer is wrong; otherwise
   look.

2. **Is it conserved?**
   Carbon and adenine and nitrogen balance exactly, and `assertBalanced` throws at birth.
   An unbalanced reaction has no runtime symptom — it just quietly mints atoms while
   everything keeps running. The worst bug in this repo's history took 900 ticks to turn
   102 into 15,020 with every test green.

3. **Does the genome say it, or does the code?**
   A chemical means what its receptors say and nothing else. Rename every chemical and
   behaviour must not move. If the engine holds a table of who-eats-what or who-fears-what,
   that table is the bug.

4. **Did you clamp?**
   No. Reactions run to an extent set by the limiting reagent, transfers go through
   `transfer`, costs are conversions. Clamping at zero creates matter.

5. **Is it two copies of one thing?**
   `World` kept its own metabolism beside `Organism`'s; when amylase became an enzyme gene,
   one copy silently stopped digesting and the creature starved with no error. Two
   implementations of one idea diverge on the day you are not looking.

6. **Would selection do this better than you?**
   If you are hand-tuning a number that lives in a genome, stop. The world searches its own
   parameters now. That is what it is for.

## On writing

- **A finding goes on a surface.** A render, a table, a row. Not a paragraph.
- **A correction is a line.**
- **Anything long is addressed to a next instance.** Size it that way, say so, and never
  mistake it for the message.

Hallie reads scannable. Long documents are written past her. This one is already at its
limit.

## Two more

- **Green tests aren't pixels.** Four runs went extinct while every test passed. The tests
  checked behaviour; none checked bookkeeping.
- **Say where you'd be wrong.** In the commit, by name. The most useful line in this repo's
  history is a subagent writing down the race condition it chose not to fix.
