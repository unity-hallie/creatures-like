import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

// scher is consumed from SOURCE, not from a published package: its `dist/` is
// gitignored upstream and it has no `prepare` script, so a git-dependency install
// would resolve `main` to a file that was never built.
//
// SCHER_SRC overrides the checkout location; the default assumes a sibling checkout.
// This is a muslin-grade seam and is allowed to be — see MUSLIN.md. The day this
// stops being a toy, scher gets a real published build and this alias goes away.
const here = dirname(fileURLToPath(import.meta.url));
const scherSrc = process.env.SCHER_SRC ?? resolve(here, "../scher/src");

export default defineConfig({
  resolve: {
    alias: {
      scher: resolve(scherSrc, "index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts", "muslin/**/*.test.ts"],
    // Ecosystem tests run real simulations over thousands of ticks, and got slower the
    // moment organisms could reproduce — populations grow, so there is more world to
    // tick. The default 5s budget started failing them as timeouts, which reads as a
    // broken assertion and is not one.
    testTimeout: 60_000,
  },
});
