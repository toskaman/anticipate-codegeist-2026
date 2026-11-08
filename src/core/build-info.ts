import type { BuildInfo } from '../../packages/contracts/src/index';

// Minimal ambient for the Forge/Node runtime (no @types/node dependency).
declare const process: { env: Record<string, string | undefined> } | undefined;

/**
 * Deployed-build identity (#217). Values are stamped at deploy time via Forge
 * custom variables (ANTICIPATE_BUILD_COMMIT / ANTICIPATE_BUILD_AT); absent or
 * malformed values fail closed to nulls (forge tunnel, CI, older builds).
 * Never throws. The optional env parameter exists for tests; production callers
 * use the default, which reads the live process environment.
 */
const COMMIT_RE = /^[0-9a-f]{4,64}$/i;

export function loadBuildInfo(env: Record<string, string | undefined> = process?.env ?? {}): BuildInfo {
  const rawCommit = env.ANTICIPATE_BUILD_COMMIT;
  const rawAt = env.ANTICIPATE_BUILD_AT;
  return {
    commit: rawCommit !== undefined && COMMIT_RE.test(rawCommit) ? rawCommit : null,
    builtAt: rawAt !== undefined && !Number.isNaN(Date.parse(rawAt)) ? rawAt : null
  };
}
