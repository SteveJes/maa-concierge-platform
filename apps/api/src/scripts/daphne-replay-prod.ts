/**
 * Convenience wrapper — same as `daphne-replay.ts` but targets prod.
 * Lets us avoid platform-specific env-var inline syntax in package.json
 * (cross-env not installed, and PowerShell vs bash differ).
 */
process.env.DAPHNE_REPLAY_URL = process.env.DAPHNE_REPLAY_URL ?? "https://api.dubub.com";
await import("./daphne-replay.js");
