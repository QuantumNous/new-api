import {
  callCompletionApi,
  generateId,
  type CompletionRequestOptions,
  type UseCompletionOptions,
} from 'ai';
import {
  KeyedCompletionStore,
  getCompletionContext,
  hasCompletionContext,
} from './completion-context.svelte.js';

export type CompletionOptions = Readonly<UseCompletionOptions>;

export class Completion {
  readonly #options: CompletionOptions = {};
  readonly #api = $derived(this.#options.api ?? '/api/completion');
  readonly #id = $derived(this.#options.id ?? generateId());
  readonly #streamProtocol = $derived(this.#options.streamProtocol ?? 'data');
  readonly #keyedStore = $state<KeyedCompletionStore>()!;
  readonly #store = $derived(this.#keyedStore.get(this.#id));
  #abortController: AbortController | undefined;

  /** The current completion result */
  get completion(): string {
    return this.#store.completions.get(this.#id) ?? '';
  }
  set completion(value: string) {
    this.#store.completions.set(this.#id, value);
  }

  /** The error object of the API request */
  get error() {
    return this.#store.error;
  }

  /** The current value of the input. Writable, so it can be bound to form inputs. */
  input = $state<string>()!;

  /**
   * Flag that indicates whether an API request is in progress.
   */
  get loading() {
    return this.#store.loading;
  }

  constructor(options: CompletionOptions = {}) {
    this.#keyedStore = hasCompletionContext()
      ? getCompletionContext()
      : new KeyedCompletionStore();
    this.#options = options;
    this.completion = options.initialCompletion ?? '';
    this.input = options.initialInput ?? '';
  }

  /**
   * Abort the current request immediately, keep the generated tokens if any.
   */
  stop = () => {
    try {
      this.#abortController?.abort();
    } catch {
      // ignore
    } finally {
      this.#store.loading = false;
      this.#abortController = undefined;
    }
  };

  /**
   * Send a new prompt to the API endpoint and update the completion state.
   */
  complete = async (prompt: string, options?: CompletionRequestOptions) =>
    this.#triggerRequest(prompt, options);

  /** Form submission handler to automatically reset input and call the completion API */
  handleSubmit = async (event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    if (this.input) {
      await this.complete(this.input);
    }
  };

  #triggerRequest = async (
    prompt: string,
    options?: CompletionRequestOptions,
  ) => {
    return callCompletionApi({
      api: this.#api,
      prompt,
      credentials: this.#options.credentials,
      headers: { ...this.#options.headers, ...options?.headers },
      body: {
        ...this.#options.body,
        ...options?.body,
      },
      streamProtocol: this.#streamProtocol,
      fetch: this.#options.fetch,
      // throttle streamed ui updates:
      setCompletion: completion => {
        this.completion = completion;
      },
      setLoading: loading => {
        this.#store.loading = loading;
      },
      setError: error => {
        this.#store.error = error;
      },
      setAbortController: abortController => {
        this.#abortController = abortController ?? undefined;
      },
      onFinish: this.#options.onFinish,
      onError: this.#options.onError,
    });
  };
}
