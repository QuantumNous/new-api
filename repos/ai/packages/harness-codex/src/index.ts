import { createCodex } from './codex-harness';

/**
 * Default `codex` harness instance with no overrides — suitable for the
 * common case where the underlying `codex` CLI's defaults are fine.
 * Equivalent to `createCodex()`.
 */
export const codex = createCodex();

export { createCodex } from './codex-harness';
export { VERSION } from './version';
export type { CodexHarnessSettings } from './codex-harness';
export type { CodexAuthOptions } from './codex-auth';
