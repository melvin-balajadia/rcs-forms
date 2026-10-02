// Locks a username after repeated failed logins.
//
// Keyed by username, not IP: nginx forwards raw TCP, so every request reaches
// the API from nginx's address and per-IP limits would lump all users
// together. Unknown usernames are tracked the same way, so a lock never
// reveals whether an account exists.
//
// In-memory, per server process — fine for one API instance per site. A
// restart clears all locks.

export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60 * 1000;
const MAX_TRACKED = 10_000; // bounds memory if someone sprays random usernames

const failures = new Map(); // key -> { count, firstAt, lockedUntil }

const keyOf = (username) => String(username).trim().toLowerCase();

const sweep = (now) => {
  for (const [key, entry] of failures) {
    const expired = entry.lockedUntil
      ? entry.lockedUntil <= now
      : now - entry.firstAt > LOCK_MS;
    if (expired) failures.delete(key);
  }
};

// Milliseconds until the username may try again, or 0 if it isn't locked
export const lockRemainingMs = (username) => {
  const entry = failures.get(keyOf(username));
  if (!entry?.lockedUntil) return 0;
  const remaining = entry.lockedUntil - Date.now();
  if (remaining <= 0) {
    failures.delete(keyOf(username));
    return 0;
  }
  return remaining;
};

export const recordFailure = (username) => {
  const now = Date.now();
  const key = keyOf(username);
  let entry = failures.get(key);

  // Failures only count within one lock window
  if (!entry || now - entry.firstAt > LOCK_MS) {
    if (failures.size >= MAX_TRACKED) sweep(now);
    entry = { count: 0, firstAt: now, lockedUntil: null };
    failures.set(key, entry);
  }

  entry.count += 1;
  if (entry.count >= MAX_FAILURES) entry.lockedUntil = now + LOCK_MS;
};

export const recordSuccess = (username) => failures.delete(keyOf(username));
