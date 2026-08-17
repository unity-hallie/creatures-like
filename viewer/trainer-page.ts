// The trainer page. Reads the live world, draws it through the SAME rasteriser the PNG
// uses, and sends the hand's interventions back.
//
// Deliberately step-first rather than play-first: the credit window is about three ticks,
// so a trainer who cannot stop time cannot aim. Play exists, but stepping is the tool.

import { WIDTH, HEIGHT, sceneCreature, type CreatureView } from "./scene.js";
import { Canvas, rasterise, rgba } from "./raster.js";
import { cell } from "scher/cell.js";

const canvasEl = document.getElementById("frame") as HTMLCanvasElement;
const ctx = canvasEl.getContext("2d")!;
const statusEl = document.getElementById("status") as HTMLElement;
const whoSel = document.getElementById("who") as HTMLSelectElement;
const tickOut = document.getElementById("tick") as HTMLOutputElement;
const logEl = document.getElementById("log") as HTMLElement;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const tokenIn = document.getElementById("token") as HTMLInputElement;

interface State {
  ids: string[];
  id: string;
  view: CreatureView | null;
  verdicts: number[];
  interventions: Array<{ tick: number; kind: string; target: string; token?: string }>;
}

const state = cell<State | null>(null);
const who = cell<string>("");
let playing = false;

function draw(s: State): void {
  if (!s.view) return;
  const canvas = new Canvas(WIDTH, HEIGHT);
  rasterise(canvas, sceneCreature(s.view, s.verdicts.slice(-120)));
  ctx.putImageData(new ImageData(rgba(canvas), WIDTH, HEIGHT), 0, 0);
}

async function refresh(): Promise<void> {
  const id = who.get();
  const res = await fetch(`/api/train/state${id ? `?id=${encodeURIComponent(id)}` : ""}`);
  const s = (await res.json()) as State;
  state.set(s);
  if (!id && s.id) who.set(s.id);
}

async function step(n: number): Promise<void> {
  await fetch(`/api/train/step?n=${n}`, { method: "POST" });
  await refresh();
}

async function act(kind: string, extra = ""): Promise<void> {
  const target = kind === "feed" ? String(state.get()?.view?.at ?? 0) : who.get();
  await fetch(`/api/train/act?kind=${kind}&target=${encodeURIComponent(target)}${extra}`, { method: "POST" });
  await refresh();
}

// ── chrome, re-observed whenever state is ────────────────────────────────────
// `subscribe` rather than `derive`: this is a side effect, not a value, and scher's
// subscribe fires once immediately with the current reading — which is exactly the
// first paint.
state.subscribe((s) => {
  if (!s) return;
  draw(s);

  if (whoSel.options.length !== s.ids.length) {
    whoSel.textContent = "";
    for (const id of s.ids) {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = id;
      whoSel.append(o);
    }
  }
  whoSel.value = s.id;
  tickOut.textContent = String(s.view?.tick ?? "—");
  statusEl.textContent = s.view
    ? `${s.view.alive ? "alive" : "dead"} · gate ${(s.view.binding.learning - s.view.binding.punishment).toFixed(2)}` +
      ` · ${s.view.recent[0] ? `just ${s.view.recent[0].action}` : "no action yet"}`
    : "no creature";

  logEl.textContent = "";
  for (const i of s.interventions) {
    const li = document.createElement("li");
    li.textContent = `t${i.tick} ${i.kind}${i.token ? ` "${i.token}"` : ""} → ${i.target}`;
    logEl.append(li);
  }
});

document.getElementById("step1")!.addEventListener("click", () => void step(1));
document.getElementById("step5")!.addEventListener("click", () => void step(5));
document.getElementById("step50")!.addEventListener("click", () => void step(50));
document.getElementById("reward")!.addEventListener("click", () => void act("reward", "&amount=1"));
document.getElementById("punish")!.addEventListener("click", () => void act("punish", "&amount=1"));
document.getElementById("feed")!.addEventListener("click", () => void act("feed", "&amount=0.5"));
document.getElementById("say")!.addEventListener("click", () =>
  void act("say", `&token=${encodeURIComponent(tokenIn.value || "word")}`),
);
whoSel.addEventListener("change", () => {
  who.set(whoSel.value);
  void refresh();
});

playBtn.addEventListener("click", () => {
  playing = !playing;
  playBtn.setAttribute("aria-pressed", String(playing));
  playBtn.textContent = playing ? "Pause" : "Play";
  const beat = async (): Promise<void> => {
    if (!playing) return;
    await step(2);
    setTimeout(() => void beat(), 120);
  };
  void beat();
});

addEventListener("keydown", (e) => {
  if (e.target instanceof HTMLInputElement) return;
  if (e.code === "Space") { e.preventDefault(); void step(1); }
  if (e.key === "r" || e.key === "R") void act("reward", "&amount=1");
  if (e.key === "p" || e.key === "P") void act("punish", "&amount=1");
});

void refresh();
