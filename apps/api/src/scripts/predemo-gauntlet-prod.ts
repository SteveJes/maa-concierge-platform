/**
 * Convenience wrapper — same as `predemo-gauntlet.ts` but targets prod.
 */
process.env.DAPHNE_REPLAY_URL = process.env.DAPHNE_REPLAY_URL ?? "https://api.dubub.com";
await import("./predemo-gauntlet.js");
