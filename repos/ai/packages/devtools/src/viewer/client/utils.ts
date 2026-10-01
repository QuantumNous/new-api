import type {
  StepSummary,
  StepInputSummary,
  InputTokenBreakdown,
  OutputTokenBreakdown,
  TraceSpan,
  RunDetail,
  ChildRun,
  Step,
  SpanKind,
  ParsedInput,
  ParsedOutput,
  ParsedUsage,
  ContentPart,
  ToolCallContentPart,
  PromptMessage,
  ParseJson,
} from './types';

export function summarizeToolCalls(toolCalls: ToolCallContentPart[]): {
  label: string;
  details: string;
} {
  const counts = toolCalls.reduce((acc: Record<string, number>, call) => {
    acc[call.toolName] = (acc[call.toolName] || 0) + 1;
    return acc;
  }, {});

  const uniqueTools = Object.keys(counts);

  const formatTool = (name: string) => {
    const count = counts[name] ?? 0;
    return count > 1 ? `${name} (x${count})` : name;
  };

  const allToolsFormatted = uniqueTools.map(formatTool);

  if (uniqueTools.length === 1 && uniqueTools[0]) {
    return {
      label: formatTool(uniqueTools[0]),
      details: '',
    };
  }

  if (uniqueTools.length === 2) {
    return {
      label: `${formatTool(uniqueTools[0])}, ${formatTool(uniqueTools[1])}`,
      details: allToolsFormatted.join(', '),
    };
  }

  return {
    label: `${formatTool(uniqueTools[0])}, ${formatTool(uniqueTools[1])}, ...`,
    details: allToolsFormatted.join(', '),
  };
}

export function truncateText(text: string, maxLength: number = 30): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '…';
}

function extractTextFromMessage(message: PromptMessage): string | null {
  const { content } = message;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const textPart = content.find(
      (part): part is { type: 'text'; text: string } => part.type === 'text',
    );
    return textPart?.text ?? null;
  }
  return null;
}

