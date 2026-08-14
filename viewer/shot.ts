// Render a checkpoint to a PNG. The surface this project is looked at through.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { scene, WIDTH, HEIGHT, type Frame } from "./scene.js";
import { Canvas, rasterise } from "./raster.js";

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
  // history up to this frame, subsampled so a long run still draws in a small box
  const upto = manifest.frames.slice(0, i);
  const stride = Math.max(1, Math.ceil(upto.length / 60));
  const history = upto
    .filter((_, n) => n % stride === 0)
    .map((e) => JSON.parse(readFileSync(join(run, e.file), "utf8")) as Frame);
  const canvas = new Canvas(WIDTH, HEIGHT);
  rasterise(canvas, scene(frame, history));
  const file = join(out, `f${String(i).padStart(5, "0")}-t${frame.tick}.png`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, canvas.png());
  console.log(file);
}
