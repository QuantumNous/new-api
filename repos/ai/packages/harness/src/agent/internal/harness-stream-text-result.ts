import {
  DelayedPromise,
  generateId,
  type AssistantModelMessage,
  type Context,
  type ToolModelMessage,
  type ToolSet,
} from '@ai-sdk/provider-utils';
import {
  addLanguageModelUsage,
  asLanguageModelUsage,
  createAsyncIterableStream,
  createNullLanguageModelUsage,
  DefaultStepResult,
  toResponseMessages,
} from 'ai/internal';
import type {
  LanguageModelV4FinishReason,
  LanguageModelV4Usage,
} from '@ai-sdk/provider';
import {
  createUIMessageStreamResponse,
  toUIMessageStream as toUIMessageStreamHelper,
  type CallWarning,
  type ContentPart,
  type FinishReason,
  type GenerateTextResult,
  type InferUIMessageChunk,
  type LanguageModelUsage,
  type ProviderMetadata,
  type StepResult,
  type StreamTextResult,
  type TextStreamPart,
  type UIMessage,
  type UIMessageStreamOptions,
} from 'ai';

type StreamProp<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
  KEY extends keyof StreamTextResult<TOOLS, RUNTIME_CONTEXT, never>,
> = Awaited<StreamTextResult<TOOLS, RUNTIME_CONTEXT, never>[KEY]>;

/**
 * Concrete `StreamTextResult` implementation backed by a single
 * harness prompt turn.
 *
 * Wraps a `ReadableStream<TextStreamPart<TOOLS>>` that the calling
 * driver pushes events into. Every `PromiseLike` accessor is backed by a
 * `DelayedPromise` so the AI SDK consumer surface stays identical to
 * `streamText`'s — consumers can `await result.text` or iterate
 * `result.fullStream`, in either order.
 *
 * Each `finish-step` boundary in the driver translates to a `StepResult`
 * built via `DefaultStepResult`. Step content is accumulated as
 * `ContentPart[]` and fed straight to `DefaultStepResult`, which derives
 * `text`, `toolCalls`, `toolResults`, `reasoning`, etc. via its getters.
 *
 * The Node.js response helpers (`pipeUIMessageStreamToResponse`,
 * `pipeTextStreamToResponse`, `toTextStreamResponse`) and the
 * output-specification surfaces (`partialOutputStream`/`elementStream`) are not
 * implemented yet — they throw a clear error.
 */
