import {
  convertReadableStreamToArray,
  mockId,
} from '@ai-sdk/provider-utils/test';
import { createTestServer } from '@ai-sdk/test-server/with-vitest';
import { describe, expect, it } from 'vitest';
import { convertToOpenAIResponsesInput } from './convert-to-openai-responses-input';
import { OpenAIResponsesLanguageModel } from './openai-responses-language-model';

const toolNameMapping = {
  toProviderToolName: (name: string) => name,
  toCustomToolName: (name: string) => name,
};

function createModel() {
  return new OpenAIResponsesLanguageModel('gpt-5.4', {
    provider: 'openai',
    url: ({ path }) => `https://api.openai.com/v1${path}`,
    headers: () => ({ Authorization: 'Bearer APIKEY' }),
    generateId: mockId(),
  });
}

const computerCall = {
  type: 'computer_call',
  id: 'computer_item_123',
  call_id: 'computer_call_123',
  status: 'completed',
  pending_safety_checks: [
    {
      id: 'safety_123',
      code: 'confirm_action',
      message: 'Confirm this action.',
    },
  ],
  actions: [
    {
      type: 'click',
      button: 'left',
      x: 100,
      y: 200,
      keys: ['CTRL'],
    },
    {
      type: 'double_click',
      x: 110,
      y: 210,
      keys: null,
    },
    {
      type: 'drag',
      path: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
    },
    { type: 'keypress', keys: ['CTRL', 'L'] },
    { type: 'move', x: 120, y: 220 },
    { type: 'screenshot' },
    {
      type: 'scroll',
      x: 130,
      y: 230,
      scroll_x: 0,
      scroll_y: 500,
    },
    { type: 'type', text: 'hello' },
    { type: 'wait' },
  ],
} as const;

const expectedInput = {
  actions: [
    {
      type: 'click',
      button: 'left',
      x: 100,
      y: 200,
      keys: ['CTRL'],
    },
    { type: 'double_click', x: 110, y: 210 },
    {
      type: 'drag',
      path: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
    },
    { type: 'keypress', keys: ['CTRL', 'L'] },
    { type: 'move', x: 120, y: 220 },
    { type: 'screenshot' },
    {
      type: 'scroll',
      x: 130,
      y: 230,
      scrollX: 0,
      scrollY: 500,
    },
    { type: 'type', text: 'hello' },
    { type: 'wait' },
  ],
  pendingSafetyChecks: [
    {
      id: 'safety_123',
      code: 'confirm_action',
      message: 'Confirm this action.',
    },
  ],
  status: 'completed',
};

