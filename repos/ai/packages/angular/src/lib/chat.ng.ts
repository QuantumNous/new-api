import { signal } from '@angular/core';
import {
  AbstractChat,
  type ChatState,
  type ChatStatus,
  type UIMessage,
  type ChatInit,
} from 'ai';
export class Chat<
  UI_MESSAGE extends UIMessage = UIMessage,
> extends AbstractChat<UI_MESSAGE> {
  constructor(init: ChatInit<UI_MESSAGE>) {
    super({
      ...init,
      state: new AngularChatState(init.messages),
    });
  }
}

class AngularChatState<
  UI_MESSAGE extends UIMessage = UIMessage,
> implements ChatState<UI_MESSAGE> {
  readonly #messages = signal<UI_MESSAGE[]>([]);
  readonly #status = signal<ChatStatus>('ready');
  readonly #error = signal<Error | undefined>(undefined);

  get messages(): UI_MESSAGE[] {
    return this.#messages();
  }

  set messages(messages: UI_MESSAGE[]) {
    this.#messages.set([...messages]);
  }

  get status(): ChatStatus {
    return this.#status();
  }

  set status(status: ChatStatus) {
    this.#status.set(status);
  }

  get error(): Error | undefined {
    return this.#error();
  }

  set error(error: Error | undefined) {
    this.#error.set(error);
  }

  constructor(initialMessages: UI_MESSAGE[] = []) {
    this.#messages.set([...initialMessages]);
  }

  setMessages = (messages: UI_MESSAGE[]) => {
    this.#messages.set([...messages]);
  };

  pushMessage = (message: UI_MESSAGE) => {
    this.#messages.update(msgs => [...msgs, message]);
  };

  popMessage = () => {
    this.#messages.update(msgs => msgs.slice(0, -1));
  };

  replaceMessage = (index: number, message: UI_MESSAGE) => {
    this.#messages.update(msgs => {
      const copy = [...msgs];
      copy[index] = message;
      return copy;
    });
  };

  snapshot = <T>(thing: T): T => structuredClone(thing);
}
