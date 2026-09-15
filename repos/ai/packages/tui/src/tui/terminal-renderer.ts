import type {
  AgentTUIStreamResult,
  AgentTUIToolApprovalRequest,
  AgentTUIToolApprovalResponse,
} from '../agent-tui-runner';
import type {
  ResponseStatisticsMode,
  TerminalPartDisplayMode,
} from '../run-agent-tui';
import { renderScreenViewport, sliceVisible, visibleLength } from './layout';
import { renderMarkdown } from './markdown';
import { TerminalFrameBuffer } from './terminal-frame-buffer';
import {
  getToolName,
  isToolUIPart,
  readUIMessageStream,
  type StepResultPerformance,
  type DynamicToolUIPart,
  type ToolUIPart,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';

export type TerminalInput = {
  isTTY?: boolean;
  on(event: 'data', listener: (chunk: Buffer) => void): TerminalInput;
  off(event: 'data', listener: (chunk: Buffer) => void): TerminalInput;
  resume(): TerminalInput;
  pause(): TerminalInput;
  setRawMode?: (mode: boolean) => TerminalInput;
};

export type TerminalOutput = {
  columns?: number;
  rows?: number;
  write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean;
  on(event: 'resize', listener: () => void): TerminalOutput;
  off(event: 'resize', listener: () => void): TerminalOutput;
};

const defaultResponseStatistics: ResponseStatisticsMode =
  'outputTokensPerSecond';

export type TerminalRendererOptions = {
  input?: TerminalInput;
  output?: TerminalOutput;
  frameBuffer?: TerminalFrameBuffer;
  tools?: TerminalPartDisplayMode;
  reasoning?: TerminalPartDisplayMode;
  responseStatistics?: ResponseStatisticsMode;
  contextSize?: number;
};

export type TerminalSessionOptions = {
  title?: string;
  initialPrompt?: string;
  submittedPrompt?: string;
  waitForExit?: boolean;
  continueSession?: boolean;
  tools?: TerminalPartDisplayMode;
  reasoning?: TerminalPartDisplayMode;
  responseStatistics?: ResponseStatisticsMode;
  contextSize?: number;
};

export type TerminalKey =
  | { type: 'character'; value: string }
  | { type: 'backspace' }
  | { type: 'enter' }
  | { type: 'up' }
  | { type: 'down' }
  | { type: 'page-up' }
  | { type: 'page-down' }
  | { type: 'ctrl-l' }
  | { type: 'ctrl-c' }
  | { type: 'escape' }
  | { type: 'ignore' };

type ChatSectionKind = 'user' | 'assistant' | 'reasoning' | 'tool' | 'error';

type ChatSection = {
  kind: ChatSectionKind;
  title: string;
  rightTitle?: string;
  content: string;
  collapsed?: boolean;
  id?: string;
  cache?: RenderedSectionCache;
};

type RenderedSectionCache = {
  width: number;
  kind: ChatSectionKind;
  title: string;
  rightTitle?: string;
  content: string;
  collapsed: boolean;
  lines: string[];
};

type StreamUsage = {
  totalTokens?: number | { total?: number };
  inputTokens?: number | { total?: number };
  promptTokens?: number;
  outputTokens?: number | { total?: number };
  completionTokens?: number;
};

type MessageMetadataWithStats = {
  usage?: StreamUsage;
  performance?: Pick<StepResultPerformance, 'outputTokensPerSecond'>;
};

const colors = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  user: '\x1b[96m',
  assistant: '\x1b[92m',
  reasoning: '\x1b[94m',
  tool: '\x1b[95m',
  error: '\x1b[91m',
};

const sectionStyles: Record<
  ChatSectionKind,
  { color: string; border: string }
> = {
  user: { color: colors.user, border: '─' },
  assistant: { color: colors.assistant, border: '─' },
  reasoning: { color: colors.reasoning, border: '·' },
  tool: { color: colors.tool, border: '─' },
  error: { color: colors.error, border: '─' },
};

const inputCursorBlinkMs = 500;
const activeControls = '↑/↓ · PgUp/PgDn · Esc/Ctrl+C';
const doneControls = '↑/↓ · PgUp/PgDn · q/Esc/Ctrl+C';
const processingStatus = `Processing input... ${activeControls}`;
const processingToolResultsStatus = `Processing tool results... ${activeControls}`;
const streamingStatus = `Streaming... ${activeControls}`;
const executingToolsStatus = `Executing tools... ${activeControls}`;

