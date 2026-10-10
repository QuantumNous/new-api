import type { ToolSet } from '@ai-sdk/provider-utils';

/**
 * Timeout configuration for API calls. Can be specified as:
 * - A number representing milliseconds
 * - An object with `totalMs` property for the total timeout in milliseconds
 * - An object with `stepMs` property for the timeout of each step in milliseconds
 * - An object with `chunkMs` property for the timeout between stream chunks (streaming only)
 * - An object with `toolMs` property for the default timeout for all tool executions
 * - An object with `tools` property for per-tool timeout overrides using `{toolName}Ms` keys
 */
export type TimeoutConfiguration<TOOLS extends ToolSet> =
  | number
  | {
      totalMs?: number;
      stepMs?: number;
      chunkMs?: number;
      toolMs?: number;
      tools?: Partial<Record<`${keyof TOOLS & string}Ms`, number>>;
    };

/**
 * Extracts the total timeout value in milliseconds from a TimeoutConfiguration.
 *
 * @param timeout - The timeout configuration.
 * @returns The total timeout in milliseconds, or undefined if no timeout is configured.
 */
export function getTotalTimeoutMs(
  timeout: TimeoutConfiguration<any> | undefined,
): number | undefined {
  if (timeout == null) {
    return undefined;
  }
  if (typeof timeout === 'number') {
    return timeout;
  }
  return timeout.totalMs;
}

/**
 * Extracts the step timeout value in milliseconds from a TimeoutConfiguration.
 *
 * @param timeout - The timeout configuration.
 * @returns The step timeout in milliseconds, or undefined if no step timeout is configured.
 */
export function getStepTimeoutMs(
  timeout: TimeoutConfiguration<any> | undefined,
): number | undefined {
  if (timeout == null || typeof timeout === 'number') {
    return undefined;
  }
  return timeout.stepMs;
}

/**
 * Extracts the chunk timeout value in milliseconds from a TimeoutConfiguration.
 * This timeout is for streaming only - it aborts if no new chunk is received within the specified duration.
 *
 * @param timeout - The timeout configuration.
 * @returns The chunk timeout in milliseconds, or undefined if no chunk timeout is configured.
 */
export function getChunkTimeoutMs(
  timeout: TimeoutConfiguration<any> | undefined,
): number | undefined {
  if (timeout == null || typeof timeout === 'number') {
    return undefined;
  }
  return timeout.chunkMs;
}

export function getToolTimeoutMs<TOOLS extends ToolSet>(
  timeout: TimeoutConfiguration<TOOLS> | undefined,
  toolName: keyof TOOLS & string,
): number | undefined {
  if (timeout == null || typeof timeout === 'number') {
    return undefined;
  }

  return timeout.tools?.[`${toolName}Ms`] ?? timeout.toolMs;
}

/**
 * Request-facing controls. These settings affect transport, retries,
 * cancellation, headers, and timeout – not model generation behavior.
 */
export type RequestOptions<TOOLS extends ToolSet = ToolSet> = {
  /**
   * Maximum number of retries. Set to 0 to disable retries.
   *
   * @default 2
   */
  maxRetries?: number;

  /**
   * Abort signal.
   */
  abortSignal?: AbortSignal;

  /**
   * Additional HTTP headers to be sent with the request.
   * Only applicable for HTTP-based providers.
   */
  headers?: Record<string, string | undefined>;

  /**
   * Timeout configuration for the request.
   */
  timeout?: TimeoutConfiguration<TOOLS>;
};
