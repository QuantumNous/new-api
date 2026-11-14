import { convertArrayToReadableStream } from '@ai-sdk/provider-utils/test';
import { smoothStream } from './smooth-stream';
import type { TextStreamPart } from './stream-text-result';
import type { ToolSet } from '@ai-sdk/provider-utils';
import { beforeEach, describe, expect, it } from 'vitest';

describe('smoothStream', () => {
  let events: any[] = [];

  beforeEach(() => {
    events = [];
  });

  async function consumeStream(stream: ReadableStream<any>) {
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      events.push(value);
    }
  }

  function delay(delayInMs: number | null) {
    events.push(`delay ${delayInMs}`);
    return Promise.resolve();
  }

  describe('throws error if chunking option is invalid', async () => {
    it('throws error if chunking strategy is invalid', async () => {
      expect(() => {
        smoothStream({
          chunking: 'foo' as any,
        });
      }).toThrowError();
    });

    it('throws error if chunking option is null', async () => {
      expect(() => {
        smoothStream({
          chunking: null as any,
        });
      }).toThrowError();
    });
  });

  describe('word chunking', () => {
    it('should combine partial words', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello', type: 'text-delta', id: '1' },
        { text: ', ', type: 'text-delta', id: '1' },
        { text: 'world!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Hello, ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "world!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should split larger text chunks', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        {
          text: 'Hello, World! This is an example text.',
          type: 'text-delta',
          id: '1',
        },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Hello, ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "World! ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "This ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "is ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "an ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "example ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "text.",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should keep longer whitespace sequences together', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'First line', type: 'text-delta', id: '1' },
        { text: ' \n\n', type: 'text-delta', id: '1' },
        { text: '  ', type: 'text-delta', id: '1' },
        { text: '  Multiple spaces', type: 'text-delta', id: '1' },
        { text: '\n    Indented', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toEqual([
        { id: '1', type: 'text-start' },
        'delay 10',
        {
          id: '1',
          text: 'First ',
          type: 'text-delta',
        },
        'delay 10',
        {
          id: '1',
          text: 'line \n\n',
          type: 'text-delta',
        },
        'delay 10',
        {
          // note: leading whitespace is included here
          // because it is part of the new chunk:
          id: '1',
          text: '    Multiple ',
          type: 'text-delta',
        },
        'delay 10',
        {
          id: '1',
          text: 'spaces\n    ',
          type: 'text-delta',
        },
        {
          id: '1',
          text: 'Indented',
          type: 'text-delta',
        },
        { id: '1', type: 'text-end' },
      ]);
    });

    it('should send remaining text buffer before tool call starts', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'I will check the', type: 'text-delta', id: '1' },
        { text: ' weather in Lon', type: 'text-delta', id: '1' },
        { text: 'don.', type: 'text-delta', id: '1' },
        {
          type: 'tool-call',
          toolCallId: '1',
          toolName: 'weather',
          input: { city: 'London' },
        },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "I ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "will ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "check ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "the ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "weather ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "in ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "London.",
            "type": "text-delta",
          },
          {
            "input": {
              "city": "London",
            },
            "toolCallId": "1",
            "toolName": "weather",
            "type": "tool-call",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should send remaining text buffer before tool call starts and tool call streaming is enabled', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', text: 'I will check the' },
        { type: 'text-delta', id: '1', text: ' weather in Lon' },
        { type: 'text-delta', id: '1', text: 'don.' },
        {
          type: 'tool-input-start',
          toolName: 'weather',
          id: '2',
        },
        { type: 'tool-input-delta', id: '2', delta: '{ city: "London" }' },
        { type: 'tool-input-end', id: '2' },
        {
          type: 'tool-call',
          toolCallId: '1',
          toolName: 'weather',
          input: { city: 'London' },
        },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "I ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "will ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "check ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "the ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "weather ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "in ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "London.",
            "type": "text-delta",
          },
          {
            "id": "2",
            "toolName": "weather",
            "type": "tool-input-start",
          },
          {
            "delta": "{ city: "London" }",
            "id": "2",
            "type": "tool-input-delta",
          },
          {
            "id": "2",
            "type": "tool-input-end",
          },
          {
            "input": {
              "city": "London",
            },
            "toolCallId": "1",
            "toolName": "weather",
            "type": "tool-call",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it(`doesn't return chunks with just spaces`, async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { type: 'text-delta', id: '1', text: ' ' },
        { type: 'text-delta', id: '1', text: ' ' },
        { type: 'text-delta', id: '1', text: ' ' },
        { type: 'text-delta', id: '1', text: 'foo' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "1",
            "text": "   foo",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });
  });

  describe('line chunking', () => {
    it('should split text by lines when using line chunking mode', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        {
          text: 'First line\nSecond line\nThird line with more text\n',
          type: 'text-delta',
          id: '1',
        },
        { text: 'Partial line', type: 'text-delta', id: '1' },
        { text: ' continues\nFinal line\n', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          chunking: 'line',
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "First line
        ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Second line
        ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Third line with more text
        ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Partial line continues
        ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Final line
        ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should handle text without line endings in line chunking mode', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Text without', type: 'text-delta', id: '1' },
        { text: ' any line', type: 'text-delta', id: '1' },
        { text: ' breaks', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: 'line',
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "1",
            "text": "Text without any line breaks",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });
  });

  describe('custom chunking', () => {
    it(`should return correct result for regexes that don't match from the exact start onwards`, async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello_, world!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: /_/,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Hello_",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": ", world!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should support custom chunking regexps (character-level)', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello, world!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: /./,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "H",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "e",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "l",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "l",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "o",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": ",",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": " ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "w",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "o",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "r",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "l",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "d",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });
  });

  describe('custom callback chunking', () => {
    it('should support custom chunking callback', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'He_llo, ', type: 'text-delta', id: '1' },
        { text: 'w_orld!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: buffer => /[^_]*_/.exec(buffer)?.[0],
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "He_",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "llo, w_",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "orld!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    describe('throws errors if the chunking function invalid matches', async () => {
      it('throws empty match error', async () => {
        const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
          { type: 'text-start', id: '1' },
          { text: 'Hello, world!', type: 'text-delta', id: '1' },
          { type: 'text-end', id: '1' },
        ]).pipeThrough(
          smoothStream({ chunking: () => '', _internal: { delay } })({
            tools: {},
          }),
        );

        await expect(
          consumeStream(stream),
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `[Error: Chunking function must return a non-empty string.]`,
        );
      });

      it('throws match prefix error', async () => {
        const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
          { type: 'text-start', id: '1' },
          { text: 'Hello, world!', type: 'text-delta', id: '1' },
          { type: 'text-end', id: '1' },
        ]).pipeThrough(
          smoothStream({ chunking: () => 'world', _internal: { delay } })({
            tools: {},
          }),
        );

        await expect(
          consumeStream(stream),
        ).rejects.toThrowErrorMatchingInlineSnapshot(
          `[Error: Chunking function must return a match that is a prefix of the buffer. Received: "world" expected to start with "Hello, world!"]`,
        );
      });
    });
  });

  describe('delay', () => {
    it('should default to 10ms', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello, world!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Hello, ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "world!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should support different number of milliseconds delay', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello, world!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 20,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 20",
          {
            "id": "1",
            "text": "Hello, ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "world!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should support null delay', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello, world!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: null,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay null",
          {
            "id": "1",
            "text": "Hello, ",
            "type": "text-delta",
          },
          {
            "id": "1",
            "text": "world!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });
  });

  describe('text part id changes', () => {
    it('should change the id when the text part id changes', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { type: 'text-start', id: '2' },
        { text: 'I will check the', type: 'text-delta', id: '1' },
        { text: ' weather in Lon', type: 'text-delta', id: '1' },
        { text: 'don.', type: 'text-delta', id: '1' },
        { text: 'I will check the', type: 'text-delta', id: '2' },
        { text: ' weather in Lon', type: 'text-delta', id: '2' },
        { text: 'don.', type: 'text-delta', id: '2' },
        { type: 'text-end', id: '1' },
        { type: 'text-end', id: '2' },
      ]).pipeThrough(
        smoothStream({
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "2",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "I ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "will ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "check ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "the ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "weather ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "in ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "London.",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "I ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "will ",
            "type": "text-delta",
          },
          {
            "id": "2",
            "text": "check ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "the ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "weather ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "in ",
            "type": "text-delta",
          },
          {
            "id": "2",
            "text": "London.",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
          {
            "id": "2",
            "type": "text-end",
          },
        ]
      `);
    });
  });

  describe('reasoning smoothing', () => {
    it('should combine partial reasoning words', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'reasoning-start', id: '1' },
        { text: 'Let', type: 'reasoning-delta', id: '1' },
        { text: ' me ', type: 'reasoning-delta', id: '1' },
        { text: 'think...', type: 'reasoning-delta', id: '1' },
        { type: 'reasoning-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "reasoning-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Let ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "me ",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "text": "think...",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "type": "reasoning-end",
          },
        ]
      `);
    });

    it('should split larger reasoning chunks', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'reasoning-start', id: '1' },
        {
          text: 'First I need to analyze the problem. Then I will solve it.',
          type: 'reasoning-delta',
          id: '1',
        },
        { type: 'reasoning-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "reasoning-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "First ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "I ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "need ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "to ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "analyze ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "the ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "problem. ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Then ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "I ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "will ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "solve ",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "text": "it.",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "type": "reasoning-end",
          },
        ]
      `);
    });

    it('should flush reasoning buffer before tool call', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'reasoning-start', id: '1' },
        { text: 'I should check the', type: 'reasoning-delta', id: '1' },
        { text: ' weather', type: 'reasoning-delta', id: '1' },
        {
          type: 'tool-call',
          toolCallId: '1',
          toolName: 'weather',
          input: { city: 'London' },
        },
        { type: 'reasoning-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "reasoning-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "I ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "should ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "check ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "the ",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "text": "weather",
            "type": "reasoning-delta",
          },
          {
            "input": {
              "city": "London",
            },
            "toolCallId": "1",
            "toolName": "weather",
            "type": "tool-call",
          },
          {
            "id": "1",
            "type": "reasoning-end",
          },
        ]
      `);
    });

    it('should use line chunking for reasoning', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'reasoning-start', id: '1' },
        {
          text: 'Step 1: Analyze\nStep 2: Solve\n',
          type: 'reasoning-delta',
          id: '1',
        },
        { type: 'reasoning-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          chunking: 'line',
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "reasoning-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Step 1: Analyze
        ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Step 2: Solve
        ",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "type": "reasoning-end",
          },
        ]
      `);
    });
  });

  describe('interleaved text and reasoning', () => {
    it('should flush text buffer when switching to reasoning', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { type: 'reasoning-start', id: '2' },
        { text: 'Hello ', type: 'text-delta', id: '1' },
        { text: 'world', type: 'text-delta', id: '1' },
        { text: 'Let me', type: 'reasoning-delta', id: '2' },
        { text: ' think', type: 'reasoning-delta', id: '2' },
        { type: 'text-end', id: '1' },
        { type: 'reasoning-end', id: '2' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          {
            "id": "2",
            "type": "reasoning-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Hello ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "world",
            "type": "text-delta",
          },
          {
            "id": "2",
            "text": "Let ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "me ",
            "type": "reasoning-delta",
          },
          {
            "id": "2",
            "text": "think",
            "type": "reasoning-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
          {
            "id": "2",
            "type": "reasoning-end",
          },
        ]
      `);
    });

    it('should flush reasoning buffer when switching to text', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'reasoning-start', id: '1' },
        { type: 'text-start', id: '2' },
        { text: 'Thinking ', type: 'reasoning-delta', id: '1' },
        { text: 'hard', type: 'reasoning-delta', id: '1' },
        { text: 'The answer', type: 'text-delta', id: '2' },
        { text: ' is 42', type: 'text-delta', id: '2' },
        { type: 'reasoning-end', id: '1' },
        { type: 'text-end', id: '2' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "reasoning-start",
          },
          {
            "id": "2",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Thinking ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "hard",
            "type": "reasoning-delta",
          },
          {
            "id": "2",
            "text": "The ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "answer ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "2",
            "text": "is ",
            "type": "text-delta",
          },
          {
            "id": "2",
            "text": "42",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "reasoning-end",
          },
          {
            "id": "2",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should handle multiple switches between text and reasoning', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'reasoning-start', id: 'r1' },
        { type: 'text-start', id: 't1' },
        { text: 'Think ', type: 'reasoning-delta', id: 'r1' },
        { text: 'Hello ', type: 'text-delta', id: 't1' },
        { text: 'more ', type: 'reasoning-delta', id: 'r1' },
        { text: 'world ', type: 'text-delta', id: 't1' },
        { type: 'reasoning-end', id: 'r1' },
        { type: 'text-end', id: 't1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "r1",
            "type": "reasoning-start",
          },
          {
            "id": "t1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "r1",
            "text": "Think ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "t1",
            "text": "Hello ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "r1",
            "text": "more ",
            "type": "reasoning-delta",
          },
          "delay 10",
          {
            "id": "t1",
            "text": "world ",
            "type": "text-delta",
          },
          {
            "id": "r1",
            "type": "reasoning-end",
          },
          {
            "id": "t1",
            "type": "text-end",
          },
        ]
      `);
    });
  });

  describe('providerMetadata preservation', () => {
    it('should preserve providerMetadata on reasoning-delta chunks (signature for Anthropic thinking)', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'reasoning-start', id: '1' },
        { text: 'I am', type: 'reasoning-delta', id: '1' },
        { text: ' thinking...', type: 'reasoning-delta', id: '1' },
        // signature as an empty delta with providerMetadata
        {
          text: '',
          type: 'reasoning-delta',
          id: '1',
          providerMetadata: {
            anthropic: { signature: 'sig_abc123' },
          },
        },
        { type: 'reasoning-end', id: '1' },
        { type: 'text-start', id: '2' },
        { text: 'Hello!', type: 'text-delta', id: '2' },
        { type: 'text-end', id: '2' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      // Find the last reasoning-delta chunk
      const reasoningDeltas = events.filter(
        (e: any) => e.type === 'reasoning-delta',
      );
      const lastReasoningDelta = reasoningDeltas[reasoningDeltas.length - 1];

      expect(lastReasoningDelta).toHaveProperty('providerMetadata');
      expect(lastReasoningDelta.providerMetadata).toEqual({
        anthropic: { signature: 'sig_abc123' },
      });
    });

    it('should preserve providerMetadata on reasoning-start for redacted thinking', async () => {
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        {
          type: 'reasoning-start',
          id: '1',
          providerMetadata: {
            anthropic: { redactedData: 'redacted-thinking-data' },
          },
        },
        { type: 'reasoning-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      // reasoning-start should pass through unchanged with providerMetadata
      const reasoningStart = events.find(
        (e: any) => e.type === 'reasoning-start',
      );
      expect(reasoningStart).toHaveProperty('providerMetadata');
      expect(reasoningStart.providerMetadata).toEqual({
        anthropic: { redactedData: 'redacted-thinking-data' },
      });
    });
  });

  describe('Intl.Segmenter chunking', () => {
    it('should segment English text using Intl.Segmenter', async () => {
      const segmenter = new Intl.Segmenter('en', { granularity: 'word' });
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello, world!', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: segmenter,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Hello",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": ",",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": " ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "world",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "!",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should segment Japanese text using Intl.Segmenter', async () => {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'こんにちは世界', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: segmenter,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "こんにちは",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "世界",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should segment Chinese text using Intl.Segmenter', async () => {
      const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: '你好世界', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: segmenter,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "你好",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "世界",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should handle mixed CJK and Latin content', async () => {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'Hello こんにちは World', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: segmenter,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "Hello",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": " ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "こんにちは",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": " ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "World",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should combine partial chunks with Intl.Segmenter', async () => {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        { text: 'こんに', type: 'text-delta', id: '1' },
        { text: 'ちは', type: 'text-delta', id: '1' },
        { text: '世界', type: 'text-delta', id: '1' },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: segmenter,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      // Note: Intl.Segmenter segments hiragana character-by-character when
      // the full word isn't available in the buffer
      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "こん",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "に",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "ち",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "は",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "世界",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });

    it('should segment longer Japanese sentence with mixed content', async () => {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      const stream = convertArrayToReadableStream<TextStreamPart<ToolSet>>([
        { type: 'text-start', id: '1' },
        {
          text: '東京は日本の首都です。人口は約1400万人で、世界最大の都市圏の一つです。美しい桜の季節には多くの観光客が訪れます。',
          type: 'text-delta',
          id: '1',
        },
        { type: 'text-end', id: '1' },
      ]).pipeThrough(
        smoothStream({
          chunking: segmenter,
          delayInMs: 10,
          _internal: { delay },
        })({ tools: {} }),
      );

      await consumeStream(stream);

      expect(events).toMatchInlineSnapshot(`
        [
          {
            "id": "1",
            "type": "text-start",
          },
          "delay 10",
          {
            "id": "1",
            "text": "東京",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "は",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "日本",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "の",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "首都",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "です",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "。",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "人口",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "は",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "約",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "1400",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "万人",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "で",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "、",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "世界",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "最大",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "の",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "都市",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "圏",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "の",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "一つ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "です",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "。",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "美しい",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "桜の",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "季節",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "に",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "は",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "多く",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "の",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "観光",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "客",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "が",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "訪れ",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "ます",
            "type": "text-delta",
          },
          "delay 10",
          {
            "id": "1",
            "text": "。",
            "type": "text-delta",
          },
          {
            "id": "1",
            "type": "text-end",
          },
        ]
      `);
    });
  });
});