export class TerminalRenderer {
  readonly #input: TerminalInput;
  readonly #output: TerminalOutput;
  readonly #frameBuffer: TerminalFrameBuffer;
  readonly #tools: TerminalPartDisplayMode;
  readonly #reasoning: TerminalPartDisplayMode;
  readonly #responseStatistics: ResponseStatisticsMode;
  readonly #defaultContextSize?: number;

  #sections: ChatSection[] = [];
  #inputText = '';
  #inputActive = false;
  #scrollOffset = 0;
  #title = '';
  #status = streamingStatus;
  #isInteractive = false;
  #interrupted = false;
  #totalTokens?: number;
  #contextSize?: number;
  #assistantOutputTokens?: number;
  #assistantOutputTokensPerSecond?: number;
  #inputCursorVisible = true;
  #inputCursorTimer?: ReturnType<typeof setInterval>;
  #onData?: (chunk: Buffer) => void;
  #onResize?: () => void;
  #resolveStreamInterrupt?: () => void;

  constructor(options?: TerminalRendererOptions) {
    this.#input = options?.input ?? process.stdin;
    this.#output = options?.output ?? process.stdout;
    this.#frameBuffer =
      options?.frameBuffer ?? new TerminalFrameBuffer(this.#output);
    this.#tools = options?.tools ?? 'auto-collapsed';
    this.#reasoning = options?.reasoning ?? 'auto-collapsed';
    this.#responseStatistics =
      options?.responseStatistics ?? defaultResponseStatistics;
    this.#defaultContextSize = options?.contextSize;
    this.#contextSize = options?.contextSize;
  }

  async readPrompt(options?: TerminalSessionOptions): Promise<string> {
    this.#start(options);
    this.#inputActive = true;
    this.#inputText = options?.initialPrompt ?? '';
    this.#status = `Type a prompt and press Enter · ${activeControls}`;
    this.#startInputCursorBlink();
    this.#paint();

    return await new Promise((resolve, reject) => {
      this.#onData = chunk => {
        const key = parseKey(chunk);

        switch (key.type) {
          case 'character':
            this.#inputText += key.value;
            this.#showInputCursor();
            this.#paint();
            break;
          case 'backspace':
            this.#inputText = this.#inputText.slice(0, -1);
            this.#showInputCursor();
            this.#paint();
            break;
          case 'enter': {
            const prompt = this.#inputText;
            this.#inputActive = false;
            this.#stopInputCursorBlink();
            this.#status = processingStatus;
            this.#addUserSection(prompt);
            this.#inputText = '';
            this.#paint();
            this.#detachInput();
            resolve(prompt);
            break;
          }
          case 'up':
          case 'down':
            this.#handleScroll(key.type);
            break;
          case 'page-up':
          case 'page-down':
            this.#handlePageScroll(key.type);
            break;
          case 'ctrl-l':
            this.#repaint();
            break;
          case 'escape':
          case 'ctrl-c':
            this.#stopInputCursorBlink();
            this.#stop();
            reject(interruptedError());
            break;
          case 'ignore':
            break;
        }
      };

      this.#attachInput();
    });
  }

  async renderStream(
    result: AgentTUIStreamResult,
    options?: TerminalSessionOptions,
  ): Promise<UIMessage | undefined> {
    this.#start(options);
    this.#inputActive = false;
    this.#status = processingStatus;
    this.#addSubmittedPrompt(options?.submittedPrompt);
    this.#interrupted = false;
    this.#totalTokens = undefined;
    this.#assistantOutputTokens = undefined;
    this.#assistantOutputTokensPerSecond = undefined;
    const displayModes = {
      tools: options?.tools ?? this.#tools,
      reasoning: options?.reasoning ?? this.#reasoning,
      responseStatistics:
        options?.responseStatistics ?? this.#responseStatistics,
    };
    this.#paint();
    const streamInterrupted = new Promise<void>(resolve => {
      this.#resolveStreamInterrupt = resolve;
    });
    this.#onData = chunk => this.#handleStreamingKey(chunk);
    this.#attachInput();
    let responseMessage: UIMessage | undefined;
    const stream = toReadableStream(
      this.#observeUIMessageStream(result.uiMessageStream),
    );

    try {
      const messages = readUIMessageStream({
        message: result.message,
        stream,
        onError: error =>
          this.#addErrorSection('Error', formatStreamError(error)),
      });

      for await (const message of takeUntil(messages, streamInterrupted)) {
        if (this.#interrupted) {
          break;
        }

        responseMessage = message;
        this.#renderAssistantMessage(message, displayModes);
      }

      if (
        !this.#interrupted &&
        responseMessage &&
        this.#assistantOutputTokens != null
      ) {
        this.#renderAssistantMessage(responseMessage, displayModes);
      }
    } finally {
      this.#resolveStreamInterrupt = undefined;
      if (this.#interrupted) {
        result.abort?.();
      }
      this.#detachInput();
      this.#status = this.#interrupted
        ? 'Interrupted'
        : options?.continueSession
          ? `Done · Enter another prompt · ${activeControls}`
          : `Done · ${doneControls}`;
      this.#paint();
      await this.#waitForExit(options);

      if (this.#interrupted || !options?.continueSession) {
        this.#stop();
      }
    }

    if (this.#interrupted) {
      throw interruptedError();
    }

    return responseMessage;
  }

