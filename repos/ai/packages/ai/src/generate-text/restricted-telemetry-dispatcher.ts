import type {
  Context,
  InferToolContext,
  InferToolSetContext,
  ToolSet,
} from '@ai-sdk/provider-utils';
import { createTelemetryDispatcher } from '../telemetry/create-telemetry-dispatcher';
import type { TelemetryDispatcher } from '../telemetry/telemetry';
import type {
  IncludedContext,
  IncludedToolsContext,
  TelemetryOptions,
} from '../telemetry/telemetry-options';
import type {
  GenerateTextOnAbortCallback,
  GenerateTextOnEndCallback,
  GenerateTextOnStartCallback,
  GenerateTextOnStepEndCallback,
  GenerateTextOnStepFinishCallback,
  GenerateTextOnStepStartCallback,
} from './generate-text-events';
import type { Output } from './output';
import { DefaultStepResult, type StepResult } from './step-result';
import type {
  OnToolExecutionEndCallback,
  OnToolExecutionStartCallback,
} from './tool-execution-events';

/**
 * Telemetry dispatcher for text generation with callbacks typed to the
 * operation-specific tool set, runtime context, and output shape.
 */
export type RestrictedTelemetryDispatcher<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  OUTPUT extends Output,
> = Omit<
  TelemetryDispatcher,
  | 'onStart'
  | 'onStepStart'
  | 'onStepEnd'
  | 'onStepFinish'
  | 'onEnd'
  | 'onAbort'
  | 'onToolExecutionStart'
  | 'onToolExecutionEnd'
> & {
  onStart: GenerateTextOnStartCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>;
  onStepStart: GenerateTextOnStepStartCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>;
  onStepEnd: GenerateTextOnStepEndCallback<TOOLS, RUNTIME_CONTEXT>;
  /** @deprecated Use `onStepEnd` instead. */
  onStepFinish: GenerateTextOnStepFinishCallback<TOOLS, RUNTIME_CONTEXT>;
  onEnd: GenerateTextOnEndCallback<TOOLS, RUNTIME_CONTEXT>;
  onAbort?: GenerateTextOnAbortCallback<TOOLS, RUNTIME_CONTEXT>;
  onToolExecutionStart?: OnToolExecutionStartCallback<TOOLS>;
  onToolExecutionEnd?: OnToolExecutionEndCallback<TOOLS>;
};

/**
 * Returns a shallow copy of the runtime context with only top-level
 * properties marked for telemetry inclusion.
 */
function filterIncludedContext<CONTEXT extends Context>({
  context,
  includeContext,
}: {
  context: CONTEXT;
  includeContext: IncludedContext<CONTEXT>;
}): Context {
  if (context == null) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(context).filter(
      ([key]) => includeContext?.[key as keyof CONTEXT] === true,
    ),
  );
}

/**
 * Creates a copy of a step result whose runtime context only contains
 * top-level properties marked for telemetry inclusion.
 */
function restrictStepResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
>({
  step,
  includeRuntimeContext,
  includeToolsContext,
}: {
  step: StepResult<TOOLS, RUNTIME_CONTEXT>;
  includeRuntimeContext: IncludedContext<RUNTIME_CONTEXT>;
  includeToolsContext: IncludedToolsContext<TOOLS>;
}) {
  return new DefaultStepResult({
    callId: step.callId,
    stepNumber: step.stepNumber,
    provider: step.model.provider,
    modelId: step.model.modelId,
    runtimeContext: filterIncludedContext({
      context: step.runtimeContext,
      includeContext: includeRuntimeContext,
    }),
    toolsContext: filterToolsContext({
      toolsContext: step.toolsContext,
      includeToolsContext,
    }),
    content: step.content,
    finishReason: step.finishReason,
    rawFinishReason: step.rawFinishReason,
    usage: step.usage,
    performance: step.performance,
    warnings: step.warnings,
    request: step.request,
    response: step.response,
    providerMetadata: step.providerMetadata,
  });
}

/**
 * Returns a shallow copy of the tools context with only top-level properties
 * marked for telemetry inclusion for each tool.
 */
function filterToolsContext<TOOLS extends ToolSet>({
  toolsContext,
  includeToolsContext,
}: {
  toolsContext: InferToolSetContext<TOOLS>;
  includeToolsContext: IncludedToolsContext<TOOLS>;
}): InferToolSetContext<TOOLS> {
  if (includeToolsContext == null) {
    return {} as InferToolSetContext<TOOLS>;
  }

  return Object.fromEntries(
    Object.entries(toolsContext).map(([toolName, toolContext]) => [
      toolName,
      filterToolContext({
        toolName,
        toolContext,
        includeToolsContext,
      }),
    ]),
  ) as InferToolSetContext<TOOLS>;
}

