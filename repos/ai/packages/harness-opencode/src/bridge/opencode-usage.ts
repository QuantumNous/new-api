import type { HarnessV1StreamPart } from '@ai-sdk/harness';

type FinishStepEvent = Extract<HarnessV1StreamPart, { type: 'finish-step' }>;

export type OpenCodeTokenUsage = {
  readonly input: number;
  readonly output: number;
  readonly reasoning: number;
  readonly cache: {
    readonly read: number;
    readonly write: number;
  };
};

export type HarnessUsage = FinishStepEvent['usage'];

export function mapUsage(tokens: unknown): HarnessUsage {
  const value = extractOpenCodeTokens(tokens) ?? zeroOpenCodeTokens();
  const cacheRead = value.cache.read;
  return {
    inputTokens: {
      total: value.input,
      noCache: Math.max(0, value.input - cacheRead),
      cacheRead,
      cacheWrite: value.cache.write,
    },
    outputTokens: {
      total: value.output + value.reasoning,
      text: value.output,
      reasoning: value.reasoning,
    },
  };
}

export function defaultUsage(): HarnessUsage {
  return mapUsage(zeroOpenCodeTokens());
}

export function extractSessionTokens(
  value: unknown,
): OpenCodeTokenUsage | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const tokens =
    extractOpenCodeTokens(record.tokens) ??
    extractOpenCodeTokens(asRecord(record.info)?.tokens) ??
    extractOpenCodeTokens(asRecord(record.data)?.tokens) ??
    extractOpenCodeTokens(asRecord(asRecord(record.data)?.data)?.tokens);
  return tokens;
}

export function subtractSessionTokens({
  before,
  after,
}: {
  before: OpenCodeTokenUsage;
  after: OpenCodeTokenUsage;
}): OpenCodeTokenUsage {
  return {
    input: diff({ before: before.input, after: after.input }),
    output: diff({ before: before.output, after: after.output }),
    reasoning: diff({ before: before.reasoning, after: after.reasoning }),
    cache: {
      read: diff({ before: before.cache.read, after: after.cache.read }),
      write: diff({ before: before.cache.write, after: after.cache.write }),
    },
  };
}

export function addUsage({
  left,
  right,
}: {
  left: HarnessUsage | undefined;
  right: HarnessUsage;
}): HarnessUsage {
  if (left == null) return right;
  const leftInput = asTokenGroup(left.inputTokens);
  const rightInput = asTokenGroup(right.inputTokens);
  const leftOutput = asTokenGroup(left.outputTokens);
  const rightOutput = asTokenGroup(right.outputTokens);
  return {
    inputTokens: {
      total: add({ left: leftInput.total, right: rightInput.total }),
      noCache: add({ left: leftInput.noCache, right: rightInput.noCache }),
      cacheRead: add({
        left: leftInput.cacheRead,
        right: rightInput.cacheRead,
      }),
      cacheWrite: add({
        left: leftInput.cacheWrite,
        right: rightInput.cacheWrite,
      }),
    },
    outputTokens: {
      total: add({ left: leftOutput.total, right: rightOutput.total }),
      text: add({ left: leftOutput.text, right: rightOutput.text }),
      reasoning: add({
        left: leftOutput.reasoning,
        right: rightOutput.reasoning,
      }),
    },
  };
}

function extractOpenCodeTokens(value: unknown): OpenCodeTokenUsage | undefined {
  const record = asRecord(value);
  const cache = asRecord(record?.cache);
  if (!record || !cache) return undefined;
  return {
    input: numberValue(record.input),
    output: numberValue(record.output),
    reasoning: numberValue(record.reasoning),
    cache: {
      read: numberValue(cache.read),
      write: numberValue(cache.write),
    },
  };
}

function zeroOpenCodeTokens(): OpenCodeTokenUsage {
  return {
    input: 0,
    output: 0,
    reasoning: 0,
    cache: { read: 0, write: 0 },
  };
}

function asTokenGroup(value: unknown): Record<string, number | undefined> {
  return asRecord(value) ?? {};
}

function asRecord(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  return value as Record<string, any>;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function diff({ before, after }: { before: number; after: number }): number {
  return Math.max(0, after - before);
}

function add({
  left,
  right,
}: {
  left: unknown;
  right: unknown;
}): number | undefined {
  const leftNumber = typeof left === 'number' ? left : undefined;
  const rightNumber = typeof right === 'number' ? right : undefined;
  return leftNumber == null && rightNumber == null
    ? undefined
    : (leftNumber ?? 0) + (rightNumber ?? 0);
}
