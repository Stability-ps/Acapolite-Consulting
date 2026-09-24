// Generic bounded-concurrency runner. Used by bulk-invite-clients-to-portal
// (and any future bulk operation) to avoid firing N simultaneous requests at
// Supabase Auth's admin API - that API is rate-limited, and running an
// unbounded Promise.all over a large batch would either trip that limit or
// spike memory/connection usage for no benefit over a small worker pool.
//
// Results are returned in the same order as `items`, regardless of which
// worker finishes first - callers can zip them back against the input
// without re-sorting.

export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runNext(): Promise<void> {
    const currentIndex = nextIndex;
    nextIndex += 1;
    if (currentIndex >= items.length) return;
    results[currentIndex] = await worker(items[currentIndex], currentIndex);
    await runNext();
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => runNext()));

  return results;
}
