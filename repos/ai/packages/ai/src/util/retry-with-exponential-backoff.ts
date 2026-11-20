import { APICallError } from '@ai-sdk/provider';
import { GatewayError } from '@ai-sdk/gateway';
import {
  retryWithExponentialBackoff,
  type RetryFunction,
} from '@ai-sdk/provider-utils';
import { RetryError } from './retry-error';

function getRetryDelayInMs({
  error,
  exponentialBackoffDelay,
}: {
  error: APICallError | GatewayError;
  exponentialBackoffDelay: number;
}): number {
  const headers = APICallError.isInstance(error)
    ? error.responseHeaders
    : APICallError.isInstance(error.cause)
      ? (error.cause as APICallError).responseHeaders
      : undefined;

  if (!headers) return exponentialBackoffDelay;

  let ms: number | undefined;

  // retry-ms is more precise than retry-after and used by e.g. OpenAI
  const retryAfterMs = headers['retry-after-ms'];
  if (retryAfterMs) {
    const timeoutMs = parseFloat(retryAfterMs);
    if (!Number.isNaN(timeoutMs)) {
      ms = timeoutMs;
    }
  }

  // About the Retry-After header: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After
  const retryAfter = headers['retry-after'];
  if (retryAfter && ms === undefined) {
    const timeoutSeconds = parseFloat(retryAfter);
    if (!Number.isNaN(timeoutSeconds)) {
      ms = timeoutSeconds * 1000;
    } else {
      ms = Date.parse(retryAfter) - Date.now();
    }
  }

  // check that the delay is reasonable:
  if (
    ms != null &&
    !Number.isNaN(ms) &&
    0 <= ms &&
    (ms < 60 * 1000 || ms < exponentialBackoffDelay)
  ) {
    return ms;
  }

  return exponentialBackoffDelay;
}

/**
 * The `retryWithExponentialBackoffRespectingRetryHeaders` strategy retries a failed API call with an exponential backoff,
 * while respecting rate limit headers (retry-after-ms and retry-after) if they are provided and reasonable (0-60 seconds).
 * You can configure the maximum number of retries, the initial delay, and the backoff factor.
 */
export const retryWithExponentialBackoffRespectingRetryHeaders = ({
  maxRetries = 2,
  initialDelayInMs = 2000,
  backoffFactor = 2,
  abortSignal,
}: {
  maxRetries?: number;
  initialDelayInMs?: number;
  backoffFactor?: number;
  abortSignal?: AbortSignal;
} = {}): RetryFunction =>
  retryWithExponentialBackoff({
    maxRetries,
    initialDelayInMs,
    backoffFactor,
    abortSignal,
    shouldRetry: error =>
      error instanceof Error &&
      ((APICallError.isInstance(error) && error.isRetryable === true) ||
        (GatewayError.isInstance(error) && error.isRetryable === true)),
    getDelayInMs: ({ error, exponentialBackoffDelay }) =>
      getRetryDelayInMs({
        error: error as APICallError | GatewayError,
        exponentialBackoffDelay,
      }),
    createRetryError: ({ message, reason, errors }) =>
      new RetryError({ message, reason, errors }),
  });