  async readToolApproval(
    request: AgentTUIToolApprovalRequest,
    options?: TerminalSessionOptions,
  ): Promise<AgentTUIToolApprovalResponse> {
    this.#start(options);
    this.#inputActive = false;
    this.#status = `Approve ${formatToolApprovalTitle(request)}? y/n · ${activeControls}`;
    this.#interrupted = false;
    this.#paint();

    return await new Promise((resolve, reject) => {
      this.#onData = chunk => {
        const key = parseKey(chunk);

        switch (key.type) {
          case 'character': {
            const value = key.value.toLowerCase();

            if (value === 'y') {
              this.#status = `Approved · ${processingStatus}`;
              this.#detachInput();
              this.#paint();
              resolve({ approved: true });
            } else if (value === 'n') {
              this.#status = `Denied · ${processingStatus}`;
              this.#detachInput();
              this.#paint();
              resolve({ approved: false, reason: 'Denied by user.' });
            }
            break;
          }
          case 'up':
          case 'down':
            this.#handleScroll(key.type);
            break;
          case 'page-up':
          case 'page-down':
            this.#handlePageScroll(key.type);
            break;
          case 'ctrl-l':
            this.#repaint();
            break;
          case 'escape':
          case 'ctrl-c':
            this.#interrupted = true;
            this.#stop();
            reject(interruptedError());
            break;
          default:
            break;
        }
      };

      this.#attachInput();
    });
  }

  #start(options?: TerminalSessionOptions) {
    this.#title = options?.title ?? this.#title;
    this.#contextSize = options?.contextSize ?? this.#defaultContextSize;

    if (this.#isInteractive) {
      return;
    }

    this.#isInteractive = true;
    this.#frameBuffer.reset();
    this.#output.write('\x1b[?1049h\x1b[?25l');

    if (this.#input.isTTY) {
      this.#input.setRawMode?.(true);
      this.#input.resume();
    }

    this.#onResize = () => this.#repaint();
    this.#output.on('resize', this.#onResize);
  }

  #stop() {
    this.#detachInput();
    this.#stopInputCursorBlink();

    if (!this.#isInteractive) {
      return;
    }

    if (this.#input.isTTY) {
      this.#input.setRawMode?.(false);
      this.#input.pause();
    }

    if (this.#onResize) {
      this.#output.off('resize', this.#onResize);
      this.#onResize = undefined;
    }

    this.#output.write('\x1b[?25h\x1b[?1049l');
    this.#frameBuffer.reset();
    this.#isInteractive = false;
  }

  #attachInput() {
    if (this.#onData) {
      this.#input.on('data', this.#onData);
    }
  }

  #detachInput() {
    if (this.#onData) {
      this.#input.off('data', this.#onData);
      this.#onData = undefined;
    }
  }

  #handleStreamingKey(chunk: Buffer) {
    const key = parseKey(chunk);

    switch (key.type) {
      case 'up':
      case 'down':
        this.#handleScroll(key.type);
        break;
      case 'page-up':
      case 'page-down':
        this.#handlePageScroll(key.type);
        break;
      case 'ctrl-l':
        this.#repaint();
        break;
      case 'escape':
      case 'ctrl-c':
        this.#interrupted = true;
        this.#resolveStreamInterrupt?.();
        break;
      default:
        break;
    }
  }

  #handleScroll(direction: 'up' | 'down', lines = 1) {
    const delta = direction === 'up' ? lines : -lines;
    this.#scrollOffset = this.#clampScrollOffset(this.#scrollOffset + delta);
    this.#paint();
  }

  #handlePageScroll(direction: 'page-up' | 'page-down') {
    this.#handleScroll(
      direction === 'page-up' ? 'up' : 'down',
      this.#bodyContentHeight(),
    );
  }

  #startInputCursorBlink() {
    this.#stopInputCursorBlink();
    this.#showInputCursor();
    this.#inputCursorTimer = setInterval(() => {
      this.#inputCursorVisible = !this.#inputCursorVisible;
      this.#paint();
    }, inputCursorBlinkMs);
    this.#inputCursorTimer.unref?.();
  }

  #stopInputCursorBlink() {
    if (this.#inputCursorTimer) {
      clearInterval(this.#inputCursorTimer);
      this.#inputCursorTimer = undefined;
    }

    this.#inputCursorVisible = true;
  }

  #showInputCursor() {
    this.#inputCursorVisible = true;
  }

  #addSubmittedPrompt(prompt: string | undefined) {
    if (prompt == null) {
      return;
    }

    const section = this.#sections.at(-1);

    if (section?.kind === 'user' && section.content === prompt) {
      return;
    }

    this.#addUserSection(prompt);
  }

  #addUserSection(prompt: string) {
    const previousBodyLineCount = this.#bodyLineCount();
    this.#sections.push({ kind: 'user', title: 'User', content: prompt });
    this.#paintAfterBodyChange(previousBodyLineCount);
  }

  #renderAssistantMessage(
    message: UIMessage,
    displayModes: {
      tools: TerminalPartDisplayMode;
      reasoning: TerminalPartDisplayMode;
      responseStatistics: ResponseStatisticsMode;
    },
  ) {
    const previousBodyLineCount = this.#bodyLineCount();
    const activeSectionIds = new Set<string>();
    const metadataStats = extractResponseStatisticsFromMetadata(
      message.metadata,
    );
    this.#totalTokens = metadataStats.totalTokens ?? this.#totalTokens;
    this.#assistantOutputTokens =
      metadataStats.outputTokens ?? this.#assistantOutputTokens;
    this.#assistantOutputTokensPerSecond =
      metadataStats.outputTokensPerSecond ??
      this.#assistantOutputTokensPerSecond;

    for (const [index, part] of message.parts.entries()) {
      const id = sectionId(message.id, index);

      switch (part.type) {
        case 'text': {
          const content = part.text.trim();

          if (content.length === 0) {
            break;
          }

          activeSectionIds.add(id);
          this.#upsertSection({
            id,
            kind: 'assistant',
            title: 'Assistant',
            rightTitle: formatResponseStatistics(
              {
                totalTokens: this.#totalTokens,
                outputTokens: this.#assistantOutputTokens,
                outputTokensPerSecond: this.#assistantOutputTokensPerSecond,
              },
              displayModes.responseStatistics,
            ),
            content,
          });
          break;
        }
        case 'reasoning': {
          const content = part.text.trim();

          if (displayModes.reasoning === 'hidden' || content.length === 0) {
            break;
          }

          activeSectionIds.add(id);
          this.#upsertSection({
            id,
            kind: 'reasoning',
            title: 'Reasoning',
            content,
            collapsed: shouldCollapsePart(
              message,
              index,
              displayModes.reasoning,
              displayModes,
            ),
          });
          break;
        }
        default:
          if (isToolUIPart(part)) {
            if (displayModes.tools === 'hidden') {
              break;
            }

            activeSectionIds.add(id);
            this.#upsertSection({
              id,
              ...renderToolInvocation(part, {
                mode: displayModes.tools,
                collapsed: shouldCollapsePart(
                  message,
                  index,
                  displayModes.tools,
                  displayModes,
                ),
              }),
            });
          }
          break;
      }
    }

    this.#removeStaleAssistantSections(message.id, activeSectionIds);
    this.#paintAfterBodyChange(previousBodyLineCount);
  }

  #upsertSection(section: ChatSection) {
    const existingSection = section.id
      ? this.#sections.find(candidate => candidate.id === section.id)
      : undefined;

    if (existingSection) {
      const cache = existingSection.cache;
      existingSection.kind = section.kind;
      existingSection.title = section.title;
      existingSection.rightTitle = section.rightTitle;
      existingSection.content = section.content;
      existingSection.collapsed = section.collapsed;
      existingSection.cache =
        cache && sectionMatchesCache(section, cache) ? cache : undefined;
      return;
    }

    this.#sections.push(section);
  }

  #removeStaleAssistantSections(
    messageId: string,
    activeSectionIds: Set<string>,
  ) {
    const prefix = `${messageId}:`;
    this.#sections = this.#sections.filter(
      section =>
        section.id == null ||
        !section.id.startsWith(prefix) ||
        activeSectionIds.has(section.id),
    );
  }

  async *#observeUIMessageStream(
    stream: AsyncIterable<UIMessageChunk> | ReadableStream<UIMessageChunk>,
  ): AsyncIterable<UIMessageChunk> {
    let hasPendingToolResults = false;

    for await (const chunk of iterateUIMessageStream(stream)) {
      const nextStatus = statusForStreamChunk(chunk, { hasPendingToolResults });

      if (chunk.type === 'start-step') {
        hasPendingToolResults = false;
      } else if (finishesToolExecution(chunk)) {
        hasPendingToolResults = true;
      }

      if (nextStatus && this.#status !== nextStatus) {
        this.#status = nextStatus;
        this.#paint();
      } else if (
        startsVisibleAssistantStream(chunk) &&
        this.#status !== streamingStatus
      ) {
        this.#status = streamingStatus;
        this.#paint();
      }

      if (chunk.type === 'error') {
        this.#addErrorSection('Error', chunk.errorText);
      }

      if (chunk.type === 'finish') {
        const stats = extractResponseStatistics(chunk);
        this.#totalTokens = stats.totalTokens;
        this.#assistantOutputTokens = stats.outputTokens;
        this.#assistantOutputTokensPerSecond = stats.outputTokensPerSecond;
      }

      yield chunk;
    }
  }

  #addErrorSection(title: string, content: string) {
    const previousBodyLineCount = this.#bodyLineCount();
    this.#sections.push({ kind: 'error', title, content });
    this.#paintAfterBodyChange(previousBodyLineCount);
  }

  #paintAfterBodyChange(previousBodyLineCount: number) {
    if (this.#scrollOffset !== 0) {
      const bodyLineDelta = this.#bodyLineCount() - previousBodyLineCount;
      this.#scrollOffset = this.#clampScrollOffset(
        this.#scrollOffset + bodyLineDelta,
      );
    }

    this.#paint();
  }

  #paint() {
    const frame = renderScreenViewport({
      width: this.#width(),
      height: this.#height(),
      title: this.#title,
      rightTitle: formatTokenCount(this.#totalTokens, this.#contextSize),
      visibleBodyLines: this.#visibleBodyLines(),
      input: this.#inputText,
      inputActive: this.#inputActive,
      inputCursorVisible: this.#inputCursorVisible,
      status: this.#status,
    });

    this.#frameBuffer.present(frame);
  }

  #repaint() {
    this.#frameBuffer.reset();
    this.#paint();
  }

  #visibleBodyLines() {
    if (this.#sections.length === 0) {
      return ['Waiting for input...'];
    }

    const bodyContentHeight = this.#bodyContentHeight();
    const totalLineCount = this.#bodyLineCount();
    const start = Math.max(
      0,
      totalLineCount - bodyContentHeight - this.#scrollOffset,
    );
    const end = start + bodyContentHeight;
    const visibleLines: string[] = [];
    let sectionStart = 0;

    for (const section of this.#sections) {
      const sectionLines = renderSectionLines(section, this.#width() - 4);
      const sectionEnd = sectionStart + sectionLines.length;

      if (sectionEnd > start && sectionStart < end) {
        visibleLines.push(
          ...sectionLines.slice(
            Math.max(0, start - sectionStart),
            end - sectionStart,
          ),
        );
      }

      if (visibleLines.length >= bodyContentHeight) {
        break;
      }

      sectionStart = sectionEnd;
    }

    return visibleLines;
  }

  #clampScrollOffset(scrollOffset: number) {
    const maxScrollOffset = Math.max(
      0,
      this.#bodyLineCount() - this.#bodyContentHeight(),
    );

    return Math.min(Math.max(0, scrollOffset), maxScrollOffset);
  }

  #bodyLineCount() {
    if (this.#sections.length === 0) {
      return 1;
    }

    let count = 0;
    for (const section of this.#sections) {
      count += renderSectionLines(section, this.#width() - 4).length;
    }

    return count;
  }

  #bodyContentHeight() {
    return Math.max(1, this.#height() - 5);
  }

  #width() {
    return Math.max(20, this.#output.columns ?? 80);
  }

  #height() {
    return Math.max(8, this.#output.rows ?? 24);
  }

  async #waitForExit(options?: TerminalSessionOptions) {
    if (
      options?.waitForExit === false ||
      !this.#input.isTTY ||
      this.#interrupted
    ) {
      return;
    }

    await new Promise<void>(resolve => {
      this.#onData = chunk => {
        const key = parseKey(chunk);

        switch (key.type) {
          case 'up':
          case 'down':
            this.#handleScroll(key.type);
            break;
          case 'page-up':
          case 'page-down':
            this.#handlePageScroll(key.type);
            break;
          case 'ctrl-l':
            this.#repaint();
            break;
          case 'escape':
            this.#detachInput();
            resolve();
            break;
          case 'character':
            if (key.value === 'q') {
              this.#detachInput();
              resolve();
            }
            break;
          case 'ctrl-c':
            this.#detachInput();
            process.exitCode = 130;
            resolve();
            break;
          default:
            break;
        }
      };

      this.#attachInput();
    });
  }
}

