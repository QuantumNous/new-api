// @ts-nocheck
import { Message, CreateMessage, generateText } from 'ai';

// Basic usage with type annotations
export function handleMessage(message: Message): void {
  console.log(message.content);
}

export function createNewMessage(): CreateMessage {
  return {
    role: 'user',
    content: 'Hello world',
  };
}

// Array types
export function handleMessages(messages: Message[]): CreateMessage[] {
  return messages.map(msg => ({
    role: msg.role,
    content: msg.content,
  }));
}

// Function parameters and return types
export async function processChat(
  messages: Message[],
  factory: () => CreateMessage
): Promise<Message> {
  const newMessage = factory();
  const result = await generateText({
    model: 'gpt-4',
    messages: [...messages, newMessage],
  });
  
  return {
    role: 'assistant',
    content: result.text,
  } as Message;
}

// Interface extending
interface CustomMessage extends Message {
  timestamp: number;
}

interface MessageFactory {
  create(): CreateMessage;
}

// Type aliases
type MessageList = Message[];
type MessageCreator = () => CreateMessage;

// Generic types
export class MessageHandler<T extends Message> {
  handle(message: T): CreateMessage {
    return {
      role: message.role,
      content: message.content,
    };
  }
}

// Union types
type MessageOrCreator = Message | CreateMessage;

export function genericTest() {
  const [message, setMessage] = generic<Message | CreateMessage>(null);
}