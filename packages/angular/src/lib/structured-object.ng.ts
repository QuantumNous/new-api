import {
  generateId,
  isAbortError,
  normalizeHeaders,
  safeValidateTypes,
  type FetchFunction,
  type FlexibleSchema,
  type InferSchema,
} from '@ai-sdk/provider-utils';
import { signal } from '@angular/core';
import {
  asSchema,
  isDeepEqualData,
  parsePartialJson,
  type DeepPartial,
} from 'ai';
export type StructuredObjectOptions<
  SCHEMA extends FlexibleSchema,
  RESULT = InferSchema<SCHEMA>,
> = {
  /**
   * The API endpoint. It should stream JSON that matches the schema as chunked text.
   */
  api: string;

  /**
   * A schema that defines the shape of the complete object.
   */
  schema: SCHEMA;

  /**
   * A unique identifier. If not provided, a random one will be
   * generated. When provided, the `useObject` hook with the same `id` will
   * have shared states across components.
   */
  id?: string;

  /**
   * An optional value for the initial object.
   */
  initialValue?: DeepPartial<RESULT>;

  /**
   * Custom fetch implementation. You can use it as a middleware to intercept requests,
   * or to provide a custom fetch implementation for e.g. testing.
   */
  fetch?: FetchFunction;

  /**
   * Callback that is called when the stream has finished.
   */
  onFinish?: (event: {
    /**
     * The generated object (typed according to the schema).
     * Can be undefined if the final object does not match the schema.
     */
    object: RESULT | undefined;

    /**
     * Optional error object. This is e.g. a TypeValidationError when the final object does not match the schema.
     */
    error: Error | undefined;
  }) => Promise<void> | void;

  /**
   * Callback function to be called when an error is encountered.
   */
  onError?: (error: Error) => void;

  /**
   * Additional HTTP headers to be included in the request.
   */
  headers?: Record<string, string> | Headers;

  /**
   * The credentials mode to be used for the fetch request.
   * Possible values are: 'omit', 'same-origin', 'include'.
   * Defaults to 'same-origin'.
   */
  credentials?: RequestCredentials;
};

export class StructuredObject<
  SCHEMA extends FlexibleSchema,
  RESULT = InferSchema<SCHEMA>,
  INPUT = unknown,
> {
  readonly options: StructuredObjectOptions<SCHEMA, RESULT>;
  readonly id: string;
  #abortController: AbortController | undefined;

  // Reactive state
  readonly #object = signal<DeepPartial<RESULT> | undefined>(undefined);
  readonly #loading = signal<boolean>(false);
  readonly #error = signal<Error | undefined>(undefined);

  /**
   * The current value for the generated object. Updated as the API streams JSON chunks.
   */
  get object(): DeepPartial<RESULT> | undefined {
    return this.#object();
  }

  /** The error object of the API request */
  get error(): Error | undefined {
    return this.#error();
  }

  /**
   * Flag that indicates whether an API request is in progress.
   */
  get loading(): boolean {
    return this.#loading();
  }

  constructor(options: StructuredObjectOptions<SCHEMA, RESULT>) {
    this.options = options;
    this.id = options.id ?? generateId();
    this.#object.set(options.initialValue);
  }

  /**
   * Abort the current request immediately, keep the current partial object if any.
   */
  stop = () => {
    try {
      this.#abortController?.abort();
    } catch {
      // ignore
    } finally {
      this.#loading.set(false);
      this.#abortController = undefined;
    }
  };

  /**
   * Calls the API with the provided input as JSON body.
   */
  submit = async (input: INPUT) => {
    try {
      this.#object.set(undefined); // reset the data
      this.#loading.set(true);
      this.#error.set(undefined);

      const abortController = new AbortController();
      this.#abortController = abortController;

      const actualFetch = this.options.fetch ?? fetch;
      const response = await actualFetch(this.options.api, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...normalizeHeaders(this.options.headers),
        },
        credentials: this.options.credentials,
        signal: abortController.signal,
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(
          (await response.text()) ?? 'Failed to fetch the response.',
        );
      }

      if (response.body == null) {
        throw new Error('The response body is empty.');
      }

      let accumulatedText = '';
      let latestObject: DeepPartial<RESULT> | undefined = undefined;

      await response.body.pipeThrough(new TextDecoderStream()).pipeTo(
        new WritableStream<string>({
          write: async chunk => {
            if (abortController?.signal.aborted) {
              throw new DOMException('Stream aborted', 'AbortError');
            }
            accumulatedText += chunk;

            const { value } = await parsePartialJson(accumulatedText);
            const currentObject = value as DeepPartial<RESULT>;

            if (!isDeepEqualData(latestObject, currentObject)) {
              latestObject = currentObject;

              this.#object.set(currentObject);
            }
          },

          close: async () => {
            this.#loading.set(false);
            this.#abortController = undefined;

            if (this.options.onFinish != null) {
              const validationResult = await safeValidateTypes({
                value: latestObject,
                schema: asSchema(this.options.schema),
              });

              if (validationResult.success) {
                this.options.onFinish({
                  object: validationResult.value,
                  error: undefined,
                });
              } else {
                this.options.onFinish({
                  object: undefined,
                  error: (validationResult as { error: Error }).error,
                });
              }
            }
          },
        }),
      );
    } catch (error) {
      if (isAbortError(error)) {
        return;
      }

      const coalescedError =
        error instanceof Error ? error : new Error(String(error));
      if (this.options.onError) {
        this.options.onError(coalescedError);
      }

      this.#loading.set(false);
      this.#error.set(coalescedError);
    }
  };
}