function interruptedError() {
  return new Error('Interrupted');
}

async function* takeUntil<T>(
  source: AsyncIterable<T>,
  stop: Promise<void>,
): AsyncIterable<T> {
  const iterator = source[Symbol.asyncIterator]();
  const stopped = stop.then(
    () => ({ done: true, value: undefined as T }) satisfies IteratorResult<T>,
  );

  while (true) {
    const nextValue = await Promise.race([iterator.next(), stopped]);

    if (nextValue.done) {
      break;
    }

    yield nextValue.value;
  }
}

function formatStreamError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return JSON.stringify(error);
}

function renderToolInvocation(
  part: ToolUIPart | DynamicToolUIPart,
  options: {
    mode: Exclude<TerminalPartDisplayMode, 'hidden'>;
    collapsed: boolean;
  },
): ChatSection {
  const toolName = getToolName(part);
  const title = `Tool · ${part.title ?? toolName}`;
  const input = 'input' in part ? part.input : undefined;
  const inputText =
    input === undefined
      ? 'Input: (streaming...)'
      : `Input:\n${formatValue(input)}`;
  const status = toolStatus(part);

  if (options.collapsed) {
    return {
      kind: 'tool',
      title,
      rightTitle: status,
      content: '',
      collapsed: true,
    };
  }

  switch (part.state) {
    case 'input-streaming':
      return {
        kind: 'tool',
        title,
        rightTitle: status,
        content: inputText,
      };
    case 'input-available':
      return {
        kind: 'tool',
        title,
        rightTitle: status,
        content: inputText,
      };
    case 'approval-requested':
      return {
        kind: 'tool',
        title,
        rightTitle: status,
        content: inputText,
      };
    case 'approval-responded':
      return {
        kind: 'tool',
        title,
        rightTitle: status,
        content: inputText,
      };
    case 'output-available':
      return {
        kind: 'tool',
        title,
        rightTitle: status,
        content: `${inputText}\n\nOutput:\n${formatValue(part.output)}`,
      };
    case 'output-error':
      return {
        kind: 'error',
        title: `Tool Error · ${part.title ?? toolName}`,
        rightTitle: status,
        content: `${inputText}\n\nError:\n${part.errorText}`,
      };
    case 'output-denied':
      return {
        kind: 'error',
        title: `Tool Denied · ${part.title ?? toolName}`,
        rightTitle: status,
        content: `${inputText}\n\nReason: ${part.approval.reason ?? 'denied'}`,
      };
  }
}