describe('OpenAI Responses computer tool', () => {
  const server = createTestServer({
    'https://api.openai.com/v1/responses': {},
  });

  it('decodes batched actions in non-streaming responses', async () => {
    server.urls['https://api.openai.com/v1/responses'].response = {
      type: 'json-value',
      body: {
        id: 'resp_computer_test',
        object: 'response',
        created_at: 1741630255,
        status: 'completed',
        error: null,
        incomplete_details: null,
        instructions: null,
        max_output_tokens: null,
        model: 'gpt-5.4',
        output: [computerCall],
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    };

    const result = await createModel().doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use it.' }] }],
      tools: [
        {
          type: 'provider',
          id: 'openai.computer',
          name: 'computer',
          args: {},
        },
      ],
    });

    expect(await server.calls[0].requestBodyJson).toMatchObject({
      tools: [{ type: 'computer' }],
    });
    expect(result.content).toEqual([
      {
        type: 'tool-call',
        toolCallId: 'computer_call_123',
        toolName: 'computer',
        input: JSON.stringify(expectedInput),
        providerMetadata: {
          openai: { itemId: 'computer_item_123' },
        },
      },
    ]);
    expect(result.finishReason.unified).toBe('tool-calls');
  });

  it('decodes batched actions in streaming responses', async () => {
    server.urls['https://api.openai.com/v1/responses'].response = {
      type: 'stream-chunks',
      chunks: [
        `data:${JSON.stringify({
          type: 'response.created',
          response: {
            id: 'resp_computer_test',
            created_at: 1741630255,
            model: 'gpt-5.4',
            service_tier: null,
          },
        })}\n\n`,
        `data:${JSON.stringify({
          type: 'response.output_item.added',
          output_index: 0,
          item: {
            type: 'computer_call',
            id: computerCall.id,
            call_id: computerCall.call_id,
            status: 'in_progress',
          },
        })}\n\n`,
        `data:${JSON.stringify({
          type: 'response.output_item.done',
          output_index: 0,
          item: computerCall,
        })}\n\n`,
        `data:${JSON.stringify({
          type: 'response.completed',
          response: {
            incomplete_details: null,
            reasoning: null,
            service_tier: null,
            usage: {
              input_tokens: 100,
              input_tokens_details: { cached_tokens: 0 },
              output_tokens: 50,
              output_tokens_details: { reasoning_tokens: 0 },
            },
          },
        })}\n\n`,
      ],
    };

    const { stream } = await createModel().doStream({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'Use it.' }] }],
      tools: [
        {
          type: 'provider',
          id: 'openai.computer',
          name: 'computer',
          args: {},
        },
      ],
    });

    const events = await convertReadableStreamToArray(stream);

    expect(events).toContainEqual({
      type: 'tool-input-start',
      id: 'computer_call_123',
      toolName: 'computer',
    });
    expect(events).toContainEqual({
      type: 'tool-input-delta',
      id: 'computer_call_123',
      delta: JSON.stringify(expectedInput),
    });
    expect(events).toContainEqual({
      type: 'tool-call',
      toolCallId: 'computer_call_123',
      toolName: 'computer',
      input: JSON.stringify(expectedInput),
      providerMetadata: {
        openai: { itemId: 'computer_item_123' },
      },
    });
    expect(events.at(-1)).toMatchObject({
      type: 'finish',
      finishReason: { unified: 'tool-calls' },
    });
  });

  it.each([
    {
      store: true,
      hasPreviousResponseId: false,
      expectedCall: {
        type: 'item_reference',
        id: 'computer_item_123',
      },
    },
    {
      store: false,
      hasPreviousResponseId: false,
      expectedCall: {
        type: 'computer_call',
        id: 'computer_item_123',
        call_id: 'computer_call_123',
        status: 'completed',
        actions: [
          {
            type: 'scroll',
            x: 10,
            y: 20,
            scroll_x: 0,
            scroll_y: 100,
            keys: undefined,
          },
        ],
        pending_safety_checks: [
          {
            id: 'safety_123',
            code: 'confirm_action',
            message: undefined,
          },
        ],
      },
    },
    {
      store: true,
      hasPreviousResponseId: true,
      expectedCall: undefined,
    },
  ])(
    'serializes screenshot output (store: $store, previous response: $hasPreviousResponseId)',
    async ({ store, hasPreviousResponseId, expectedCall }) => {
      const result = await convertToOpenAIResponsesInput({
        prompt: [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'computer_call_123',
                toolName: 'computer',
                input: {
                  actions: [
                    {
                      type: 'scroll',
                      x: 10,
                      y: 20,
                      scrollX: 0,
                      scrollY: 100,
                    },
                  ],
                  pendingSafetyChecks: [
                    {
                      id: 'safety_123',
                      code: 'confirm_action',
                    },
                  ],
                  status: 'completed',
                },
                providerOptions: {
                  openai: { itemId: 'computer_item_123' },
                },
              },
            ],
          },
          {
            role: 'tool',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'computer_call_123',
                toolName: 'computer',
                output: {
                  type: 'json',
                  value: {
                    output: {
                      type: 'computer_screenshot',
                      imageUrl: 'data:image/png;base64,c2NyZWVuc2hvdA==',
                      detail: 'original',
                    },
                    acknowledgedSafetyChecks: [
                      {
                        id: 'safety_123',
                        code: 'confirm_action',
                      },
                    ],
                  },
                },
              },
            ],
          },
        ],
        toolNameMapping,
        systemMessageMode: 'system',
        providerOptionsName: 'openai',
        store,
        hasPreviousResponseId,
        hasComputerTool: true,
      });

      expect(result.input).toEqual([
        ...(expectedCall == null ? [] : [expectedCall]),
        {
          type: 'computer_call_output',
          call_id: 'computer_call_123',
          output: {
            type: 'computer_screenshot',
            image_url: 'data:image/png;base64,c2NyZWVuc2hvdA==',
            file_id: undefined,
            detail: 'original',
          },
          acknowledged_safety_checks: [
            {
              id: 'safety_123',
              code: 'confirm_action',
              message: undefined,
            },
          ],
        },
      ]);
    },
  );

  it('serializes file ID screenshot output', async () => {
    const result = await convertToOpenAIResponsesInput({
      prompt: [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'computer_call_123',
              toolName: 'computer',
              output: {
                type: 'json',
                value: {
                  output: {
                    type: 'computer_screenshot',
                    fileId: 'file_screenshot_123',
                  },
                },
              },
            },
          ],
        },
      ],
      toolNameMapping,
      systemMessageMode: 'system',
      providerOptionsName: 'openai',
      store: true,
      hasComputerTool: true,
    });

    expect(result.input).toEqual([
      {
        type: 'computer_call_output',
        call_id: 'computer_call_123',
        output: {
          type: 'computer_screenshot',
          image_url: undefined,
          file_id: 'file_screenshot_123',
          detail: undefined,
        },
        acknowledged_safety_checks: undefined,
      },
    ]);
  });
});
