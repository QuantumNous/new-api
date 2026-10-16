import type { JSONValue } from '@ai-sdk/provider';

/**
 * Adapter-namespaced opaque data attached to harness events.
 *
 * Mirrors the `providerMetadata` pattern from `@ai-sdk/provider`, but lives
 * in the harness namespace because a harness is a peer concept to a
 * provider, not a kind of provider.
 *
 * Keys are harness ids (e.g. `'claude-code'`). Inner values are arbitrary
 * JSON-serializable data the adapter chooses to surface to callers.
 */
export type HarnessV1Metadata = Record<string, Record<string, JSONValue>>;
