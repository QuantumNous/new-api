import { tool, type ModelMessage, type ToolSet } from '@ai-sdk/provider-utils';
import { describe, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import type { DynamicToolCall, StaticToolCall } from './tool-call';
import type { ToolOutput } from './tool-output';
import type {
  OnToolCallFinishEvent,
  OnToolCallStartEvent,
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
  ToolExecutionEndEvent,
  ToolExecutionStartEvent,
} from './tool-execution-events';

/**
 * Type tests for tool execution events.
 *
 * `toolCall` ↔ `toolContext` correlation is expressed as a discriminated union; use
 * `Extract<...>` to assert it. TypeScript does not narrow `toolContext` from
 * `toolCall.toolName` in control flow (it stays `unknown` on the static branch), while
 * `toolCall.input` does narrow after ruling out `dynamic === true`.
 */
describe('ToolExecutionStartEvent', () => {
  const tools = {
    weather: tool({
      inputSchema: z.object({ location: z.string() }),
      contextSchema: z.object({ weatherApiKey: z.string() }),
    }),
    calculator: tool({
      inputSchema: z.object({ expression: z.string() }),
    }),
  };

  type Tools = typeof tools;

  it('ties weather static toolCall to context schema type', () => {
    type Weather = Extract<
      ToolExecutionStartEvent<Tools>,
      { toolCall: { toolName: 'weather'; dynamic?: false | undefined } }
    >;

    expectTypeOf<Weather['toolContext']>().toEqualTypeOf<{
      weatherApiKey: string;
    }>();
    expectTypeOf<Weather['toolCall']['input']>().toEqualTypeOf<{
      location: string;
    }>();
  });

  it('uses undefined toolContext for tools without a contextSchema', () => {
    type Calculator = Extract<
      ToolExecutionStartEvent<Tools>,
      { toolCall: { toolName: 'calculator'; dynamic?: false | undefined } }
    >;

    expectTypeOf<Calculator['toolContext']>().toEqualTypeOf<undefined>();
    expectTypeOf<Calculator['toolCall']['input']>().toEqualTypeOf<{
      expression: string;
    }>();
  });

  it('types dynamic tool invocations with unknown toolContext', () => {
    type Dynamic = Extract<
      ToolExecutionStartEvent<Tools>,
      { toolCall: { dynamic: true } }
    >;

    expectTypeOf<Dynamic['toolContext']>().toEqualTypeOf<unknown>();
    expectTypeOf<Dynamic['toolCall']>().toEqualTypeOf<DynamicToolCall>();
  });

  it('includes callId and messages on each branch', () => {
    type Weather = Extract<
      ToolExecutionStartEvent<Tools>,
      { toolCall: { toolName: 'weather'; dynamic?: false | undefined } }
    >;

    expectTypeOf<Weather>().toMatchTypeOf<{
      callId: string;
      messages: ModelMessage[];
    }>();
  });

  it('narrows toolContext to unknown when dynamic is true (control flow)', () => {
    const accept = (event: ToolExecutionStartEvent<Tools>) => {
      if (event.toolCall.dynamic === true) {
        expectTypeOf(event.toolContext).toEqualTypeOf<unknown>();
      }
    };

    expectTypeOf(accept).toBeFunction();
  });

  it('narrows toolCall.input in control flow when dynamic is ruled out first', () => {
    const accept = (event: ToolExecutionStartEvent<Tools>) => {
      if (event.toolCall.dynamic === true) {
        return;
      }

      if (event.toolCall.toolName === 'weather') {
        expectTypeOf(event.toolCall.input).toEqualTypeOf<{
          location: string;
        }>();
        return;
      }

      if (event.toolCall.toolName === 'calculator') {
        expectTypeOf(event.toolCall.input).toEqualTypeOf<{
          expression: string;
        }>();
      }
    };

    expectTypeOf(accept).toBeFunction();
  });

  describe('default ToolSet specialization (widened)', () => {
    it('types toolContext as unknown for generic consumers', () => {
      expectTypeOf<
        ToolExecutionStartEvent<ToolSet>['toolContext']
      >().toEqualTypeOf<unknown>();
    });

    it('allows any declared tool name on static calls in the widened toolCall union', () => {
      type TC = ToolExecutionStartEvent<ToolSet>['toolCall'];
      expectTypeOf<TC>().toEqualTypeOf<
        StaticToolCall<ToolSet> | DynamicToolCall
      >();
    });
  });

  it('supports a single-tool set', () => {
    const solo = {
      only: tool({
        inputSchema: z.object({ id: z.string() }),
        contextSchema: z.object({ secret: z.string() }),
      }),
    };

    type Solo = typeof solo;

    type Only = Extract<
      ToolExecutionStartEvent<Solo>,
      { toolCall: { toolName: 'only'; dynamic?: false | undefined } }
    >;

    expectTypeOf<Only['toolContext']>().toEqualTypeOf<{ secret: string }>();
  });
});

describe('ToolExecutionEndEvent', () => {
  const tools = {
    weather: tool({
      inputSchema: z.object({ location: z.string() }),
      contextSchema: z.object({ weatherApiKey: z.string() }),
    }),
    calculator: tool({
      inputSchema: z.object({ expression: z.string() }),
    }),
  };

  type Tools = typeof tools;

  it('ties weather static toolCall to context and carries toolOutput', () => {
    type Weather = Extract<
      ToolExecutionEndEvent<Tools>,
      { toolCall: { toolName: 'weather'; dynamic?: false | undefined } }
    >;

    expectTypeOf<Weather['toolContext']>().toEqualTypeOf<{
      weatherApiKey: string;
    }>();
    expectTypeOf<Weather>().toMatchTypeOf<{
      toolOutput: ToolOutput<Tools>;
    }>();
  });

  it('uses undefined toolContext for tools without a contextSchema', () => {
    type Calculator = Extract<
      ToolExecutionEndEvent<Tools>,
      { toolCall: { toolName: 'calculator'; dynamic?: false | undefined } }
    >;

    expectTypeOf<Calculator['toolContext']>().toEqualTypeOf<undefined>();
  });

  it('types dynamic tool completion with unknown toolContext', () => {
    type Dynamic = Extract<
      ToolExecutionEndEvent<Tools>,
      { toolCall: { dynamic: true } }
    >;

    expectTypeOf<Dynamic['toolContext']>().toEqualTypeOf<unknown>();
  });

  it('includes toolExecutionMs, callId, and messages on static branches', () => {
    type Weather = Extract<
      ToolExecutionEndEvent<Tools>,
      { toolCall: { toolName: 'weather'; dynamic?: false | undefined } }
    >;

    expectTypeOf<Weather>().toMatchTypeOf<{
      callId: string;
      toolExecutionMs: number;
      messages: ModelMessage[];
    }>();
  });

  it('narrows toolOutput with the type discriminator', () => {
    const accept = (event: ToolExecutionEndEvent<Tools>) => {
      if (event.toolOutput.type === 'tool-result') {
        expectTypeOf(event.toolOutput.type).toEqualTypeOf<'tool-result'>();
        expectTypeOf(event.toolOutput.output).not.toEqualTypeOf<undefined>();
        return;
      }

      expectTypeOf(event.toolOutput.type).toEqualTypeOf<'tool-error'>();
      expectTypeOf(event.toolOutput.error).toEqualTypeOf<unknown>();
    };

    expectTypeOf(accept).toBeFunction();
  });

  describe('default ToolSet specialization (widened)', () => {
    it('types toolContext as unknown', () => {
      expectTypeOf<
        ToolExecutionEndEvent<ToolSet>['toolContext']
      >().toEqualTypeOf<unknown>();
    });

    it('types toolOutput as ToolOutput<ToolSet>', () => {
      expectTypeOf<
        ToolExecutionEndEvent<ToolSet>['toolOutput']
      >().toEqualTypeOf<ToolOutput<ToolSet>>();
    });
  });
});

describe('tool execution callbacks', () => {
  const tools = {
    a: tool({
      inputSchema: z.object({ x: z.number() }),
      contextSchema: z.object({ token: z.string() }),
    }),
  };

  type Tools = typeof tools;

  it('accepts handlers typed with ToolExecutionStartEvent', () => {
    const handler: OnToolExecutionStartCallback<Tools> = event => {
      if (event.toolCall.dynamic === true) {
        expectTypeOf(event.toolContext).toEqualTypeOf<unknown>();
        return;
      }
      if (event.toolCall.toolName === 'a') {
        expectTypeOf(event.toolCall.input).toEqualTypeOf<{ x: number }>();
      }
    };

    expectTypeOf(handler).toEqualTypeOf<OnToolExecutionStartCallback<Tools>>();
  });

  it('accepts handlers typed with ToolExecutionEndEvent', () => {
    const handler: OnToolExecutionEndCallback<Tools> = event => {
      if (event.toolOutput.type === 'tool-error') {
        expectTypeOf(event.toolOutput.error).toEqualTypeOf<unknown>();
      }
    };

    expectTypeOf(handler).toEqualTypeOf<OnToolExecutionEndCallback<Tools>>();
  });
});

describe('deprecated aliases', () => {
  const tools = {
    legacy: tool({ inputSchema: z.object({ q: z.string() }) }),
  };

  type Tools = typeof tools;

  it('OnToolCallStartEvent matches ToolExecutionStartEvent', () => {
    expectTypeOf<OnToolCallStartEvent<Tools>>().toEqualTypeOf<
      ToolExecutionStartEvent<Tools>
    >();
  });

  it('OnToolCallFinishEvent matches ToolExecutionEndEvent', () => {
    expectTypeOf<OnToolCallFinishEvent<Tools>>().toEqualTypeOf<
      ToolExecutionEndEvent<Tools>
    >();
  });
});
