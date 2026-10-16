/**
 * If `text` is exactly the wide `string` type, there are no string literals to
 * preserve, so this resolves to `never`.
 *
 * If `text` is a string literal or a union of string literals, this resolves
 * to that literal union unchanged.
 *
 * This is used when building template-literal model identifiers (for example
 * `"provider:modelId"`) so that editors can suggest concrete `modelId` values
 * when the underlying method parameter is narrowed, while falling back to a
 * generic `"provider:${string}"` style overload when the parameter is only
 * typed as `string`.
 */
export type ExtractLiteralUnion<text> = text extends string
  ? string extends text
    ? never
    : text
  : never;
