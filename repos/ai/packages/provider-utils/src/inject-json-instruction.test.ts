import type { JSONSchema7, LanguageModelV4Prompt } from '@ai-sdk/provider';
import { expect, it, describe } from 'vitest';
import {
  injectJsonInstruction,
  injectJsonInstructionIntoMessages,
} from './inject-json-instruction';

const basicSchema: JSONSchema7 = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
  },
  required: ['name', 'age'],
};

describe('injectJsonInstruction', () => {
  it('should handle basic case with prompt and schema', () => {
    const result = injectJsonInstruction({
      prompt: 'Generate a person',
      schema: basicSchema,
    });
    expect(result).toBe(
      'Generate a person\n\n' +
        'JSON schema:\n' +
        '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}\n' +
        'You MUST answer with a JSON object that matches the JSON schema above.',
    );
  });

  it('should handle only prompt, no schema', () => {
    const result = injectJsonInstruction({
      prompt: 'Generate a person',
    });
    expect(result).toBe('Generate a person\n\nYou MUST answer with JSON.');
  });

  it('should handle only schema, no prompt', () => {
    const result = injectJsonInstruction({
      schema: basicSchema,
    });
    expect(result).toBe(
      'JSON schema:\n' +
        '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}\n' +
        'You MUST answer with a JSON object that matches the JSON schema above.',
    );
  });

  it('should handle no prompt, no schema', () => {
    const result = injectJsonInstruction({});
    expect(result).toBe('You MUST answer with JSON.');
  });

  it('should handle custom schemaPrefix and schemaSuffix', () => {
    const result = injectJsonInstruction({
      prompt: 'Generate a person',
      schema: basicSchema,
      schemaPrefix: 'Custom prefix:',
      schemaSuffix: 'Custom suffix',
    });
    expect(result).toBe(
      'Generate a person\n\n' +
        'Custom prefix:\n' +
        '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}\n' +
        'Custom suffix',
    );
  });

  it('should handle empty string prompt', () => {
    const result = injectJsonInstruction({
      prompt: '',
      schema: basicSchema,
    });
    expect(result).toBe(
      'JSON schema:\n' +
        '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}\n' +
        'You MUST answer with a JSON object that matches the JSON schema above.',
    );
  });

  it('should handle empty object schema', () => {
    const result = injectJsonInstruction({
      prompt: 'Generate something',
      schema: {},
    });
    expect(result).toBe(
      'Generate something\n\n' +
        'JSON schema:\n' +
        '{}\n' +
        'You MUST answer with a JSON object that matches the JSON schema above.',
    );
  });

  it('should handle complex nested schema', () => {
    const complexSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'number' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
              },
            },
          },
        },
      },
    };
    const result = injectJsonInstruction({
      prompt: 'Generate a complex person',
      schema: complexSchema,
    });
    expect(result).toBe(
      'Generate a complex person\n\n' +
        'JSON schema:\n' +
        '{"type":"object","properties":{"person":{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"},"address":{"type":"object","properties":{"street":{"type":"string"},"city":{"type":"string"}}}}}}}\n' +
        'You MUST answer with a JSON object that matches the JSON schema above.',
    );
  });

  it('should handle schema with special characters', () => {
    const specialSchema: JSONSchema7 = {
      type: 'object',
      properties: {
        'special@property': { type: 'string' },
        'emoji😊': { type: 'string' },
      },
    };
    const result = injectJsonInstruction({
      schema: specialSchema,
    });
    expect(result).toBe(
      'JSON schema:\n' +
        '{"type":"object","properties":{"special@property":{"type":"string"},"emoji😊":{"type":"string"}}}\n' +
        'You MUST answer with a JSON object that matches the JSON schema above.',
    );
  });

  it('should handle very long prompt and schema', () => {
    const longPrompt = 'A'.repeat(1000);
    const longSchema: JSONSchema7 = {
      type: 'object',
      properties: {},
    };
    for (let i = 0; i < 100; i++) {
      longSchema.properties![`prop${i}`] = { type: 'string' };
    }
    const result = injectJsonInstruction({
      prompt: longPrompt,
      schema: longSchema,
    });
    expect(result).toBe(
      longPrompt +
        '\n\n' +
        'JSON schema:\n' +
        JSON.stringify(longSchema) +
        '\n' +
        'You MUST answer with a JSON object that matches the JSON schema above.',
    );
  });

  it('should handle null values for optional parameters', () => {
    const result = injectJsonInstruction({
      prompt: null as any,
      schema: null as any,
      schemaPrefix: null as any,
      schemaSuffix: null as any,
    });
    expect(result).toBe('');
  });

  it('should handle undefined values for optional parameters', () => {
    const result = injectJsonInstruction({
      prompt: undefined,
      schema: undefined,
      schemaPrefix: undefined,
      schemaSuffix: undefined,
    });
    expect(result).toBe('You MUST answer with JSON.');
  });
});

