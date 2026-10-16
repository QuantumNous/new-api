import type {
  LanguageModelV4Prompt,
  LanguageModelV4StreamPart,
} from '@ai-sdk/provider';
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createCerebras } from './cerebras-provider';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
];
const JSON_RESPONSE_FORMAT = { type: 'json' as const };

async function convertStreamToArray(
  stream: ReadableStream<LanguageModelV4StreamPart>,
) {
  const reader = stream.getReader();
  const chunks: LanguageModelV4StreamPart[] = [];

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    chunks.push(value);
  }

  return chunks;
}

function createJsonFixtureFetchMock(filename: string) {
  return vi.fn().mockResolvedValue(
    new Response(fs.readFileSync(`src/fixtures/${filename}.json`, 'utf8'), {
      headers: { 'content-type': 'application/json' },
    }),
  );
}

function createStreamFixtureFetchMock(filename: string) {
  const chunks = fs
    .readFileSync(`src/fixtures/${filename}.chunks.txt`, 'utf8')
    .split('\n')
    .filter(line => line.trim().length > 0);

  return vi.fn().mockResolvedValue(
    new Response(
      [...chunks.map(chunk => `data: ${chunk}\n\n`), 'data: [DONE]\n\n'].join(
        '',
      ),
      {
        headers: { 'content-type': 'text/event-stream' },
      },
    ),
  );
}

describe('doGenerate', () => {
  describe('finish reason normalization', () => {
    it('preserves the captured first tool-call step', async () => {
      const fetch = createJsonFixtureFetchMock(
        'cerebras-structured-output-tools.1',
      );
      const model = createCerebras({ apiKey: 'test-api-key', fetch })(
        'zai-glm-4.7',
      );

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: JSON_RESPONSE_FORMAT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "The user is asking about a "magic number". I see that I have access to a function called "nonUsefulTool" which "returns a magic number". This seems like exactly what the user is asking for. Let me call this function to get the magic number for them.",
            "type": "reasoning",
          },
          {
            "input": "{}",
            "toolCallId": "85e4fd267",
            "toolName": "nonUsefulTool",
            "type": "tool-call",
          },
        ]
      `);
      expect(result.finishReason).toMatchInlineSnapshot(`
        {
          "raw": "tool_calls",
          "unified": "tool-calls",
        }
      `);
    });

    it('drops the captured repeated tool call when structured output text is present', async () => {
      const fetch = createJsonFixtureFetchMock(
        'cerebras-structured-output-tools.2',
      );
      const model = createCerebras({ apiKey: 'test-api-key', fetch })(
        'zai-glm-4.7',
      );

      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: JSON_RESPONSE_FORMAT,
      });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "{"result":"2026"}",
            "type": "text",
          },
          {
            "text": "The function returned 2026 as the magic number. Now I need to return this as a JSON object matching the specified schema. The schema requires a "result" property of type string. So I should wrap the magic number in a string.",
            "type": "reasoning",
          },
        ]
      `);
      expect(result.finishReason).toMatchInlineSnapshot(`
        {
          "raw": "tool_calls",
          "unified": "stop",
        }
      `);
    });

    it('preserves the captured mixed response without structured output', async () => {
      const fetch = createJsonFixtureFetchMock(
        'cerebras-structured-output-tools.2',
      );
      const model = createCerebras({ apiKey: 'test-api-key', fetch })(
        'zai-glm-4.7',
      );

      const result = await model.doGenerate({ prompt: TEST_PROMPT });

      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "text": "{"result":"2026"}",
            "type": "text",
          },
          {
            "text": "The function returned 2026 as the magic number. Now I need to return this as a JSON object matching the specified schema. The schema requires a "result" property of type string. So I should wrap the magic number in a string.",
            "type": "reasoning",
          },
          {
            "input": "{}",
            "toolCallId": "0babb4517",
            "toolName": "nonUsefulTool",
            "type": "tool-call",
          },
        ]
      `);
      expect(result.finishReason).toMatchInlineSnapshot(`
        {
          "raw": "tool_calls",
          "unified": "tool-calls",
        }
      `);
    });
  });
});

describe('doStream', () => {
  describe('finish reason normalization', () => {
    it('normalizes captured streamed structured output with tool calls finish reason', async () => {
      const fetch = createStreamFixtureFetchMock(
        'cererebras-structured-output-tools.1',
      );
      const model = createCerebras({ apiKey: 'test-api-key', fetch })(
        'zai-glm-4.7',
      );

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        responseFormat: JSON_RESPONSE_FORMAT,
      });
      const chunks = await convertStreamToArray(stream);

      expect(chunks.at(-1)).toMatchInlineSnapshot(`
        {
          "finishReason": {
            "raw": "tool_calls",
            "unified": "stop",
          },
          "providerMetadata": {
            "cerebras": {
              "acceptedPredictionTokens": 0,
              "rejectedPredictionTokens": 0,
            },
          },
          "type": "finish",
          "usage": {
            "inputTokens": {
              "cacheRead": 256,
              "cacheWrite": undefined,
              "noCache": 177,
              "total": 433,
            },
            "outputTokens": {
              "reasoning": 108,
              "text": 14,
              "total": 122,
            },
            "raw": {
              "completion_tokens": 122,
              "completion_tokens_details": {
                "accepted_prediction_tokens": 0,
                "reasoning_tokens": 108,
                "rejected_prediction_tokens": 0,
              },
              "prompt_tokens": 433,
              "prompt_tokens_details": {
                "cached_tokens": 256,
              },
              "total_tokens": 555,
            },
          },
        }
      `);
    });

    it('drops the spurious tool calls from a mixed structured-output stream', async () => {
      const fetch = createStreamFixtureFetchMock(
        'cererebras-structured-output-tools.1',
      );
      const model = createCerebras({ apiKey: 'test-api-key', fetch })(
        'zai-glm-4.7',
      );

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        responseFormat: JSON_RESPONSE_FORMAT,
      });
      const chunks = await convertStreamToArray(stream);

      // Tool calls finalize during flush (after the structured-output text has
      // streamed), so the json-mode filter drops them all — matching the
      // doGenerate behavior of treating the mixed response as the final answer.
      expect(
        chunks.filter(chunk => chunk.type === 'tool-call'),
      ).toMatchInlineSnapshot(`[]`);
    });
  });
});
