// @ts-nocheck
import { UIMessage, CreateUIMessage, generateText } from 'ai';

// Basic usage with type annotations
export function handleMessage(message: UIMessage): void {
  console.log(message.content);
}

export function createNewMessage(): CreateUIMessage {
  return {
    role: 'user',
    content: 'Hello world',
  };
}

// Array types
export function handleMessages(messages: UIMessage[]): CreateUIMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

// Function parameters and return types
export async function processChat(
  messages: UIMessage[],
  factory: () => CreateUIMessage
): Promise<UIMessage> {
  const newMessage = factory();
  const result = await generateText({
    model: 'gpt-4',
    messages: [...messages, newMessage],
  });
  
  return {
    role: 'assistant',
    content: result.text,
  } as UIMessage;
}

// Interface extending
interface CustomMessage extends UIMessage {
  timestamp: number;
}

interface MessageFactory {
  create(): CreateUIMessage;
}

// Type aliases
type MessageList = UIMessage[];
type MessageCreator = () => CreateUIMessage;

// Generic types
export class MessageHandler<T extends UIMessage> {
  handle(message: T): CreateUIMessage {
    return {
      role: message.role,
      content: message.content,
    };
  }
}

// Union types
type MessageOrCreator = UIMessage | CreateUIMessage;

export function genericTest() {
  const [message, setMessage] = generic<UIMessage | CreateUIMessage>(null);
}