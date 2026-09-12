import {
  type AbstractChat,
  type ChatInit,
  type ChatTransport,
  type CreateUIMessage,
  type UIMessage,
  DefaultChatTransport,
} from 'ai';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Chat } from './chat.react';

export type { CreateUIMessage, UIMessage };

export type UseChatHelpers<UI_MESSAGE extends UIMessage> = {
  /**
   * The id of the chat.
   */
  readonly id: string;

  /**
   * Update the `messages` state locally. This is useful when you want to
   * edit the messages on the client, and then trigger the `reload` method
   * manually to regenerate the AI response.
   */
  setMessages: (
    messages: UI_MESSAGE[] | ((messages: UI_MESSAGE[]) => UI_MESSAGE[]),
  ) => void;

  error: Error | undefined;
} & Pick<
  AbstractChat<UI_MESSAGE>,
  | 'sendMessage'
  | 'regenerate'
  | 'stop'
  | 'resumeStream'
  | 'addToolResult'
  | 'addToolOutput'
  | 'addToolApprovalResponse'
  | 'status'
  | 'messages'
  | 'clearError'
>;

export type UseChatOptions<UI_MESSAGE extends UIMessage> = (
  | { chat: Chat<UI_MESSAGE> }
  | ChatInit<UI_MESSAGE>
) & {
  /**
   * Custom throttle wait in ms for the chat messages and data updates.
   * Default is undefined, which disables throttling.
   */
  throttle?: number;

  /**
   * @deprecated Use `throttle` instead.
   */
  experimental_throttle?: number;

  /**
   * Whether to resume an ongoing chat generation stream.
   */
  resume?: boolean;
};

export function useChat<UI_MESSAGE extends UIMessage = UIMessage>({
  throttle,
  experimental_throttle,
  resume = false,
  ...options
}: UseChatOptions<UI_MESSAGE> = {}): UseChatHelpers<UI_MESSAGE> {
  const throttleWaitMs = throttle ?? experimental_throttle;
  // the Chat instance is created once and not recreated when options change,
  // so it would normally keep the callbacks/transport from the first render forever

  // keep latest values in a ref that is refreshed on every render,
  // and hand `Chat` stable wrappers that read from it to avoid stale closures
  const latestRef = useRef<
    Partial<
      Pick<
        ChatInit<UI_MESSAGE>,
        | 'onToolCall'
        | 'onData'
        | 'onFinish'
        | 'onError'
        | 'sendAutomaticallyWhen'
        | 'transport'
      >
    >
  >({});

  if (!('chat' in options)) {
    latestRef.current = {
      onToolCall: options.onToolCall,
      onData: options.onData,
      onFinish: options.onFinish,
      onError: options.onError,
      sendAutomaticallyWhen: options.sendAutomaticallyWhen,
      transport: options.transport,
    };
  }

  // resolve the latest transport and fallback to a lazily created default transport
  let defaultTransport: ChatTransport<UI_MESSAGE> | undefined;
  const getTransport = () =>
    latestRef.current.transport ??
    (defaultTransport ??= new DefaultChatTransport<UI_MESSAGE>());

  // give `Chat` stable wrappers that always read the latest values from `latestRef`
  const chatOptions: typeof options = {
    ...options,
    transport: {
      sendMessages: sendOptions => getTransport().sendMessages(sendOptions),
      reconnectToStream: reconnectOptions =>
        getTransport().reconnectToStream(reconnectOptions),
    },
    onToolCall: arg => latestRef.current.onToolCall?.(arg),
    onData: arg => latestRef.current.onData?.(arg),
    onFinish: arg => latestRef.current.onFinish?.(arg),
    onError: arg => latestRef.current.onError?.(arg),
    sendAutomaticallyWhen: arg =>
      latestRef.current.sendAutomaticallyWhen?.(arg) ?? false,
  };

  const chatRef = useRef<Chat<UI_MESSAGE>>(
    'chat' in options ? options.chat : new Chat(chatOptions),
  );

  const shouldRecreateChat =
    ('chat' in options && options.chat !== chatRef.current) ||
    ('id' in options &&
      options.id != null &&
      chatRef.current.id !== options.id);

  if (shouldRecreateChat) {
    chatRef.current = 'chat' in options ? options.chat : new Chat(chatOptions);
  }

  const subscribeToMessages = useCallback(
    (update: () => void) =>
      chatRef.current['~registerMessagesCallback'](update, throttleWaitMs),
    // `chatRef.current.id` is required to trigger re-subscription when the chat ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [throttleWaitMs, chatRef.current.id],
  );

  const messages = useSyncExternalStore(
    subscribeToMessages,
    () => chatRef.current.messages,
    () => chatRef.current.messages,
  );

  const status = useSyncExternalStore(
    chatRef.current['~registerStatusCallback'],
    () => chatRef.current.status,
    () => chatRef.current.status,
  );

  const error = useSyncExternalStore(
    chatRef.current['~registerErrorCallback'],
    () => chatRef.current.error,
    () => chatRef.current.error,
  );

  const setMessages = useCallback(
    (
      messagesParam: UI_MESSAGE[] | ((messages: UI_MESSAGE[]) => UI_MESSAGE[]),
    ) => {
      if (typeof messagesParam === 'function') {
        messagesParam = messagesParam(chatRef.current.messages);
      }
      chatRef.current.messages = messagesParam;
    },
    [chatRef],
  );

  useEffect(() => {
    if (resume) {
      chatRef.current.resumeStream();
    }
  }, [resume, chatRef]);

  return {
    id: chatRef.current.id,
    messages,
    setMessages,
    sendMessage: chatRef.current.sendMessage,
    regenerate: chatRef.current.regenerate,
    clearError: chatRef.current.clearError,
    stop: chatRef.current.stop,
    error,
    resumeStream: chatRef.current.resumeStream,
    status,
    /**
     * @deprecated Use `addToolOutput` instead.
     */
    addToolResult: chatRef.current.addToolOutput,
    addToolOutput: chatRef.current.addToolOutput,
    addToolApprovalResponse: chatRef.current.addToolApprovalResponse,
  };
}
