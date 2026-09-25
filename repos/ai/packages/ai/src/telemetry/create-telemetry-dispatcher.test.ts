import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTelemetryDispatcher } from './create-telemetry-dispatcher';
import type { Telemetry } from './telemetry';
import { registerTelemetry } from './telemetry-registry';

const dummyEvent = {} as any;
const augmentedDummyEvent = {
  ...dummyEvent,
  recordInputs: undefined,
  recordOutputs: undefined,
  functionId: undefined,
};

beforeEach(() => {
  globalThis.AI_SDK_TELEMETRY_INTEGRATIONS = undefined;
});

describe('createTelemetryDispatcher', () => {
  it('returns no-op listeners when no integrations are configured', async () => {
    const telemetry = createTelemetryDispatcher({});

    expect(telemetry.onStart).toBeDefined();
    expect(telemetry.onStepStart).toBeDefined();
    expect(telemetry.onLanguageModelCallStart).toBeDefined();
    expect(telemetry.onLanguageModelCallEnd).toBeDefined();
    expect(telemetry.onToolExecutionStart).toBeDefined();
    expect(telemetry.onToolExecutionEnd).toBeDefined();
    expect(telemetry.onStepEnd).toBeDefined();
    expect(telemetry.onObjectStepStart).toBeDefined();
    expect(telemetry.onObjectStepEnd).toBeDefined();
    expect(telemetry.onEmbedStart).toBeDefined();
    expect(telemetry.onEmbedEnd).toBeDefined();
    expect(telemetry.onRerankStart).toBeDefined();
    expect(telemetry.onRerankEnd).toBeDefined();
    expect(telemetry.onEnd).toBeDefined();
    expect(telemetry.onAbort).toBeDefined();
    expect(telemetry.onError).toBeDefined();
    expect(telemetry.executeLanguageModelCall).toBeDefined();
    expect(telemetry.executeTool).toBeDefined();

    await expect(telemetry.onStart!(dummyEvent)).resolves.toBeUndefined();
    await expect(telemetry.onError!(dummyEvent)).resolves.toBeUndefined();
    await expect(
      telemetry.executeLanguageModelCall!({
        callId: 'call-1',
        execute: async () => 'result',
      }),
    ).resolves.toBe('result');
    await expect(
      telemetry.executeTool!({
        callId: 'call-1',
        toolCallId: 'tool-1',
        execute: async () => 'result',
      }),
    ).resolves.toBe('result');
  });

  it('accepts a single integration', async () => {
    const integration: Telemetry = {
      onStart: vi.fn(),
    };

    const telemetry = createTelemetryDispatcher({
      telemetry: { integrations: integration },
    });

    await telemetry.onStart!(dummyEvent);

    expect(integration.onStart).toHaveBeenCalledWith(augmentedDummyEvent);
  });

  it('accepts an array of integrations', () => {
    const telemetry = createTelemetryDispatcher({
      telemetry: {
        integrations: [{ onStart: vi.fn() }, { onEnd: vi.fn() }],
      },
    });

    expect(telemetry.onStart).toBeDefined();
    expect(telemetry.onEnd).toBeDefined();
  });

  it('returns no-op listeners for methods that no integration implements', async () => {
    const telemetry = createTelemetryDispatcher({
      telemetry: { integrations: [{ onStart: vi.fn() }] },
    });

    await expect(
      telemetry.onToolExecutionStart!(dummyEvent),
    ).resolves.toBeUndefined();
    await expect(telemetry.onEmbedEnd!(dummyEvent)).resolves.toBeUndefined();
  });

  it('broadcasts an event to all integrations that implement the method', async () => {
    const onStart1 = vi.fn();
    const onStart2 = vi.fn();

    const telemetry = createTelemetryDispatcher({
      telemetry: {
        integrations: [{ onStart: onStart1 }, { onStart: onStart2 }],
      },
    });

    await telemetry.onStart!(dummyEvent);

    expect(onStart1).toHaveBeenCalledWith(augmentedDummyEvent);
    expect(onStart2).toHaveBeenCalledWith(augmentedDummyEvent);
  });

  it('fans out step-end events to deprecated onStepFinish integrations', async () => {
    const onStepEnd = vi.fn();
    const onStepFinish = vi.fn();

    const telemetry = createTelemetryDispatcher({
      telemetry: {
        integrations: [{ onStepEnd }, { onStepFinish }],
      },
    });

    await telemetry.onStepEnd!(dummyEvent);

    expect(onStepEnd).toHaveBeenCalledWith(augmentedDummyEvent);
    expect(onStepFinish).toHaveBeenCalledWith(augmentedDummyEvent);
  });

  it('skips integrations that do not implement the method', async () => {
    const onStart = vi.fn();

    const telemetry = createTelemetryDispatcher({
      telemetry: { integrations: [{ onStart }, {}] },
    });

    await telemetry.onStart!(dummyEvent);

    expect(onStart).toHaveBeenCalledOnce();
  });

  it('swallows async errors from individual integrations without affecting others', async () => {
    const onStart1 = vi.fn().mockRejectedValue(new Error('boom'));
    const onStart2 = vi.fn();

    const telemetry = createTelemetryDispatcher({
      telemetry: {
        integrations: [{ onStart: onStart1 }, { onStart: onStart2 }],
      },
    });

    await telemetry.onStart!(dummyEvent);

    expect(onStart1).toHaveBeenCalledWith(augmentedDummyEvent);
    expect(onStart2).toHaveBeenCalledWith(augmentedDummyEvent);
  });

  it('swallows sync errors thrown by integrations', async () => {
    const telemetry = createTelemetryDispatcher({
      telemetry: {
        integrations: [
          {
            onStart: () => {
              throw new Error('sync boom');
            },
          },
        ],
      },
    });

    await expect(telemetry.onStart!(dummyEvent)).resolves.toBeUndefined();
  });

  it('works with all lifecycle methods', async () => {
    const integration: Telemetry = {
      onStart: vi.fn(),
      onStepStart: vi.fn(),
      onLanguageModelCallStart: vi.fn(),
      onLanguageModelCallEnd: vi.fn(),
      onToolExecutionStart: vi.fn(),
      onToolExecutionEnd: vi.fn(),
      onStepEnd: vi.fn(),
      onObjectStepStart: vi.fn(),
      onObjectStepEnd: vi.fn(),
      onEmbedStart: vi.fn(),
      onEmbedEnd: vi.fn(),
      onRerankStart: vi.fn(),
      onRerankEnd: vi.fn(),
      onEnd: vi.fn(),
      onAbort: vi.fn(),
      onError: vi.fn(),
    };

    const telemetry = createTelemetryDispatcher({
      telemetry: { integrations: integration },
    });

    await telemetry.onStart!(dummyEvent);
    await telemetry.onStepStart!(dummyEvent);
    await telemetry.onLanguageModelCallStart!(dummyEvent);
    await telemetry.onLanguageModelCallEnd!(dummyEvent);
    await telemetry.onToolExecutionStart!(dummyEvent);
    await telemetry.onToolExecutionEnd!(dummyEvent);
    await telemetry.onStepEnd!(dummyEvent);
    await telemetry.onObjectStepStart!(dummyEvent);
    await telemetry.onObjectStepEnd!(dummyEvent);
    await telemetry.onEmbedStart!(dummyEvent);
    await telemetry.onEmbedEnd!(dummyEvent);
    await telemetry.onRerankStart!(dummyEvent);
    await telemetry.onRerankEnd!(dummyEvent);
    await telemetry.onEnd!(dummyEvent);
    await telemetry.onAbort!(dummyEvent);
    await telemetry.onError!(dummyEvent);

    expect(integration.onStart).toHaveBeenCalledOnce();
    expect(integration.onStepStart).toHaveBeenCalledOnce();
    expect(integration.onLanguageModelCallStart).toHaveBeenCalledOnce();
    expect(integration.onLanguageModelCallEnd).toHaveBeenCalledOnce();
    expect(integration.onToolExecutionStart).toHaveBeenCalledOnce();
    expect(integration.onToolExecutionEnd).toHaveBeenCalledOnce();
    expect(integration.onStepEnd).toHaveBeenCalledOnce();
    expect(integration.onObjectStepStart).toHaveBeenCalledOnce();
    expect(integration.onObjectStepEnd).toHaveBeenCalledOnce();
    expect(integration.onEmbedStart).toHaveBeenCalledOnce();
    expect(integration.onEmbedEnd).toHaveBeenCalledOnce();
    expect(integration.onRerankStart).toHaveBeenCalledOnce();
    expect(integration.onRerankEnd).toHaveBeenCalledOnce();
    expect(integration.onEnd).toHaveBeenCalledOnce();
    expect(integration.onAbort).toHaveBeenCalledOnce();
    expect(integration.onError).toHaveBeenCalledOnce();
  });

  it('handles an empty array of integrations', async () => {
    const telemetry = createTelemetryDispatcher({
      telemetry: { integrations: [] },
    });

    expect(telemetry.onStart).toBeDefined();
    expect(telemetry.onEnd).toBeDefined();

    await expect(telemetry.onStart!(dummyEvent)).resolves.toBeUndefined();
  });

  describe('isEnabled filter', () => {
    it('does not invoke any integration callbacks when isEnabled is false', async () => {
      const integration: Telemetry = {
        onStart: vi.fn(),
        onStepStart: vi.fn(),
        onToolExecutionStart: vi.fn(),
        onToolExecutionEnd: vi.fn(),
        onStepEnd: vi.fn(),
        onObjectStepStart: vi.fn(),
        onObjectStepEnd: vi.fn(),
        onEmbedStart: vi.fn(),
        onEmbedEnd: vi.fn(),
        onRerankStart: vi.fn(),
        onRerankEnd: vi.fn(),
        onEnd: vi.fn(),
        onAbort: vi.fn(),
        onError: vi.fn(),
        executeLanguageModelCall: async ({ execute }) => execute(),
        executeTool: async ({ execute }) => execute(),
      };

      const telemetry = createTelemetryDispatcher({
        telemetry: { isEnabled: false, integrations: integration },
      });

      expect(telemetry.onStart).toBeUndefined();
      expect(telemetry.onStepStart).toBeUndefined();
      expect(telemetry.onToolExecutionStart).toBeUndefined();
      expect(telemetry.onToolExecutionEnd).toBeUndefined();
      expect(telemetry.onStepEnd).toBeUndefined();
      expect(telemetry.onObjectStepStart).toBeUndefined();
      expect(telemetry.onObjectStepEnd).toBeUndefined();
      expect(telemetry.onEmbedStart).toBeUndefined();
      expect(telemetry.onEmbedEnd).toBeUndefined();
      expect(telemetry.onRerankStart).toBeUndefined();
      expect(telemetry.onRerankEnd).toBeUndefined();
      expect(telemetry.onEnd).toBeUndefined();
      expect(telemetry.onAbort).toBeUndefined();
      expect(telemetry.onError).toBeUndefined();
      expect(telemetry.executeLanguageModelCall).toBeUndefined();
      expect(telemetry.executeTool).toBeUndefined();
    });

    it('ignores globally registered integrations when isEnabled is false', () => {
      registerTelemetry({
        onStart: vi.fn(),
        executeLanguageModelCall: async ({ execute }) => execute(),
        executeTool: async ({ execute }) => execute(),
      });

      const telemetry = createTelemetryDispatcher({
        telemetry: { isEnabled: false },
      });

      expect(telemetry.onStart).toBeUndefined();
      expect(telemetry.executeLanguageModelCall).toBeUndefined();
      expect(telemetry.executeTool).toBeUndefined();
    });

    it('invokes integrations when isEnabled is true', async () => {
      const onStart = vi.fn();
      const telemetry = createTelemetryDispatcher({
        telemetry: { isEnabled: true, integrations: { onStart } },
      });

      await telemetry.onStart!(dummyEvent);

      expect(onStart).toHaveBeenCalledWith(augmentedDummyEvent);
    });

    it('invokes integrations when isEnabled is undefined (default enabled)', async () => {
      const onStart = vi.fn();
      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: { onStart } },
      });

      await telemetry.onStart!(dummyEvent);

      expect(onStart).toHaveBeenCalledWith(augmentedDummyEvent);
    });

    it('does not augment events with isEnabled', async () => {
      const onStart = vi.fn();
      const telemetry = createTelemetryDispatcher({
        telemetry: { isEnabled: true, integrations: { onStart } },
      });

      await telemetry.onStart!(dummyEvent);

      const receivedEvent = onStart.mock.calls[0]![0];
      expect(receivedEvent).not.toHaveProperty('isEnabled');
    });
  });

  describe('global vs local integration resolution', () => {
    it('uses globally registered integrations when no local integrations are provided', async () => {
      const onStart = vi.fn();
      registerTelemetry({ onStart });

      const telemetry = createTelemetryDispatcher({});
      await telemetry.onStart!(dummyEvent);

      expect(onStart).toHaveBeenCalledWith(augmentedDummyEvent);
    });

    it('uses only local integrations when provided, ignoring global', async () => {
      const globalOnStart = vi.fn();
      const localOnStart = vi.fn();

      registerTelemetry({ onStart: globalOnStart });

      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: { onStart: localOnStart } },
      });
      await telemetry.onStart!(dummyEvent);

      expect(globalOnStart).not.toHaveBeenCalled();
      expect(localOnStart).toHaveBeenCalledWith(augmentedDummyEvent);
    });

    it('uses only local integration array when provided, ignoring global', async () => {
      const globalOnStart = vi.fn();
      const localOnStart1 = vi.fn();
      const localOnStart2 = vi.fn();

      registerTelemetry({ onStart: globalOnStart });

      const telemetry = createTelemetryDispatcher({
        telemetry: {
          integrations: [
            { onStart: localOnStart1 },
            { onStart: localOnStart2 },
          ],
        },
      });
      await telemetry.onStart!(dummyEvent);

      expect(globalOnStart).not.toHaveBeenCalled();
      expect(localOnStart1).toHaveBeenCalledWith(augmentedDummyEvent);
      expect(localOnStart2).toHaveBeenCalledWith(augmentedDummyEvent);
    });

    it('global integrations still work for calls without local integrations', async () => {
      const globalOnStart = vi.fn();
      const localOnStart = vi.fn();

      registerTelemetry({ onStart: globalOnStart });

      const withLocal = createTelemetryDispatcher({
        telemetry: { integrations: { onStart: localOnStart } },
      });
      const withoutLocal = createTelemetryDispatcher({});

      await withLocal.onStart!(dummyEvent);
      await withoutLocal.onStart!(dummyEvent);

      expect(localOnStart).toHaveBeenCalledOnce();
      expect(globalOnStart).toHaveBeenCalledOnce();
    });

    it('auto-binds class-based global integrations', async () => {
      class ClassGlobalIntegration implements Telemetry {
        calls = 0;

        onStart() {
          this.calls += 1;
        }
      }

      const integration = new ClassGlobalIntegration();
      registerTelemetry(integration);

      const telemetry = createTelemetryDispatcher({});
      await telemetry.onStart!(dummyEvent);

      expect(integration.calls).toBe(1);
    });
  });

  describe('class-based integrations', () => {
    it('preserves this context for local integrations', async () => {
      class MyIntegration implements Telemetry {
        value = '';

        async onStart() {
          this.value = 'called';
        }
      }

      const instance = new MyIntegration();
      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: instance },
      });

      await telemetry.onStart!(dummyEvent);

      expect(instance.value).toBe('called');
    });

    it('preserves this context across multiple methods', async () => {
      class DevToolsTelemetry implements Telemetry {
        calls: string[] = [];

        async onStart() {
          this.calls.push('start');
        }

        async onEnd() {
          this.calls.push('end');
        }
      }

      const instance = new DevToolsTelemetry();
      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: [instance] },
      });

      await telemetry.onStart!(dummyEvent);
      await telemetry.onEnd!(dummyEvent);

      expect(instance.calls).toEqual(['start', 'end']);
    });
  });

  describe('executeLanguageModelCall', () => {
    it('passes through when no integrations implement executeLanguageModelCall', async () => {
      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: { onStart: vi.fn() } },
      });

      await expect(
        telemetry.executeLanguageModelCall!({
          callId: 'call-1',
          execute: async () => 'result',
        }),
      ).resolves.toBe('result');
    });

    it('wraps execute with a single integration', async () => {
      const execute = vi.fn().mockResolvedValue('result');
      let wrapperCalls = 0;
      const wrapper: Telemetry['executeLanguageModelCall'] = async ({
        execute,
      }) => {
        wrapperCalls += 1;
        return `wrapped:${await execute()}` as any;
      };

      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: { executeLanguageModelCall: wrapper } },
      });

      await expect(
        telemetry.executeLanguageModelCall!({
          callId: 'call-1',
          execute,
        }),
      ).resolves.toBe('wrapped:result');

      expect(wrapperCalls).toBe(1);
      expect(execute).toHaveBeenCalledOnce();
    });

    it('auto-binds class-based executeLanguageModelCall integrations', async () => {
      class ExecuteLanguageModelCallIntegration implements Telemetry {
        calls = 0;

        async executeLanguageModelCall<T>({
          execute,
        }: {
          execute: () => PromiseLike<T>;
        }) {
          this.calls += 1;
          return execute();
        }
      }

      const integration = new ExecuteLanguageModelCallIntegration();
      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: integration },
      });

      await telemetry.executeLanguageModelCall!({
        callId: 'call-1',
        execute: async () => 'done',
      });

      expect(integration.calls).toBe(1);
    });
  });

  describe('executeTool', () => {
    it('passes through when no integrations implement executeTool', async () => {
      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: { onStart: vi.fn() } },
      });

      await expect(
        telemetry.executeTool!({
          callId: 'call-1',
          toolCallId: 'tool-1',
          execute: async () => 'result',
        }),
      ).resolves.toBe('result');
    });

    it('wraps execute with a single integration', async () => {
      const execute = vi.fn().mockResolvedValue('result');
      let wrapperCalls = 0;
      const wrapper: Telemetry['executeTool'] = async ({ execute }) => {
        wrapperCalls += 1;
        return `wrapped:${await execute()}` as any;
      };

      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: { executeTool: wrapper } },
      });

      await expect(
        telemetry.executeTool!({
          callId: 'call-1',
          toolCallId: 'tool-1',
          execute,
        }),
      ).resolves.toBe('wrapped:result');

      expect(wrapperCalls).toBe(1);
      expect(execute).toHaveBeenCalledOnce();
    });

    it('uses only local executeTool when provided, ignoring global', async () => {
      const callOrder: string[] = [];

      registerTelemetry({
        executeTool: async ({ execute }) => {
          callOrder.push('global-before');
          const result = await execute();
          callOrder.push('global-after');
          return result;
        },
      });

      const telemetry = createTelemetryDispatcher({
        telemetry: {
          integrations: {
            executeTool: async ({ execute }) => {
              callOrder.push('local-before');
              const result = await execute();
              callOrder.push('local-after');
              return result;
            },
          },
        },
      });

      const result = await telemetry.executeTool!({
        callId: 'call-1',
        toolCallId: 'tool-1',
        execute: async () => {
          callOrder.push('execute');
          return 'done';
        },
      });

      expect(result).toBe('done');
      expect(callOrder).toEqual(['local-before', 'execute', 'local-after']);
    });

    it('uses global executeTool when no local integrations are provided', async () => {
      const callOrder: string[] = [];

      registerTelemetry({
        executeTool: async ({ execute }) => {
          callOrder.push('global-before');
          const result = await execute();
          callOrder.push('global-after');
          return result;
        },
      });

      const telemetry = createTelemetryDispatcher({});

      const result = await telemetry.executeTool!({
        callId: 'call-1',
        toolCallId: 'tool-1',
        execute: async () => {
          callOrder.push('execute');
          return 'done';
        },
      });

      expect(result).toBe('done');
      expect(callOrder).toEqual(['global-before', 'execute', 'global-after']);
    });

    it('auto-binds class-based executeTool integrations', async () => {
      class ExecuteToolIntegration implements Telemetry {
        calls = 0;

        async executeTool<T>({ execute }: { execute: () => PromiseLike<T> }) {
          this.calls += 1;
          return execute();
        }
      }

      const integration = new ExecuteToolIntegration();
      const telemetry = createTelemetryDispatcher({
        telemetry: { integrations: integration },
      });

      await telemetry.executeTool!({
        callId: 'call-1',
        toolCallId: 'tool-1',
        execute: async () => 'done',
      });

      expect(integration.calls).toBe(1);
    });
  });
});
