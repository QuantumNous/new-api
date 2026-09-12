import type * as diagnosticsChannelModule from 'node:diagnostics_channel';
import type * as asyncHooksModule from 'node:async_hooks';
import {
  AI_SDK_TELEMETRY_TRACING_CHANNEL,
  type TelemetryTracingChannelMessage,
} from './tracing-channel';
import { isNodeRuntime } from '../util/is-node-runtime';

type DiagnosticsChannel = typeof diagnosticsChannelModule;
type AsyncHooks = typeof asyncHooksModule;
type AsyncResource = asyncHooksModule.AsyncResource;

export type TracingChannelContext = {
  run<T>(execute: () => T): T;
};

let diagnosticsChannelPromise:
  | Promise<DiagnosticsChannel | undefined>
  | undefined;

/**
 * Loads Node's diagnostics channel module only when the current runtime supports
 * it. Unsupported runtimes and failed imports intentionally resolve to
 * undefined so telemetry tracing never crashes user code.
 */
async function loadDiagnosticsChannel(): Promise<
  DiagnosticsChannel | undefined
> {
  if (!isNodeRuntime()) {
    return undefined;
  }

  if (diagnosticsChannelPromise == null) {
    diagnosticsChannelPromise = Promise.resolve(
      loadBuiltinModule<DiagnosticsChannel>('node:diagnostics_channel'),
    );
  }

  return diagnosticsChannelPromise;
}

function loadBuiltinModule<T>(id: string): T | undefined {
  const processWithBuiltins = globalThis.process as
    | {
        getBuiltinModule?: (id: string) => unknown;
      }
    | undefined;

  try {
    return processWithBuiltins?.getBuiltinModule?.(id) as T | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Runs an async operation inside the AI SDK telemetry tracing channel when
 * tracing subscribers may exist. Without Node diagnostics-channel support,
 * without tracingChannel support, or when the runtime reports no subscribers,
 * this is a direct pass-through.
 *
 * The execution bookkeeping preserves the original model/tool result or error
 * if tracing itself throws, and prevents falling back by calling `execute` a
 * second time.
 */
export async function runWithTracingChannelSpan<T>(
  message: TelemetryTracingChannelMessage,
  execute: () => PromiseLike<T>,
): Promise<T> {
  const diagnosticsChannel = await loadDiagnosticsChannel();
  const tracingChannel = diagnosticsChannel?.tracingChannel?.(
    AI_SDK_TELEMETRY_TRACING_CHANNEL,
  );

  if (tracingChannel == null || tracingChannel.hasSubscribers === false) {
    return await execute();
  }

  let executePromise: Promise<T> | undefined;
  let executionResult: T | undefined;
  let executionError: unknown;
  let hasExecutionResult = false;
  let hasExecutionError = false;

  const tracedExecute = () => {
    try {
      executePromise = Promise.resolve(execute());
    } catch (error) {
      executePromise = Promise.reject(error);
    }

    executePromise = executePromise.then(
      result => {
        executionResult = result;
        hasExecutionResult = true;
        return result;
      },
      error => {
        executionError = error;
        hasExecutionError = true;
        throw error;
      },
    );

    return executePromise;
  };

  try {
    return await tracingChannel.tracePromise(tracedExecute, message);
  } catch {
    if (hasExecutionError) {
      throw executionError;
    }

    if (hasExecutionResult) {
      return executionResult as T;
    }

    if (executePromise != null) {
      return await executePromise;
    }

    return await execute();
  }
}

/**
 * Opens a long-lived tracing-channel span context and returns a runner that can
 * re-enter that context later without changing stream setup timing.
 */
export function openTelemetryChannelSpanContext({
  message,
  completion,
}: {
  message: TelemetryTracingChannelMessage;
  completion: PromiseLike<unknown>;
}): TracingChannelContext | undefined {
  if (!isNodeRuntime()) {
    return undefined;
  }

  const diagnosticsChannel = loadBuiltinModule<DiagnosticsChannel>(
    'node:diagnostics_channel',
  );
  const asyncHooks = loadBuiltinModule<AsyncHooks>('node:async_hooks');
  const tracingChannel = diagnosticsChannel?.tracingChannel?.(
    AI_SDK_TELEMETRY_TRACING_CHANNEL,
  );

  if (
    tracingChannel == null ||
    tracingChannel.hasSubscribers === false ||
    asyncHooks == null
  ) {
    Promise.resolve(completion).catch(() => {});
    return undefined;
  }

  const context = message as TelemetryTracingChannelMessage & {
    result?: unknown;
    error?: unknown;
  };
  let asyncResource: AsyncResource | undefined;
  let asyncEndPublished = false;

  const safePublish = (publish: () => void) => {
    try {
      publish();
    } catch {
      // Diagnostics subscribers should never affect SDK stream behavior.
    }
  };

  const publishAsyncEnd = ({
    result,
    error,
  }: {
    result?: unknown;
    error?: unknown;
  }) => {
    if (asyncEndPublished) {
      return;
    }

    asyncEndPublished = true;

    if (error !== undefined) {
      context.error = error;
      safePublish(() => tracingChannel.error.publish(context));
    }

    if (result !== undefined) {
      context.result = result;
    }

    safePublish(() => tracingChannel.asyncEnd.publish(context));
  };

  safePublish(() => {
    tracingChannel.start.runStores(context, () => {
      asyncResource = new asyncHooks.AsyncResource('ai.telemetry');
    });
  });
  safePublish(() => tracingChannel.end.publish(context));

  void Promise.resolve(completion).then(
    result => publishAsyncEnd({ result }),
    error => publishAsyncEnd({ error }),
  );

  return {
    run: execute =>
      asyncResource == null
        ? execute()
        : asyncResource.runInAsyncScope(execute),
  };
}
