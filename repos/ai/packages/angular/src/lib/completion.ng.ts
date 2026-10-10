import { signal } from '@angular/core';
import {
  callCompletionApi,
  generateId,
  type CompletionRequestOptions,
  type UseCompletionOptions,
} from 'ai';
import { normalizeHeaders } from '@ai-sdk/provider-utils';

export type CompletionOptions = Readonly<UseCompletionOptions>;

export class Completion {
  readonly #options: CompletionOptions;

  // Static config
  readonly id: string;
  readonly api: string;
  readonly streamProtocol: 'data' | 'text';

  // Reactive state
  readonly #input = signal('');
  readonly #completion = signal<string>('');
  readonly #error = signal<Error | undefined>(undefined);
  readonly #loading = signal<boolean>(false);

  #abortController: AbortController | null = null;

  constructor(options: CompletionOptions = {}) {
    this.#options = options;
    this.#completion.set(options.initialCompletion ?? '');
    this.#input.set(options.initialInput ?? '');
    this.api = options.api ?? '/api/completion';
    this.id = options.id ?? generateId();
    this.streamProtocol = options.streamProtocol ?? 'data';
  }

  /** Current value of the completion. Writable. */
  get completion(): string {
    return this.#completion();
  }
  set completion(value: string) {
    this.#completion.set(value);
  }

  /** Current value of the input. Writable. */
  get input(): string {
    return this.#input();
  }
  set input(value: string) {
    this.#input.set(value);
  }

  /** The error object of the API request */
  get error(): Error | undefined {
    return this.#error();
  }

  /** Flag that indicates whether an API request is in progress. */
  get loading(): boolean {
    return this.#loading();
  }

  /** Abort the current request immediately, keep the generated tokens if any. */
  stop = () => {
    try {
      this.#abortController?.abort();
    } catch {
      // ignore
    } finally {
      this.#loading.set(false);
      this.#abortController = null;
    }
  };

  /** Send a new prompt to the API endpoint and update the completion state. */
  complete = async (prompt: string, options?: CompletionRequestOptions) =>
    this.#triggerRequest(prompt, options);

  /** Form submission handler to automatically reset input and call the completion API */
  handleSubmit = async (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    if (this.#input()) {
      await this.complete(this.#input());
    }
  };

  #triggerRequest = async (
    prompt: string,
    options?: CompletionRequestOptions,
  ) => {
    return callCompletionApi({
      api: this.api,
      prompt,
      credentials: this.#options.credentials,
      headers: {
        ...normalizeHeaders(this.#options.headers),
        ...normalizeHeaders(options?.headers),
      },
      body: {
        ...this.#options.body,
        ...options?.body,
      },
      streamProtocol: this.streamProtocol,
      fetch: this.#options.fetch,
      setCompletion: (completion: string) => {
        this.#completion.set(completion);
      },
      setLoading: (loading: boolean) => {
        this.#loading.set(loading);
      },
      setError: (error: any) => {
        this.#error.set(error);
      },
      setAbortController: abortController => {
        this.#abortController = abortController ?? null;
      },
      onFinish: this.#options.onFinish,
      onError: this.#options.onError,
    });
  };
}
