import {
  validateTypes,
  withUserAgentSuffix,
  type Context,
  type Experimental_SandboxSession as SandboxSession,
  type ModelMessage,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import { generateText } from '../generate-text/generate-text';
import type {
  GenerateTextOnStartCallback,
  GenerateTextOnStepStartCallback,
} from '../generate-text/generate-text-events';
import type { GenerateTextResult } from '../generate-text/generate-text-result';
import type { Output } from '../generate-text/output';
import { isStepCount } from '../generate-text/stop-condition';
import { streamText } from '../generate-text/stream-text';
import type { StreamTextResult } from '../generate-text/stream-text-result';
import type { Prompt } from '../prompt';
import { mergeCallbacks } from '../util/merge-callbacks';
import type {
  Agent,
  AgentCallParameters,
  AgentStreamParameters,
} from './agent';
import type { ToolLoopAgentSettings } from './tool-loop-agent-settings';

/**
 * A tool loop agent is an agent that runs tools in a loop. In each step,
 * it calls the LLM, and if there are tool calls, it executes the tools
 * and calls the LLM again in a new step with the tool results.
 *
 * The loop continues until:
 * - A finish reasoning other than tool-calls is returned, or
 * - A tool that is invoked does not have an execute function, or
 * - A tool call needs approval via `toolApproval` or tool-level `needsApproval`, or
 * - A stop condition is met (default stop condition is isStepCount(20))
 */
export class ToolLoopAgent<
  CALL_OPTIONS = never,
  TOOLS extends ToolSet = {},
  RUNTIME_CONTEXT extends Context = Context,
  OUTPUT extends Output = never,
> implements Agent<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT> {
  readonly version = 'agent-v1';

  private readonly settings: ToolLoopAgentSettings<
    CALL_OPTIONS,
    TOOLS,
    RUNTIME_CONTEXT,
    OUTPUT
  >;

  constructor(
    settings: ToolLoopAgentSettings<
      CALL_OPTIONS,
      TOOLS,
      RUNTIME_CONTEXT,
      OUTPUT
    >,
  ) {
    const { onFinish, onEnd = onFinish } = settings;
    this.settings = { ...settings, onEnd };
  }

  /**
   * The id of the agent.
   */
  get id(): string | undefined {
    return this.settings.id;
  }

  /**
   * The tools that the agent can use.
   */
  get tools(): TOOLS {
    return this.settings.tools as TOOLS;
  }

  private async prepareCall(options: {
    prompt?: string | Array<ModelMessage>;
    messages?: Array<ModelMessage>;
    options?: CALL_OPTIONS;
    experimental_sandbox?: SandboxSession;
  }): Promise<
    Omit<
      ToolLoopAgentSettings<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT, OUTPUT>,
      | 'prepareCall'
      | 'instructions'
      | 'allowSystemInMessages'
      | 'onStart'
      | 'experimental_onStart'
      | 'onStepStart'
      | 'experimental_onStepStart'
      | 'onToolExecutionStart'
      | 'onToolExecutionEnd'
      | 'onStepEnd'
      | 'onStepFinish'
      | 'onEnd'
      | 'onFinish'
    > &
      Prompt
  > {
    if (
      this.settings.callOptionsSchema != null &&
      options.options !== undefined
    ) {
      const validatedOptions = await validateTypes({
        value: options.options,
        schema: this.settings.callOptionsSchema,
        context: { field: 'options' },
      });
      options = { ...options, options: validatedOptions };
    }

    const {
      onStart: _settingsStableOnStart,
      experimental_onStart: _settingsExperimentalOnStart,
      onStepStart: _settingsStableOnStepStart,
      experimental_onStepStart: _settingsExperimentalOnStepStart,
      onToolExecutionStart: _settingsOnToolExecutionStart,
      onToolExecutionEnd: _settingsOnToolExecutionEnd,
      onStepEnd: _settingsOnStepEnd,
      onStepFinish: _settingsOnStepFinish,
      onFinish: _settingsOnFinish,
      onEnd: _settingsOnEnd,
      ...settingsWithoutCallbacks
    } = this.settings;

    const baseCallArgs = {
      ...settingsWithoutCallbacks,
      stopWhen: this.settings.stopWhen ?? isStepCount(20),
      ...options,
    };

    const preparedCallArgs =
      (await this.settings.prepareCall?.(
        baseCallArgs as Parameters<
          NonNullable<
            ToolLoopAgentSettings<
              CALL_OPTIONS,
              TOOLS,
              RUNTIME_CONTEXT,
              OUTPUT
            >['prepareCall']
          >
        >[0],
      )) ?? baseCallArgs;

    const {
      instructions,
      allowSystemInMessages,
      messages,
      prompt,
      runtimeContext,
      ...callArgs
    } = preparedCallArgs;

    const promptArgs = {
      instructions,
      allowSystemInMessages,
      messages,
      prompt,
    } as Prompt;

    if (runtimeContext === undefined) {
      return {
        ...callArgs,
        ...promptArgs,
      };
    }

    return {
      ...callArgs,
      runtimeContext,
      ...promptArgs,
    };
  }

  /**
   * Tags outgoing requests so usage can be attributed to ToolLoopAgent. Chains
   * with the `ai/<version>` and `ai-sdk/<provider>/<version>` suffixes added
   * downstream by generateText/streamText and the provider.
   */
  private agentHeaders(preparedCall: {
    headers?: unknown;
  }): Record<string, string> {
    return withUserAgentSuffix(
      (preparedCall.headers as Record<string, string | undefined>) ?? {},
      'ai-sdk-agent/tool-loop',
    );
  }

  /**
   * Generates an output from the agent (non-streaming).
   */
  async generate({
    abortSignal,
    timeout,
    experimental_sandbox: sandbox,
    onStart,
    experimental_onStart,
    onStepStart,
    experimental_onStepStart,
    onToolExecutionStart,
    onToolExecutionEnd,
    onStepEnd,
    onStepFinish,
    onFinish,
    onEnd = onFinish,
    ...options
  }: AgentCallParameters<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT>): Promise<
    GenerateTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>
  > {
    const generate = generateText<TOOLS, RUNTIME_CONTEXT, OUTPUT>;
    const preparedCall = await this.prepareCall({
      ...options,
      experimental_sandbox: sandbox,
    });
    const callbackArgs = {
      abortSignal,
      timeout,
      experimental_sandbox: sandbox,
      onStart: mergeCallbacks(
        this.settings.onStart ?? this.settings.experimental_onStart,
        (onStart ?? experimental_onStart) as
          | GenerateTextOnStartCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>
          | undefined,
      ),
      onStepStart: mergeCallbacks(
        this.settings.onStepStart ?? this.settings.experimental_onStepStart,
        (onStepStart ?? experimental_onStepStart) as
          | GenerateTextOnStepStartCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>
          | undefined,
      ),
      onToolExecutionStart: mergeCallbacks(
        this.settings.onToolExecutionStart,
        onToolExecutionStart,
      ),
      onToolExecutionEnd: mergeCallbacks(
        this.settings.onToolExecutionEnd,
        onToolExecutionEnd,
      ),
      onStepEnd: mergeCallbacks(
        this.settings.onStepEnd ?? this.settings.onStepFinish,
        onStepEnd ?? onStepFinish,
      ),
      onEnd: mergeCallbacks(this.settings.onEnd, onEnd),
    };

    return await generate({
      ...preparedCall,
      ...callbackArgs,
      headers: this.agentHeaders(preparedCall),
    } as unknown as Parameters<typeof generate>[0]);
  }

  /**
   * Streams an output from the agent (streaming).
   */
  async stream({
    abortSignal,
    timeout,
    experimental_sandbox: sandbox,
    experimental_transform,
    onStart,
    experimental_onStart,
    onStepStart,
    experimental_onStepStart,
    onToolExecutionStart,
    onToolExecutionEnd,
    onStepEnd,
    onStepFinish,
    onFinish,
    onEnd = onFinish,
    ...options
  }: AgentStreamParameters<CALL_OPTIONS, TOOLS, RUNTIME_CONTEXT>): Promise<
    StreamTextResult<TOOLS, RUNTIME_CONTEXT, OUTPUT>
  > {
    const stream = streamText<TOOLS, RUNTIME_CONTEXT, OUTPUT>;
    const preparedCall = await this.prepareCall({
      ...options,
      experimental_sandbox: sandbox,
    });
    const callbackArgs = {
      abortSignal,
      timeout,
      experimental_sandbox: sandbox,
      experimental_transform,
      onStart: mergeCallbacks(
        this.settings.onStart ?? this.settings.experimental_onStart,
        (onStart ?? experimental_onStart) as
          | GenerateTextOnStartCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>
          | undefined,
      ),
      onStepStart: mergeCallbacks(
        this.settings.onStepStart ?? this.settings.experimental_onStepStart,
        (onStepStart ?? experimental_onStepStart) as
          | GenerateTextOnStepStartCallback<TOOLS, RUNTIME_CONTEXT, OUTPUT>
          | undefined,
      ),
      onToolExecutionStart: mergeCallbacks(
        this.settings.onToolExecutionStart,
        onToolExecutionStart,
      ),
      onToolExecutionEnd: mergeCallbacks(
        this.settings.onToolExecutionEnd,
        onToolExecutionEnd,
      ),
      onStepEnd: mergeCallbacks(
        this.settings.onStepEnd ?? this.settings.onStepFinish,
        onStepEnd ?? onStepFinish,
      ),
      onEnd: mergeCallbacks(this.settings.onEnd, onEnd),
    };

    return await stream({
      ...preparedCall,
      ...callbackArgs,
      headers: this.agentHeaders(preparedCall),
    } as unknown as Parameters<typeof stream>[0]);
  }
}