function filterToolContext<TOOLS extends ToolSet>({
  toolName,
  toolContext,
  includeToolsContext,
}: {
  toolName: string;
  toolContext: unknown;
  includeToolsContext: IncludedToolsContext<TOOLS>;
}) {
  const includeToolContext = (
    includeToolsContext as
      | Record<
          string,
          IncludedContext<InferToolContext<TOOLS[typeof toolName]>>
        >
      | undefined
  )?.[toolName];

  return filterIncludedContext({
    context: toolContext as InferToolContext<TOOLS[typeof toolName]>,
    includeContext: includeToolContext,
  });
}

/**
 * Creates a telemetry dispatcher that only includes configured runtime context
 * properties in text-generation lifecycle events before dispatching them.
 */
export function createRestrictedTelemetryDispatcher<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  OUTPUT extends Output,
>({
  telemetry,
  includeRuntimeContext,
  includeToolsContext,
}: {
  telemetry?: TelemetryOptions<RUNTIME_CONTEXT, TOOLS>;
  includeRuntimeContext: IncludedContext<RUNTIME_CONTEXT>;
  includeToolsContext?: IncludedToolsContext<TOOLS>;
}): RestrictedTelemetryDispatcher<TOOLS, RUNTIME_CONTEXT, OUTPUT> {
  const telemetryDispatcher = createTelemetryDispatcher({ telemetry });

  return {
    ...telemetryDispatcher,
    onStart: event =>
      telemetryDispatcher.onStart?.({
        ...event,
        runtimeContext: filterIncludedContext({
          context: event.runtimeContext,
          includeContext: includeRuntimeContext,
        }),
        toolsContext: filterToolsContext({
          toolsContext: event.toolsContext,
          includeToolsContext,
        }),
      }),
    onStepStart: event =>
      telemetryDispatcher.onStepStart?.({
        ...event,
        runtimeContext: filterIncludedContext({
          context: event.runtimeContext,
          includeContext: includeRuntimeContext,
        }),
        steps: event.steps.map(step =>
          restrictStepResult({
            step,
            includeRuntimeContext,
            includeToolsContext,
          }),
        ),
        toolsContext: filterToolsContext({
          toolsContext: event.toolsContext,
          includeToolsContext,
        }),
      }),
    onStepEnd: event =>
      telemetryDispatcher.onStepEnd?.(
        restrictStepResult({
          step: event,
          includeRuntimeContext,
          includeToolsContext,
        }),
      ),
    onStepFinish: event =>
      telemetryDispatcher.onStepEnd?.(
        restrictStepResult({
          step: event,
          includeRuntimeContext,
          includeToolsContext,
        }),
      ),
    onEnd: event =>
      telemetryDispatcher.onEnd?.(
        ((restrictedSteps: StepResult<TOOLS, Context>[]) => {
          return {
            ...event,
            runtimeContext: filterIncludedContext({
              context: event.runtimeContext,
              includeContext: includeRuntimeContext,
            }),
            steps: restrictedSteps,
            finalStep: restrictedSteps.at(-1)!,
            toolsContext: filterToolsContext({
              toolsContext: event.toolsContext,
              includeToolsContext,
            }),
          };
        })(
          event.steps.map(step =>
            restrictStepResult({
              step,
              includeRuntimeContext,
              includeToolsContext,
            }),
          ),
        ),
      ),
    onAbort: event =>
      telemetryDispatcher.onAbort?.({
        ...event,
        steps: event.steps.map(step =>
          restrictStepResult({
            step,
            includeRuntimeContext,
            includeToolsContext,
          }),
        ),
      }),
    onToolExecutionStart: event =>
      telemetryDispatcher.onToolExecutionStart?.({
        ...event,
        toolContext: filterToolContext({
          toolName: event.toolCall.toolName,
          toolContext: event.toolContext,
          includeToolsContext,
        }),
      }),
    onToolExecutionEnd: event =>
      telemetryDispatcher.onToolExecutionEnd?.({
        ...event,
        toolContext: filterToolContext({
          toolName: event.toolCall.toolName,
          toolContext: event.toolContext,
          includeToolsContext,
        }),
      }),
  };
}
