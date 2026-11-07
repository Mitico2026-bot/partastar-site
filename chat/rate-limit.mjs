// Fixed one-minute window per key (visitor IP): constant work and constant memory per call.
// A request that is already over the limit changes nothing, so a flood from one visitor costs
// almost nothing, and the number of tracked keys is capped.
export function createLimiter({ perWindow = 10, windowMs = 60_000, maxKeys = 10_000, now = Date.now } = {}) {
  const hits = new Map(); // key -> { start, count }, oldest first

  function limited(key) {
    const t = now();
    let e = hits.get(key);
    if (!e || t - e.start >= windowMs) {
      if (!e && hits.size >= maxKeys) hits.delete(hits.keys().next().value); // forget the oldest key
      e = { start: t, count: 0 };
      hits.delete(key); // re-insert so insertion order stays oldest-first
      hits.set(key, e);
    }
    if (e.count >= perWindow) return true;
    e.count++;
    return false;
  }

  function sweep() {
    const t = now();
    for (const [key, e] of hits) if (t - e.start >= windowMs) hits.delete(key);
  }

  return { limited, sweep, get size() { return hits.size; }, entry: (key) => hits.get(key) };
}
