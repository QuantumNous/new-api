/**
 * Type-only module: declares the union of supported Gemini Interactions agent
 * names. Used by the `google.interactions({ agent })` factory branch.
 *
 * Strict string-literal union: unknown agent names are a compile-time error.
 * User-defined agents (created via the `/agents` endpoint) are addressed by
 * a separate `{ managedAgent: string }` factory shape — see
 * `GoogleInteractionsModelInput`.
 */

export type GoogleInteractionsAgentName =
  | 'deep-research-pro-preview-12-2025'
  | 'deep-research-preview-04-2026'
  | 'deep-research-max-preview-04-2026'
  | 'antigravity-preview-05-2026';
