// THE PAGE — a canvas, a scrubber, and as little else as it can get away with.
//
// It draws nothing itself. `scene.ts` builds the ops and `raster.ts` turns them into the
// greyscale buffer, both imported as the same source files the PNG CLI uses, so the canvas
// is not a second renderer that agrees with the first — it is the first, blitted instead of
// deflated. The last inch, greyscale → ImageData, is `rgba()`, and `test/viewer.test.ts`
// decodes a real PNG to check that inch.
//
// The reactive layer is scher's Cell. The state here is genuinely its thesis — an
// append-only sequence of frames and a standpoint moving over it — and the equality gate
// pays for itself on the poll: a poll that finds nothing new sets a cell to an equal
// reading, which notifies nobody, so the page does no work. What scher's DOM layer offers
// (`project`, `el`) is NOT used, and the reason is in the commit message: every node on
// this page is stable and mutated in place, which is the one case a re-projecting view is
// wrong for.

import { cell, derive, batch } from "scher/cell.js";
import { scene, sceneMap, sceneZoom, historyIndices, mapPlaceAt, dashWidth, WIDTH, HEIGHT, type Frame } from "./scene.js";
import { Canvas, rasterise, rgba } from "./raster.js";

type View = "dash" | "map" | "zoom";

const canvasEl = document.getElementById("frame") as HTMLCanvasElement;
const scrub = document.getElementById("scrub") as HTMLInputElement;
const statusEl = document.getElementById("status") as HTMLElement;
// A radio group rather than a select: three mutually exclusive views, arrow-key
// reachable without opening anything, and the markup states the exclusivity instead of
// implying it.
const viewRadios = Array.prototype.slice.call(
  document.querySelectorAll('input[name="view"]'),
) as HTMLInputElement[];
const tickOut = document.getElementById("tick") as HTMLOutputElement;
const runSel = document.getElementById("run") as HTMLSelectElement;

canvasEl.width = WIDTH;
canvasEl.height = HEIGHT;
const ctx = canvasEl.getContext("2d")!;

// The URL is read ONCE here, before anything subscribes, and it is load-bearing that it
// happens in that order: a scher subscription delivers the current reading immediately, so
// the hash writer below runs the moment it is attached. Start the cells at defaults and the
// first thing the page does is overwrite the link you arrived on with them.
const arrived = new URLSearchParams(location.hash.slice(1));

const run = cell(arrived.get("run") ?? "");
const frames = cell<Frame[]>([], (a, b) => a.length === b.length);
const index = cell(Number(arrived.get("i") ?? 0));
const view = cell<View>((arrived.get("view") as View) ?? "map");
const place = cell(Number(arrived.get("place") ?? 0));

// ── the picture ──────────────────────────────────────────────────────────────

function paint(): void {
  const all = frames.get();
  const i = index.get();
  const frame = all[i];
  if (!frame) return;
  const past = historyIndices(i).map((n) => all[n]);
  const v = view.get();
  const ops =
    v === "map" ? sceneMap(frame, past)
    : v === "zoom" ? sceneZoom(frame, place.get(), past)
    : scene(frame, past);
  // the dashboard grows with the world, so the canvas is resized to match rather than
  // cropping places off the right edge. Every other view is a fixed composition.
  const w = v === "dash" ? dashWidth(frame) : WIDTH;
  if (canvasEl.width !== w) canvasEl.width = w;
  const buffer = new Canvas(w, HEIGHT);
  rasterise(buffer, ops);
  ctx.putImageData(new ImageData(rgba(buffer), w, HEIGHT), 0, 0);
}

function chrome(): void {
  const all = frames.get();
  scrub.max = String(Math.max(0, all.length - 1));
  scrub.value = String(index.get());
  for (const radio of viewRadios) radio.checked = radio.value === view.get();
  const frame = all[index.get()];
  // the caption says which moment of which world this is; the output carries the tick on
  // its own, because that is the number anyone actually quotes
  tickOut.textContent = frame ? String(frame.tick) : "—";
  statusEl.textContent = frame
    ? `frame ${index.get() + 1} of ${all.length}` +
      (view.get() === "zoom" ? ` · place ${place.get()} ${frame.places[place.get()]?.name ?? ""}` : "")
    : "no frames";
}