export function getStepInputSummary(
  input: ParsedInput | null,
  isFirstStep: boolean,
): StepInputSummary | null {
  const prompt = input?.prompt;
  if (!Array.isArray(prompt)) return null;

  if (isFirstStep) {
    const userMessages = prompt.filter(msg => msg.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (lastUserMessage) {
      const text = extractTextFromMessage(lastUserMessage);
      if (text) {
        return {
          type: 'user',
          label: `"${truncateText(text)}"`,
          fullText: text,
        };
      }
    }
    return null;
  }

  const toolMessages = prompt.filter(msg => msg.role === 'tool');
  if (toolMessages.length > 0) {
    const lastToolMessage = toolMessages[toolMessages.length - 1];
    const toolCounts: Record<string, number> = {};

    const content = lastToolMessage?.content;
    if (Array.isArray(content)) {
      for (const part of content) {
        if (
          part.type === 'tool-result' &&
          'toolName' in part &&
          part.toolName
        ) {
          toolCounts[part.toolName] = (toolCounts[part.toolName] || 0) + 1;
        }
      }
    }

    const uniqueTools = Object.keys(toolCounts);
    if (uniqueTools.length === 0) {
      return { type: 'tool', label: 'tool result' };
    }

    const formatTool = (name: string) => {
      const count = toolCounts[name];
      return count != null && count > 1 ? `${name} (x${count})` : name;
    };

    const allToolsFormatted = uniqueTools.map(formatTool);

    if (uniqueTools.length === 1) {
      return { type: 'tool', label: formatTool(uniqueTools[0]) };
    }

    if (uniqueTools.length === 2) {
      return {
        type: 'tool',
        label: `${formatTool(uniqueTools[0])}, ${formatTool(uniqueTools[1])}`,
        toolDetails: allToolsFormatted.join(', '),
      };
    }

    return {
      type: 'tool',
      label: `${formatTool(uniqueTools[0])}, ${formatTool(uniqueTools[1])}, ...`,
      toolDetails: allToolsFormatted.join(', '),
    };
  }

  const userMessages = prompt.filter(msg => msg.role === 'user');
  const lastUserMessage = userMessages[userMessages.length - 1];

  if (!lastUserMessage) return null;

  const text = extractTextFromMessage(lastUserMessage);
  if (!text) return null;

  return {
    type: 'user',
    label: `"${truncateText(text)}"`,
    fullText: text,
  };
}

export function getStepSummary(
  output: ParsedOutput | null,
  error: string | null,
): StepSummary {
  if (error) {
    return { type: 'error', icon: 'alert', label: 'Error' };
  }

  const finishReason =
    typeof output?.finishReason === 'string'
      ? output.finishReason
      : typeof output?.finishReason === 'object'
        ? output.finishReason?.unified
        : undefined;

  if (finishReason === 'tool-calls') {
    const toolCalls: ToolCallContentPart[] =
      output?.toolCalls ||
      (output?.content?.filter(
        (p): p is ToolCallContentPart => p.type === 'tool-call',
      ) ??
        []);
    const { label, details } = summarizeToolCalls(toolCalls);
    return {
      type: 'tool-calls',
      icon: 'wrench',
      label,
      toolDetails: details || undefined,
    };
  }

  return { type: 'response', icon: 'message', label: 'Response' };
}

export function safeParseJson(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Token usage can be either a number (old format) or an object with breakdown (ai@6.0.0-beta.139+).
 * Old format: inputTokens: 4456
 * New format for input: { total: 4456, noCache: 9, cacheRead: 4100, cacheWrite: 347 }
 * New format for output: { total: 1262, text: 1262, reasoning: 0 }
 */
export function getInputTokenBreakdown(
  tokens: number | InputTokenBreakdown | null | undefined,
): InputTokenBreakdown {
  if (tokens == null) return { total: 0 };
  if (typeof tokens === 'number') return { total: tokens };
  if (typeof tokens === 'object') {
    const total =
      'total' in tokens && typeof tokens.total === 'number' ? tokens.total : 0;
    return {
      total,
      ...(typeof tokens.noCache === 'number' && { noCache: tokens.noCache }),
      ...(typeof tokens.cacheRead === 'number' && {
        cacheRead: tokens.cacheRead,
      }),
      ...(typeof tokens.cacheWrite === 'number' && {
        cacheWrite: tokens.cacheWrite,
      }),
    };
  }
  return { total: 0 };
}

export function getOutputTokenBreakdown(
  tokens: number | OutputTokenBreakdown | null | undefined,
): OutputTokenBreakdown {
  if (tokens == null) return { total: 0 };
  if (typeof tokens === 'number') return { total: tokens };
  if (typeof tokens === 'object') {
    const total =
      'total' in tokens && typeof tokens.total === 'number' ? tokens.total : 0;
    return {
      total,
      ...(typeof tokens.text === 'number' && { text: tokens.text }),
      ...(typeof tokens.reasoning === 'number' && {
        reasoning: tokens.reasoning,
      }),
    };
  }
  return { total: 0 };
}

export function formatInputTokens(breakdown: InputTokenBreakdown): string {
  const { total, cacheRead } = breakdown;
  if (cacheRead && cacheRead > 0) {
    return `${total} (${cacheRead} cached)`;
  }
  return String(total);
}

export function formatOutputTokens(breakdown: OutputTokenBreakdown): string {
  const { total, reasoning } = breakdown;
  if (reasoning && reasoning > 0) {
    return `${total} (${reasoning} reasoning)`;
  }
  return String(total);
}

export function formatToolParams(
  args: Record<string, unknown>,
  _maxLength = 40,
): string {
  if (!args || typeof args !== 'object') return '';

  const entries = Object.entries(args);
  if (entries.length === 0) return '';

  const formatValue = (value: unknown, maxLen = 20): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length}]`;
      }
      return '{…}';
    }
    if (typeof value === 'string') {
      if (value.length > maxLen) {
        return `"${value.slice(0, maxLen)}…"`;
      }
      return `"${value}"`;
    }
    return String(value);
  };

  const firstEntry = entries[0];
  if (!firstEntry) return '';

  const [firstKey, firstValue] = firstEntry;
  const firstFormatted = `${firstKey}: ${formatValue(firstValue)}`;

  if (entries.length === 1) {
    return `{ ${firstFormatted} }`;
  }

  return `{ ${firstFormatted}, … }`;
}

export function formatToolParamsInline(args: Record<string, unknown>): string {
  if (!args || typeof args !== 'object') return '';

  const entries = Object.entries(args);
  if (entries.length === 0) return '';

  const formatValue = (value: unknown, maxLen = 20): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length}]`;
      }
      return '{…}';
    }
    if (typeof value === 'string') {
      if (value.length > maxLen) {
        return `"${value.slice(0, maxLen)}…"`;
      }
      return `"${value}"`;
    }
    return String(value);
  };

  const firstEntry = entries[0];
  if (!firstEntry) return '';

  const [firstKey, firstValue] = firstEntry;
  const firstFormatted = `${firstKey}: ${formatValue(firstValue)}`;

  if (entries.length === 1) {
    return `{ ${firstFormatted} }`;
  }

  return `{ ${firstFormatted}, … }`;
}

