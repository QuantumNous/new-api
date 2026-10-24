import { delay } from './delay';
import { getErrorMessage } from './get-error-message';
import { isAbortError } from './is-abort-error';

export type RetryFunction = <OUTPUT>(
  fn: () => PromiseLike<OUTPUT>,
) => PromiseLike<OUTPUT>;

export type RetryErrorReason = 'maxRetriesExceeded' | 'errorNotRetryable';

export type RetryErrorFactory = ({
  message,
  reason,
  errors,
}: {
  message: string;
  reason: RetryErrorReason;
  errors: Array<unknown>;
}) => unknown;

export type RetryDelayProvider = ({
  error,
  exponentialBackoffDelay,
}: {
  error: unknown;
  exponentialBackoffDelay: number;
}) => number;

export type ShouldRetryFunction = (
  error: unknown,
) => boolean | Promise<boolean>;

/**
 * Retries a failed operation with exponential backoff.
 */
export const retryWithExponentialBackoff =
  ({
    maxRetries = 2,
    initialDelayInMs = 2000,
    backoffFactor = 2,
    abortSignal,
    shouldRetry,
    getDelayInMs = ({ exponentialBackoffDelay }) => exponentialBackoffDelay,
    createRetryError = ({ message }) => new Error(message),
  }: {
    maxRetries?: number;
    initialDelayInMs?: number;
    backoffFactor?: number;
    abortSignal?: AbortSignal;
    shouldRetry: ShouldRetryFunction;
    getDelayInMs?: RetryDelayProvider;
    createRetryError?: RetryErrorFactory;
  }): RetryFunction =>
  async <OUTPUT>(f: () => PromiseLike<OUTPUT>) =>
    retryWithExponentialBackoffInternal(f, {
      maxRetries,
      delayInMs: initialDelayInMs,
      backoffFactor,
      abortSignal,
      shouldRetry,
      getDelayInMs,
      createRetryError,
    });

async function retryWithExponentialBackoffInternal<OUTPUT>(
  f: () => PromiseLike<OUTPUT>,
  {
    maxRetries,
    delayInMs,
    backoffFactor,
    abortSignal,
    shouldRetry,
    getDelayInMs,
    createRetryError,
  }: {
    maxRetries: number;
    delayInMs: number;
    backoffFactor: number;
    abortSignal: AbortSignal | undefined;
    shouldRetry: ShouldRetryFunction;
    getDelayInMs: RetryDelayProvider;
    createRetryError: RetryErrorFactory;
  },
  errors: unknown[] = [],
): Promise<OUTPUT> {
  try {
    return await f();
  } catch (error) {
    if (isAbortError(error)) {
      throw error; // don't retry when the request was aborted
    }

    if (maxRetries === 0) {
      throw error; // don't wrap the error when retries are disabled
    }

    const errorMessage = getErrorMessage(error);
    const newErrors = [...errors, error];
    const tryNumber = newErrors.length;

    if (tryNumber > maxRetries) {
      throw createRetryError({
        message: `Failed after ${tryNumber} attempts. Last error: ${errorMessage}`,
        reason: 'maxRetriesExceeded',
        errors: newErrors,
      });
    }

    if ((await shouldRetry(error)) && tryNumber <= maxRetries) {
      await delay(
        getDelayInMs({
          error,
          exponentialBackoffDelay: delayInMs,
        }),
        { abortSignal },
      );

      return retryWithExponentialBackoffInternal(
        f,
        {
          maxRetries,
          delayInMs: backoffFactor * delayInMs,
          backoffFactor,
          abortSignal,
          shouldRetry,
          getDelayInMs,
          createRetryError,
        },
        newErrors,
      );
    }

    if (tryNumber === 1) {
      throw error; // don't wrap the error when a non-retryable error occurs on the first try
    }

    throw createRetryError({
      message: `Failed after ${tryNumber} attempts with non-retryable error: '${errorMessage}'`,
      reason: 'errorNotRetryable',
      errors: newErrors,
    });
  }
}
