import type {
  LanguageModelV4,
  LanguageModelV4StreamResult,
  LanguageModelV4Usage,
  SharedV4Warning,
} from '@ai-sdk/provider';
import {
  safeParseJSON,
  type InferSchema,
  type ProviderOptions,
} from '@ai-sdk/provider-utils';
import {
  InvalidToolInputError,
  NoSuchToolError,
  type CallWarning,
  type FinishReason,
  type LanguageModelUsage,
  type LanguageModelCallOptions,
  type Prompt,
  type RequestOptions,
  type Schema,
  type ToolChoice,
} from 'ai';
import {
  asLanguageModelUsage,
  convertToLanguageModelPrompt,
  prepareLanguageModelCallOptions,
  prepareRetries,
  prepareToolChoice,
  prepareTools,
  standardizePrompt,
} from 'ai/internal';
import type { ReactNode } from 'react';
import type * as z3 from 'zod/v3';
import type * as z4 from 'zod/v4';
import { createStreamableUI } from '../streamable-ui/create-streamable-ui';
import { createResolvablePromise } from '../util/create-resolvable-promise';
import { isAsyncGenerator } from '../util/is-async-generator';
import { isGenerator } from '../util/is-generator';

type Streamable = ReactNode | Promise<ReactNode>;

type Renderer<T extends Array<any>> = (
  ...args: T
) =>
  | Streamable
  | Generator<Streamable, Streamable, void>
  | AsyncGenerator<Streamable, Streamable, void>;

type RenderTool<
  INPUT_SCHEMA extends z4.core.$ZodType | z3.Schema | Schema = any,
> = {
  description?: string;
  inputSchema: INPUT_SCHEMA;
  generate?: Renderer<
    [
      InferSchema<INPUT_SCHEMA>,
      {
        toolName: string;
        toolCallId: string;
      },
    ]
  >;
};

type RenderText = Renderer<
  [
    {
      /**
       * The full text content from the model so far.
       */
      content: string;

      /**
       * The new appended text content from the model since the last `text` call.
       */
      delta: string;

      /**
       * Whether the model is done generating text.
       * If `true`, the `content` will be the final output and this call will be the last.
       */
      done: boolean;
    },
  ]
>;

type RenderResult = {
  value: ReactNode;
} & LanguageModelV4StreamResult;

const defaultTextRenderer: RenderText = ({ content }: { content: string }) =>
  content;

/**
 * `streamUI` is a helper function to create a streamable UI from LLMs.
 */
export async function streamUI<
  TOOLS extends { [name: string]: z4.core.$ZodType | z3.Schema | Schema } = {},
