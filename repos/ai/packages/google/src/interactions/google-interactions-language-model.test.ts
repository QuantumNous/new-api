import type {
  JSONSchema7,
  LanguageModelV4FunctionTool,
  LanguageModelV4Prompt,
  LanguageModelV4ProviderTool,
} from '@ai-sdk/provider';
import { convertReadableStreamToArray } from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import * as fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGoogle } from '../google-provider';

vi.mock('../version', () => ({
  VERSION: '0.0.0-test',
}));

const TEST_URL =
  'https://generativelanguage.googleapis.com/v1beta/interactions';

const TEST_PROMPT: LanguageModelV4Prompt = [
  { role: 'user', content: [{ type: 'text', text: 'Hello, how are you?' }] },
];

const provider = createGoogle({
  apiKey: 'test-api-key',
  generateId: () => 'test-id',
});

const model = provider.interactions('gemini-2.5-flash');

describe('GoogleInteractionsLanguageModel.doGenerate', () => {
  const server = createTestServer({ [TEST_URL]: {} });

  function prepareJsonFixtureResponse(filename: string) {
    server.urls[TEST_URL].response = {
      type: 'json-value',
      body: JSON.parse(
        fs.readFileSync(
          `src/interactions/__fixtures__/${filename}.json`,
          'utf8',
        ),
      ),
    };
  }

  describe('basic text', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('basic');
    });

    it('returns content, finishReason, usage, warnings, providerMetadata', async () => {
      const result = await model.doGenerate({ prompt: TEST_PROMPT });
      expect({
        content: result.content,
        finishReason: result.finishReason,
        usage: result.usage,
        warnings: result.warnings,
        providerMetadata: result.providerMetadata,
      }).toMatchInlineSnapshot(`
        {
          "content": [
            {
              "providerMetadata": {
                "google": {
                  "interactionId": "v1_ChdTbXNIYXFyUEV0ZUttdGtQNXVqVHdRRRIXU21zSGFxclBFdGVLbXRrUDV1alR3UUU",
                  "signature": "CqwBAQw51sfgKVnBHSz5praTe+uG0Anr7XQqpCF63u254O4l2U4+GL3n7WRshuMFMfTty31n/76lM81JlqplsBd+YnEEPdyYqh4RpVrMnvUgDP7rkuWFPutrEgLUU/r3LuD3z1dc3qiMjtw3r3RkXtdHNF2Om28zmRoMT0/u8yNkPJA7S2IEfzasBN5yobkpwgbPAQ73PDJZy8n0qjNQmSG/OCMCUDBZMH3C9A1rEg==",
                },
              },
              "text": "",
              "type": "reasoning",
            },
            {
              "providerMetadata": {
                "google": {
                  "interactionId": "v1_ChdTbXNIYXFyUEV0ZUttdGtQNXVqVHdRRRIXU21zSGFxclBFdGVLbXRrUDV1alR3UUU",
                },
              },
              "text": "Hello! I'm doing well, thank you for asking.

        How are you today?",
              "type": "text",
            },
          ],
          "finishReason": {
            "raw": "completed",
            "unified": "stop",
          },
          "providerMetadata": {
            "google": {
              "interactionId": "v1_ChdTbXNIYXFyUEV0ZUttdGtQNXVqVHdRRRIXU21zSGFxclBFdGVLbXRrUDV1alR3UUU",
              "serviceTier": "standard",
            },
          },
          "usage": {
            "inputTokens": {
              "cacheRead": 0,
              "cacheWrite": undefined,
              "noCache": 7,
              "total": 7,
            },
            "outputTokens": {
              "reasoning": 32,
              "text": 19,
              "total": 51,
            },
            "raw": {
              "input_tokens_by_modality": [
                {
                  "modality": "text",
                  "tokens": 7,
                },
              ],
              "total_cached_tokens": 0,
              "total_input_tokens": 7,
              "total_output_tokens": 19,
              "total_thought_tokens": 32,
              "total_tokens": 58,
              "total_tool_use_tokens": 0,
            },
          },
          "warnings": [],
        }
      `);
    });

    it('sends the expected request body', async () => {
      await model.doGenerate({ prompt: TEST_PROMPT });
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "input": [
            {
              "content": [
                {
                  "text": "Hello, how are you?",
                  "type": "text",
                },
              ],
              "type": "user_input",
            },
          ],
          "model": "gemini-2.5-flash",
        }
      `);
    });

    it('does not send an Api-Revision header', async () => {
      await model.doGenerate({ prompt: TEST_PROMPT });
      expect(server.calls[0].requestHeaders).not.toHaveProperty('api-revision');
    });

    it('exposes the request body via result.request.body', async () => {
      const { request } = await model.doGenerate({ prompt: TEST_PROMPT });
      expect(request?.body).toMatchInlineSnapshot(`
        {
          "input": [
            {
              "content": [
                {
                  "text": "Hello, how are you?",
                  "type": "text",
                },
              ],
              "type": "user_input",
            },
          ],
          "model": "gemini-2.5-flash",
        }
      `);
    });

    it('exposes the raw response body via result.response.body', async () => {
      const { response } = await model.doGenerate({ prompt: TEST_PROMPT });
      expect(typeof response?.body).toBe('object');
      expect((response?.body as { id?: string })?.id).toMatch(/^v1_/);
    });
  });

  describe('text ProviderReference file', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('basic');
    });

    it('forwards the uploaded text document to the model', async () => {
      const result = await provider
        .interactions('gemini-3.5-flash')
        .doGenerate({
          prompt: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Return only the secret verification code from the attached text document.',
                },
                {
                  type: 'file',
                  mediaType: 'text/plain',
                  data: {
                    type: 'reference',
                    reference: {
                      google:
                        'https://generativelanguage.googleapis.com/v1beta/files/gzed1s6hqcsn',
                    },
                  },
                },
              ],
            },
          ],
        });

      expect(await server.calls[0].requestBodyJson).toMatchObject({
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text: 'Return only the secret verification code from the attached text document.',
              },
              {
                type: 'document',
                uri: 'https://generativelanguage.googleapis.com/v1beta/files/gzed1s6hqcsn',
                mime_type: 'text/plain',
              },
            ],
          },
        ],
      });
      expect(result.warnings).toEqual([]);
    });
  });

  describe('multi-turn input', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('basic');
    });

    it('emits Array<Turn> when there is more than one turn', async () => {
      const prompt: LanguageModelV4Prompt = [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: [{ type: 'text', text: 'Hi' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hello!' }] },
        {
          role: 'user',
          content: [{ type: 'text', text: 'How are you?' }],
        },
      ];
      await model.doGenerate({ prompt });
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "input": [
            {
              "content": [
                {
                  "text": "Hi",
                  "type": "text",
                },
              ],
              "type": "user_input",
            },
            {
              "content": [
                {
                  "text": "Hello!",
                  "type": "text",
                },
              ],
              "type": "model_output",
            },
            {
              "content": [
                {
                  "text": "How are you?",
                  "type": "text",
                },
              ],
              "type": "user_input",
            },
          ],
          "model": "gemini-2.5-flash",
          "system_instruction": "You are a helpful assistant.",
        }
      `);
    });
  });

  describe('structured output (responseFormat)', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('structured-output');
    });

    const SCHEMA: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the person.' },
        age: { type: 'number', description: 'Age of the person in years.' },
      },
      required: ['name', 'age'],
      additionalProperties: false,
      $schema: 'http://json-schema.org/draft-07/schema#',
    };

    it('emits response_format on the request body when responseFormat is json with a schema', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: {
          type: 'json',
          schema: SCHEMA,
        },
      });
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "input": [
            {
              "content": [
                {
                  "text": "Hello, how are you?",
                  "type": "text",
                },
              ],
              "type": "user_input",
            },
          ],
          "model": "gemini-2.5-flash",
          "response_format": [
            {
              "mime_type": "application/json",
              "schema": {
                "$schema": "http://json-schema.org/draft-07/schema#",
                "additionalProperties": false,
                "properties": {
                  "age": {
                    "description": "Age of the person in years.",
                    "type": "number",
                  },
                  "name": {
                    "description": "Full name of the person.",
                    "type": "string",
                  },
                },
                "required": [
                  "name",
                  "age",
                ],
                "type": "object",
              },
              "type": "text",
            },
          ],
        }
      `);
    });

    it('emits a single text response_format entry when responseFormat is json without a schema', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'json' },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      // mime_type lives inside the polymorphic response_format entry; no
      // top-level response_mime_type field on the wire.
      expect(body.response_mime_type).toBeUndefined();
      expect(body.response_format).toEqual([
        { type: 'text', mime_type: 'application/json' },
      ]);
    });

    it('omits response_format when responseFormat is text', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'text' },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.response_mime_type).toBeUndefined();
      expect(body.response_format).toBeUndefined();
    });

    it('returns the JSON-shaped text content from the parsed response', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'json', schema: SCHEMA },
      });
      expect(result.content).toMatchInlineSnapshot(`
        [
          {
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdUV3NIYW9LTk9OYXlxdHNQb2RpcC1RRRIXVFdzSGFvS05PTmF5cXRzUG9kaXAtUUU",
                "signature": "CqACAQw51sc7wSan2PLLtHG+z0j4AgWR8MPPe76QUDZpwhGeQ1AGXBWGqSm7nhjwbkyXhJ7JlfZ/R3iLZAmqxGH9mLrdkzQooTu5YKptE0+D1jb+PLv7PM/pkCeI8E2IUDtamWiQP2/eG3Rgouxd7+kNxcaERwGTLFsGMdZttew0aP8+xd0hKPAZVkkqKtjVVNYQaSVsnXpTxZrE+spikYx1T/lB9tl6tYkJrB/SmkGO/tsTqDVsaejBXheSM+pu/Nt7s9gAhiNxJnoTvFENezmmiGwiho1lkkPrK8u5uODO5MldRXefJnv8mkZAw/3l6Cxd63hKPGP5za6sjFr/0Scsv0LcrOU65e+YEqZOkp7OXcCoqTCZZITx89JjkOA/pN1T",
              },
            },
            "text": "",
            "type": "reasoning",
          },
          {
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdUV3NIYW9LTk9OYXlxdHNQb2RpcC1RRRIXVFdzSGFvS05PTmF5cXRzUG9kaXAtUUU",
              },
            },
            "text": "{"name":"John Doe","age":30}",
            "type": "text",
          },
        ]
      `);
      expect(result.warnings).toEqual([]);
    });

    it('warns and drops responseFormat when an agent is set', async () => {
      const agentModel = provider.interactions({
        agent: 'deep-research-pro-preview-12-2025',
      });
      await agentModel.doGenerate({
        prompt: TEST_PROMPT,
        responseFormat: { type: 'json', schema: SCHEMA },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.response_mime_type).toBeUndefined();
      expect(body.response_format).toBeUndefined();
    });
  });

  describe('service tier', () => {
    it('sends service_tier in the request body when providerOptions.google.serviceTier is set', async () => {
      prepareJsonFixtureResponse('basic');
      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            serviceTier: 'priority',
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.service_tier).toBe('priority');
    });

    it('omits service_tier from the request body when providerOptions.google.serviceTier is not set', async () => {
      prepareJsonFixtureResponse('basic');
      await model.doGenerate({ prompt: TEST_PROMPT });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.service_tier).toBeUndefined();
    });

    it('reads providerMetadata.google.serviceTier from the response body service_tier field', async () => {
      const fixture = JSON.parse(
        fs.readFileSync('src/interactions/__fixtures__/basic.json', 'utf8'),
      );
      server.urls[TEST_URL].response = {
        type: 'json-value',
        body: { ...fixture, service_tier: 'priority' },
      };

      const { providerMetadata } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(providerMetadata?.google?.serviceTier).toBe('priority');
    });

    it('falls back to the x-gemini-service-tier response header when service_tier is absent from the body', async () => {
      const fixture = JSON.parse(
        fs.readFileSync('src/interactions/__fixtures__/basic.json', 'utf8'),
      );
      delete fixture.service_tier;
      server.urls[TEST_URL].response = {
        type: 'json-value',
        body: fixture,
        headers: {
          'x-gemini-service-tier': 'priority',
        },
      };

      const { providerMetadata } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(providerMetadata?.google?.serviceTier).toBe('priority');
    });

    it('omits serviceTier from providerMetadata when both response body and header are absent', async () => {
      const fixture = JSON.parse(
        fs.readFileSync('src/interactions/__fixtures__/basic.json', 'utf8'),
      );
      delete fixture.service_tier;
      server.urls[TEST_URL].response = {
        type: 'json-value',
        body: fixture,
      };

      const { providerMetadata } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(providerMetadata?.google?.serviceTier).toBeUndefined();
    });
  });

  describe('output token modality breakdown', () => {
    it('surfaces output_tokens_by_modality on providerMetadata.google.outputTokensByModality', async () => {
      const fixture = JSON.parse(
        fs.readFileSync('src/interactions/__fixtures__/basic.json', 'utf8'),
      );
      server.urls[TEST_URL].response = {
        type: 'json-value',
        body: {
          ...fixture,
          usage: {
            ...fixture.usage,
            output_tokens_by_modality: [
              { modality: 'video', tokens: 57920 },
              { modality: 'text', tokens: 19 },
            ],
          },
        },
      };

      const { providerMetadata } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(providerMetadata?.google?.outputTokensByModality).toEqual({
        video: 57920,
        text: 19,
      });
    });

    it('omits outputTokensByModality when the response has no breakdown', async () => {
      prepareJsonFixtureResponse('basic');

      const { providerMetadata } = await model.doGenerate({
        prompt: TEST_PROMPT,
      });

      expect(providerMetadata?.google?.outputTokensByModality).toBeUndefined();
    });
  });

  describe('stateful chaining (previousInteractionId, store, thinking)', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('basic');
    });

    it('emits previous_interaction_id and omits store when previousInteractionId is set + default store', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            previousInteractionId: 'v1_prev-abc',
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.previous_interaction_id).toBe('v1_prev-abc');
      expect(body.store).toBeUndefined();
    });

    it('emits store: false (and no previous_interaction_id) for stateless mode', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            store: false,
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.store).toBe(false);
      expect(body.previous_interaction_id).toBeUndefined();
    });

    it('emits both previous_interaction_id and store: false when both are set, and surfaces a warning', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            previousInteractionId: 'v1_prev',
            store: false,
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.previous_interaction_id).toBe('v1_prev');
      expect(body.store).toBe(false);
      const warning = result.warnings.find(
        w =>
          w.type === 'other' &&
          (w as { message?: string }).message?.includes('store: false'),
      );
      expect(warning).toBeDefined();
    });

    it('compacts assistant turns matching previousInteractionId out of the wire body', async () => {
      const PREV_ID = 'v1_prev-compaction';
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is the largest city in Spain?' },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'Madrid is the largest.',
                providerOptions: {
                  google: { interactionId: PREV_ID },
                },
              },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'And the second largest?' }],
          },
        ],
        providerOptions: {
          google: { previousInteractionId: PREV_ID },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.previous_interaction_id).toBe(PREV_ID);
      expect(body.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What is the largest city in Spain?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
          {
            "content": [
              {
                "text": "And the second largest?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
        ]
      `);
    });

    it('emits thinking_level and thinking_summaries inside generation_config', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            thinkingLevel: 'high',
            thinkingSummaries: 'auto',
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as {
        generation_config?: {
          thinking_level?: string;
          thinking_summaries?: string;
        };
      };
      expect(body.generation_config?.thinking_level).toBe('high');
      expect(body.generation_config?.thinking_summaries).toBe('auto');
    });

    it('returns interactionId for turn 1 from a captured fixture', async () => {
      prepareJsonFixtureResponse('multi-turn-stateful-turn1');
      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
        ],
      });
      expect(result.providerMetadata?.google?.interactionId).toBe(
        'v1_ChdWV3NIYXNYZEc5S19xdHNQcmVYeG1BRRIXVldzSGFzWGRHOUtfcXRzUHJlWHhtQUU',
      );
      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => (c as { text: string }).text)
        .join('');
      expect(text).toContain('Madrid');
      expect(text).toContain('Barcelona');
      expect(text).toContain('Valencia');
    });

    it('compacts the turn-2 wire body and references prior interaction (fixture-driven)', async () => {
      prepareJsonFixtureResponse('multi-turn-stateful-turn2');
      const TURN_1_ID =
        'v1_ChdWV3NIYXNYZEc5S19xdHNQcmVYeG1BRRIXVldzSGFzWGRHOUtfcXRzUHJlWHhtQUU';

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: '',
                providerOptions: {
                  google: {
                    interactionId: TURN_1_ID,
                    signature: 'thought-sig-from-turn-1',
                  },
                },
              },
              {
                type: 'text',
                text: 'The three largest cities in Spain are Madrid, Barcelona, and Valencia.',
                providerOptions: {
                  google: { interactionId: TURN_1_ID },
                },
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is the most famous landmark in the second one?',
              },
            ],
          },
        ],
        providerOptions: {
          google: { previousInteractionId: TURN_1_ID },
        },
      });

      const body = (await server.calls[0].requestBodyJson) as {
        previous_interaction_id?: string;
        input: unknown;
      };
      expect(body.previous_interaction_id).toBe(TURN_1_ID);
      // Compaction: only the two surviving user messages remain on the wire.
      expect(body.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What are the three largest cities in Spain?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
          {
            "content": [
              {
                "text": "What is the most famous landmark in the second one?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
        ]
      `);

      // Turn 2 references "Barcelona" — the second city from the prior turn.
      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => (c as { text: string }).text)
        .join('');
      expect(text).toContain('Barcelona');
      expect(text).toMatch(/Sagrada Fam.lia/);
    });

    it('round-trips a thought signature on an input reasoning part to the wire thought block', async () => {
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'q' }],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: '',
                providerOptions: {
                  google: { signature: 'sig-roundtrip' },
                },
              },
              { type: 'text', text: 'old answer' },
            ],
          },
          {
            role: 'user',
            content: [{ type: 'text', text: 'q2' }],
          },
        ],
      });
      const body = (await server.calls[0].requestBodyJson) as {
        input: Array<{ type: string; signature?: string }>;
      };
      // `thought` is a top-level step type, not a content block under a
      // turn — find it directly on `input`.
      const thought = body.input.find(step => step.type === 'thought');
      expect(thought?.signature).toBe('sig-roundtrip');
    });
  });

  describe('stateless multi-turn (store: false, no previousInteractionId)', () => {
    it('forwards a single-turn user input verbatim and sets store: false (turn 1 fixture)', async () => {
      prepareJsonFixtureResponse('multi-turn-stateless-turn1');

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
        ],
        providerOptions: {
          google: { store: false },
        },
      });

      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.store).toBe(false);
      expect(body.previous_interaction_id).toBeUndefined();
      expect(body.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What are the three largest cities in Spain?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
        ]
      `);

      expect(result.warnings).toEqual([]);
      // The API omits `id` when `store: false`, so no interactionId is surfaced.
      expect(result.providerMetadata?.google?.interactionId).toBeUndefined();

      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => (c as { text: string }).text)
        .join('');
      expect(text).toContain('Madrid');
      expect(text).toContain('Barcelona');
      expect(text).toContain('Valencia');
    });

    it('forwards full message history verbatim on turn 2 with store: false (turn 2 fixture)', async () => {
      prepareJsonFixtureResponse('multi-turn-stateless-turn2');

      const result = await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'The three largest cities in Spain are Madrid, Barcelona, and Valencia.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is the most famous landmark in the second one?',
              },
            ],
          },
        ],
        providerOptions: {
          google: { store: false },
        },
      });

      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.store).toBe(false);
      expect(body.previous_interaction_id).toBeUndefined();
      // Full history forwarded verbatim — no compaction.
      expect(body.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What are the three largest cities in Spain?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
          {
            "content": [
              {
                "text": "The three largest cities in Spain are Madrid, Barcelona, and Valencia.",
                "type": "text",
              },
            ],
            "type": "model_output",
          },
          {
            "content": [
              {
                "text": "What is the most famous landmark in the second one?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
        ]
      `);

      expect(result.warnings).toEqual([]);

      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => (c as { text: string }).text)
        .join('');
      expect(text).toMatch(/Sagrada Fam.lia/);
    });
  });

  describe('abort signal', () => {
    it('rejects when the abort signal is aborted before the request is dispatched', async () => {
      const abortController = new AbortController();
      abortController.abort();

      await expect(
        model.doGenerate({
          prompt: TEST_PROMPT,
          abortSignal: abortController.signal,
        }),
      ).rejects.toThrow();
    });
  });

  describe('tool calling (multi-step flow)', () => {
    const WEATHER_TOOL: LanguageModelV4FunctionTool = {
      type: 'function',
      name: 'getWeather',
      description: 'Get the current weather in a location',
      inputSchema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to get the weather for',
          },
        },
        required: ['location'],
      },
    };

    it('emits tools and (no toolChoice) on the request body', async () => {
      prepareJsonFixtureResponse('tool-call-step1');
      await model.doGenerate({
        prompt: TEST_PROMPT,
        tools: [WEATHER_TOOL],
      });
      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "input": [
            {
              "content": [
                {
                  "text": "Hello, how are you?",
                  "type": "text",
                },
              ],
              "type": "user_input",
            },
          ],
          "model": "gemini-2.5-flash",
          "tools": [
            {
              "description": "Get the current weather in a location",
              "name": "getWeather",
              "parameters": {
                "properties": {
                  "location": {
                    "description": "The location to get the weather for",
                    "type": "string",
                  },
                },
                "required": [
                  "location",
                ],
                "type": "object",
              },
              "type": "function",
            },
          ],
        }
      `);
    });

    it('emits tool_choice in generation_config when toolChoice is set', async () => {
      prepareJsonFixtureResponse('tool-call-step1');
      await model.doGenerate({
        prompt: TEST_PROMPT,
        tools: [WEATHER_TOOL],
        toolChoice: { type: 'required' },
      });
      const body = (await server.calls[0].requestBodyJson) as {
        generation_config?: { tool_choice?: unknown };
      };
      expect(body.generation_config?.tool_choice).toBe('any');
    });

    it('parses a function_call output as a tool-call content part with finishReason "tool-calls"', async () => {
      prepareJsonFixtureResponse('tool-call-step1');
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        tools: [WEATHER_TOOL],
      });

      expect(result.finishReason).toMatchInlineSnapshot(`
        {
          "raw": "requires_action",
          "unified": "tool-calls",
        }
      `);
      const toolCalls = result.content.filter(c => c.type === 'tool-call');
      expect(toolCalls).toMatchInlineSnapshot(`
        [
          {
            "input": "{"location":"San Francisco"}",
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdUMnNIYXVxU0lJX2lxdHNQX2FicXVBWRIXVDJzSGF1cVNJSV9pcXRzUF9hYnF1QVk",
              },
            },
            "toolCallId": "zggxzq8r",
            "toolName": "getWeather",
            "type": "tool-call",
          },
        ]
      `);
    });

    it('round-trips an assistant tool-call + tool-result message pair through the request body (step 2)', async () => {
      prepareJsonFixtureResponse('tool-call-step2');
      await model.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is the weather in San Francisco right now?',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: '',
                providerOptions: { google: { signature: 'sig-abc' } },
              },
              {
                type: 'tool-call',
                toolCallId: 'r7b1dyif',
                toolName: 'getWeather',
                input: { location: 'San Francisco' },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'r7b1dyif',
                toolName: 'getWeather',
                output: {
                  type: 'json',
                  value: {
                    location: 'San Francisco',
                    condition: 'sunny',
                    temperature: 16,
                  },
                },
              },
            ],
          },
        ],
        tools: [WEATHER_TOOL],
      });

      expect(await server.calls[0].requestBodyJson).toMatchInlineSnapshot(`
        {
          "input": [
            {
              "content": [
                {
                  "text": "What is the weather in San Francisco right now?",
                  "type": "text",
                },
              ],
              "type": "user_input",
            },
            {
              "signature": "sig-abc",
              "type": "thought",
            },
            {
              "arguments": {
                "location": "San Francisco",
              },
              "id": "r7b1dyif",
              "name": "getWeather",
              "type": "function_call",
            },
            {
              "content": [
                {
                  "call_id": "r7b1dyif",
                  "name": "getWeather",
                  "result": "{"location":"San Francisco","condition":"sunny","temperature":16}",
                  "type": "function_result",
                },
              ],
              "type": "user_input",
            },
          ],
          "model": "gemini-2.5-flash",
          "tools": [
            {
              "description": "Get the current weather in a location",
              "name": "getWeather",
              "parameters": {
                "properties": {
                  "location": {
                    "description": "The location to get the weather for",
                    "type": "string",
                  },
                },
                "required": [
                  "location",
                ],
                "type": "object",
              },
              "type": "function",
            },
          ],
        }
      `);
    });

    it('parses the step-2 final text response after the tool result was provided', async () => {
      prepareJsonFixtureResponse('tool-call-step2');
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        tools: [WEATHER_TOOL],
      });
      expect(result.finishReason.unified).toBe('stop');
      const text = result.content
        .filter(c => c.type === 'text')
        .map(c => (c as { text: string }).text)
        .join('');
      expect(text).toContain('San Francisco');
    });
  });

  describe('built-in google_search tool', () => {
    const GOOGLE_SEARCH_TOOL: LanguageModelV4ProviderTool = {
      type: 'provider',
      id: 'google.google_search',
      name: 'google_search',
      args: {},
    };

    beforeEach(() => {
      prepareJsonFixtureResponse('google-search');
    });

    it('emits a google_search tool descriptor on the request body', async () => {
      await model.doGenerate({
        prompt: TEST_PROMPT,
        tools: [GOOGLE_SEARCH_TOOL],
      });
      const body = (await server.calls[0].requestBodyJson) as {
        tools?: Array<unknown>;
      };
      expect(body.tools).toEqual([{ type: 'google_search' }]);
    });

    it('parses google_search_call/result blocks as provider-executed tool parts and surfaces sources', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        tools: [GOOGLE_SEARCH_TOOL],
      });

      const toolCall = result.content.find(c => c.type === 'tool-call');
      expect(toolCall).toMatchObject({
        type: 'tool-call',
        toolName: 'google_search',
        providerExecuted: true,
      });

      const toolResult = result.content.find(c => c.type === 'tool-result');
      expect(toolResult).toMatchObject({
        type: 'tool-result',
        toolName: 'google_search',
      });

      const sources = result.content.filter(c => c.type === 'source');
      const urls = sources
        .filter(s => (s as { sourceType?: string }).sourceType === 'url')
        .map(s => (s as { url?: string }).url);
      expect(urls.length).toBeGreaterThan(0);
      for (const url of urls) {
        expect(url).toMatch(/^https?:\/\//);
      }
    });

    it('finishes with reason "stop"', async () => {
      const result = await model.doGenerate({
        prompt: TEST_PROMPT,
        tools: [GOOGLE_SEARCH_TOOL],
      });
      expect(result.finishReason.unified).toBe('stop');
    });
  });

  describe('image output', () => {
    it('emits a file content part on the result when the response carries an image block', async () => {
      prepareJsonFixtureResponse('image-output');
      const imageModel = provider.interactions('gemini-3-pro-image-preview');
      const result = await imageModel.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Generate an image of a comic cat in a spaceship.',
              },
            ],
          },
        ],
        providerOptions: {
          google: {
            responseModalities: ['image'],
          },
        },
      });
      const filePart = result.content.find(c => c.type === 'file') as
        | {
            type: string;
            mediaType: string;
            data: { type: string; data?: string };
            providerMetadata?: { google?: { interactionId?: string } };
          }
        | undefined;
      expect(filePart).toBeDefined();
      expect(filePart?.type).toBe('file');
      expect(filePart?.mediaType).toMatch(/^image\//);
      expect(filePart?.data.type).toBe('data');
      expect(typeof filePart?.data.data).toBe('string');
      expect(filePart?.data.data?.length ?? 0).toBeGreaterThan(0);
      expect(filePart?.providerMetadata?.google?.interactionId).toMatch(/^v1_/);
    });

    it('passes responseModalities into the request body', async () => {
      prepareJsonFixtureResponse('image-output');
      const imageModel = provider.interactions('gemini-3-pro-image-preview');
      await imageModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            responseModalities: ['image'],
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.response_modalities).toEqual(['image']);
    });

    it('emits a file content part on the modify (turn 2) result with previousInteractionId', async () => {
      prepareJsonFixtureResponse('image-output-modify');
      const imageModel = provider.interactions('gemini-3-pro-image-preview');
      const result = await imageModel.doGenerate({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'now make the cat red' }],
          },
        ],
        providerOptions: {
          google: {
            responseModalities: ['image'],
            previousInteractionId: 'v1_prev-turn',
          },
        },
      });
      const filePart = result.content.find(c => c.type === 'file');
      expect(filePart).toMatchObject({
        type: 'file',
        mediaType: 'image/jpeg',
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.previous_interaction_id).toBe('v1_prev-turn');
    });
  });

  describe('agent factory branch', () => {
    beforeEach(() => {
      prepareJsonFixtureResponse('basic');
    });

    const AGENT_NAME = 'deep-research-pro-preview-12-2025' as const;

    it('puts `agent` (not `model`) in the request body when constructed via the agent factory branch', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      await agentModel.doGenerate({ prompt: TEST_PROMPT });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.agent).toBe(AGENT_NAME);
      expect(body.model).toBeUndefined();
    });

    it('puts `model` (not `agent`) in the request body when constructed via a model id', async () => {
      await model.doGenerate({ prompt: TEST_PROMPT });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.model).toBe('gemini-2.5-flash');
      expect(body.agent).toBeUndefined();
    });

    it('omits generation_config from the request body when an agent is set', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      await agentModel.doGenerate({ prompt: TEST_PROMPT });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.generation_config).toBeUndefined();
    });

    it('emits agent_config with type "deep-research" and the renamed snake_case fields', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      await agentModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            agentConfig: {
              type: 'deep-research',
              thinkingSummaries: 'auto',
              visualization: 'auto',
              collaborativePlanning: true,
            },
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as {
        agent_config?: Record<string, unknown>;
      };
      expect(body.agent_config).toEqual({
        type: 'deep-research',
        thinking_summaries: 'auto',
        visualization: 'auto',
        collaborative_planning: true,
      });
    });

    it('emits agent_config with type "dynamic" verbatim', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      await agentModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            agentConfig: { type: 'dynamic' },
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as {
        agent_config?: Record<string, unknown>;
      };
      expect(body.agent_config).toEqual({ type: 'dynamic' });
    });

    it('emits file_search tools when an agent is set', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      const result = await agentModel.doGenerate({
        prompt: TEST_PROMPT,
        tools: [
          {
            type: 'provider',
            id: 'google.file_search',
            name: 'file_search',
            args: {
              fileSearchStoreNames: ['fileSearchStores/x'],
            },
          },
        ],
        providerOptions: { google: { background: true } },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.tools).toEqual([
        {
          type: 'file_search',
          file_search_store_names: ['fileSearchStores/x'],
        },
      ]);
      expect(body.background).toBe(true);
      const warning = result.warnings.find(
        w =>
          w.type === 'other' &&
          (w as { message?: string }).message?.includes('tools'),
      );
      expect(warning).toBeUndefined();
    });

    it('emits a warning and drops generation-config fields (temperature, topP, thinkingLevel) when an agent is set', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      const result = await agentModel.doGenerate({
        prompt: TEST_PROMPT,
        temperature: 0.5,
        topP: 0.9,
        providerOptions: {
          google: { thinkingLevel: 'high' },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.generation_config).toBeUndefined();
      const warning = result.warnings.find(
        w =>
          w.type === 'other' &&
          (w as { message?: string }).message?.includes('temperature') &&
          (w as { message?: string }).message?.includes('topP') &&
          (w as { message?: string }).message?.includes('thinkingLevel'),
      );
      expect(warning).toBeDefined();
    });

    it('does not emit a generation-config warning when no generation-config fields are set on an agent call', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      const result = await agentModel.doGenerate({ prompt: TEST_PROMPT });
      const warning = result.warnings.find(
        w =>
          w.type === 'other' &&
          (w as { message?: string }).message?.includes(
            'use providerOptions.google.agentConfig instead',
          ),
      );
      expect(warning).toBeUndefined();
    });

    it('preserves previousInteractionId on agent calls (multi-turn agent flow)', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      await agentModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            previousInteractionId: 'v1_prior-agent-turn',
          },
        },
      });
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.previous_interaction_id).toBe('v1_prior-agent-turn');
      expect(body.agent).toBe(AGENT_NAME);
      expect(body.model).toBeUndefined();
    });

    it('passes background through from providerOptions.google.background', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      await agentModel.doGenerate({
        prompt: TEST_PROMPT,
        providerOptions: { google: { background: true } },
      });
      const agentBody = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(agentBody.background).toBe(true);
    });

    it('omits background by default (no auto-injection on agent calls)', async () => {
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      await agentModel.doGenerate({ prompt: TEST_PROMPT });
      const agentBody = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(agentBody.background).toBeUndefined();

      await model.doGenerate({ prompt: TEST_PROMPT });
      const modelBody = (await server.calls[1].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(modelBody.background).toBeUndefined();
    });

    describe('environment', () => {
      it('passes the literal "remote" string through verbatim', async () => {
        const agentModel = provider.interactions({ agent: AGENT_NAME });
        await agentModel.doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: { google: { environment: 'remote' } },
        });
        const body = (await server.calls[0].requestBodyJson) as Record<
          string,
          unknown
        >;
        expect(body.environment).toBe('remote');
      });

      it('passes an env_id string through verbatim', async () => {
        const agentModel = provider.interactions({ agent: AGENT_NAME });
        await agentModel.doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: { google: { environment: 'env_abc123' } },
        });
        const body = (await server.calls[0].requestBodyJson) as Record<
          string,
          unknown
        >;
        expect(body.environment).toBe('env_abc123');
      });

      it('serializes the object form with sources of all three types', async () => {
        const agentModel = provider.interactions({ agent: AGENT_NAME });
        await agentModel.doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            google: {
              environment: {
                type: 'remote',
                sources: [
                  {
                    type: 'inline',
                    content: 'note contents',
                    target: '/data/note.txt',
                  },
                  {
                    type: 'gcs',
                    source: 'gs://example/path',
                    target: '/data/',
                  },
                  {
                    type: 'repository',
                    source: 'github://octocat/Hello-World',
                    target: '/repo/',
                  },
                ],
              },
            },
          },
        });
        const body = (await server.calls[0].requestBodyJson) as Record<
          string,
          unknown
        >;
        expect(body.environment).toMatchInlineSnapshot(`
          {
            "sources": [
              {
                "content": "note contents",
                "target": "/data/note.txt",
                "type": "inline",
              },
              {
                "source": "gs://example/path",
                "target": "/data/",
                "type": "gcs",
              },
              {
                "source": "github://octocat/Hello-World",
                "target": "/repo/",
                "type": "repository",
              },
            ],
            "type": "remote",
          }
        `);
      });

      it('omits null target on non-inline sources', async () => {
        const agentModel = provider.interactions({ agent: AGENT_NAME });
        await agentModel.doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            google: {
              environment: {
                type: 'remote',
                sources: [
                  { type: 'gcs', source: 'gs://example/path' },
                  {
                    type: 'repository',
                    source: 'github://octocat/Hello-World',
                  },
                ],
              },
            },
          },
        });
        const body = (await server.calls[0].requestBodyJson) as Record<
          string,
          unknown
        >;
        expect(body.environment).toMatchInlineSnapshot(`
          {
            "sources": [
              {
                "source": "gs://example/path",
                "type": "gcs",
              },
              {
                "source": "github://octocat/Hello-World",
                "type": "repository",
              },
            ],
            "type": "remote",
          }
        `);
      });

      it('serializes a network allowlist with header transforms', async () => {
        const agentModel = provider.interactions({ agent: AGENT_NAME });
        await agentModel.doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            google: {
              environment: {
                type: 'remote',
                network: {
                  allowlist: [
                    {
                      domain: 'generativelanguage.googleapis.com',
                      transform: [{ 'x-goog-api-key': 'AIza-redacted' }],
                    },
                    { domain: '*' },
                  ],
                },
              },
            },
          },
        });
        const body = (await server.calls[0].requestBodyJson) as Record<
          string,
          unknown
        >;
        expect(body.environment).toMatchInlineSnapshot(`
          {
            "network": {
              "allowlist": [
                {
                  "domain": "generativelanguage.googleapis.com",
                  "transform": [
                    {
                      "x-goog-api-key": "AIza-redacted",
                    },
                  ],
                },
                {
                  "domain": "*",
                },
              ],
            },
            "type": "remote",
          }
        `);
      });

      it('serializes network "disabled" verbatim', async () => {
        const agentModel = provider.interactions({ agent: AGENT_NAME });
        await agentModel.doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: {
            google: {
              environment: { type: 'remote', network: 'disabled' },
            },
          },
        });
        const body = (await server.calls[0].requestBodyJson) as Record<
          string,
          unknown
        >;
        expect(body.environment).toEqual({
          type: 'remote',
          network: 'disabled',
        });
      });

      it('emits a warning and drops environment on model-id calls', async () => {
        const result = await model.doGenerate({
          prompt: TEST_PROMPT,
          providerOptions: { google: { environment: 'remote' } },
        });
        const body = (await server.calls[0].requestBodyJson) as Record<
          string,
          unknown
        >;
        expect(body.environment).toBeUndefined();
        const warning = result.warnings.find(
          w =>
            w.type === 'other' &&
            (w as { message?: string }).message?.includes('environment'),
        );
        expect(warning).toBeDefined();
      });
    });
  });
});