function shouldCollapsePart(
  message: UIMessage,
  partIndex: number,
  mode: TerminalPartDisplayMode,
  displayModes: {
    tools: TerminalPartDisplayMode;
    reasoning: TerminalPartDisplayMode;
  },
) {
  switch (mode) {
    case 'collapsed':
      return true;
    case 'auto-collapsed':
      return message.parts
        .slice(partIndex + 1)
        .some(part => isVisibleAssistantPart(part, displayModes));
    case 'full':
    case 'hidden':
      return false;
  }
}

function isVisibleAssistantPart(
  part: UIMessage['parts'][number],
  displayModes: {
    tools: TerminalPartDisplayMode;
    reasoning: TerminalPartDisplayMode;
  },
) {
  switch (part.type) {
    case 'text':
      return part.text.trim().length > 0;
    case 'reasoning':
      return displayModes.reasoning !== 'hidden' && part.text.trim().length > 0;
    default:
      return isToolUIPart(part) && displayModes.tools !== 'hidden';
  }
}

function startsVisibleAssistantStream(chunk: UIMessageChunk) {
  switch (chunk.type) {
    case 'text-start':
    case 'text-delta':
    case 'reasoning-start':
    case 'reasoning-delta':
    case 'tool-input-start':
    case 'tool-input-delta':
      return true;
    default:
      return false;
  }
}