>({
  model,
  tools,
  toolChoice,
  instructions,
  system,
  prompt,
  messages,
  allowSystemInMessages,
  maxRetries,
  abortSignal,
  headers,
  initial,
  text,
  providerOptions,
  onFinish,
  ...settings
}: LanguageModelCallOptions &
  Omit<RequestOptions, 'timeout'> &
  Prompt & {
    /**
     * The language model to use.
     */
    model: LanguageModelV4;

    /**
     * The tools that the model can call. The model needs to support calling tools.
     */
    tools?: {
      [name in keyof TOOLS]: RenderTool<TOOLS[name]>;
    };

    /**
     * The tool choice strategy. Default: 'auto'.
     */
    toolChoice?: ToolChoice<TOOLS>;

    text?: RenderText;
    initial?: ReactNode;

    /**
     * Additional provider-specific options. They are passed through
     * to the provider from the AI SDK and enable provider-specific
     * functionality that can be fully encapsulated in the provider.
     */
    providerOptions?: ProviderOptions;

    /**
     * Callback that is called when the LLM response and the final object validation are finished.
     */
    onFinish?: (event: {
      /**
       * The reason why the generation finished.
       */
      finishReason: FinishReason;
      /**
       * The token usage of the generated response.
       */
      usage: LanguageModelUsage;
      /**
       * The final ui node that was generated.
       */
      value: ReactNode;
      /**
       * Warnings from the model provider (e.g. unsupported settings)
       */
      warnings?: CallWarning[];
      /**
       * Optional response data.
       */
      response?: {
        /**
         * Response headers.
         */
        headers?: Record<string, string>;
      };
    }) => Promise<void> | void;
  }): Promise<RenderResult> {
  // TODO: Remove these errors after the experimental phase.
  if (typeof model === 'string') {
    throw new Error(
      '`model` cannot be a string in `streamUI`. Use the actual model instance instead.',
    );
  }
  if ('functions' in settings) {
    throw new Error(
      '`functions` is not supported in `streamUI`, use `tools` instead.',
    );
  }
  if ('provider' in settings) {
    throw new Error(
      '`provider` is no longer needed in `streamUI`. Use `model` instead.',
    );
  }
  if (tools) {
    for (const [name, tool] of Object.entries(tools)) {
      if ('render' in tool) {
        throw new Error(
          'Tool definition in `streamUI` should not have `render` property. Use `generate` instead. Found in tool: ' +
            name,
        );
      }
    }
  }

  const ui = createStreamableUI(initial);

  // The default text renderer just returns the content as string.
  const textRender = text || defaultTextRenderer;

  let finished: Promise<void> | undefined;

  let finishEvent: {
    finishReason: FinishReason;
    usage: LanguageModelV4Usage;
    warnings?: CallWarning[];
    response?: {
      headers?: Record<string, string>;
    };
  } | null = null;

  async function render({
    args,
    renderer,
    streamableUI,
    isLastCall = false,
  }: {
    renderer: undefined | Renderer<any>;
    args: [payload: any] | [payload: any, options: any];
    streamableUI: ReturnType<typeof createStreamableUI>;
    isLastCall?: boolean;
  }) {
    if (!renderer) return;

    // create a promise that will be resolved when the render call is finished.
    // it is appended to the `finished` promise chain to ensure the render call
    // is finished before the next render call starts.
    const renderFinished = createResolvablePromise<void>();
    finished = finished
      ? finished.then(() => renderFinished.promise)
      : renderFinished.promise;

    const rendererResult = renderer(...args);

    if (isAsyncGenerator(rendererResult) || isGenerator(rendererResult)) {
      while (true) {
        const { done, value } = await rendererResult.next();
        const node = await value;

        if (isLastCall && done) {
          streamableUI.done(node);
        } else {
          streamableUI.update(node);
        }

        if (done) break;
      }
    } else {
      const node = await rendererResult;

      if (isLastCall) {
        streamableUI.done(node);
      } else {
        streamableUI.update(node);
      }
    }

    // resolve the promise to signal that the render call is finished
    renderFinished.resolve(undefined);
  }

  const { retry } = prepareRetries({ maxRetries, abortSignal });

  const validatedPrompt = await standardizePrompt({
    instructions,
    system,
    prompt,
    messages,
    allowSystemInMessages,
  } as Prompt);
  const languageModelTools = await prepareTools({
    tools: tools,
  });
  const languageModelToolChoice = prepareToolChoice({
    toolChoice,
  });

  const result = await retry(async () =>
    model.doStream({
      ...prepareLanguageModelCallOptions(settings),
      tools: languageModelTools,
      toolChoice: languageModelToolChoice,
      prompt: await convertToLanguageModelPrompt({
        prompt: validatedPrompt,
        supportedUrls: await model.supportedUrls,
        download: undefined,
        provider: model.provider.split('.')[0],
      }),
      providerOptions,
      abortSignal,
      headers,
      includeRawChunks: false,
    }),
  );

  // For the stream and consume it asynchronously:
  const [stream, forkedStream] = result.stream.tee();
  (async () => {
    try {
      let content = '';
      let hasToolCall = false;
      let warnings: SharedV4Warning[] | undefined;

      const reader = forkedStream.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        switch (value.type) {
          case 'stream-start': {
            warnings = value.warnings;
            break;
          }

          case 'text-delta': {
            content += value.delta;
            render({
              renderer: textRender,
              args: [{ content, done: false, delta: value.delta }],
              streamableUI: ui,
            });
            break;
          }

          case 'tool-input-start':
          case 'tool-input-delta': {
            hasToolCall = true;
            break;
          }

          case 'tool-call': {
            const toolName = value.toolName as keyof TOOLS & string;

            if (!tools) {
              throw new NoSuchToolError({ toolName });
            }

            const tool = tools[toolName];
            if (!tool) {
              throw new NoSuchToolError({
                toolName,
                availableTools: Object.keys(tools),
              });
            }

            hasToolCall = true;
            const parseResult = await safeParseJSON({
              text: value.input,
              schema: tool.inputSchema,
            });

            if (parseResult.success === false) {
              throw new InvalidToolInputError({
                toolName,
                toolInput: value.input,
                cause: parseResult.error,
              });
            }

            render({
              renderer: tool.generate,
              args: [
                parseResult.value,
                {
                  toolName,
                  toolCallId: value.toolCallId,
                },
              ],
              streamableUI: ui,
              isLastCall: true,
            });

            break;
          }

          case 'error': {
            throw value.error;
          }

          case 'finish': {
            finishEvent = {
              finishReason: value.finishReason?.unified,
              usage: value.usage,
              warnings,
              response: result.response,
            };
            break;
          }
        }
      }

      if (!hasToolCall) {
        render({
          renderer: textRender,
          args: [{ content, done: true }],
          streamableUI: ui,
          isLastCall: true,
        });
      }

      await finished;

      if (finishEvent && onFinish) {
        await onFinish({
          ...finishEvent,
          usage: asLanguageModelUsage(finishEvent.usage),
          value: ui.value,
        });
      }
    } catch (error) {
      // During the stream rendering, we don't want to throw the error to the
      // parent scope but only let the React's error boundary to catch it.
      ui.error(error);
    }
  })();

  return {
    ...result,
    stream,
    value: ui.value,
  };
}
