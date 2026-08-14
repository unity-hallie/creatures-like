// The canary for the seam described in README.md and vitest.config.ts: scher gets consumed
// from SOURCE via an alias, not from a published build. That arrangement can break for
// reasons with nothing to do with this repo — scher moves a file, renames an export, or
// somebody runs the suite without a sibling checkout.
//
// When that happens, this test fails first and names the reason, instead of a chemistry
// muslin failing and sending the reader hunting through simulation code for a problem that
// actually lives in a path.
import { test, expect } from "vitest";
import { Society, cell } from "scher";

test("the scher alias resolves and its kernel answers", () => {
  const society = new Society();
  society.lay({ slug: "a", content: "a beat", subject: null, object: null });
  expect(society.get("a")?.content).toBe("a beat");

  const reading = cell(1);
  reading.set(2);
  expect(reading.get()).toBe(2);
});
