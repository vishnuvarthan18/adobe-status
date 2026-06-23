const cache = new Map();
const TTL = 10 * 60 * 1000; // 10 minutes

export function getCached(email) {
  const entry = cache.get(email);
  if (entry && Date.now() - entry.ts < TTL) return entry.data;
  cache.delete(email);
  return null;
}

export function setCached(email, data) {
  cache.set(email, { data, ts: Date.now() });
}

export function clearCached(email) {
  cache.delete(email);
}
