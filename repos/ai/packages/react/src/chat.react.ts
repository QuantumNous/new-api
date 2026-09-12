import {
  AbstractChat,
  type ChatInit,
  type ChatState,
  type ChatStatus,
  type UIMessage,
} from 'ai';
import { throttle } from './throttle';

class ReactChatState<
  UI_MESSAGE extends UIMessage,
> implements ChatState<UI_MESSAGE> {
  #messages: UI_MESSAGE[];
  #status: ChatStatus = 'ready';
  #error: Error | undefined = undefined;

  #messagesCallbacks = new Set<() => void>();
  #statusCallbacks = new Set<() => void>();
  #errorCallbacks = new Set<() => void>();

  constructor(initialMessages: UI_MESSAGE[] = []) {
    this.#messages = initialMessages;
  }

  get status(): ChatStatus {
    return this.#status;
  }

  set status(newStatus: ChatStatus) {
    this.#status = newStatus;
    this.#callStatusCallbacks();
  }

  get error(): Error | undefined {
    return this.#error;
  }

  set error(newError: Error | undefined) {
    this.#error = newError;
    this.#callErrorCallbacks();
  }

  get messages(): UI_MESSAGE[] {
    return this.#messages;
  }

  set messages(newMessages: UI_MESSAGE[]) {
    this.#messages = [...newMessages];
    this.#callMessagesCallbacks();
  }

  pushMessage = (message: UI_MESSAGE) => {
    this.#messages = this.#messages.concat(message);
    this.#callMessagesCallbacks();
  };

  popMessage = () => {
    this.#messages = this.#messages.slice(0, -1);
    this.#callMessagesCallbacks();
  };

  replaceMessage = (index: number, message: UI_MESSAGE) => {
    this.#messages = [
      ...this.#messages.slice(0, index),
      // We deep clone the message here to ensure the new React Compiler (currently in RC) detects deeply nested parts/metadata changes:
      this.snapshot(message),
      ...this.#messages.slice(index + 1),
    ];
    this.#callMessagesCallbacks();
  };

  snapshot = <T>(value: T): T => structuredClone(value);

  '~registerMessagesCallback' = (
    onChange: () => void,
    throttleWaitMs?: number,
  ): (() => void) => {
    const callback = throttleWaitMs
      ? throttle(onChange, throttleWaitMs)
      : onChange;
    this.#messagesCallbacks.add(callback);
    return () => {
      this.#messagesCallbacks.delete(callback);
    };
  };

  '~registerStatusCallback' = (onChange: () => void): (() => void) => {
    this.#statusCallbacks.add(onChange);
    return () => {
      this.#statusCallbacks.delete(onChange);
    };
  };

  '~registerErrorCallback' = (onChange: () => void): (() => void) => {
    this.#errorCallbacks.add(onChange);
    return () => {
      this.#errorCallbacks.delete(onChange);
    };
  };

  #callMessagesCallbacks = () => {
    this.#messagesCallbacks.forEach(callback => callback());
  };

  #callStatusCallbacks = () => {
    this.#statusCallbacks.forEach(callback => callback());
  };

  #callErrorCallbacks = () => {
    this.#errorCallbacks.forEach(callback => callback());
  };
}

export class Chat<
  UI_MESSAGE extends UIMessage,
> extends AbstractChat<UI_MESSAGE> {
  #state: ReactChatState<UI_MESSAGE>;

  constructor({ messages, ...init }: ChatInit<UI_MESSAGE>) {
    const state = new ReactChatState(messages);
    super({ ...init, state });
    this.#state = state;
  }

  '~registerMessagesCallback' = (
    onChange: () => void,
    throttleWaitMs?: number,
  ): (() => void) =>
    this.#state['~registerMessagesCallback'](onChange, throttleWaitMs);

  '~registerStatusCallback' = (onChange: () => void): (() => void) =>
    this.#state['~registerStatusCallback'](onChange);

  '~registerErrorCallback' = (onChange: () => void): (() => void) =>
    this.#state['~registerErrorCallback'](onChange);
}
