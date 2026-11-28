import type {
  Arrayable,
  Context,
  InferToolSetContext,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { Telemetry } from './telemetry';

export type IncludedContext<CONTEXT extends Context | unknown | never> =
  | { [KEY in keyof NoInfer<CONTEXT>]?: boolean }
  | undefined;

export type IncludedToolsContext<TOOLS extends ToolSet> =
  | {
      [TOOL_NAME in keyof NoInfer<
        InferToolSetContext<TOOLS>
      >]?: IncludedContext<NoInfer<InferToolSetContext<TOOLS>[TOOL_NAME]>>;
    }
  | undefined;

/**
 * Telemetry configuration.
 */
export type TelemetryOptions<
  RUNTIME_CONTEXT extends Context = Context,
  TOOLS extends ToolSet = ToolSet,
> = {
  /**
   * Enable or disable telemetry. Enabled by default when a telemetry
   * integration is registered. Set to `false` to opt out.
   */
  isEnabled?: boolean;

  /**
   * Enable or disable input recording. Enabled by default.
   *
   * You might want to disable input recording to avoid recording sensitive
   * information, to reduce data transfers, or to increase performance.
   */
  recordInputs?: boolean;

  /**
   * Enable or disable output recording. Enabled by default.
   *
   * You might want to disable output recording to avoid recording sensitive
   * information, to reduce data transfers, or to increase performance.
   */
  recordOutputs?: boolean;

  /**
   * Identifier for this function. Used to group telemetry data by function.
   */
  functionId?: string;

  /**
   * Top-level runtime context properties that should be included in telemetry.
   * Runtime context properties are excluded unless they are explicitly set to `true`.
   */
  includeRuntimeContext?: IncludedContext<RUNTIME_CONTEXT>;

  /**
   * Top-level tool context properties that should be included in telemetry,
   * configured per tool.
   *
   * Tool context properties are excluded unless they are explicitly set to `true`.
   */
  includeToolsContext?: IncludedToolsContext<TOOLS>;

  /**
   * Per-call telemetry integrations that receive lifecycle events during generation.
   *
   * When provided, these integrations will take precedence over the globally registered
   * integrations for this call.
   */
  integrations?: Arrayable<Telemetry>;
};
