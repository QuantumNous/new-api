import {
  AbstractChat,
  type ChatInit as BaseChatInit,
  type ChatInit,
  type ChatState,
  type ChatStatus,
  type UIMessage,
} from 'ai';
import {
  computed,
  shallowRef,
  toValue,
  triggerRef,
  watch,
  type ComputedRef,
  type MaybeRefOrGetter,
  type ShallowRef,
} from 'vue';

/**
 * @internal
 */
export class VueChat<
  UI_MESSAGE extends UIMessage,
> extends AbstractChat<UI_MESSAGE> {
  constructor({
    state,
    ...init
  }: Omit<ChatInit<UI_MESSAGE>, 'messages'> & {
    state: ChatState<UI_MESSAGE>;
  }) {
    super({
      ...init,
      state,
    });
  }
}

/**
 * Return type of the {@link useChat} composable, which includes the chat
 * instance methods and reactive properties for messages, status, and error.
 */
export interface UseChatHelpers<UI_MESSAGE extends UIMessage> extends Pick<
  AbstractChat<UI_MESSAGE>,
  | 'sendMessage'
  | 'regenerate'
  | 'stop'
  | 'resumeStream'
  | 'addToolOutput'
  | 'addToolApprovalResponse'
  | 'clearError'
> {
  /**
   * The id of the chat.
   */
  id: ComputedRef<string>;

  /**
   * The current error state of the chat, if any.
   */
  error: ShallowRef<Error | undefined>;

  /**
   * The current status of the chat, which can be 'ready', 'generating', 'streaming', or 'error'.
   */
  status: ShallowRef<ChatStatus>;

  /**
   * The list of messages in the chat, which can be updated by the chat instance methods or directly by setting this property.
   */
  messages: ShallowRef<UI_MESSAGE[]>;
}

/**
 * Composable to access messages, status, and other chat properties and
 * methods. Accepts an optional reactive initial configuration object
 *
 * @example
 *
 * ```ts
 * // passing a getter if any reactive properties are used within
 * // the init object
 * const { messages, sendMessage } = useChat(() => ({
 *   // ...
 * })
 * ```
 *
 * @see BaseChatInit
 */
export function useChat<UI_MESSAGE extends UIMessage = UIMessage>(
  init?: MaybeRefOrGetter<BaseChatInit<UI_MESSAGE>>,
): UseChatHelpers<UI_MESSAGE> {
  const messages = shallowRef<UI_MESSAGE[]>([]);
  const status = shallowRef<ChatStatus>('ready');
  const error = shallowRef<Error | undefined>();

  // this wrapper doesn't need to be reactive and can be reused across chat
  // instance changes, because the inner refs are reactive and the wrapper
  // methods trigger updates when needed
  const chatStateWrapper = {
    get messages(): UI_MESSAGE[] {
      return messages.value;
    },

    set messages(messageList: UI_MESSAGE[]) {
      messages.value = messageList;
    },

    get status(): ChatStatus {
      return status.value;
    },

    set status(statusValue: ChatStatus) {
      status.value = statusValue;
    },

    get error(): Error | undefined {
      return error.value;
    },

    set error(errorValue: Error | undefined) {
      error.value = errorValue;
    },

    pushMessage(message: UI_MESSAGE) {
      messages.value.push(message);
      // needed because messagesRef is a shallowRef
      triggerRef(messages);
    },

    popMessage() {
      messages.value.pop();
      triggerRef(messages);
    },

    replaceMessage(index: number, message: UI_MESSAGE) {
      // message is cloned here because vue's deep reactivity shows unexpected behavior, particularly when updating tool invocation parts
      messages.value[index] = { ...message };
      triggerRef(messages);
    },

    snapshot: <T>(value: T): T => value,
  } satisfies ChatState<UI_MESSAGE>;

  // the instance is created right away thanks to immediate: true. We do it this
  // way instead of a computed to ensure all changes to reactive state happen
  // in the same tick
  const chatInstance = shallowRef<VueChat<UI_MESSAGE>>() as ShallowRef<
    VueChat<UI_MESSAGE>
  >;

  watch(
    () => toValue(init),
    opts => {
      // reset the initial state
      messages.value = opts?.messages ?? [];
      status.value = 'ready';
      error.value = undefined;

      chatInstance.value = new VueChat<UI_MESSAGE>({
        ...opts,
        state: chatStateWrapper,
      });
    },
    { immediate: true },
  );

  return {
    id: computed(() => chatInstance.value.id),
    status,
    messages,
    error,
    addToolApprovalResponse: opts =>
      chatInstance.value.addToolApprovalResponse(opts),
    addToolOutput: opts => chatInstance.value.addToolOutput(opts),
    clearError: () => chatInstance.value.clearError(),
    regenerate: opts => chatInstance.value.regenerate(opts),
    sendMessage: (...args) => chatInstance.value.sendMessage(...args),
    stop: () => chatInstance.value.stop(),
    resumeStream: opts => chatInstance.value.resumeStream(opts),
  };
}
