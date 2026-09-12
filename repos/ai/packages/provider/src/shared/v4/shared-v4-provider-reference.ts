/**
 * A mapping of provider names to provider-specific file identifiers.
 *
 * Provider references allow files to be identified across different
 * providers without re-uploading, by storing each provider's own
 * identifier for the same logical file.
 *
 * ```ts
 * {
 *   "openai": "file-abc123",
 *   "anthropic": "file-xyz789"
 * }
 * ```
 *
 * The `type?: never` constraint excludes any object that has a `type`
 * property, so a `SharedV4ProviderReference` cannot be confused with a
 * tagged file-data shape (e.g. `{ type: 'data', data }` or
 * `{ type: 'reference', reference }`) when both appear in the same union.
 */
export type SharedV4ProviderReference = Record<string, string> & {
  type?: never;
};
