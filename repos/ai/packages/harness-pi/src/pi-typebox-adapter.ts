import { Type, type TSchema } from 'typebox';

/**
 * Wrap a JSON Schema 7 fragment so Pi's `defineTool({ parameters })` accepts
 * it. Pi v0.77 uses TypeBox at the type level but treats `parameters` as
 * opaque schema metadata at runtime, so `Type.Unsafe(jsonSchema)` is
 * sufficient — no per-property structural conversion is needed.
 */
export function toolSpecToTypeBoxParameters(jsonSchema: unknown): TSchema {
  return Type.Unsafe(jsonSchema as object);
}
