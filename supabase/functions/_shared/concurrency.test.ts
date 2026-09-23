import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runWithConcurrency } from "./concurrency.ts";

Deno.test("runWithConcurrency preserves result order regardless of completion order", async () => {
  const items = [30, 10, 20, 5, 25];
  const results = await runWithConcurrency(items, 3, async (ms) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    return ms;
  });
  assertEquals(results, items);
});

Deno.test("runWithConcurrency never runs more than `limit` workers at once", async () => {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);

  await runWithConcurrency(items, 4, async (item) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    return item;
  });

  assert(maxActive <= 4, `expected max 4 concurrent workers, saw ${maxActive}`);
});

Deno.test("runWithConcurrency processes every item exactly once", async () => {
  const items = Array.from({ length: 37 }, (_, i) => i);
  const seen: number[] = [];

  const results = await runWithConcurrency(items, 5, async (item) => {
    seen.push(item);
    return item * 2;
  });

  assertEquals(seen.length, items.length);
  assertEquals(new Set(seen).size, items.length);
  assertEquals(results, items.map((i) => i * 2));
});

Deno.test("runWithConcurrency handles an empty input list", async () => {
  const results = await runWithConcurrency<number, number>([], 5, async (item) => item);
  assertEquals(results, []);
});

Deno.test("runWithConcurrency handles a limit larger than the item count", async () => {
  const results = await runWithConcurrency([1, 2, 3], 50, async (item) => item + 1);
  assertEquals(results, [2, 3, 4]);
});

Deno.test("runWithConcurrency propagates a worker rejection", async () => {
  let threw = false;
  try {
    await runWithConcurrency([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error("boom");
      return item;
    });
  } catch (error) {
    threw = true;
    assert(error instanceof Error && error.message === "boom");
  }
  assert(threw, "expected the rejection to propagate");
});