export function formatResultPreview(result: unknown): string {
  if (result === null) return 'null';
  if (result === undefined) return 'undefined';

  if (typeof result === 'string') {
    if (result.length > 30) {
      return `"${result.slice(0, 30)}…"`;
    }
    return `"${result}"`;
  }

  if (Array.isArray(result)) {
    return `[${result.length}]`;
  }

  if (typeof result === 'object') {
    const entries = Object.entries(result as Record<string, unknown>);
    if (entries.length === 0) return '{}';

    const firstEntry = entries[0];
    if (!firstEntry) return '{…}';

    const [firstKey, firstValue] = firstEntry;
    let valueStr: string;
    if (typeof firstValue === 'string' && firstValue.length > 15) {
      valueStr = `"${firstValue.slice(0, 15)}…"`;
    } else if (typeof firstValue === 'string') {
      valueStr = `"${firstValue}"`;
    } else if (typeof firstValue === 'object') {
      valueStr = Array.isArray(firstValue) ? `[${firstValue.length}]` : '{…}';
    } else {
      valueStr = String(firstValue);
    }

    if (entries.length === 1) {
      return `{ ${firstKey}: ${valueStr} }`;
    }
    return `{ ${firstKey}: ${valueStr}, … }`;
  }

  return String(result);
}

export const SPAN_COLORS: Record<SpanKind, string> = {
  step: 'bg-blue-500',
  'child-run': 'bg-cyan-500',
  thinking: 'bg-amber-500',
  'tool-call': 'bg-purple-500',
  text: 'bg-emerald-500',
  error: 'bg-red-500',
};

export const SPAN_COLORS_MUTED: Record<SpanKind, string> = {
  step: 'bg-blue-500/20',
  'child-run': 'bg-cyan-500/20',
  thinking: 'bg-amber-500/20',
  'tool-call': 'bg-purple-500/20',
  text: 'bg-emerald-500/20',
  error: 'bg-red-500/20',
};

