import type { InferUITools, UIDataTypes, UIMessage } from 'ai';
import type { tools } from './tools';

export type MyTools = InferUITools<typeof tools>;

// Define custom message type with data part schemas
export type HumanInTheLoopUIMessage = UIMessage<
  never, // metadata type
  UIDataTypes,
  MyTools
>;