function statusForStreamChunk(
  chunk: UIMessageChunk,
  { hasPendingToolResults }: { hasPendingToolResults: boolean },
) {
  switch (chunk.type) {
    case 'start-step':
      return hasPendingToolResults
        ? processingToolResultsStatus
        : processingStatus;
    case 'tool-output-available':
    case 'tool-output-error':
    case 'tool-output-denied':
      return processingToolResultsStatus;
    case 'tool-input-available':
      return executingToolsStatus;
    case 'tool-approval-response':
      return chunk.approved ? executingToolsStatus : undefined;
    default:
      return undefined;
  }
}

function finishesToolExecution(chunk: UIMessageChunk) {
  switch (chunk.type) {
    case 'tool-output-available':
    case 'tool-output-error':
    case 'tool-output-denied':
      return true;
    default:
      return false;
  }
}

function toolStatus(part: ToolUIPart | DynamicToolUIPart) {
  switch (part.state) {
    case 'input-streaming':
      return 'waiting';
    case 'approval-requested':
      return 'approval requested';
    case 'input-available':
      return 'executing';
    case 'approval-responded':
      return part.approval.approved ? 'executing' : 'denied';
    case 'output-available':
    case 'output-error':
      return 'done';
    case 'output-denied':
      return 'denied';
  }
}

function formatValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function formatToolApprovalTitle(request: AgentTUIToolApprovalRequest) {
  return `tool ${request.title ?? request.toolName}`;
}

function sectionId(messageId: string, partIndex: number) {
  return `${messageId}:${partIndex}`;
}

function toReadableStream(
  stream: AsyncIterable<UIMessageChunk> | ReadableStream<UIMessageChunk>,
): ReadableStream<UIMessageChunk> {
  if (stream instanceof ReadableStream) {
    return stream;
  }

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(chunk);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function* iterateUIMessageStream(
  stream: AsyncIterable<UIMessageChunk> | ReadableStream<UIMessageChunk>,
): AsyncIterable<UIMessageChunk> {
  if (stream instanceof ReadableStream) {
    const reader = stream.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          return;
        }

        yield value;
      }
    } finally {
      reader.releaseLock();
    }

    return;
  }

  yield* stream;
}

function renderSectionLines(section: ChatSection, width: number) {
  if (section.cache && sectionMatchesCache(section, section.cache, width)) {
    return section.cache.lines;
  }

  const lines = createSectionLines(section, width);
  section.cache = {
    width,
    kind: section.kind,
    title: section.title,
    rightTitle: section.rightTitle,
    content: section.content,
    collapsed: section.collapsed === true,
    lines,
  };

  return lines;
}

function sectionMatchesCache(
  section: ChatSection,
  cache: RenderedSectionCache,
  width = cache.width,
) {
  return (
    cache.width === width &&
    cache.kind === section.kind &&
    cache.title === section.title &&
    cache.rightTitle === section.rightTitle &&
    cache.content === section.content &&
    cache.collapsed === (section.collapsed === true)
  );
}

function createSectionLines(section: ChatSection, width: number) {
  const style = sectionStyles[section.kind];
  const contentWidth = Math.max(1, width - 4);
  const title = ` ${section.title} `;
  const rightTitle = section.rightTitle ? ` ${section.rightTitle} ` : '';

  if (section.collapsed) {
    const borderWidth = Math.max(
      0,
      width - 2 - title.length - rightTitle.length,
    );
    const top = `${style.color}╭${title}${style.border.repeat(borderWidth)}${rightTitle}╮${colors.reset}`;
    const bottom = `${style.color}╰${style.border.repeat(Math.max(0, width - 2))}╯${colors.reset}`;

    return [top, bottom];
  }

  const borderWidth = Math.max(0, width - 2 - title.length - rightTitle.length);
  const top = `${style.color}╭${title}${style.border.repeat(borderWidth)}${rightTitle}╮${colors.reset}`;
  const bottom = `${style.color}╰${style.border.repeat(Math.max(0, width - 2))}╯${colors.reset}`;
  const content =
    section.content.length > 0
      ? renderMarkdown(section.content)
      : colors.dim + '(streaming...)' + colors.reset;
  const lines = content
    .split('\n')
    .flatMap(line => wrapVisibleLine(line, contentWidth));

  return [
    top,
    ...lines.map(line => sectionLine(line, contentWidth, style.color)),
    bottom,
  ];
}

function sectionLine(line: string, contentWidth: number, color: string) {
  const visible = sliceVisible(line, contentWidth);
  const padding = ' '.repeat(
    Math.max(0, contentWidth - visibleLength(visible)),
  );

  return `${color}│${colors.reset} ${visible}${padding} ${color}│${colors.reset}`;
}

function wrapVisibleLine(line: string, width: number): string[] {
  if (line.length === 0) {
    return [''];
  }

  const lines: string[] = [];
  let remaining = line;

  while (visibleLength(remaining) > width) {
    const breakAt = findVisibleBreakPoint(remaining, width);
    lines.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }

  lines.push(remaining);
  return lines;
}

function findVisibleBreakPoint(input: string, width: number) {
  const slice = sliceVisible(input, width + 1);
  const lastSpace = slice.lastIndexOf(' ');

  if (lastSpace > 0) {
    return lastSpace;
  }

  return sliceVisible(input, width).length;
}

