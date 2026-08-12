// @ts-nocheck
import { CoreMessage, streamText } from 'ai';

// Type annotation in variable declaration
const messages: CoreMessage[] = [];

// Type annotation in function parameter
function processMessages(msgs: CoreMessage[]) {
  return msgs;
}

// Function return type
function getMessages(): CoreMessage[] {
  return [];
}

// In interface
interface ChatState {
  messages: CoreMessage[];
  history: CoreMessage[];
}

// In type alias
type MessageStore = {
  items: CoreMessage[];
};

// Generic constraint
function filterMessages<T extends CoreMessage>(msgs: T[]): T[] {
  return msgs;
}

// Type assertion
const msg = {} as CoreMessage;

