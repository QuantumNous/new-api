import { createClaudeCode } from './claude-code-harness';

/**
 * Default `claude-code` harness instance with no overrides — suitable for the
 * common case where the underlying `claude` CLI's defaults are fine.
 * Equivalent to `createClaudeCode()`.
 */
export const claudeCode = createClaudeCode();

export { createClaudeCode } from './claude-code-harness';
export type { ClaudeCodeHarnessSettings } from './claude-code-harness';
export type { ClaudeCodeAuthOptions } from './claude-code-auth';
