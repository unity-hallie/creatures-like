// A local server for looking at a run in a browser, one frame at a time.
//
// It exists to serve exactly two things: the frames, and the SOURCE FILES the PNG CLI
// already uses. The page does not get its own renderer — it gets `scene.ts` and
// `raster.ts`, transpiled on request, so the picture a human scrubs and the picture an
// agent reads out of a PNG come from the same code rather than from two implementations
// that agree until they don't.
//
// Transpiling per request instead of building is the point, not laziness: a build step
// introduces a stale artifact, and a stale artifact is precisely how the two pictures
// would drift apart while every test stayed green.

import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import ts from "typescript";

const HERE = dirname(fileURLToPath(import.meta.url));
const VIEWER = existsSync(join(HERE, "scene.ts")) ? HERE : resolve(HERE, "../../viewer");
const ROOT = resolve(VIEWER, "..");
const SCHER = process.env.SCHER_SRC ?? resolve(ROOT, "../scher/src");

/** TypeScript to browser ESM, one file at a time.
 *
 *  `transpileModule` is per-file by design: it erases types and rewrites nothing else, so
 *  what the browser runs is the same statements the Node importer runs. `test/viewer.test.ts`
 *  fetches these bytes and checks they still draw pixel-for-pixel what the direct import
 *  draws — the claim in the file header is only worth what that test is worth. */
export function transpile(source: string, fileName: string): string {
  return ts.transpileModule(source, {
    fileName,
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      isolatedModules: true,
    },
  }).outputText;
}

/** Map a served `/dir/name.js` back to the `.ts` on disk it was written as. */
function sourceFor(urlPath: string): string | null {
  const mounts: Record<string, string> = { "/viewer/": VIEWER, "/scher/": SCHER };
  for (const [prefix, dir] of Object.entries(mounts)) {
    if (!urlPath.startsWith(prefix)) continue;
    const rest = urlPath.slice(prefix.length);
    if (rest.includes("..") || extname(rest) !== ".js") return null;
    const file = join(dir, rest.slice(0, -3) + ".ts");
    return resolve(file).startsWith(resolve(dir)) && existsSync(file) ? file : null;
  }
  return null;
}

function runs(): string[] {
  const dir = join(ROOT, "runs");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((d) => existsSync(join(dir, d, "manifest.json"))).sort();
}

/** The frames of a run from index `from` on, as one response.
 *
 *  One request rather than one-per-frame because the measurement said so: a 114-frame run
 *  is 1.47 MB of JSON that gzips to 90 KB, and drawing ANY frame needs up to sixty earlier
 *  ones for the sparklines — so per-frame fetching would mean sixty round trips per scrub
 *  position to save bytes that compression already gave back. `from` is what keeps that
 *  honest as the run grows: a poll ships only what is new. */
function frames(id: string, from: number): string | null {
  const dir = join(ROOT, "runs", id);
  const manifest = join(dir, "manifest.json");
  if (id.includes("/") || id.includes("..") || !existsSync(manifest)) return null;
  const entries = (JSON.parse(readFileSync(manifest, "utf8")) as { frames: { file: string }[] }).frames;
  const wanted = entries.slice(Math.max(0, from));
  const texts = wanted.map((e) => readFileSync(join(dir, e.file), "utf8"));
  // spliced as text, never parsed: the server has no opinion about a frame's contents
  return `{"count":${entries.length},"from":${Math.max(0, from)},"frames":[${texts.join(",")}]}`;
}

function send(req: IncomingMessage, res: ServerResponse, type: string, body: string): void {
  const buf = Buffer.from(body);
  const gz = buf.length > 1024 && (req.headers["accept-encoding"] ?? "").includes("gzip");
  const out = gz ? gzipSync(buf) : buf;
  res.writeHead(200, {
    "content-type": type,
    "content-length": out.length,
    "cache-control": "no-store",
    ...(gz ? { "content-encoding": "gzip" } : {}),
  });
  res.end(out);
}

export function createViewerServer(): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const path = url.pathname;

    if (path === "/" || path === "/index.html") {
      return send(req, res, "text/html; charset=utf-8", readFileSync(join(VIEWER, "index.html"), "utf8"));
    }
    if (path === "/api/runs") {
      return send(req, res, "application/json", JSON.stringify(runs()));
    }
    if (path.startsWith("/api/run/")) {
      const body = frames(decodeURIComponent(path.slice("/api/run/".length)), Number(url.searchParams.get("from") ?? 0));
      if (!body) {
        res.writeHead(404).end("no such run");
        return;
      }
      return send(req, res, "application/json", body);
    }
    const src = sourceFor(path);
    if (src) {
      return send(req, res, "text/javascript; charset=utf-8", transpile(readFileSync(src, "utf8"), src));
    }
    res.writeHead(404).end("not found");
  });
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const port = Number(process.env.PORT ?? 8080);
  createViewerServer().listen(port, () => {
    const found = runs();
    console.log(`viewer  http://localhost:${port}/`);
    console.log(found.length ? `runs    ${found.join(" ")}` : `runs    none found under ${join(ROOT, "runs")}`);
  });
}
