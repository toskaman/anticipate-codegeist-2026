// Minimal Node/Forge runtime ambient (avoids an @types/node dependency).
// Only what the codebase uses: synchronous env reads with string values.
// Backend-only: this code never runs in a browser, so process is always defined.
declare const process: { env: Record<string, string | undefined> };
