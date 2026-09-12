/**
 * QuiverAI image model identifier.
 *
 * @see https://quiver.ai/
 */
export type QuiverAIImageModelId =
  | 'arrow-1'
  | 'arrow-1.1'
  | 'arrow-1.1-max'
  | (string & {});

/**
 * QuiverAI image operation:
 * - `generate`: Text-to-SVG generation (default).
 * - `vectorize`: Convert a raster image into an SVG.
 */
export type QuiverAIOperation = 'generate' | 'vectorize';
