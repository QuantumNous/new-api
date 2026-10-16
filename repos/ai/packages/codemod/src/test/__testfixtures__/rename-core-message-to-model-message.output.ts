// @ts-nocheck
import { ModelMessage, streamText } from 'ai';

// Type annotation in variable declaration
const messages: ModelMessage[] = [];

// Type annotation in function parameter
function processMessages(msgs: ModelMessage[]) {
  return msgs;
}

// Function return type
function getMessages(): ModelMessage[] {
  return [];
}

// In interface
interface ChatState {
  messages: ModelMessage[];
  history: ModelMessage[];
}

// In type alias
type MessageStore = {
  items: ModelMessage[];
};

// Generic constraint
function filterMessages<T extends ModelMessage>(msgs: T[]): T[] {
  return msgs;
}

// Type assertion
const msg = {} as ModelMessage;

