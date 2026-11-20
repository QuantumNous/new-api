import type { LanguageModelV4ToolResultOutput } from '@ai-sdk/provider';
import type { Tool } from '@ai-sdk/provider-utils';
import type { ModelMessage } from 'ai';
import {
  createDefaultDownloadFunction,
  createToolModelOutput,
  downloadAssets,
  mapToolResultOutput,
  type DownloadFunction,
} from 'ai/internal';

/**
 * Converts a single tool result into a provider-level
 * `LanguageModelV4ToolResultOutput`, honoring the tool's optional
 * `toModelOutput` hook.
 *
 * Unlike `generateText`/`streamText`, `WorkflowAgent` assembles the
 * `LanguageModelV4` prompt incrementally — appending one tool result at a time
 * — instead of building AI-level `ModelMessage`s and converting the whole
 * prompt once via `convertToLanguageModelPrompt`. This helper performs the
 * equivalent per-result conversion using the shared `ai/internal` primitives:
 *
 *   1. `createToolModelOutput` — applies `tool.toModelOutput` (or the
 *      text/json/error fallback).
 *   2. `downloadAssets` — for `content`-type outputs, downloads any file/image
 *      assets so URLs become bytes the provider can consume.
 *   3. `mapToolResultOutput` — maps the AI-level `ToolResultOutput` to the
 *      provider-level output and converts legacy file types.
 */
export async function createLanguageModelToolResultOutput({
  toolCallId,
  toolName,
  input,
  output,
  tool,
  errorMode,
  supportedUrls,
  download = createDefaultDownloadFunction(),
  provider,
}: {
  toolCallId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  tool: Tool | undefined;
  errorMode: 'none' | 'text' | 'json';
  supportedUrls: Record<string, RegExp[]>;
  download?: DownloadFunction;
  provider?: string;
}): Promise<LanguageModelV4ToolResultOutput> {
  const modelOutput = await createToolModelOutput({
    toolCallId,
    input,
    output,
    tool,
    errorMode,
  });

  const downloadedAssets =
    modelOutput.type === 'content'
      ? await downloadAssets(
          [
            {
              role: 'tool',
              content: [
                {
                  type: 'tool-result',
                  toolCallId,
                  toolName,
                  output: modelOutput,
                },
              ],
            } satisfies ModelMessage,
          ],
          download,
          supportedUrls,
        )
      : {};

  return mapToolResultOutput({
    output: modelOutput,
    provider,
    downloadedAssets,
  });
}