describe('injectJsonInstructionIntoMessages', () => {
  it('should handle basic case with prompt and schema', () => {
    const result = injectJsonInstructionIntoMessages({
      messages: [{ role: 'system', content: 'Generate a person' }],
      schema: basicSchema,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "Generate a person

      JSON schema:
      {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}
      You MUST answer with a JSON object that matches the JSON schema above.",
          "role": "system",
        },
      ]
    `);
  });

  it('should not mutate the input messages array', () => {
    const originalMessages: LanguageModelV4Prompt = [
      { role: 'system', content: 'Generate a person' },
    ];

    injectJsonInstructionIntoMessages({
      messages: originalMessages,
      schema: basicSchema,
    });

    expect(originalMessages).toEqual([
      { role: 'system', content: 'Generate a person' },
    ]);
  });

  it('should handle empty messages array', () => {
    const result = injectJsonInstructionIntoMessages({
      messages: [],
      schema: basicSchema,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "JSON schema:
      {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}
      You MUST answer with a JSON object that matches the JSON schema above.",
          "role": "system",
        },
      ]
    `);
  });

  it('should handle messages without initial system message', () => {
    const result = injectJsonInstructionIntoMessages({
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hi there' }],
        },
      ],
      schema: basicSchema,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "JSON schema:
      {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}
      You MUST answer with a JSON object that matches the JSON schema above.",
          "role": "system",
        },
        {
          "content": [
            {
              "text": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "content": [
            {
              "text": "Hi there",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
      ]
    `);
  });

  it('should handle system message with empty content', () => {
    const result = injectJsonInstructionIntoMessages({
      messages: [
        { role: 'system', content: '' },
        { role: 'user', content: [{ type: 'text', text: 'Generate data' }] },
      ],
      schema: basicSchema,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "JSON schema:
      {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}
      You MUST answer with a JSON object that matches the JSON schema above.",
          "role": "system",
        },
        {
          "content": [
            {
              "text": "Generate data",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should preserve all non-system messages', () => {
    const result = injectJsonInstructionIntoMessages({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Hi' }] },
        { role: 'user', content: [{ type: 'text', text: 'Generate person' }] },
      ],
      schema: basicSchema,
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "You are helpful

      JSON schema:
      {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}
      You MUST answer with a JSON object that matches the JSON schema above.",
          "role": "system",
        },
        {
          "content": [
            {
              "text": "Hello",
              "type": "text",
            },
          ],
          "role": "user",
        },
        {
          "content": [
            {
              "text": "Hi",
              "type": "text",
            },
          ],
          "role": "assistant",
        },
        {
          "content": [
            {
              "text": "Generate person",
              "type": "text",
            },
          ],
          "role": "user",
        },
      ]
    `);
  });

  it('should handle case with no schema', () => {
    const result = injectJsonInstructionIntoMessages({
      messages: [{ role: 'system', content: 'Generate data' }],
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "Generate data

      You MUST answer with JSON.",
          "role": "system",
        },
      ]
    `);
  });

  it('should handle custom schema prefix and suffix', () => {
    const result = injectJsonInstructionIntoMessages({
      messages: [{ role: 'system', content: 'Generate data' }],
      schema: basicSchema,
      schemaPrefix: 'Custom schema:',
      schemaSuffix: 'Follow this format exactly.',
    });

    expect(result).toMatchInlineSnapshot(`
      [
        {
          "content": "Generate data

      Custom schema:
      {"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}},"required":["name","age"]}
      Follow this format exactly.",
          "role": "system",
        },
      ]
    `);
  });
});
