/**
 * Checks if the given model ID is a Mistral model.
 * Mistral models on Bedrock are prefixed with 'mistral.' or region-prefixed like 'us.mistral.'.
 */
export function isMistralModel(modelId: string): boolean {
  return modelId.includes('mistral.');
}

/**
 * Normalizes a tool call ID for Mistral models.
 *
 * Mistral models require tool call IDs to match the regex `^[a-zA-Z0-9]{9}$`:
 * - Exactly 9 characters
 * - Alphanumeric only (no underscores, hyphens, or other characters)
 *
 * Bedrock generates tool call IDs in formats like `tooluse_bpe71yCfRu2b5i-nKGDr5g`,
 * which are incompatible with Mistral's requirements.
 *
 * This function extracts the first 9 alphanumeric characters from the ID.
 *
 * @param toolCallId - The original tool call ID from Bedrock
 * @param isMistral - Whether the model is a Mistral model
 * @returns The normalized tool call ID (9 alphanumeric chars) if Mistral, otherwise the original ID
 */
export function normalizeToolCallId(
  toolCallId: string,
  isMistral: boolean,
): string {
  if (!isMistral) {
    return toolCallId;
  }

  // Extract only alphanumeric characters and take first 9
  const alphanumericChars = toolCallId.replace(/[^a-zA-Z0-9]/g, '');
  return alphanumericChars.slice(0, 9);
}
