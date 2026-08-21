// @ts-nocheck
import { ToolExecutionOptions } from 'ai';

// Type annotation in function parameter
function executeWithOptions(options: ToolExecutionOptions) {
  return options;
}

// Type annotation in variable declaration
const myOptions: ToolExecutionOptions = {
  toolCallId: '123',
  messages: [],
};

// Using as type parameter
const optionsList: ToolExecutionOptions[] = [];

// Function return type
function getOptions(): ToolExecutionOptions {
  return {} as ToolExecutionOptions;
}

// In interface
interface MyToolConfig {
  options: ToolExecutionOptions;
}

// In type alias
type ToolOptionsWrapper = {
  inner: ToolExecutionOptions;
};

// Generic constraint
function processOptions<T extends ToolExecutionOptions>(opts: T): T {
  return opts;
}