describe('GoogleInteractionsLanguageModel agent polling', () => {
  const POST_URL =
    'https://generativelanguage.googleapis.com/v1beta/interactions';
  const POLL_URL =
    'https://generativelanguage.googleapis.com/v1beta/interactions/v1_poll-test';
  const AGENT_NAME = 'deep-research-pro-preview-12-2025' as const;

  const pollServer = createTestServer({
    [POST_URL]: {},
    [POLL_URL]: {},
  });

  it('returns the polled terminal response from doGenerate when POST returns in_progress', async () => {
    pollServer.urls[POST_URL].response = {
      type: 'json-value',
      body: {
        id: 'v1_poll-test',
        status: 'in_progress',
        model: 'deep-research-pro-preview-12-2025',
      },
    };
    let getCallCount = 0;
    pollServer.urls[POLL_URL].response = () => {
      const idx = getCallCount++;
      if (idx === 0) {
        return {
          type: 'json-value',
          body: { id: 'v1_poll-test', status: 'in_progress' },
        };
      }
      return {
        type: 'json-value',
        body: {
          id: 'v1_poll-test',
          status: 'completed',
          steps: [
            {
              type: 'model_output',
              content: [{ type: 'text', text: 'researched answer' }],
            },
          ],
          usage: {
            total_input_tokens: 5,
            total_output_tokens: 3,
            total_tokens: 8,
          },
        },
      };
    };

    const fastProvider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });
    const agentModel = fastProvider.interactions({ agent: AGENT_NAME });
    const result = await agentModel.doGenerate({
      prompt: TEST_PROMPT,
    });

    expect(result.finishReason.unified).toBe('stop');
    expect(result.content).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: 'researched answer' }),
      ]),
    );
    const calls = pollServer.calls;
    expect(calls[0].requestMethod).toBe('POST');
    expect(calls[1].requestMethod).toBe('GET');
    expect(calls[2].requestMethod).toBe('GET');
    expect(getCallCount).toBe(2);
  });

  it('opens GET /interactions/{id}?stream=true and pipes SSE events through when POST is non-terminal', async () => {
    pollServer.urls[POST_URL].response = {
      type: 'json-value',
      body: {
        id: 'v1_poll-test',
        status: 'in_progress',
      },
    };
    pollServer.urls[POLL_URL].response = {
      type: 'stream-chunks',
      chunks: [
        `data: ${JSON.stringify({
          event_type: 'interaction.created',
          event_id: 'evt-1',
          interaction: {
            id: 'v1_poll-test',
            status: 'in_progress',
            model: 'deep-research-pro-preview-12-2025',
          },
        })}\n\n`,
        `data: ${JSON.stringify({
          event_type: 'step.start',
          event_id: 'evt-2',
          index: 0,
          step: { type: 'model_output' },
        })}\n\n`,
        `data: ${JSON.stringify({
          event_type: 'step.delta',
          event_id: 'evt-3',
          index: 0,
          delta: { type: 'text', text: 'streamed agent answer' },
        })}\n\n`,
        `data: ${JSON.stringify({
          event_type: 'step.stop',
          event_id: 'evt-4',
          index: 0,
        })}\n\n`,
        `data: ${JSON.stringify({
          event_type: 'interaction.completed',
          event_id: 'evt-5',
          interaction: {
            id: 'v1_poll-test',
            status: 'completed',
            usage: {
              total_input_tokens: 5,
              total_output_tokens: 3,
              total_tokens: 8,
            },
          },
        })}\n\n`,
      ],
    };

    const fastProvider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });
    const agentModel = fastProvider.interactions({ agent: AGENT_NAME });
    const { stream } = await agentModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: { google: { background: true } },
    });
    const parts = await convertReadableStreamToArray(stream);
    const types = parts.map(p => p.type);
    expect(types).toContain('text-start');
    expect(types).toContain('text-delta');
    expect(types).toContain('text-end');
    expect(types).toContain('finish');

    const textDelta = parts.find(p => p.type === 'text-delta');
    expect((textDelta as { delta?: string }).delta).toBe(
      'streamed agent answer',
    );

    const calls = pollServer.calls;
    expect(calls[0].requestMethod).toBe('POST');
    expect(calls[1].requestMethod).toBe('GET');
    expect(new URL(calls[1].requestUrl).searchParams.get('stream')).toBe(
      'true',
    );
    expect(
      new URL(calls[1].requestUrl).searchParams.get('last_event_id'),
    ).toBeNull();
  });

  it('reconnects to GET stream with last_event_id when the SSE connection drops', async () => {
    pollServer.urls[POST_URL].response = {
      type: 'json-value',
      body: { id: 'v1_poll-test', status: 'in_progress' },
    };
    let getCallCount = 0;
    pollServer.urls[POLL_URL].response = () => {
      const idx = getCallCount++;
      if (idx === 0) {
        return {
          type: 'stream-chunks',
          chunks: [
            `data: ${JSON.stringify({
              event_type: 'interaction.created',
              event_id: 'evt-1',
              interaction: {
                id: 'v1_poll-test',
                status: 'in_progress',
                model: 'deep-research-pro-preview-12-2025',
              },
            })}\n\n`,
            `data: ${JSON.stringify({
              event_type: 'step.start',
              event_id: 'evt-2',
              index: 0,
              step: { type: 'model_output' },
            })}\n\n`,
            `data: ${JSON.stringify({
              event_type: 'step.delta',
              event_id: 'evt-3',
              index: 0,
              delta: { type: 'text', text: 'first half ' },
            })}\n\n`,
          ],
        };
      }
      return {
        type: 'stream-chunks',
        chunks: [
          `data: ${JSON.stringify({
            event_type: 'step.delta',
            event_id: 'evt-4',
            index: 0,
            delta: { type: 'text', text: 'second half' },
          })}\n\n`,
          `data: ${JSON.stringify({
            event_type: 'step.stop',
            event_id: 'evt-5',
            index: 0,
          })}\n\n`,
          `data: ${JSON.stringify({
            event_type: 'interaction.completed',
            event_id: 'evt-6',
            interaction: {
              id: 'v1_poll-test',
              status: 'completed',
              usage: {
                total_input_tokens: 5,
                total_output_tokens: 3,
                total_tokens: 8,
              },
            },
          })}\n\n`,
        ],
      };
    };

    const fastProvider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });
    const agentModel = fastProvider.interactions({ agent: AGENT_NAME });
    const { stream } = await agentModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: { google: { background: true } },
    });
    const parts = await convertReadableStreamToArray(stream);
    const textDeltas = parts
      .filter(p => p.type === 'text-delta')
      .map(p => (p as { delta: string }).delta);
    expect(textDeltas).toEqual(['first half ', 'second half']);

    const calls = pollServer.calls;
    expect(calls[0].requestMethod).toBe('POST');
    expect(calls[1].requestMethod).toBe('GET');
    expect(calls[2].requestMethod).toBe('GET');
    expect(
      new URL(calls[1].requestUrl).searchParams.get('last_event_id'),
    ).toBeNull();
    expect(new URL(calls[2].requestUrl).searchParams.get('last_event_id')).toBe(
      'evt-3',
    );
    expect(getCallCount).toBe(2);
  });

  it('surfaces image outputs as file parts in the synthesized stream', async () => {
    pollServer.urls[POST_URL].response = {
      type: 'json-value',
      body: {
        id: 'v1_poll-test',
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [
              { type: 'text', text: 'here is your image' },
              {
                type: 'image',
                data: 'aGVsbG8=',
                mime_type: 'image/png',
              },
              {
                type: 'image',
                uri: 'https://example.com/img.png',
                mime_type: 'image/png',
              },
            ],
          },
        ],
        usage: {
          total_input_tokens: 5,
          total_output_tokens: 3,
          total_tokens: 8,
        },
      },
    };

    const fastProvider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });
    const agentModel = fastProvider.interactions({ agent: AGENT_NAME });
    const { stream } = await agentModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: { google: { background: true } },
    });
    const parts = await convertReadableStreamToArray(stream);
    const fileParts = parts.filter(p => p.type === 'file');
    expect(fileParts).toEqual([
      expect.objectContaining({
        type: 'file',
        mediaType: 'image/png',
        data: { type: 'data', data: 'aGVsbG8=' },
      }),
      expect.objectContaining({
        type: 'file',
        mediaType: 'image/png',
        data: { type: 'url', url: new URL('https://example.com/img.png') },
      }),
    ]);
  });

  it('surfaces video outputs as file parts in the synthesized stream', async () => {
    pollServer.urls[POST_URL].response = {
      type: 'json-value',
      body: {
        id: 'v1_poll-test',
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [
              { type: 'text', text: 'here is your video' },
              {
                type: 'video',
                data: 'AAAAIGZ0eXBpc29t',
                mime_type: 'video/mp4',
              },
              {
                type: 'video',
                uri: 'https://example.com/clip.mp4',
                mime_type: 'video/mp4',
              },
            ],
          },
        ],
        usage: {
          total_input_tokens: 5,
          total_output_tokens: 3,
          total_tokens: 8,
        },
      },
    };

    const fastProvider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });
    const agentModel = fastProvider.interactions({ agent: AGENT_NAME });
    const { stream } = await agentModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: { google: { background: true } },
    });
    const parts = await convertReadableStreamToArray(stream);
    const fileParts = parts.filter(p => p.type === 'file');
    expect(fileParts).toEqual([
      expect.objectContaining({
        type: 'file',
        mediaType: 'video/mp4',
        data: { type: 'data', data: 'AAAAIGZ0eXBpc29t' },
      }),
      expect.objectContaining({
        type: 'file',
        mediaType: 'video/mp4',
        data: { type: 'url', url: new URL('https://example.com/clip.mp4') },
      }),
    ]);
  });

  it('synthesizes a complete stream when POST already returns a terminal status', async () => {
    pollServer.urls[POST_URL].response = {
      type: 'json-value',
      body: {
        id: 'v1_poll-test',
        status: 'completed',
        steps: [
          {
            type: 'model_output',
            content: [{ type: 'text', text: 'instant answer' }],
          },
        ],
        usage: {
          total_input_tokens: 5,
          total_output_tokens: 3,
          total_tokens: 8,
        },
      },
    };

    const fastProvider = createGoogle({
      apiKey: 'test-api-key',
      generateId: () => 'test-id',
    });
    const agentModel = fastProvider.interactions({ agent: AGENT_NAME });
    const { stream } = await agentModel.doStream({
      prompt: TEST_PROMPT,
      includeRawChunks: false,
      providerOptions: { google: { background: true } },
    });
    const parts = await convertReadableStreamToArray(stream);
    const types = parts.map(p => p.type);
    expect(types).toContain('text-start');
    expect(types).toContain('text-delta');
    expect(types).toContain('text-end');
    expect(types).toContain('finish');
    const textDelta = parts.find(p => p.type === 'text-delta');
    expect((textDelta as { delta?: string }).delta).toBe('instant answer');
    const calls = pollServer.calls;
    expect(calls.length).toBe(1);
    expect(calls[0].requestMethod).toBe('POST');
  });
});

