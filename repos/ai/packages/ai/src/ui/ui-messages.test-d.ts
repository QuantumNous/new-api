import { describe, it } from 'vitest';
import type { DynamicToolUIPart, ToolUIPart } from './ui-messages';

type TestTools = {
  weather: {
    input: {
      city: string;
      units?: 'celsius' | 'fahrenheit';
    };
    output: string;
  };
};

type AssertAssignable<Target, Source extends Target> = Source;

describe('UIMessagePart', () => {
  it('allows dynamic input-streaming tool parts with optional input', () => {
    type Part = {
      type: 'dynamic-tool';
      state: 'input-streaming';
      toolCallId: string;
      toolName: string;
      input?: unknown;
      providerExecuted?: boolean;
    };

    type _ = AssertAssignable<DynamicToolUIPart, Part>;
  });

  it('allows static input-streaming tool parts with optional input', () => {
    type Part = {
      type: 'tool-weather';
      state: 'input-streaming';
      toolCallId: string;
      input?: {
        city?: string;
      };
      providerExecuted?: boolean;
    };

    type _ = AssertAssignable<ToolUIPart<TestTools>, Part>;
  });

  it('allows static input-streaming tool parts with explicit undefined input', () => {
    type Part = {
      type: 'tool-weather';
      state: 'input-streaming';
      toolCallId: 'call-1';
      input: undefined;
    };

    type _ = AssertAssignable<ToolUIPart<TestTools>, Part>;
  });
});
