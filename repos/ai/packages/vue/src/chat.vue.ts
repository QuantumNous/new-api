import {
  AbstractChat,
  type ChatInit,
  type ChatState,
  type ChatStatus,
  type UIMessage,
} from 'ai';
import { ref, type Ref } from 'vue';
class VueChatState<
  UI_MESSAGE extends UIMessage,
> implements ChatState<UI_MESSAGE> {
  private messagesRef: Ref<UI_MESSAGE[]>;
  private statusRef = ref<ChatStatus>('ready');
  private errorRef = ref<Error | undefined>(undefined);

  constructor(messages?: UI_MESSAGE[]) {
    this.messagesRef = ref(messages ?? []) as Ref<UI_MESSAGE[]>;
  }

  get messages(): UI_MESSAGE[] {
    return this.messagesRef.value;
  }

  set messages(messages: UI_MESSAGE[]) {
    this.messagesRef.value = messages;
  }

  get status(): ChatStatus {
    return this.statusRef.value;
  }

  set status(status: ChatStatus) {
    this.statusRef.value = status;
  }

  get error(): Error | undefined {
    return this.errorRef.value;
  }

  set error(error: Error | undefined) {
    this.errorRef.value = error;
  }

  pushMessage = (message: UI_MESSAGE) => {
    this.messagesRef.value = [...this.messagesRef.value, message];
  };

  popMessage = () => {
    this.messagesRef.value = this.messagesRef.value.slice(0, -1);
  };

  replaceMessage = (index: number, message: UI_MESSAGE) => {
    // message is cloned here because vue's deep reactivity shows unexpected behavior, particularly when updating tool invocation parts
    this.messagesRef.value[index] = { ...message };
  };

  snapshot = <T>(value: T): T => value;
}

/**
 * @deprecated Use the {@link useChat} composable instead. It exposes reactive
 * refs and automatically recreates the chat when its init object changes.
 */
export class Chat<
  UI_MESSAGE extends UIMessage,
> extends AbstractChat<UI_MESSAGE> {
  constructor({ messages, ...init }: ChatInit<UI_MESSAGE>) {
    super({
      ...init,
      state: new VueChatState(messages),
    });
  }
}