describe('GoogleInteractionsLanguageModel.doStream', () => {
  const server = createTestServer({ [TEST_URL]: {} });

  function prepareChunksFixtureResponse(filename: string) {
    const chunks = fs
      .readFileSync(
        `src/interactions/__fixtures__/${filename}.chunks.txt`,
        'utf8',
      )
      .split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => `data: ${line}\n\n`);

    server.urls[TEST_URL].response = {
      type: 'stream-chunks',
      chunks,
    };
  }

  describe('basic text', () => {
    beforeEach(() => {
      prepareChunksFixtureResponse('basic');
    });

    it('streams text-start, reasoning, text-delta, text-end, finish parts', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });
      expect(await convertReadableStreamToArray(stream)).toMatchInlineSnapshot(`
        [
          {
            "type": "stream-start",
            "warnings": [],
          },
          {
            "id": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU",
            "modelId": "gemini-2.5-flash",
            "type": "response-metadata",
          },
          {
            "id": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU:0",
            "type": "reasoning-start",
          },
          {
            "id": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU:0",
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU",
                "signature": "CiQBDDnWxzCnKBoG0/vIUQ9fHy3JYGvjTmIZFY4uKrzvEqSAJh8KdQEMOdbH472i8Wb3Z10/9wPWQyeSH2KMnQfWxi4Z+jlD+igWd1veIZW9QWMqrhgPQqsabcZiwzNAyNaSOJFu0D2ulKtvde8IrVcZkeoG0IR7QVcZWFbKF/uuXxeAV2CYsqXF8Xhv362V/Lc17nWUjzFwvkrftAq8AQEMOdbHZ41h6ebbkW11izLCzDhm/aW2Zh5LR60hYvYMFrL22tOZFEHoBAzZJR+NaPaGbCCd6YtSKUMWXDckIRL42Ms6xISx5eW2xKiNk4Pf+6CDD09wP7kxx/jrvn17+oFEB86PDzUCjK79WXHTufzNZ2NFyXV9wqAX6VcrxSz6eA7BvXtZcHnP5mIlSpBwNDkuWwqtWZq7ebtySPbjjUq4tZw8xB/I0guOpC+u+lCAoSoCOtf8Y+Zc7SG6Cs8BAQw51sel75qdPe/A19DGEaH4sRjNgXHSNzW6zsOqn+nMZEQznZSP+EMitUNYJSCv9ceM5a2+hs9PhGJuPVKrSxnmVya1iHYdquju9DD0q+wSycGXsor1UI4TMic4jg2+5xAFSUir9qA6nSZeuRDjMkCQ0fbJESf2if70CBFNWQe1Q2kKpfc1CrZR2dtc28YfS/c8iyarj3cts6sybBAxgAR834OcVIttdMt8eimPXfCPAP0qGu1cxjXSk746D3XmMwQtpIfW1/xpIjVhJsGA",
              },
            },
            "type": "reasoning-end",
          },
          {
            "id": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU:1",
            "type": "text-start",
          },
          {
            "delta": "I'm doing great, thank you for asking!

        How are you doing today? And what can I do for you?",
            "id": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU:1",
            "type": "text-delta",
          },
          {
            "id": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU:1",
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU",
              },
            },
            "type": "text-end",
          },
          {
            "finishReason": {
              "raw": "completed",
              "unified": "stop",
            },
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdUR3NIYXVyQkFlYVA2ZGtQajZERThBVRIXVEdzSGF1ckJBZWFQNmRrUGo2REU4QVU",
                "serviceTier": "standard",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 7,
                "total": 7,
              },
              "outputTokens": {
                "reasoning": 115,
                "text": 26,
                "total": 141,
              },
              "raw": {
                "input_tokens_by_modality": [
                  {
                    "modality": "text",
                    "tokens": 7,
                  },
                ],
                "total_cached_tokens": 0,
                "total_input_tokens": 7,
                "total_output_tokens": 26,
                "total_thought_tokens": 115,
                "total_tokens": 148,
                "total_tool_use_tokens": 0,
              },
            },
          },
        ]
      `);
    });

    it('exposes interactionId via the finish part providerMetadata', async () => {
      prepareChunksFixtureResponse('basic');
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      expect(
        (
          finish as {
            providerMetadata?: { google?: { interactionId?: string } };
          }
        ).providerMetadata?.google?.interactionId,
      ).toBeDefined();
    });

    it('emits raw chunks when includeRawChunks is true', async () => {
      prepareChunksFixtureResponse('basic');
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: true,
      });
      const parts = await convertReadableStreamToArray(stream);
      const rawCount = parts.filter(p => p.type === 'raw').length;
      expect(rawCount).toBeGreaterThan(0);
    });
  });

  describe('service tier', () => {
    function prepareCustomChunksWithHeaders(
      chunkObjects: Array<Record<string, unknown>>,
      headers?: Record<string, string>,
    ) {
      const chunks = chunkObjects.map(o => `data: ${JSON.stringify(o)}\n\n`);
      server.urls[TEST_URL].response = {
        type: 'stream-chunks',
        chunks,
        ...(headers ? { headers } : {}),
      };
    }

    function readFixtureChunkLines(filename: string) {
      return fs
        .readFileSync(
          `src/interactions/__fixtures__/${filename}.chunks.txt`,
          'utf8',
        )
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => JSON.parse(line) as Record<string, unknown>);
    }

    it('sends service_tier in the request body when providerOptions.google.serviceTier is set', async () => {
      prepareChunksFixtureResponse('basic');
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        providerOptions: {
          google: {
            serviceTier: 'priority',
          },
        },
      });
      await convertReadableStreamToArray(stream);
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.service_tier).toBe('priority');
    });

    it('reads providerMetadata.google.serviceTier from the interaction.complete event body service_tier field', async () => {
      const objs = readFixtureChunkLines('basic');
      const completeIdx = objs.findIndex(
        o => o.event_type === 'interaction.completed',
      );
      const complete = objs[completeIdx];
      const interaction = complete.interaction as Record<string, unknown>;
      objs[completeIdx] = {
        ...complete,
        interaction: { ...interaction, service_tier: 'priority' },
      };
      prepareCustomChunksWithHeaders(objs);

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      expect(
        (
          finish as {
            providerMetadata?: { google?: { serviceTier?: string } };
          }
        ).providerMetadata?.google?.serviceTier,
      ).toBe('priority');
    });

    it('falls back to the x-gemini-service-tier response header when service_tier is absent from the body', async () => {
      const objs = readFixtureChunkLines('basic');
      const completeIdx = objs.findIndex(
        o => o.event_type === 'interaction.completed',
      );
      const complete = objs[completeIdx];
      const interaction = {
        ...(complete.interaction as Record<string, unknown>),
      };
      delete interaction.service_tier;
      objs[completeIdx] = { ...complete, interaction };
      prepareCustomChunksWithHeaders(objs, {
        'x-gemini-service-tier': 'priority',
      });

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      expect(
        (
          finish as {
            providerMetadata?: { google?: { serviceTier?: string } };
          }
        ).providerMetadata?.google?.serviceTier,
      ).toBe('priority');
    });

    it('omits serviceTier from finish providerMetadata when both response body and header are absent', async () => {
      const objs = readFixtureChunkLines('basic');
      const completeIdx = objs.findIndex(
        o => o.event_type === 'interaction.completed',
      );
      const complete = objs[completeIdx];
      const interaction = {
        ...(complete.interaction as Record<string, unknown>),
      };
      delete interaction.service_tier;
      objs[completeIdx] = { ...complete, interaction };
      prepareCustomChunksWithHeaders(objs);

      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      expect(
        (
          finish as {
            providerMetadata?: { google?: { serviceTier?: string } };
          }
        ).providerMetadata?.google?.serviceTier,
      ).toBeUndefined();
    });
  });

  describe('stateful chaining (multi-turn fixtures)', () => {
    it('streams turn-1 reasoning + text and surfaces interactionId on finish', async () => {
      prepareChunksFixtureResponse('multi-turn-stateful-turn1');
      const { stream } = await model.doStream({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
        ],
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      const fId = (
        finish as {
          providerMetadata?: { google?: { interactionId?: string } };
        }
      ).providerMetadata?.google?.interactionId;
      expect(fId).toBeDefined();
      expect(typeof fId).toBe('string');

      const text = parts
        .filter(p => p.type === 'text-delta')
        .map(p => (p as { delta: string }).delta)
        .join('');
      expect(text).toContain('Madrid');
      expect(text).toContain('Barcelona');
    });

    it('compacts the turn-2 stream wire body and streams the chained answer', async () => {
      prepareChunksFixtureResponse('multi-turn-stateful-turn2');
      const TURN_1_ID =
        'v1_ChdWV3NIYXNYZEc5S19xdHNQcmVYeG1BRRIXVldzSGFzWGRHOUtfcXRzUHJlWHhtQUU';
      const { stream } = await model.doStream({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'reasoning',
                text: '',
                providerOptions: {
                  google: { interactionId: TURN_1_ID, signature: 'sig-1' },
                },
              },
              {
                type: 'text',
                text: 'Madrid, Barcelona, Valencia',
                providerOptions: {
                  google: { interactionId: TURN_1_ID },
                },
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is the most famous landmark in the second one?',
              },
            ],
          },
        ],
        providerOptions: {
          google: { previousInteractionId: TURN_1_ID },
        },
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);

      const body = (await server.calls[0].requestBodyJson) as {
        previous_interaction_id?: string;
        input: unknown;
        stream?: boolean;
      };
      expect(body.previous_interaction_id).toBe(TURN_1_ID);
      expect(body.stream).toBe(true);
      // Compaction: only the two surviving user messages remain on the wire.
      expect(body.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What are the three largest cities in Spain?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
          {
            "content": [
              {
                "text": "What is the most famous landmark in the second one?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
        ]
      `);

      const text = parts
        .filter(p => p.type === 'text-delta')
        .map(p => (p as { delta: string }).delta)
        .join('');
      expect(text).toMatch(/Sagrada Fam.lia/);
    });
  });

  describe('stateless multi-turn (store: false, no previousInteractionId)', () => {
    it('streams turn 1 with store: false in the body and no interactionId on finish', async () => {
      prepareChunksFixtureResponse('multi-turn-stateless-turn1');
      const { stream } = await model.doStream({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
        ],
        providerOptions: {
          google: { store: false },
        },
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);

      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.store).toBe(false);
      expect(body.previous_interaction_id).toBeUndefined();
      expect(body.stream).toBe(true);

      const finish = parts.find(p => p.type === 'finish');
      expect(finish).toBeDefined();
      // The streaming API returns `id: ""` for `store: false`; the transformer
      // normalizes the empty string to `undefined` so providerMetadata stays
      // clean.
      expect(
        (
          finish as {
            providerMetadata?: { google?: { interactionId?: string } };
          }
        ).providerMetadata?.google?.interactionId,
      ).toBeUndefined();

      const text = parts
        .filter(p => p.type === 'text-delta')
        .map(p => (p as { delta: string }).delta)
        .join('');
      expect(text).toContain('Madrid');
      expect(text).toContain('Barcelona');
    });

    it('streams turn 2 forwarding full history verbatim with store: false', async () => {
      prepareChunksFixtureResponse('multi-turn-stateless-turn2');
      const { stream } = await model.doStream({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the three largest cities in Spain?',
              },
            ],
          },
          {
            role: 'assistant',
            content: [
              {
                type: 'text',
                text: 'The three largest cities in Spain are Madrid, Barcelona, and Valencia.',
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is the most famous landmark in the second one?',
              },
            ],
          },
        ],
        providerOptions: {
          google: { store: false },
        },
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);

      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.store).toBe(false);
      expect(body.previous_interaction_id).toBeUndefined();
      // Full history forwarded verbatim — no compaction.
      expect(body.input).toMatchInlineSnapshot(`
        [
          {
            "content": [
              {
                "text": "What are the three largest cities in Spain?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
          {
            "content": [
              {
                "text": "The three largest cities in Spain are Madrid, Barcelona, and Valencia.",
                "type": "text",
              },
            ],
            "type": "model_output",
          },
          {
            "content": [
              {
                "text": "What is the most famous landmark in the second one?",
                "type": "text",
              },
            ],
            "type": "user_input",
          },
        ]
      `);

      const text = parts
        .filter(p => p.type === 'text-delta')
        .map(p => (p as { delta: string }).delta)
        .join('');
      expect(text).toContain('Sagrada');
    });
  });

  describe('tool calling (multi-step flow)', () => {
    const WEATHER_TOOL: LanguageModelV4FunctionTool = {
      type: 'function',
      name: 'getWeather',
      description: 'Get the current weather in a location',
      inputSchema: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The location to get the weather for',
          },
        },
        required: ['location'],
      },
    };

    it('emits tool-input-start, tool-input-delta, tool-input-end, tool-call, finish for a function_call stream (step 1)', async () => {
      prepareChunksFixtureResponse('tool-call-step1');
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        tools: [WEATHER_TOOL],
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const interesting = parts.filter(
        p =>
          p.type === 'tool-input-start' ||
          p.type === 'tool-input-delta' ||
          p.type === 'tool-input-end' ||
          p.type === 'tool-call' ||
          p.type === 'finish',
      );
      expect(interesting).toMatchInlineSnapshot(`
        [
          {
            "id": "61nzpsv4",
            "toolName": "getWeather",
            "type": "tool-input-start",
          },
          {
            "delta": "{"location":"San Francisco"}",
            "id": "61nzpsv4",
            "type": "tool-input-delta",
          },
          {
            "id": "61nzpsv4",
            "type": "tool-input-end",
          },
          {
            "input": "{"location":"San Francisco"}",
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdVbXNIYXVEUkVacmpxdHNQb3JQeXlBRRIXVW1zSGF1RFJFWnJqcXRzUG9yUHl5QUU",
                "signature": "",
              },
            },
            "toolCallId": "61nzpsv4",
            "toolName": "getWeather",
            "type": "tool-call",
          },
          {
            "finishReason": {
              "raw": "requires_action",
              "unified": "tool-calls",
            },
            "providerMetadata": {
              "google": {
                "interactionId": "v1_ChdVbXNIYXVEUkVacmpxdHNQb3JQeXlBRRIXVW1zSGF1RFJFWnJqcXRzUG9yUHl5QUU",
                "serviceTier": "standard",
              },
            },
            "type": "finish",
            "usage": {
              "inputTokens": {
                "cacheRead": 0,
                "cacheWrite": undefined,
                "noCache": 53,
                "total": 53,
              },
              "outputTokens": {
                "reasoning": 65,
                "text": 15,
                "total": 80,
              },
              "raw": {
                "input_tokens_by_modality": [
                  {
                    "modality": "text",
                    "tokens": 53,
                  },
                ],
                "total_cached_tokens": 0,
                "total_input_tokens": 53,
                "total_output_tokens": 15,
                "total_thought_tokens": 65,
                "total_tokens": 133,
                "total_tool_use_tokens": 0,
              },
            },
          },
        ]
      `);
    });

    it('streams the final text response and finish reason "stop" on step 2 (after tool result)', async () => {
      prepareChunksFixtureResponse('tool-call-step2');
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        tools: [WEATHER_TOOL],
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const finish = parts.find(p => p.type === 'finish');
      expect(finish?.finishReason.unified).toBe('stop');
      const text = parts
        .filter(p => p.type === 'text-delta')
        .map(p => (p as { delta: string }).delta)
        .join('');
      expect(text).toContain('San Francisco');
    });
  });

  describe('built-in google_search tool', () => {
    const GOOGLE_SEARCH_TOOL: LanguageModelV4ProviderTool = {
      type: 'provider',
      id: 'google.google_search',
      name: 'google_search',
      args: {},
    };

    beforeEach(() => {
      prepareChunksFixtureResponse('google-search');
    });

    it('emits provider-executed tool-call/tool-result and source parts for google_search results', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        tools: [GOOGLE_SEARCH_TOOL],
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);

      const toolCall = parts.find(p => p.type === 'tool-call');
      expect(toolCall).toMatchObject({
        type: 'tool-call',
        toolName: 'google_search',
        providerExecuted: true,
      });

      const toolResult = parts.find(p => p.type === 'tool-result');
      expect(toolResult).toMatchObject({
        type: 'tool-result',
        toolName: 'google_search',
      });

      const sourceUrls = parts
        .filter(p => p.type === 'source')
        .filter(p => (p as { sourceType?: string }).sourceType === 'url')
        .map(p => (p as { url?: string }).url);
      expect(sourceUrls.length).toBeGreaterThan(0);
      for (const url of sourceUrls) {
        expect(url).toMatch(/^https?:\/\//);
      }

      const finish = parts.find(p => p.type === 'finish');
      expect(finish?.finishReason.unified).toBe('stop');
    });

    it('de-duplicates source urls when the same url appears in tool-result and text_annotation', async () => {
      const { stream } = await model.doStream({
        prompt: TEST_PROMPT,
        tools: [GOOGLE_SEARCH_TOOL],
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const sourceUrls = parts
        .filter(p => p.type === 'source')
        .filter(p => (p as { sourceType?: string }).sourceType === 'url')
        .map(p => (p as { url?: string }).url);

      // De-duplication invariant: each unique URL appears at most once,
      // regardless of how many times it surfaced across tool-result and
      // text_annotation events.
      const counts = new Map<string | undefined, number>();
      for (const url of sourceUrls) {
        counts.set(url, (counts.get(url) ?? 0) + 1);
      }
      for (const [, count] of counts) {
        expect(count).toBe(1);
      }
    });
  });

  describe('image output', () => {
    it('emits a file stream part at content.stop for image blocks', async () => {
      prepareChunksFixtureResponse('image-output');
      const imageModel = provider.interactions('gemini-3-pro-image-preview');
      const { stream } = await imageModel.doStream({
        prompt: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Generate an image of a comic cat in a spaceship.',
              },
            ],
          },
        ],
        providerOptions: {
          google: {
            responseModalities: ['image'],
          },
        },
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const filePart = parts.find(p => p.type === 'file') as
        | {
            type: string;
            mediaType: string;
            data: { type: string; data?: string };
            providerMetadata?: { google?: { interactionId?: string } };
          }
        | undefined;
      expect(filePart).toBeDefined();
      expect(filePart?.type).toBe('file');
      expect(filePart?.mediaType).toMatch(/^image\//);
      expect(filePart?.data.type).toBe('data');
      expect(typeof filePart?.data.data).toBe('string');
      expect(filePart?.data.data?.length ?? 0).toBeGreaterThan(0);
      expect(filePart?.providerMetadata?.google?.interactionId).toMatch(/^v1_/);
    }, 30_000);

    it('emits a file stream part for the modify (turn 2) stream', async () => {
      prepareChunksFixtureResponse('image-output-modify');
      const imageModel = provider.interactions('gemini-3-pro-image-preview');
      const { stream } = await imageModel.doStream({
        prompt: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'now make the cat red' }],
          },
        ],
        providerOptions: {
          google: {
            responseModalities: ['image'],
            previousInteractionId: 'v1_prev-turn',
          },
        },
        includeRawChunks: false,
      });
      const parts = await convertReadableStreamToArray(stream);
      const filePart = parts.find(p => p.type === 'file');
      expect(filePart).toMatchObject({
        type: 'file',
        mediaType: 'image/jpeg',
        data: { type: 'data' },
      });
    }, 30_000);
  });

  describe('agent factory branch', () => {
    const AGENT_NAME = 'deep-research-pro-preview-12-2025' as const;

    function prepareJsonFixtureResponse(filename: string) {
      server.urls[TEST_URL].response = {
        type: 'json-value',
        body: JSON.parse(
          fs.readFileSync(
            `src/interactions/__fixtures__/${filename}.json`,
            'utf8',
          ),
        ),
      };
    }

    it('puts `agent` (not `model`) and `background:true` (not `stream:true`) in the request body when streaming with background:true', async () => {
      prepareJsonFixtureResponse('basic');
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      const { stream } = await agentModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        providerOptions: { google: { background: true } },
      });
      await convertReadableStreamToArray(stream);
      const body = (await server.calls[0].requestBodyJson) as Record<
        string,
        unknown
      >;
      expect(body.agent).toBe(AGENT_NAME);
      expect(body.model).toBeUndefined();
      expect(body.background).toBe(true);
      expect(body.stream).toBeUndefined();
      expect(body.generation_config).toBeUndefined();
    });

    it('emits warning and drops generation-config fields on streaming agent calls', async () => {
      prepareJsonFixtureResponse('basic');
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      const { stream } = await agentModel.doStream({
        prompt: TEST_PROMPT,
        temperature: 0.5,
        includeRawChunks: false,
        providerOptions: { google: { background: true } },
      });
      const parts = await convertReadableStreamToArray(stream);
      const streamStart = parts.find(p => p.type === 'stream-start');
      expect(streamStart).toBeDefined();
      const warnings = (streamStart as { warnings?: Array<unknown> }).warnings;
      const warning = (warnings ?? []).find(
        w =>
          (w as { type?: string }).type === 'other' &&
          (w as { message?: string }).message?.includes('temperature'),
      );
      expect(warning).toBeDefined();
    });

    it('synthesizes text-start, text-delta, text-end, finish parts from a terminal-status agent response', async () => {
      prepareJsonFixtureResponse('basic');
      const agentModel = provider.interactions({ agent: AGENT_NAME });
      const { stream } = await agentModel.doStream({
        prompt: TEST_PROMPT,
        includeRawChunks: false,
        providerOptions: { google: { background: true } },
      });
      const parts = await convertReadableStreamToArray(stream);
      const types = parts.map(p => p.type);
      expect(types).toContain('stream-start');
      expect(types).toContain('text-start');
      expect(types).toContain('text-delta');
      expect(types).toContain('text-end');
      expect(types).toContain('finish');
      const finishPart = parts.find(p => p.type === 'finish');
      expect(
        (finishPart as { finishReason?: { unified?: string } }).finishReason
          ?.unified,
      ).toBe('stop');
    });
  });
});
