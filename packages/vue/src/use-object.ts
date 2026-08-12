import {
  isAbortError,
  safeValidateTypes,
  type FetchFunction,
} from '@ai-sdk/provider-utils';
import {
  asSchema,
  isDeepEqualData,
  parsePartialJson,
  type DeepPartial,
  type FlexibleSchema,
  type InferSchema,
} from 'ai';
import type * as SwrvModule from 'swrv';
import swrv from 'swrv';
import { ref, type Ref } from 'vue';
// use function to allow for mocking in tests
const getOriginalFetch = () => fetch;

export type Experimental_UseObjectOptions<
  SCHEMA extends FlexibleSchema,
  RESULT,
> = {
  /** API endpoint that streams JSON chunks matching the schema */
  api: string;

  /** Schema that defines the final object shape */
  schema: SCHEMA;

  /** Shared state key. If omitted a random one is generated */
  id?: string;

  /** Initial partial value */
  initialValue?: DeepPartial<RESULT>;

  /** Optional custom fetch implementation */
  fetch?: FetchFunction;

  /** Called when stream ends */
  onFinish?: (event: {
    object: RESULT | undefined;
    error: Error | undefined;
  }) => Promise<void> | void;

  /** Called on error */
  onError?: (error: Error) => void;

  /** Extra request headers */
  headers?: Record<string, string> | Headers;

  /** Request credentials mode. Defaults to 'same-origin' if omitted */
  credentials?: RequestCredentials;
};

export type Experimental_UseObjectHelpers<RESULT, INPUT> = {
  /** POST the input and start streaming */
  submit: (input: INPUT) => void;

  /** Current partial object, updated as chunks arrive */
  object: Ref<DeepPartial<RESULT> | undefined>;

  /** Latest error if any */
  error: Ref<Error | undefined>;

  /** Loading flag for the in-flight request */
  isLoading: Ref<boolean | undefined>;

  /** Abort the current request. Keeps current partial object. */
  stop: () => void;

  /** Abort and clear all state */
  clear: () => void;
};

let uniqueId = 0;

// @ts-expect-error - some issues with the default export of useSWRV
const useSWRV = (swrv.default as (typeof SwrvModule)['default']) || swrv;
const store: Record<string, any> = {};

export const experimental_useObject = function useObject<
  SCHEMA extends FlexibleSchema,
  RESULT = InferSchema<SCHEMA>,
  INPUT = any,
>({
  api,
  id,
  schema,
  initialValue,
  fetch,
  onError,
  onFinish,
  headers,
  credentials,
}: Experimental_UseObjectOptions<
  SCHEMA,
  RESULT
>): Experimental_UseObjectHelpers<RESULT, INPUT> {
  // Generate an unique id for the object if not provided.
  const completionId = id || `completion-${uniqueId++}`;

  const key = `${api}|${completionId}`;
  const { data, mutate: originalMutate } = useSWRV<
    DeepPartial<RESULT> | undefined
  >(key, () => (key in store ? store[key] : initialValue));

  const { data: isLoading, mutate: mutateLoading } = useSWRV<boolean>(
    `${completionId}-loading`,
    null,
  );

  isLoading.value ??= false;
  data.value ||= initialValue as DeepPartial<RESULT> | undefined;

  const mutateObject = (value: DeepPartial<RESULT> | undefined) => {
    store[key] = value;
    return originalMutate();
  };

  const error = ref<Error | undefined>(undefined);
  let abortController: AbortController | null = null;

  const stop = async () => {
    if (abortController) {
      try {
        abortController.abort();
      } catch {
        // ignore
      } finally {
        abortController = null;
      }
    }
    await mutateLoading(() => false);
  };

  const clearObject = async () => {
    error.value = undefined;
    await mutateLoading(() => false);
    await mutateObject(undefined);
    // Need to explicitly set the value to undefined to trigger a re-render
    data.value = undefined;
  };

  const clear = async () => {
    await stop();
    await clearObject();
  };

  const submit = async (input: INPUT) => {
    try {
      await clearObject();
      await mutateLoading(() => true);

      abortController = new AbortController();

      const actualFetch = fetch ?? getOriginalFetch();
      const response = await actualFetch(api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(headers as any),
        },
        credentials: credentials ?? 'same-origin',
        signal: abortController.signal,
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) || 'Failed to fetch the response.',
        );
      }

      if (!response.body) {
        throw new Error('The response body is empty.');
      }

      let accumulatedText = '';
      let latestObject: DeepPartial<RESULT> | undefined = undefined;

      await response.body.pipeThrough(new TextDecoderStream()).pipeTo(
        new WritableStream<string>({
          async write(chunk) {
            accumulatedText += chunk;
            const { value } = await parsePartialJson(accumulatedText);
            const currentObject = value as DeepPartial<RESULT>;
            if (!isDeepEqualData(latestObject, currentObject)) {
              latestObject = currentObject;
              await mutateObject(currentObject);
            }
          },
          async close() {
            await mutateLoading(() => false);
            abortController = null;

            if (onFinish) {
              const validationResult = await safeValidateTypes({
                value: latestObject,
                schema: asSchema(schema),
              });

              onFinish(
                validationResult.success
                  ? {
                      object: validationResult.value as RESULT,
                      error: undefined,
                    }
                  : { object: undefined, error: validationResult.error },
              );
            }
          },
        }),
      );
    } catch (err: unknown) {
      if (isAbortError(err)) return;

      if (onError && err instanceof Error) onError(err);

      await mutateLoading(() => false);
      error.value = err instanceof Error ? err : new Error(String(err));
    }
  };

  return {
    submit,
    object: data,
    error,
    isLoading,
    stop,
    clear,
  };
};
