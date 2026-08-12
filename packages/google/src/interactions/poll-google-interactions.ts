import {
  createJsonResponseHandler,
  delay,
  getFromApi,
  isAbortError,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import { googleFailedResponseHandler } from '../google-error';
import { cancelGoogleInteraction } from './cancel-google-interaction';
import {
  googleInteractionsResponseSchema,
  type GoogleInteractionsResponse,
} from './google-interactions-api';
import type { GoogleInteractionsStatus } from './google-interactions-prompt';

const TERMINAL_STATUSES: ReadonlySet<GoogleInteractionsStatus | string> =
  new Set(['completed', 'failed', 'cancelled', 'incomplete']);

export function isTerminalStatus(
  status: GoogleInteractionsStatus | string | null | undefined,
): boolean {
  return status != null && TERMINAL_STATUSES.has(status);
}

/*
 * Default polling cadence for background interactions. Starts at 1 s, doubles
 * each tick up to a 10 s ceiling, and gives up after 30 minutes -- agent runs
 * such as deep research can take tens of minutes server-side, so we err on
 * the long side rather than truncate a real run. Override per-call via
 * `providerOptions.google.pollingTimeoutMs`.
 */
const DEFAULT_INITIAL_DELAY_MS = 1000;
const DEFAULT_MAX_DELAY_MS = 10000;
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000;

export type PollGoogleInteractionResult = {
  response: GoogleInteractionsResponse;
  rawResponse: unknown;
  responseHeaders: Record<string, string> | undefined;
};

/**
 * Polls `GET {baseURL}/interactions/{id}` until the response status is
 * terminal (`completed` / `failed` / `cancelled` / `incomplete`). Throws if
 * the polling loop exceeds `timeoutMs`, the response has no `id` to poll on,
 * or the abort signal fires.
 */
export async function pollGoogleInteractionUntilTerminal({
  baseURL,
  interactionId,
  headers,
  fetch,
  abortSignal,
  initialDelayMs = DEFAULT_INITIAL_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  baseURL: string;
  interactionId: string | null | undefined;
  headers: Record<string, string | undefined>;
  fetch?: FetchFunction;
  abortSignal?: AbortSignal;
  initialDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
}): Promise<PollGoogleInteractionResult> {
  if (interactionId == null || interactionId.length === 0) {
    throw new Error(
      'google.interactions: cannot poll a background interaction without an id. ' +
        'The POST response did not include an interaction id.',
    );
  }

  const startedAt = Date.now();
  let nextDelayMs = initialDelayMs;
  const url = `${baseURL}/interactions/${encodeURIComponent(interactionId)}`;

  /*
   * When the caller aborts, fire a best-effort `POST /interactions/{id}/cancel`
   * so the run stops billing on Google's side. Wrap every exit path that's
   * triggered by an abort -- the explicit `abortSignal.aborted` check, the
   * AbortError thrown by `delay()`, and any AbortError thrown by `getFromApi`.
   */
  const cancelOnServer = () =>
    cancelGoogleInteraction({ baseURL, interactionId, headers, fetch });

  try {
    while (true) {
      if (abortSignal?.aborted) {
        await cancelOnServer();
        throw new DOMException('Polling was aborted', 'AbortError');
      }

      if (Date.now() - startedAt > timeoutMs) {
        throw new Error(
          `google.interactions: timed out polling interaction ${interactionId} after ${timeoutMs}ms.`,
        );
      }

      await delay(nextDelayMs, { abortSignal });

      const {
        value: response,
        rawValue: rawResponse,
        responseHeaders,
      } = await getFromApi({
        url,
        headers,
        failedResponseHandler: googleFailedResponseHandler,
        successfulResponseHandler: createJsonResponseHandler(
          googleInteractionsResponseSchema,
        ),
        abortSignal,
        fetch,
      });

      if (isTerminalStatus(response.status)) {
        return { response, rawResponse, responseHeaders };
      }

      nextDelayMs = Math.min(nextDelayMs * 2, maxDelayMs);
    }
  } catch (error) {
    if (isAbortError(error)) {
      await cancelOnServer();
    }
    throw error;
  }
}
