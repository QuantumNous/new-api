import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';
import { createBuiltinToolFilteringMiddleware } from './tool-filtering';

async function runAfterModel(input: {
  messages: unknown[];
  events?: Record<string, unknown>[];
  builtinToolFiltering: NonNullable<
    Parameters<
      typeof createBuiltinToolFilteringMiddleware
    >[0]['builtinToolFiltering']
  >;
}) {
  const events = input.events ?? [];
  const middleware = createBuiltinToolFilteringMiddleware({
    builtinToolFiltering: input.builtinToolFiltering,
    emit: event => events.push(event),
  });

  if (!middleware?.afterModel || typeof middleware.afterModel === 'function') {
    throw new Error('expected object afterModel hook');
  }

  return {
    events,
    result: await middleware.afterModel.hook(
      { messages: input.messages } as never,
      {} as never,
    ),
  };
}

describe('createBuiltinToolFilteringMiddleware', () => {
  it('denies inactive built-ins while leaving custom tool calls pending', async () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'read-1',
          name: 'read_file',
          args: { file_path: '/README.md' },
        },
        {
          id: 'weather-1',
          name: 'weather',
          args: { city: 'Paris' },
        },
      ],
    });

    const { events, result } = await runAfterModel({
      messages: [message],
      builtinToolFiltering: { mode: 'allow', toolNames: ['weather'] },
    });

    expect(events).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'read-1',
        toolName: 'read',
        input: '{"file_path":"/README.md"}',
        providerExecuted: true,
        nativeName: 'read_file',
      },
      {
        type: 'tool-result',
        toolCallId: 'read-1',
        toolName: 'read',
        result:
          "Tool 'read' is inactive due to the HarnessAgent tool filtering policy.",
      },
    ]);
    expect(result?.jumpTo).toBeUndefined();
    expect(message.tool_calls?.map(toolCall => toolCall.id)).toEqual([
      'read-1',
      'weather-1',
    ]);
    if (!result) throw new Error('expected middleware result');
    const deniedReadMessage = result.messages[1];
    expect(ToolMessage.isInstance(deniedReadMessage)).toBe(true);
    if (!ToolMessage.isInstance(deniedReadMessage)) {
      throw new Error('expected read denial tool message');
    }
    expect(deniedReadMessage.tool_call_id).toBe('read-1');
    expect(deniedReadMessage.status).toBe('error');
  });

  it('jumps back to the model when every tool call is denied', async () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'read-1',
          name: 'read_file',
          args: { file_path: '/README.md' },
        },
      ],
    });

    const { result } = await runAfterModel({
      messages: [message],
      builtinToolFiltering: { mode: 'allow', toolNames: ['weather'] },
    });

    if (!result) throw new Error('expected middleware result');
    expect(result.jumpTo).toBe('model');
    expect(ToolMessage.isInstance(result.messages[1])).toBe(true);
  });

  it('applies deny policies to native built-in names without blocking active built-ins', async () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'glob-1',
          name: 'glob',
          args: { pattern: '**/README.md' },
        },
        {
          id: 'read-1',
          name: 'read_file',
          args: { file_path: '/README.md' },
        },
      ],
    });

    const { events, result } = await runAfterModel({
      messages: [message],
      builtinToolFiltering: { mode: 'deny', toolNames: ['glob'] },
    });

    expect(events).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'glob-1',
        toolName: 'glob',
        input: '{"pattern":"**/README.md"}',
        providerExecuted: true,
        nativeName: 'glob',
      },
      {
        type: 'tool-result',
        toolCallId: 'glob-1',
        toolName: 'glob',
        result:
          "Tool 'glob' is inactive due to the HarnessAgent tool filtering policy.",
      },
    ]);
    if (!result) throw new Error('expected middleware result');
    expect(result.jumpTo).toBeUndefined();
    const deniedGlobMessage = result.messages[1];
    expect(ToolMessage.isInstance(deniedGlobMessage)).toBe(true);
    if (!ToolMessage.isInstance(deniedGlobMessage)) {
      throw new Error('expected glob denial tool message');
    }
    expect(deniedGlobMessage.tool_call_id).toBe('glob-1');
  });

  it('denies inactive native-only built-ins', async () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'task-1',
          name: 'task',
          args: { description: 'read the README' },
        },
        {
          id: 'todos-1',
          name: 'write_todos',
          args: { todos: [] },
        },
      ],
    });

    const { events, result } = await runAfterModel({
      messages: [message],
      builtinToolFiltering: { mode: 'allow', toolNames: ['weather'] },
    });

    expect(events).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'task-1',
        toolName: 'task',
        input: '{"description":"read the README"}',
        providerExecuted: true,
        nativeName: 'task',
      },
      {
        type: 'tool-result',
        toolCallId: 'task-1',
        toolName: 'task',
        result:
          "Tool 'task' is inactive due to the HarnessAgent tool filtering policy.",
      },
      {
        type: 'tool-call',
        toolCallId: 'todos-1',
        toolName: 'write_todos',
        input: '{"todos":[]}',
        providerExecuted: true,
        nativeName: 'write_todos',
      },
      {
        type: 'tool-result',
        toolCallId: 'todos-1',
        toolName: 'write_todos',
        result:
          "Tool 'write_todos' is inactive due to the HarnessAgent tool filtering policy.",
      },
    ]);
    if (!result) throw new Error('expected middleware result');
    expect(result.jumpTo).toBe('model');
    expect(ToolMessage.isInstance(result.messages[1])).toBe(true);
    expect(ToolMessage.isInstance(result.messages[2])).toBe(true);
  });

  it('does nothing when all requested tools are active', async () => {
    const message = new AIMessage({
      content: '',
      tool_calls: [
        {
          id: 'read-1',
          name: 'read_file',
          args: { file_path: '/README.md' },
        },
        {
          id: 'weather-1',
          name: 'weather',
          args: { city: 'Paris' },
        },
      ],
    });

    const { events, result } = await runAfterModel({
      messages: [message],
      builtinToolFiltering: { mode: 'deny', toolNames: ['bash'] },
    });

    expect(events).toEqual([]);
    expect(result).toBeUndefined();
  });
});
