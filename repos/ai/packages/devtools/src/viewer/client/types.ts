export interface Run {
  id: string;
  started_at: string;
  stepCount: number;
  firstMessage?: string;
  hasError?: boolean;
  isInProgress?: boolean;
  type?: 'generate' | 'stream';
  function_id?: string | null;
}

export interface Step {
  id: string;
  run_id: string;
  step_number: number;
  type: 'generate' | 'stream';
  model_id: string;
  provider: string | null;
  started_at: string;
  duration_ms: number | null;
  input: string;
  output: string | null;
  usage: string | null;
  error: string | null;
  raw_request: string | null;
  raw_response: string | null;
  raw_chunks: string | null;
  provider_options: string | null;
}

export interface ChildRun {
  run: {
    id: string;
    started_at: string;
    parent_run_id: string | null;
    parent_step_id: string | null;
    isInProgress?: boolean;
    function_id?: string | null;
  };
  steps: Step[];
  childRuns?: ChildRun[];
}

export interface RunDetail {
  run: {
    id: string;
    started_at: string;
    isInProgress?: boolean;
    function_id?: string | null;
  };
  steps: Step[];
  childRuns?: ChildRun[];
}

export type StepType = 'tool-calls' | 'response' | 'error';

export interface StepSummary {
  type: StepType;
  icon: 'wrench' | 'message' | 'alert';
  label: string;
  toolDetails?: string;
}

export interface StepInputSummary {
  type: 'user' | 'tool';
  label: string;
  fullText?: string;
  toolDetails?: string;
}

export interface InputTokenBreakdown {
  total: number;
  noCache?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

export interface OutputTokenBreakdown {
  total: number;
  text?: number;
  reasoning?: number;
}

export type SpanKind =
  | 'step'
  | 'child-run'
  | 'thinking'
  | 'tool-call'
  | 'text'
  | 'error';

export interface TraceSpan {
  id: string;
  stepId: string;
  label: string;
  sublabel?: string;
  startMs: number;
  durationMs: number;
  depth: number;
  kind: SpanKind;
  tokens?: { input: number; output: number };
  modelId?: string;
  isInProgress?: boolean;
  toolCallId?: string;
  thinkingText?: string;
  textContent?: string;
}

// --- Parsed JSON structures (deserialized from Step string fields) ---

export interface TextContentPart {
  type: 'text';
  text: string;
}

export interface ToolCallContentPart {
  type: 'tool-call';
  toolName: string;
  toolCallId?: string;
  args?: Record<string, unknown> | string;
  input?: Record<string, unknown> | string;
}

export interface ToolResultContentPart {
  type: 'tool-result';
  toolName?: string;
  toolCallId?: string;
  result?: unknown;
  output?: unknown;
}

export interface ReasoningContentPart {
  type: 'reasoning' | 'thinking';
  text?: string;
  thinking?: string;
  reasoning?: string;
  toolCallId?: string;
}

export type ContentPart =
  | TextContentPart
  | ToolCallContentPart
  | ToolResultContentPart
  | ReasoningContentPart;

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface PromptMessage {
  role: MessageRole;
  content: string | ContentPart[];
}

export interface ParsedInput {
  prompt?: PromptMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  toolChoice?: string | { type: string };
}

export interface ToolDefinition {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface ParsedOutput {
  finishReason?: string | { unified?: string; raw?: string };
  toolCalls?: ToolCallContentPart[];
  textParts?: TextContentPart[];
  reasoningParts?: ReasoningContentPart[];
  content?: ContentPart[];
}

export interface ParsedUsage {
  inputTokens?: number | InputTokenBreakdown;
  outputTokens?: number | OutputTokenBreakdown;
  raw?: unknown;
}

export type ParseJson = (str: string | null) => unknown;
