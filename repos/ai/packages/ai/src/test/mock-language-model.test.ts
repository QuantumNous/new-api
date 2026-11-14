import { describe, expect, it } from 'vitest';
import { MockLanguageModelV2 } from './mock-language-model-v2';
import { MockLanguageModelV3 } from './mock-language-model-v3';
import { MockLanguageModelV4 } from './mock-language-model-v4';

const usageV2 = {
  inputTokens: 1,
  outputTokens: 1,
  totalTokens: 2,
};

const usage = {
  cachedInputTokens: undefined,
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: {
    total: 1,
    text: 1,
    reasoning: undefined,
  },
};

function generateResult(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: { unified: 'stop' as const, raw: 'stop' },
    usage,
    warnings: [],
  };
}

function generateResultV2(text: string) {
  return {
    content: [{ type: 'text' as const, text }],
    finishReason: 'stop' as const,
    usage: usageV2,
    warnings: [],
  };
}

function streamResult(text: string) {
  return {
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-start', id: text });
        controller.enqueue({ type: 'text-delta', id: text, delta: text });
        controller.enqueue({ type: 'text-end', id: text });
        controller.close();
      },
    }),
  };
}

async function readStreamText(stream: ReadableStream) {
  const reader = stream.getReader();
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return text;
    }
    if (value.type === 'text-delta') {
      text += value.delta;
    }
  }
}

describe('MockLanguageModelV2', () => {
  it('returns array-backed generate results from the first entry', async () => {
    const model = new MockLanguageModelV2({
      doGenerate: [generateResultV2('first'), generateResultV2('second')],
    });

    await expect(model.doGenerate({} as never)).resolves.toMatchObject({
      content: [{ type: 'text', text: 'first' }],
    });
    await expect(model.doGenerate({} as never)).resolves.toMatchObject({
      content: [{ type: 'text', text: 'second' }],
    });
  });

  it('returns array-backed stream results from the first entry', async () => {
    const model = new MockLanguageModelV2({
      doStream: [streamResult('first'), streamResult('second')],
    });

    await expect(
      readStreamText((await model.doStream({} as never)).stream),
    ).resolves.toBe('first');
    await expect(
      readStreamText((await model.doStream({} as never)).stream),
    ).resolves.toBe('second');
    expect(model.doStreamCalls).toHaveLength(2);
  });
});

describe('MockLanguageModelV3', () => {
  it('returns array-backed generate results from the first entry', async () => {
    const model = new MockLanguageModelV3({
      doGenerate: [generateResult('first'), generateResult('second')],
    });

    await expect(model.doGenerate({} as never)).resolves.toMatchObject({
      content: [{ type: 'text', text: 'first' }],
    });
    await expect(model.doGenerate({} as never)).resolves.toMatchObject({
      content: [{ type: 'text', text: 'second' }],
    });
  });

  it('returns array-backed stream results from the first entry', async () => {
    const model = new MockLanguageModelV3({
      doStream: [streamResult('first'), streamResult('second')],
    });

    await expect(
      readStreamText((await model.doStream({} as never)).stream),
    ).resolves.toBe('first');
    await expect(
      readStreamText((await model.doStream({} as never)).stream),
    ).resolves.toBe('second');
    expect(model.doStreamCalls).toHaveLength(2);
  });
});

describe('MockLanguageModelV4', () => {
  it('returns array-backed generate results from the first entry', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: [generateResult('first'), generateResult('second')],
    });

    await expect(model.doGenerate({} as never)).resolves.toMatchObject({
      content: [{ type: 'text', text: 'first' }],
    });
    await expect(model.doGenerate({} as never)).resolves.toMatchObject({
      content: [{ type: 'text', text: 'second' }],
    });
  });

  it('returns array-backed stream results from the first entry', async () => {
    const model = new MockLanguageModelV4({
      doStream: [streamResult('first'), streamResult('second')],
    });

    await expect(
      readStreamText((await model.doStream({} as never)).stream),
    ).resolves.toBe('first');
    await expect(
      readStreamText((await model.doStream({} as never)).stream),
    ).resolves.toBe('second');
    expect(model.doStreamCalls).toHaveLength(2);
  });
});
