// Render a checkpoint to a PNG. The surface this project is looked at through.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { scene, sceneMap, sceneZoom, historyIndices, dashWidth, WIDTH, HEIGHT, type Frame } from "./scene.js";
import { Canvas, rasterise } from "./raster.js";
import { png } from "./png.js";

const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const [k, v] = a.replace(/^--/, "").split("=");
  args.set(k, v ?? "true");
}
const run = args.get("run") ?? "runs/long-01";
const out = args.get("out") ?? "shots";
mkdirSync(out, { recursive: true });

const manifest = JSON.parse(readFileSync(join(run, "manifest.json"), "utf8")) as {
  frames: Array<{ file: string; tick: number }>;
};
const want = args.get("frame");
const picked =
  want === undefined || want === "last"
    ? [manifest.frames.length - 1]
    : want === "all"
      ? manifest.frames.map((_, i) => i)
      : want.split(",").map((n) => (Number(n) < 0 ? manifest.frames.length + Number(n) : Number(n)));

for (const i of picked) {
  const entry = manifest.frames[i];
  if (!entry) continue;
  const frame = JSON.parse(readFileSync(join(run, entry.file), "utf8")) as Frame;
  const history = historyIndices(i).map(
    (n) => JSON.parse(readFileSync(join(run, manifest.frames[n].file), "utf8")) as Frame,
  );
  const view = args.get("view") ?? "dash";
  const zoomAt = Number(args.get("place") ?? 0);
  const ops =
    view === "map" ? sceneMap(frame, history) : view === "zoom" ? sceneZoom(frame, zoomAt, history) : scene(frame, history);
  // the dashboard grows with the world; every other view is a fixed composition
  const canvas = new Canvas(view === "dash" ? dashWidth(frame) : WIDTH, HEIGHT);
  rasterise(canvas, ops);
  const tag = view === "zoom" ? `zoom${zoomAt}` : view;
  const file = join(out, `${tag}-f${String(i).padStart(5, "0")}-t${frame.tick}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, png(canvas));
  console.log(file);
}