export function buildTraceSpans(
  runDetail: RunDetail,
  parseJson: ParseJson,
): TraceSpan[] {
  const spans: TraceSpan[] = [];
  const traceStart = new Date(runDetail.run.started_at).getTime();

  const addStepSpans = (
    steps: Step[],
    depth: number,
    childRuns: ChildRun[],
    functionId?: string | null,
  ) => {
    for (const step of steps) {
      const stepStartAbs = new Date(step.started_at).getTime();
      const stepStartMs = stepStartAbs - traceStart;
      const stepDuration = step.duration_ms ?? 0;
      const stepEndMs = stepStartMs + stepDuration;
      const usage = parseJson(step.usage) as ParsedUsage | null;
      const output = parseJson(step.output) as ParsedOutput | null;

      const stepLabel = functionId || step.model_id || 'LLM call';
      const stepSublabel = functionId ? step.model_id : undefined;

      const contentParts: ContentPart[] =
        (output?.content as ContentPart[] | undefined) ?? [];
      const hasSubParts = contentParts.length > 0 || step.error;

      const tokenInfo = usage
        ? {
            input:
              typeof usage.inputTokens === 'number'
                ? usage.inputTokens
                : ((usage.inputTokens as InputTokenBreakdown | undefined)
                    ?.total ?? 0),
            output:
              typeof usage.outputTokens === 'number'
                ? usage.outputTokens
                : ((usage.outputTokens as OutputTokenBreakdown | undefined)
                    ?.total ?? 0),
          }
        : undefined;

      spans.push({
        id: step.id,
        stepId: step.id,
        label: stepLabel,
        sublabel: !hasSubParts
          ? step.duration_ms === null && !step.error
            ? 'streaming...'
            : stepSublabel || 'Response'
          : stepSublabel,
        startMs: stepStartMs,
        durationMs: stepDuration,
        depth,
        kind: 'step',
        tokens: tokenInfo,
        modelId: step.model_id,
        isInProgress: step.duration_ms === null && !step.error,
      });

      if (!hasSubParts) {
        const stepChildRuns = childRuns.filter(
          childRun => childRun.run.parent_step_id === step.id,
        );
        for (const childRun of stepChildRuns) {
          addStepSpans(
            childRun.steps,
            depth + 1,
            childRun.childRuns ?? [],
            childRun.run.function_id,
          );
        }
        continue;
      }

      const stepChildRuns = childRuns.filter(
        childRun => childRun.run.parent_step_id === step.id,
      );
      const sortedChildRuns = [...stepChildRuns].sort(
        (a, b) =>
          new Date(a.run.started_at).getTime() -
          new Date(b.run.started_at).getTime(),
      );

      const toolCallParts = contentParts.filter(
        (p): p is ToolCallContentPart => p.type === 'tool-call',
      );

      const toolCallToChildRuns = new Map<string, ChildRun[]>();
      const unmatchedChildRuns: ChildRun[] = [];

      if (toolCallParts.length > 0 && sortedChildRuns.length > 0) {
        let childRunIndex = 0;
        for (const tc of toolCallParts) {
          const tcId = tc.toolCallId;
          if (!tcId) continue;

          const tcResult = contentParts.find(
            p =>
              p.type === 'tool-result' &&
              'toolCallId' in p &&
              p.toolCallId === tcId,
          );

          if (tcResult && childRunIndex < sortedChildRuns.length) {
            const childRun = sortedChildRuns[childRunIndex];
            if (childRun) {
              const existing = toolCallToChildRuns.get(tcId) ?? [];
              existing.push(childRun);
              toolCallToChildRuns.set(tcId, existing);
              childRunIndex++;
            }
          }
        }
        for (let i = childRunIndex; i < sortedChildRuns.length; i++) {
          const childRun = sortedChildRuns[i];
          if (childRun) unmatchedChildRuns.push(childRun);
        }
      } else {
        unmatchedChildRuns.push(...sortedChildRuns);
      }

      const toolTimeRanges: Array<{
        toolCallId: string;
        startMs: number;
        endMs: number;
      }> = [];
      for (const tc of toolCallParts) {
        const tcId = tc.toolCallId;
        if (!tcId) continue;
        const tcChildRuns = toolCallToChildRuns.get(tcId) ?? [];
        if (tcChildRuns.length > 0) {
          const earliest = Math.min(
            ...tcChildRuns.map(
              childRun =>
                new Date(childRun.run.started_at).getTime() - traceStart,
            ),
          );
          const latest = Math.max(
            ...tcChildRuns.map(childRun => {
              const childRunStart =
                new Date(childRun.run.started_at).getTime() - traceStart;
              const childRunDuration = childRun.steps.reduce(
                (a, s) => a + (s.duration_ms || 0),
                0,
              );
              return childRunStart + childRunDuration;
            }),
          );
          toolTimeRanges.push({
            toolCallId: tcId,
            startMs: earliest,
            endMs: latest,
          });
        }
      }

      let cursor = stepStartMs;

      for (const part of contentParts) {
        if (part.type === 'reasoning' || part.type === 'thinking') {
          const thinkingText =
            part.text || part.thinking || part.reasoning || '';

          const nextToolStart =
            toolTimeRanges.length > 0
              ? Math.min(...toolTimeRanges.map(t => t.startMs))
              : stepEndMs;
          const thinkingEnd = Math.max(cursor, nextToolStart);
          const thinkingDuration = Math.max(0, thinkingEnd - cursor);

          spans.push({
            id: `${step.id}-thinking-${part.toolCallId || cursor}`,
            stepId: step.id,
            label: 'Thinking',
            sublabel:
              thinkingText.length > 50
                ? thinkingText.slice(0, 50) + '...'
                : thinkingText,
            startMs: cursor,
            durationMs: thinkingDuration,
            depth: depth + 1,
            kind: 'thinking',
            thinkingText,
          });
          cursor = cursor + thinkingDuration;
        } else if (part.type === 'tool-call') {
          const toolName = part.toolName || 'unknown';
          const args = part.input ?? part.args;
          const argPreview =
            args && typeof args === 'object'
              ? Object.entries(args as Record<string, unknown>)
                  .slice(0, 3)
                  .map(([, v]) => {
                    const previewText =
                      typeof v === 'string'
                        ? v
                        : (JSON.stringify(v) ?? String(v));
                    return previewText.length > 30
                      ? previewText.slice(0, 30) + '…'
                      : previewText;
                  })
                  .join(', ')
              : typeof args === 'string'
                ? args.slice(0, 60)
                : '';

          const tcChildRuns =
            toolCallToChildRuns.get(part.toolCallId ?? '') ?? [];
          const timeRange = toolTimeRanges.find(
            t => t.toolCallId === part.toolCallId,
          );

          let toolStartMs: number;
          let toolDuration: number;

          if (timeRange) {
            toolStartMs = timeRange.startMs;
            toolDuration = timeRange.endMs - timeRange.startMs;
          } else {
            toolStartMs = cursor;
            toolDuration = 0;
          }

          spans.push({
            id: `${step.id}-tool-${part.toolCallId || cursor}`,
            stepId: step.id,
            label: toolName,
            sublabel: argPreview ? `(${argPreview})` : undefined,
            startMs: toolStartMs,
            durationMs: toolDuration,
            depth: depth + 1,
            kind: 'tool-call',
            toolCallId: part.toolCallId,
          });

          for (const childRun of tcChildRuns) {
            addStepSpans(
              childRun.steps,
              depth + 2,
              childRun.childRuns ?? [],
              childRun.run.function_id,
            );
          }

          cursor = Math.max(cursor, toolStartMs + toolDuration);
        } else if (part.type === 'text') {
          const text = part.text || '';

          const textDuration = Math.max(0, stepEndMs - cursor);

          spans.push({
            id: `${step.id}-text-${cursor}`,
            stepId: step.id,
            label: 'Text',
            sublabel: text.length > 60 ? text.slice(0, 60) + '...' : text,
            startMs: cursor,
            durationMs: textDuration,
            depth: depth + 1,
            kind: 'text',
            textContent: text,
          });
          cursor = cursor + textDuration;
        }
      }

      if (step.error) {
        const errorDuration = Math.max(0, stepEndMs - cursor);
        spans.push({
          id: `${step.id}-error`,
          stepId: step.id,
          label: 'Error',
          sublabel:
            step.error.length > 60
              ? step.error.slice(0, 60) + '...'
              : step.error,
          startMs: cursor,
          durationMs: errorDuration,
          depth: depth + 1,
          kind: 'error',
        });
      }

      for (const childRun of unmatchedChildRuns) {
        addStepSpans(
          childRun.steps,
          depth + 1,
          childRun.childRuns ?? [],
          childRun.run.function_id,
        );
      }
    }
  };

  addStepSpans(
    runDetail.steps,
    0,
    runDetail.childRuns ?? [],
    runDetail.run.function_id,
  );
  return spans;
}