function extractResponseStatistics(chunk: UIMessageChunk) {
  const usage =
    'usage' in chunk ? (chunk.usage as StreamUsage | undefined) : undefined;
  const metadataUsage =
    'messageMetadata' in chunk
      ? (chunk.messageMetadata as MessageMetadataWithStats | undefined)?.usage
      : undefined;
  const metadataPerformance =
    'messageMetadata' in chunk
      ? (chunk.messageMetadata as MessageMetadataWithStats | undefined)
          ?.performance
      : undefined;

  return {
    totalTokens: extractTotalTokenCountFromUsage(usage ?? metadataUsage),
    outputTokens: extractOutputTokenCountFromUsage(usage ?? metadataUsage),
    outputTokensPerSecond: metadataPerformance?.outputTokensPerSecond,
  };
}

function extractResponseStatisticsFromMetadata(metadata: unknown) {
  const stats = metadata as MessageMetadataWithStats | undefined;

  return {
    totalTokens: extractTotalTokenCountFromUsage(stats?.usage),
    outputTokens: extractOutputTokenCountFromUsage(stats?.usage),
    outputTokensPerSecond: stats?.performance?.outputTokensPerSecond,
  };
}

function extractTotalTokenCountFromUsage(usage: StreamUsage | undefined) {
  const totalTokens = usage?.totalTokens;

  if (typeof totalTokens === 'number') {
    return totalTokens;
  }

  if (typeof totalTokens?.total === 'number') {
    return totalTokens.total;
  }

  const inputTokens = extractInputTokenCountFromUsage(usage);
  const outputTokens = extractOutputTokenCountFromUsage(usage);

  if (inputTokens != null && outputTokens != null) {
    return inputTokens + outputTokens;
  }

  return undefined;
}

function extractInputTokenCountFromUsage(usage: StreamUsage | undefined) {
  const inputTokens = usage?.inputTokens;

  if (typeof inputTokens === 'number') {
    return inputTokens;
  }

  if (typeof inputTokens?.total === 'number') {
    return inputTokens.total;
  }

  return usage?.promptTokens;
}

function extractOutputTokenCountFromUsage(usage: StreamUsage | undefined) {
  const outputTokens = usage?.outputTokens;

  if (typeof outputTokens === 'number') {
    return outputTokens;
  }

  if (typeof outputTokens?.total === 'number') {
    return outputTokens.total;
  }

  return usage?.completionTokens;
}

function formatTokenCount(tokens: number | undefined, contextSize?: number) {
  if (tokens == null) {
    return undefined;
  }

  const tokenCount = `${tokens.toLocaleString()} ${tokens === 1 ? 'token' : 'tokens'}`;
  const contextPercentage = formatContextPercentage(tokens, contextSize);

  return contextPercentage == null
    ? tokenCount
    : `${tokenCount} ${contextPercentage}`;
}

function formatContextPercentage(
  tokens: number,
  contextSize: number | undefined,
) {
  if (
    contextSize == null ||
    contextSize <= 0 ||
    !Number.isFinite(contextSize)
  ) {
    return undefined;
  }

  return `${Math.round((tokens / contextSize) * 100).toLocaleString()}%`;
}

function formatResponseStatistics(
  stats: {
    totalTokens: number | undefined;
    outputTokens: number | undefined;
    outputTokensPerSecond: number | undefined;
  },
  mode: ResponseStatisticsMode,
) {
  if (mode === 'outputTokensPerSecond') {
    return formatOutputTokensPerSecond(stats.outputTokensPerSecond);
  }

  return formatTokenCount(stats.outputTokens);
}

function formatOutputTokensPerSecond(
  outputTokensPerSecond: number | undefined,
) {
  if (outputTokensPerSecond == null) {
    return undefined;
  }

  return `${formatNumber(outputTokensPerSecond)} tok/s`;
}

function formatNumber(value: number) {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function parseKey(chunk: Buffer): TerminalKey {
  const value = chunk.toString('utf8');

  switch (value) {
    case '\u000c':
      return { type: 'ctrl-l' };
    case '\u0003':
      return { type: 'ctrl-c' };
    case '\x1B':
      return { type: 'escape' };
    case '\r':
    case '\n':
      return { type: 'enter' };
    case '\u007f':
    case '\b':
      return { type: 'backspace' };
    case '\x1B[A':
      return { type: 'up' };
    case '\x1B[B':
      return { type: 'down' };
    case '\x1B[5~':
      return { type: 'page-up' };
    case '\x1B[6~':
      return { type: 'page-down' };
    default:
      if (value >= ' ' && value !== '\x7F') {
        return { type: 'character', value };
      }

      return { type: 'ignore' };
  }
}
