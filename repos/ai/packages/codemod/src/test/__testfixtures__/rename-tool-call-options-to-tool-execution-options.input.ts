// @ts-nocheck
import { ToolCallOptions } from 'ai';

// Type annotation in function parameter
function executeWithOptions(options: ToolCallOptions) {
  return options;
}

// Type annotation in variable declaration
const myOptions: ToolCallOptions = {
  toolCallId: '123',
  messages: [],
};

// Using as type parameter
const optionsList: ToolCallOptions[] = [];

// Function return type
function getOptions(): ToolCallOptions {
  return {} as ToolCallOptions;
}

// In interface
interface MyToolConfig {
  options: ToolCallOptions;
}

// In type alias
type ToolOptionsWrapper = {
  inner: ToolCallOptions;
};

// Generic constraint
function processOptions<T extends ToolCallOptions>(opts: T): T {
  return opts;
}