function writeHash(): void {
  const want = `#run=${run.get()}&i=${index.get()}&view=${view.get()}&place=${place.get()}`;
  if (location.hash !== want) history.replaceState(null, "", want);
}

/** One reading of the whole standpoint. Every effect below subscribes to this rather than
 *  to the five cells separately, so one change is one wave and nothing can be left stale by
 *  an effect that forgot which cells it reads. */
const reading = derive(
  () => ({ run: run.get(), frames: frames.get(), i: index.get(), view: view.get(), place: place.get() }),
  [run, frames, index, view, place],
);
reading.subscribe(paint);
reading.subscribe(chrome);
reading.subscribe(writeHash);

// ── loading ──────────────────────────────────────────────────────────────────

interface Page {
  count: number;
  from: number;
  frames: Frame[];
}

async function fetchFrom(id: string, from: number): Promise<Page> {
  const res = await fetch(`/api/run/${encodeURIComponent(id)}?from=${from}`);
  if (!res.ok) throw new Error(`run ${id}: ${res.status}`);
  return (await res.json()) as Page;
}

async function openRun(id: string): Promise<void> {
  const page = await fetchFrom(id, 0);
  const wanted = index.get();
  batch(() => {
    run.set(id);
    frames.set(page.frames);
    index.set(Math.min(wanted, Math.max(0, page.frames.length - 1)));
  });
}

/** Extend the scrubber as the run writes.
 *
 *  Safe to do live, and this is the property that makes it safe rather than a preference:
 *  a frame's picture is built from itself and frames BEFORE it, so appending frame N+1
 *  cannot change what frame N looks like. The timeline only ever grows to the right, and
 *  nothing already on screen moves under you. The playhead follows the tail only if it was
 *  already there. */
async function poll(): Promise<void> {
  const id = run.get();
  if (!id) return;
  const before = frames.get().length;
  const page = await fetchFrom(id, before);
  if (page.frames.length === 0) return;
  const wasAtTail = index.get() >= before - 1;
  batch(() => {
    frames.set([...frames.get(), ...page.frames]);
    if (wasAtTail) index.set(frames.get().length - 1);
  });
}

// ── controls ─────────────────────────────────────────────────────────────────

function readHash(): void {
  const q = new URLSearchParams(location.hash.slice(1));
  batch(() => {
    if (q.has("i")) index.set(Number(q.get("i")));
    if (q.has("view")) view.set(q.get("view") as View);
    if (q.has("place")) place.set(Number(q.get("place")));
  });
}

scrub.addEventListener("input", () => index.set(Number(scrub.value)));
for (const radio of viewRadios) radio.addEventListener("change", () => view.set(radio.value as View));
runSel.addEventListener("change", () => void openRun(runSel.value));

addEventListener("keydown", (e) => {
  const step = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
  if (step === 0) return;
  e.preventDefault();
  index.set(Math.max(0, Math.min(frames.get().length - 1, index.get() + step)));
});

// Clicking a place on the map zooms it. The hit test asks `scene.ts` where it drew each
// place, so the target cannot drift away from the picture.
canvasEl.addEventListener("click", (e) => {
  if (view.get() === "zoom") return view.set("map");
  if (view.get() !== "map") return;
  const frame = frames.get()[index.get()];
  if (!frame) return;
  const box = canvasEl.getBoundingClientRect();
  const x = ((e.clientX - box.left) * WIDTH) / box.width;
  const y = ((e.clientY - box.top) * HEIGHT) / box.height;
  let best = -1;
  let bestDistance = 60;
  frame.places.forEach((_, i) => {
    const p = mapPlaceAt(i, frame.places.length);
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  if (best >= 0) batch(() => {
    place.set(best);
    view.set("zoom");
  });
});

addEventListener("hashchange", readHash);

// ── start ────────────────────────────────────────────────────────────────────

async function start(): Promise<void> {
  const found = (await (await fetch("/api/runs")).json()) as string[];
  runSel.replaceChildren(
    ...found.map((id) => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = id;
      return o;
    }),
  );
  const wanted = run.get() || found[found.length - 1];
  if (!wanted) {
    statusEl.textContent = "no runs under runs/";
    return;
  }
  runSel.value = wanted;
  await openRun(wanted);
  // arriving without a frame in the URL means "show me where the run has got to"
  if (!arrived.has("i")) index.set(frames.get().length - 1);
  setInterval(() => void poll().catch(() => {}), 5000);
}

void start();