export class HarnessStreamTextResult<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
> implements StreamTextResult<TOOLS, RUNTIME_CONTEXT, never> {
  // Delayed promises backing every PromiseLike accessor. Each is typed
  // against the corresponding `StreamTextResult` property so the public
  // surface stays in lockstep with AI SDK's interface as it evolves.
  private readonly _content = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'content'>
  >();
  private readonly _text = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'text'>
  >();
  private readonly _reasoning = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'reasoning'>
  >();
  private readonly _reasoningText = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'reasoningText'>
  >();
  private readonly _files = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'files'>
  >();
  private readonly _sources = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'sources'>
  >();
  private readonly _toolCalls = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'toolCalls'>
  >();
  private readonly _staticToolCalls = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'staticToolCalls'>
  >();
  private readonly _dynamicToolCalls = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'dynamicToolCalls'>
  >();
  private readonly _toolResults = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'toolResults'>
  >();
  private readonly _staticToolResults = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'staticToolResults'>
  >();
  private readonly _dynamicToolResults = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'dynamicToolResults'>
  >();
  private readonly _finishReason = new DelayedPromise<FinishReason>();
  private readonly _rawFinishReason = new DelayedPromise<string | undefined>();
  private readonly _usage = new DelayedPromise<LanguageModelUsage>();
  private readonly _warnings = new DelayedPromise<CallWarning[] | undefined>();
  private readonly _steps = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'steps'>
  >();
  private readonly _finalStep = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'finalStep'>
  >();
  private readonly _request = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'request'>
  >();
  private readonly _response = new DelayedPromise<
    StreamProp<TOOLS, RUNTIME_CONTEXT, 'response'>
  >();
  private readonly _responseMessages = new DelayedPromise<
    Array<AssistantModelMessage | ToolModelMessage>
  >();
  private readonly _providerMetadata = new DelayedPromise<
    ProviderMetadata | undefined
  >();

  // The driver pushes parts into this controller; consumers read via `stream`.
  private readonly fullStreamController: ReadableStreamDefaultController<
    TextStreamPart<TOOLS>
  >;
  readonly stream: AsyncIterableStream<TextStreamPart<TOOLS>>;
  // `fullStream` is the deprecated alias that AI SDK still exposes on the
  // public interface. Backed by the same underlying stream as `stream`.
  readonly fullStream: AsyncIterableStream<TextStreamPart<TOOLS>>;
  readonly textStream: AsyncIterableStream<string>;

  private readonly stepsBuffer: StepResult<TOOLS, RUNTIME_CONTEXT>[] = [];
  private currentStepContent: ContentPart<TOOLS>[] = [];
  private currentStepWarnings: CallWarning[] = [];
  private stepNumber = 0;

  private readonly tools: TOOLS;
  private readonly runtimeContext: RUNTIME_CONTEXT;
  private readonly toolsContext: never;
  private readonly providerName: string;
  private readonly modelId: string;

  // Accumulators that span the whole turn.
  private accumulatedUsage: LanguageModelUsage = createNullLanguageModelUsage();
  private finalProviderMetadata: ProviderMetadata | undefined = undefined;
  private finalFinishReason: FinishReason = 'other';
  private finalRawFinishReason: string | undefined = undefined;
  private aggregateWarnings: CallWarning[] = [];
  private settled = false;

  constructor(options: {
    tools: TOOLS;
    runtimeContext: RUNTIME_CONTEXT;
    toolsContext: never;
    harnessId: string;
    sessionId: string;
  }) {
    this.tools = options.tools;
    this.runtimeContext = options.runtimeContext;
    this.toolsContext = options.toolsContext;
    this.providerName = `harness:${options.harnessId}`;
    this.modelId = options.sessionId;

    let controllerRef!: ReadableStreamDefaultController<TextStreamPart<TOOLS>>;
    const baseStream = new ReadableStream<TextStreamPart<TOOLS>>({
      start(c) {
        controllerRef = c;
      },
    });
    this.fullStreamController = controllerRef;

    const [forFull, forText] = baseStream.tee();
    this.stream = forFull as AsyncIterableStream<TextStreamPart<TOOLS>>;
    this.fullStream = this.stream;
    this.textStream = forText.pipeThrough(
      new TransformStream<TextStreamPart<TOOLS>, string>({
        transform(part, controller) {
          if (part.type === 'text-delta') {
            controller.enqueue(part.text);
          }
        },
      }),
    ) as AsyncIterableStream<string>;
  }

  // ─── Writer-side methods used by the driver ────────────────────────

  /**
   * Push a translated `TextStreamPart` into `fullStream` and accumulate it
   * into the current step's content array where applicable.
   */
  enqueue(part: TextStreamPart<TOOLS>): void {
    this.fullStreamController.enqueue(part);
    this.appendToCurrentStepContent(part);
  }

  /**
   * Mark the end of a step. Builds a `StepResult` from the accumulated
   * content and records it in the steps array. Accepts the V4-shaped
   * finish reason / usage the harness emits and normalizes to AI SDK's
   * flat shape internally.
   */
  finishStep(input: {
    finishReason: LanguageModelV4FinishReason;
    usage: LanguageModelV4Usage;
    providerMetadata: ProviderMetadata | undefined;
    warnings: CallWarning[];
  }): void {
    const normalizedUsage = asLanguageModelUsage(input.usage);
    const finishReason = input.finishReason.unified;
    const rawFinishReason = input.finishReason.raw;

    const step = new DefaultStepResult<TOOLS, RUNTIME_CONTEXT>({
      callId: generateId(),
      stepNumber: this.stepNumber,
      provider: this.providerName,
      modelId: this.modelId,
      runtimeContext: this.runtimeContext,
      toolsContext: this.toolsContext,
      content: this.currentStepContent,
      finishReason,
      rawFinishReason,
      usage: normalizedUsage,
      performance: createEmptyPerformance(),
      warnings: input.warnings.length > 0 ? input.warnings : undefined,
      request: {},
      response: {
        id: generateId(),
        timestamp: new Date(),
        modelId: this.modelId,
        messages: [],
      },
      providerMetadata: input.providerMetadata,
    });
    this.stepsBuffer.push(step);

    // Forward an AI SDK finish-step event so consumers reading fullStream
    // see step boundaries.
    this.fullStreamController.enqueue({
      type: 'finish-step',
      finishReason,
      rawFinishReason,
      usage: normalizedUsage,
      providerMetadata: input.providerMetadata,
      response: step.response,
      performance: createEmptyPerformance(),
    } as TextStreamPart<TOOLS>);

    this.accumulatedUsage = addLanguageModelUsage(
      this.accumulatedUsage,
      normalizedUsage,
    );
    this.finalFinishReason = finishReason;
    this.finalRawFinishReason = rawFinishReason;
    this.finalProviderMetadata = input.providerMetadata;
    if (input.warnings.length > 0)
      this.aggregateWarnings.push(...input.warnings);

    this.stepNumber += 1;
    this.currentStepContent = [];
    this.currentStepWarnings = [];
  }

  /**
   * Resolve every delayed promise and close `fullStream`. Idempotent.
   */
  async finish(input?: {
    finishReason: LanguageModelV4FinishReason;
    totalUsage: LanguageModelV4Usage;
    providerMetadata: ProviderMetadata | undefined;
  }): Promise<void> {
    if (this.settled) return;
    this.settled = true;

    if (input != null) {
      this.finalFinishReason = input.finishReason.unified;
      this.finalRawFinishReason = input.finishReason.raw;
      this.finalProviderMetadata = input.providerMetadata;
      this.accumulatedUsage = asLanguageModelUsage(input.totalUsage);
    }

    // Flush any trailing content not yet captured by a finish-step. We
    // construct the step directly here (the public `finishStep` takes V4
    // shapes; we already have AI SDK shapes at this point).
    if (this.currentStepContent.length > 0) {
      const trailingStep = new DefaultStepResult<TOOLS, RUNTIME_CONTEXT>({
        callId: generateId(),
        stepNumber: this.stepNumber,
        provider: this.providerName,
        modelId: this.modelId,
        runtimeContext: this.runtimeContext,
        toolsContext: this.toolsContext,
        content: this.currentStepContent,
        finishReason: this.finalFinishReason,
        rawFinishReason: this.finalRawFinishReason,
        usage: createNullLanguageModelUsage(),
        performance: createEmptyPerformance(),
        warnings:
          this.currentStepWarnings.length > 0
            ? this.currentStepWarnings
            : undefined,
        request: {},
        response: {
          id: generateId(),
          timestamp: new Date(),
          modelId: this.modelId,
          messages: [],
        },
        providerMetadata: this.finalProviderMetadata,
      });
      this.stepsBuffer.push(trailingStep);
      this.currentStepContent = [];
      this.currentStepWarnings = [];
    }

    const finalStep =
      this.stepsBuffer.length > 0
        ? this.stepsBuffer[this.stepsBuffer.length - 1]!
        : new DefaultStepResult<TOOLS, RUNTIME_CONTEXT>({
            callId: generateId(),
            stepNumber: 0,
            provider: this.providerName,
            modelId: this.modelId,
            runtimeContext: this.runtimeContext,
            toolsContext: this.toolsContext,
            content: [],
            finishReason: this.finalFinishReason,
            rawFinishReason: this.finalRawFinishReason,
            usage: createNullLanguageModelUsage(),
            performance: createEmptyPerformance(),
            warnings: undefined,
            request: {},
            response: {
              id: generateId(),
              timestamp: new Date(),
              modelId: this.modelId,
              messages: [],
            },
            providerMetadata: undefined,
          });

    const aggregatedContent = this.stepsBuffer.flatMap(s => s.content);

    this._content.resolve(
      aggregatedContent as StreamProp<TOOLS, RUNTIME_CONTEXT, 'content'>,
    );
    this._text.resolve(finalStep.text);
    // Reasoning content parts are not yet derived from harness events; the
    // foundation surfaces an empty array. Adapters that emit reasoning
    // deltas can be wired up to produce real reasoning content in a later
    // pass.
    this._reasoning.resolve(
      [] as StreamProp<TOOLS, RUNTIME_CONTEXT, 'reasoning'>,
    );
    this._reasoningText.resolve(undefined);
    this._files.resolve(this.stepsBuffer.flatMap(s => s.files));
    this._sources.resolve(this.stepsBuffer.flatMap(s => s.sources));
    this._toolCalls.resolve(
      this.stepsBuffer.flatMap(s => s.toolCalls) as StreamProp<
        TOOLS,
        RUNTIME_CONTEXT,
        'toolCalls'
      >,
    );
    this._staticToolCalls.resolve(
      this.stepsBuffer.flatMap(s => s.staticToolCalls) as StreamProp<
        TOOLS,
        RUNTIME_CONTEXT,
        'staticToolCalls'
      >,
    );
    this._dynamicToolCalls.resolve(
      this.stepsBuffer.flatMap(s => s.dynamicToolCalls) as StreamProp<
        TOOLS,
        RUNTIME_CONTEXT,
        'dynamicToolCalls'
      >,
    );
    this._toolResults.resolve(
      this.stepsBuffer.flatMap(s => s.toolResults) as StreamProp<
        TOOLS,
        RUNTIME_CONTEXT,
        'toolResults'
      >,
    );
    this._staticToolResults.resolve(
      this.stepsBuffer.flatMap(s => s.staticToolResults) as StreamProp<
        TOOLS,
        RUNTIME_CONTEXT,
        'staticToolResults'
      >,
    );
    this._dynamicToolResults.resolve(
      this.stepsBuffer.flatMap(s => s.dynamicToolResults) as StreamProp<
        TOOLS,
        RUNTIME_CONTEXT,
        'dynamicToolResults'
      >,
    );
    this._finishReason.resolve(this.finalFinishReason);
    this._rawFinishReason.resolve(this.finalRawFinishReason);
    this._usage.resolve(this.accumulatedUsage);
    this._warnings.resolve(
      this.aggregateWarnings.length > 0 ? this.aggregateWarnings : undefined,
    );
    this._steps.resolve(this.stepsBuffer);
    this._finalStep.resolve(finalStep);
    this._request.resolve(finalStep.request);
    this._response.resolve(finalStep.response);
    this._providerMetadata.resolve(this.finalProviderMetadata);

    const responseMessages = await toResponseMessages<TOOLS>({
      content: aggregatedContent,
      tools: this.tools,
    });
    this._responseMessages.resolve(responseMessages);

    // Forward AI SDK finish event before closing.
    this.fullStreamController.enqueue({
      type: 'finish',
      finishReason: this.finalFinishReason,
      rawFinishReason: this.finalRawFinishReason,
      totalUsage: this.accumulatedUsage,
      providerMetadata: this.finalProviderMetadata,
    } as TextStreamPart<TOOLS>);

    this.fullStreamController.close();
  }

  /**
   * Surface a fatal error as a stream `error` part + reject every delayed
   * promise so awaiting consumers stop hanging. Idempotent.
   */
  fail(error: unknown): void {
    if (this.settled) return;
    this.settled = true;
    this.fullStreamController.enqueue({
      type: 'error',
      error,
    } as TextStreamPart<TOOLS>);
    this.fullStreamController.close();
    for (const dp of [
      this._content,
      this._text,
      this._reasoning,
      this._reasoningText,
      this._files,
      this._sources,
      this._toolCalls,
      this._staticToolCalls,
      this._dynamicToolCalls,
      this._toolResults,
      this._staticToolResults,
      this._dynamicToolResults,
      this._finishReason,
      this._rawFinishReason,
      this._usage,
      this._warnings,
      this._steps,
      this._finalStep,
      this._request,
      this._response,
      this._responseMessages,
      this._providerMetadata,
    ]) {
      try {
        (dp as DelayedPromise<unknown>).reject(error);
      } catch {
        // ignore double-rejection
      }
    }
  }

  // ─── Reader-side public surface (StreamTextResult contract) ────────

  get content() {
    return this._content.promise;
  }
  get text() {
    return this._text.promise;
  }
  get reasoning() {
    return this._reasoning.promise;
  }
  get reasoningText() {
    return this._reasoningText.promise;
  }
  get files() {
    return this._files.promise;
  }
  get sources() {
    return this._sources.promise;
  }
  get toolCalls() {
    return this._toolCalls.promise;
  }
  get staticToolCalls() {
    return this._staticToolCalls.promise;
  }
  get dynamicToolCalls() {
    return this._dynamicToolCalls.promise;
  }
  get toolResults() {
    return this._toolResults.promise;
  }
  get staticToolResults() {
    return this._staticToolResults.promise;
  }
  get dynamicToolResults() {
    return this._dynamicToolResults.promise;
  }
  get finishReason() {
    return this._finishReason.promise;
  }
  get rawFinishReason() {
    return this._rawFinishReason.promise;
  }
  get usage() {
    return this._usage.promise;
  }
  get totalUsage() {
    return this._usage.promise;
  }
  get warnings() {
    return this._warnings.promise;
  }
  get steps() {
    return this._steps.promise;
  }
  get finalStep() {
    return this._finalStep.promise;
  }
  get request() {
    return this._request.promise;
  }
  get response() {
    return this._response.promise;
  }
  get responseMessages() {
    return this._responseMessages.promise;
  }
  get providerMetadata() {
    return this._providerMetadata.promise;
  }

  // Output-specification surfaces are not yet supported.
  get experimental_partialOutputStream(): never {
    throw notSupportedYet('partial output stream');
  }
  get partialOutputStream(): never {
    throw notSupportedYet('partial output stream');
  }
  get elementStream(): never {
    throw notSupportedYet('element stream');
  }
  get output(): never {
    throw notSupportedYet('structured output');
  }

  async consumeStream(): Promise<void> {
    const reader = this.fullStream.getReader();
    try {
      while (true) {
        const { done } = await reader.read();
        if (done) return;
      }
    } finally {
      reader.releaseLock();
    }
  }

  toUIMessageStream<UI_MESSAGE extends UIMessage>({
    originalMessages,
    generateMessageId,
    onFinish,
    messageMetadata,
    sendReasoning,
    sendSources,
    sendStart,
    sendFinish,
    onError,
  }: UIMessageStreamOptions<UI_MESSAGE> = {}): AsyncIterableStream<
    InferUIMessageChunk<UI_MESSAGE>
  > {
    return createAsyncIterableStream(
      toUIMessageStreamHelper<TOOLS, UI_MESSAGE>({
        stream: this.stream,
        tools: this.tools,
        originalMessages,
        generateMessageId,
        onFinish,
        messageMetadata,
        sendReasoning,
        sendSources,
        sendStart,
        sendFinish,
        onError,
      }),
    ) as AsyncIterableStream<InferUIMessageChunk<UI_MESSAGE>>;
  }

  pipeUIMessageStreamToResponse(): never {
    throw notSupportedYet('pipeUIMessageStreamToResponse');
  }

  pipeTextStreamToResponse(): never {
    throw notSupportedYet('pipeTextStreamToResponse');
  }

  toUIMessageStreamResponse<UI_MESSAGE extends UIMessage>({
    originalMessages,
    generateMessageId,
    onFinish,
    messageMetadata,
    sendReasoning,
    sendSources,
    sendStart,
    sendFinish,
    onError,
    ...init
  }: ResponseInit & {
    consumeSseStream?: (options: {
      stream: ReadableStream<string>;
    }) => PromiseLike<void> | void;
  } & UIMessageStreamOptions<UI_MESSAGE> = {}): Response {
    return createUIMessageStreamResponse({
      stream: this.toUIMessageStream<UI_MESSAGE>({
        originalMessages,
        generateMessageId,
        onFinish,
        messageMetadata,
        sendReasoning,
        sendSources,
        sendStart,
        sendFinish,
        onError,
      }),
      ...init,
    });
  }

  toTextStreamResponse(): never {
    throw notSupportedYet('toTextStreamResponse');
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private appendToCurrentStepContent(part: TextStreamPart<TOOLS>): void {
    switch (part.type) {
      case 'text-delta': {
        // Coalesce contiguous text-deltas with the same id into one text part.
        const last =
          this.currentStepContent[this.currentStepContent.length - 1];
        if (last && last.type === 'text') {
          (last as { text: string }).text += part.text;
        } else {
          this.currentStepContent.push({
            type: 'text',
            text: part.text,
          } as ContentPart<TOOLS>);
        }
        return;
      }
      case 'tool-call':
        this.currentStepContent.push({
          ...(part as object),
        } as ContentPart<TOOLS>);
        return;
      case 'tool-approval-request':
        this.currentStepContent.push({
          ...(part as object),
        } as ContentPart<TOOLS>);
        return;
      case 'tool-approval-response':
        this.currentStepContent.push({
          ...(part as object),
        } as ContentPart<TOOLS>);
        return;
      case 'tool-result':
        this.currentStepContent.push({
          ...(part as object),
        } as ContentPart<TOOLS>);
        return;
      default:
        // text-start/end, reasoning-*, raw, error, finish-step, finish are
        // not directly stored as ContentParts. (Reasoning content parts
        // would belong here; we omit them for v0.)
        return;
    }
  }
}

function createEmptyPerformance(): StepResult<ToolSet, Context>['performance'] {
  return {
    effectiveOutputTokensPerSecond: 0,
    outputTokensPerSecond: undefined,
    inputTokensPerSecond: undefined,
    effectiveTotalTokensPerSecond: 0,
    stepTimeMs: 0,
    responseTimeMs: 0,
    toolExecutionMs: {},
    timeToFirstOutputMs: undefined,
  };
}

function notSupportedYet(feature: string): Error {
  return new Error(
    `HarnessAgent: ${feature} is not implemented yet. Track the foundation review for follow-up.`,
  );
}

// Re-declare `AsyncIterableStream` locally to avoid pulling AI SDK's internal
// async-iterable-stream helper. ReadableStreams already implement the
// async-iterator contract in modern runtimes; we expose them under the same
// nominal type AI SDK does.
type AsyncIterableStream<T> = ReadableStream<T> & AsyncIterable<T>;

// `GenerateTextResult` is re-exported only so downstream code can keep this
// file as the single source of return-shape constants; not otherwise used here.
export type _GenerateTextResultMarker<
  TOOLS extends ToolSet,
  RUNTIME_CONTEXT extends Context,
> = GenerateTextResult<TOOLS, RUNTIME_CONTEXT, never>;
