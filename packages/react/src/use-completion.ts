import {
  callCompletionApi,
  type CompletionRequestOptions,
  type UseCompletionOptions,
} from 'ai';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import useSWR from 'swr';
import { throttle } from './throttle';

export type { UseCompletionOptions };

export type UseCompletionHelpers = {
  /** The current completion result */
  completion: string;
  /**
   * Send a new prompt to the API endpoint and update the completion state.
   */
  complete: (
    prompt: string,
    options?: CompletionRequestOptions,
  ) => Promise<string | null | undefined>;
  /** The error object of the API request */
  error: undefined | Error;
  /**
   * Abort the current API request but keep the generated tokens.
   */
  stop: () => void;
  /**
   * Update the `completion` state locally.
   */
  setCompletion: (completion: string) => void;
  /** The current value of the input */
  input: string;
  /** setState-powered method to update the input value */
  setInput: React.Dispatch<React.SetStateAction<string>>;
  /**
   * An input/textarea-ready onChange handler to control the value of the input
   * @example
   * ```jsx
   * <input onChange={handleInputChange} value={input} />
   * ```
   */
  handleInputChange: (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) => void;

  /**
   * Form submission handler to automatically reset input and append a user message
   * @example
   * ```jsx
   * <form onSubmit={handleSubmit}>
   *  <input onChange={handleInputChange} value={input} />
   * </form>
   * ```
   */
  handleSubmit: (event?: { preventDefault?: () => void }) => void;

  /** Whether the API request is in progress */
  isLoading: boolean;
};

export function useCompletion({
  api = '/api/completion',
  id,
  initialCompletion = '',
  initialInput = '',
  credentials,
  headers,
  body,
  streamProtocol = 'data',
  fetch,
  onFinish,
  onError,
  experimental_throttle: throttleWaitMs,
}: UseCompletionOptions & {
  /**
   * Custom throttle wait in ms for the completion and data updates.
   * Default is undefined, which disables throttling.
   */
  experimental_throttle?: number;
} = {}): UseCompletionHelpers {
  // Generate an unique id for the completion if not provided.
  const hookId = useId();
  const completionId = id || hookId;

  // Store the completion state in SWR, using the completionId as the key to share states.
  const { data, mutate } = useSWR<string>([api, completionId], null, {
    fallbackData: initialCompletion,
  });

  const { data: isLoading = false, mutate: mutateLoading } = useSWR<boolean>(
    [completionId, 'loading'],
    null,
  );

  const [error, setError] = useState<undefined | Error>(undefined);
  const completion = data!;

  // Abort controller to cancel the current API call.
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const extraMetadataRef = useRef({
    credentials,
    headers,
    body,
  });

  useEffect(() => {
    extraMetadataRef.current = {
      credentials,
      headers,
      body,
    };
  }, [credentials, headers, body]);

  const triggerRequest = useCallback(
    async (prompt: string, options?: CompletionRequestOptions) =>
      callCompletionApi({
        api,
        prompt,
        credentials: extraMetadataRef.current.credentials,
        headers: { ...extraMetadataRef.current.headers, ...options?.headers },
        body: {
          ...extraMetadataRef.current.body,
          ...options?.body,
        },
        streamProtocol,
        fetch,
        // throttle streamed ui updates:
        setCompletion: throttle(
          (completion: string) => mutate(completion, false),
          throttleWaitMs,
        ),
        setLoading: mutateLoading,
        setError,
        setAbortController,
        onFinish,
        onError,
      }),
    [
      mutate,
      mutateLoading,
      api,
      extraMetadataRef,
      setAbortController,
      onFinish,
      onError,
      setError,
      streamProtocol,
      fetch,
      throttleWaitMs,
    ],
  );

  const stop = useCallback(() => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
  }, [abortController]);

  const setCompletion = useCallback(
    (completion: string) => {
      mutate(completion, false);
    },
    [mutate],
  );

  const complete = useCallback<UseCompletionHelpers['complete']>(
    async (prompt, options) => {
      return triggerRequest(prompt, options);
    },
    [triggerRequest],
  );

  const [input, setInput] = useState(initialInput);

  const handleSubmit = useCallback(
    (event?: { preventDefault?: () => void }) => {
      event?.preventDefault?.();
      return input ? complete(input) : undefined;
    },
    [input, complete],
  );

  const handleInputChange = useCallback(
    (e: any) => {
      setInput(e.target.value);
    },
    [setInput],
  );

  return {
    completion,
    complete,
    error,
    setCompletion,
    stop,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
  };
}
