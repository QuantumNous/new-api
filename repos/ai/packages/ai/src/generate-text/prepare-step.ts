import type {
  Context,
  Experimental_SandboxSession as SandboxSession,
  InferToolSetContext,
  ModelMessage,
  ProviderOptions,
  ToolSet,
} from '@ai-sdk/provider-utils';
import type { Instructions } from '../prompt';
import type { LanguageModel, ToolChoice } from '../types/language-model';
import type { ActiveTools } from './active-tools';
import type { ResponseMessage } from './response-message';
import type { StepResult } from './step-result';
import type { ToolOrder } from './tool-order';

/**
 * Function that you can use to provide different settings for a step.
 *
 * @param options - The options for the step.
 * @param options.steps - The steps that have been executed so far.
 * @param options.stepNumber - The number of the step that is being executed.
 * @param options.model - The model that is being used.
 * @param options.instructions - The instructions that will be sent to the model for the current step.
 * @param options.initialInstructions - The initial instructions that were passed into generateText or streamText.
 * @param options.messages - The messages that will be sent to the model for the current step. If you return a `messages` override, those messages carry forward to later steps.
 * @param options.initialMessages - The initial messages that were passed into generateText or streamText.
 * @param options.responseMessages - The response messages that have been accumulated from previous steps.
 * @param options.runtimeContext - The user-defined runtime context.
 *
 * @returns An object that contains the settings for the step.
 * If you return undefined (or for undefined settings), the settings from the outer level will be used.
 */
export type PrepareStepFunction<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> = (options: {
  /**
   * The steps that have been executed so far.
   */
  steps: Array<StepResult<NoInfer<TOOLS>, NoInfer<RUNTIME_CONTEXT>>>;

  /**
   * The number of the step that is being executed.
   */
  stepNumber: number;

  /**
   * The model instance that is being used for this step.
   */
  model: LanguageModel;

  /**
   * The instructions that will be sent to the model for the current step.
   */
  instructions: Instructions | undefined;

  /**
   * The initial instructions that were passed into generateText or streamText.
   */
  initialInstructions: Instructions | undefined;

  /**
   * The messages that will be sent to the model for the current step.
   * If you return a `messages` override, those messages carry forward to later steps.
   */
  messages: Array<ModelMessage>;

  /**
   * The initial messages that were passed into generateText or streamText.
   */
  initialMessages: Array<ModelMessage>;

  /**
   * The response messages that have been accumulated from all previous steps.
   */
  responseMessages: Array<ResponseMessage>;

  /**
   * Tool context.
   */
  toolsContext: InferToolSetContext<TOOLS>;

  /**
   * User-defined runtime context.
   */
  runtimeContext: RUNTIME_CONTEXT;

  /**
   * The sandbox environment that the step is operating in.
   */
  experimental_sandbox?: SandboxSession;
}) =>
  | PromiseLike<PrepareStepResult<TOOLS, RUNTIME_CONTEXT>>
  | PrepareStepResult<TOOLS, RUNTIME_CONTEXT>;

/**
 * The result type returned by a {@link PrepareStepFunction},
 * allowing per-step overrides of model, tools, instructions, or messages.
 */
export type PrepareStepResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context = Context,
> =
  | {
      /**
       * Optionally override which LanguageModel instance is used for this step.
       */
      model?: LanguageModel;

      /**
       * Optionally set which tool the model must call, or provide tool call configuration
       * for this step.
       */
      toolChoice?: ToolChoice<NoInfer<TOOLS>>;

      /**
       * If provided, only these tools are enabled/available for this step.
       */
      activeTools?: ActiveTools<NoInfer<TOOLS>>;

      /**
       * Optionally override the order in which tools are sent to the provider
       * for this step.
       */
      toolOrder?: ToolOrder<NoInfer<TOOLS>>;

      /**
       * Optionally override the instructions sent to the model for this step.
       * The override carries forward to later steps.
       */
      instructions?: Instructions;

      /**
       * Optionally override the instructions sent to the model for this step.
       *
       * @deprecated Use `instructions` instead.
       */
      system?: Instructions;

      /**
       * Optionally override the full set of messages sent to the model
       * for this step. The override carries forward to later steps.
       */
      messages?: Array<ModelMessage>;

      /**
       * Tool context.
       *
       * Changing the toolsContext will affect the toolsContext in this step
       * and all subsequent steps.
       *
       * The toolsContext is passed into tool execution.
       */
      toolsContext?: InferToolSetContext<TOOLS>;

      /**
       * Runtime context.
       *
       * Changing the runtimeContext will affect the runtimeContext in this step
       * and all subsequent steps.
       */
      runtimeContext?: RUNTIME_CONTEXT;

      /**
       * The sandbox environment that the step is operating in.
       *
       * Changing the sandbox will affect tool execution in this step only.
       */
      experimental_sandbox?: SandboxSession;

      /**
       * Additional provider-specific options for this step.
       *
       * Can be used to pass provider-specific configuration such as
       * container IDs for Anthropic's code execution.
       */
      providerOptions?: ProviderOptions;
    }
  | undefined;
