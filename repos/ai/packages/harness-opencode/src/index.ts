import { createOpenCode } from './opencode-harness';

/**
 * Default `openCode` harness instance with no overrides. Equivalent to
 * `createOpenCode()`.
 */
export const openCode = createOpenCode();

export { createOpenCode } from './opencode-harness';
export { VERSION } from './version';
export type { OpenCodeHarnessSettings } from './opencode-harness';
export type { OpenCodeAuthOptions } from './opencode-auth';
