import {
  createEventSourceResponseHandler,
  delay,
  getFromApi,
  isAbortError,
  type FetchFunction,
  type ParseResult,
} from '@ai-sdk/provider-utils';
import { googleFailedResponseHandler } from '../google-error';
import { cancelGoogleInteraction } from './cancel-google-interaction';
import {
  googleInteractionsEventSchema,
  type GoogleInteractionsEvent,
} from './google-interactions-api';

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

/**
 * Connects to `GET {baseURL}/interactions/{id}?stream=true` and surfaces the
 * server-sent events as a `ReadableStream<ParseResult<GoogleInteractionsEvent>>`
 * so the existing `buildGoogleInteractionsStreamTransform` can consume them
 * unchanged.
 *
 * The connection can drop mid-run: long-running agents idle for long
 * stretches between SSE events and undici's default body timeout terminates
 * the request with `UND_ERR_BODY_TIMEOUT`. We track the last seen `event_id`
 * and reconnect with `?last_event_id=<id>` on any unexpected end. After
 * `maxRetries` consecutive failures the stream errors out so the caller can
 * decide whether to fall back to polling.
 *
 * The stream completes cleanly when an `interaction.complete` event with a
 * terminal status arrives, or when an `error` event arrives.
 */
export function streamGoogleInteractionEvents({
  baseURL,
  interactionId,
  headers,
  fetch,
  abortSignal,
  maxRetries = DEFAULT_MAX_RETRIES,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
}: {
  baseURL: string;
  interactionId: string;
  headers: Record<string, string | undefined>;
  fetch?: FetchFunction;
  abortSignal?: AbortSignal;
  maxRetries?: number;
  retryDelayMs?: number;
}): ReadableStream<ParseResult<GoogleInteractionsEvent>> {
  if (interactionId.length === 0) {
    throw new Error(
      'google.interactions: cannot stream a background interaction without an id.',
    );
  }

  const eventSourceHeaders = {
    ...headers,
    accept: 'text/event-stream',
  };

  let lastEventId: string | undefined;
  let complete = false;
  let attempt = 0;
  let receivedAnyEventThisAttempt = false;
  let currentReader:
    | ReadableStreamDefaultReader<ParseResult<GoogleInteractionsEvent>>
    | undefined;

  /*
   * Forwards `cancel()` from the consumer (and the upstream `abortSignal`) to
   * any in-flight `getFromApi` or `delay` so the loop unblocks immediately
   * instead of waiting for the next iteration to notice a flag.
   */
  const internalAbort = new AbortController();
  const upstreamAbortHandler = () => internalAbort.abort();
  if (abortSignal != null) {
    if (abortSignal.aborted) {
      internalAbort.abort();
    } else {
      abortSignal.addEventListener('abort', upstreamAbortHandler, {
        once: true,
      });
    }
  }
  const effectiveSignal = internalAbort.signal;

  function buildUrl(): string {
    const base = `${baseURL}/interactions/${encodeURIComponent(interactionId)}`;
    const params = new URLSearchParams({ stream: 'true' });
    if (lastEventId != null) {
      params.set('last_event_id', lastEventId);
    }
    return `${base}?${params.toString()}`;
  }

  async function openReader() {
    const { value: stream } = await getFromApi({
      url: buildUrl(),
      validateUrl: false,
      headers: eventSourceHeaders,
      failedResponseHandler: googleFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        googleInteractionsEventSchema,
      ),
      abortSignal: effectiveSignal,
      fetch,
    });
    return stream.getReader();
  }

  return new ReadableStream<ParseResult<GoogleInteractionsEvent>>({
    async start(controller) {
      try {
        while (!complete && !effectiveSignal.aborted) {
          if (currentReader == null) {
            try {
              currentReader = await openReader();
              receivedAnyEventThisAttempt = false;
            } catch (error) {
              if (isAbortError(error) || effectiveSignal.aborted) {
                controller.error(error);
                return;
              }
              attempt++;
              if (attempt >= maxRetries) {
                controller.error(error);
                return;
              }
              await delay(retryDelayMs * attempt, {
                abortSignal: effectiveSignal,
              });
              continue;
            }
          }

          try {
            const { done, value } = await currentReader.read();
            if (done) {
              /*
               * Underlying stream ended. If we already saw the terminal event
               * we exit cleanly; otherwise this is an unexpected disconnect
               * and we'll reconnect with `last_event_id`.
               *
               * If the connection closed without producing any events at all
               * this attempt, count it as a failed attempt -- otherwise an
               * empty/misbehaving server response would loop forever.
               */
              currentReader = undefined;
              if (complete) break;
              if (!receivedAnyEventThisAttempt) {
                attempt++;
                if (attempt >= maxRetries) {
                  controller.error(
                    new Error(
                      'google.interactions: SSE stream closed without producing any events.',
                    ),
                  );
                  return;
                }
                await delay(retryDelayMs * attempt, {
                  abortSignal: effectiveSignal,
                });
              } else {
                attempt = 0;
              }
              continue;
            }

            receivedAnyEventThisAttempt = true;

            if (value.success) {
              const streamEvent = value.value as {
                event_id?: string;
                event_type?: string;
              };
              if (
                typeof streamEvent.event_id === 'string' &&
                streamEvent.event_id.length > 0
              ) {
                lastEventId = streamEvent.event_id;
              }
              if (
                streamEvent.event_type === 'interaction.completed' ||
                streamEvent.event_type === 'error'
              ) {
                complete = true;
              }
            }

            controller.enqueue(value);
          } catch (error) {
            if (isAbortError(error) || effectiveSignal.aborted) {
              controller.error(error);
              return;
            }
            currentReader = undefined;
            attempt++;
            if (attempt >= maxRetries) {
              controller.error(error);
              return;
            }
            await delay(retryDelayMs * attempt, {
              abortSignal: effectiveSignal,
            });
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        if (abortSignal != null) {
          abortSignal.removeEventListener('abort', upstreamAbortHandler);
        }
        currentReader?.cancel().catch(() => {});
        currentReader = undefined;

        /*
         * If we're exiting because the caller aborted (or the consumer
         * cancelled the stream) before the agent finished, fire
         * `POST /interactions/{id}/cancel` so the run stops billing on
         * Google's side. Skipped when `complete` is set -- the agent already
         * reported terminal status via `interaction.complete` / `error`.
         */
        if (effectiveSignal.aborted && !complete) {
          await cancelGoogleInteraction({
            baseURL,
            interactionId,
            headers,
            fetch,
          });
        }
      }
    },

    cancel() {
      internalAbort.abort();
      currentReader?.cancel().catch(() => {});
      currentReader = undefined;
    },
  });
}
