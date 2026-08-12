import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { tool, ToolLoopAgent, type InferAgentUIMessage } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the current weather at a specific location',
  inputSchema: z.object({
    location: z.string().describe('The city and state, e.g. San Francisco, CA'),
    unit: z
      .enum(['celsius', 'fahrenheit'])
      .optional()
      .describe('Temperature unit'),
  }),
  execute: async ({ location, unit = 'fahrenheit' }) => ({
    location,
    temperature: unit === 'celsius' ? 18 : 64,
    condition: 'Partly cloudy',
    humidity: 65,
  }),
  providerOptions: {
    openai: { deferLoading: true },
  },
});

const searchFilesTool = tool({
  description: 'Search through files in the workspace',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
    file_types: z.array(z.string()).optional().describe('Filter by file types'),
  }),
  execute: async ({ query }) => ({
    results: [
      `document1.pdf - Contains "${query}" on page 3`,
      `notes.txt - Found "${query}" in title`,
      `report.docx - "${query}" mentioned in summary`,
    ],
  }),
  providerOptions: {
    openai: { deferLoading: true },
  },
});

const sendEmailTool = tool({
  description: 'Send an email to a recipient',
  inputSchema: z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
  }),
  execute: async ({ to, subject }) => ({
    success: true,
    message: `Email sent to ${to} with subject: ${subject}`,
    timestamp: new Date().toISOString(),
  }),
  providerOptions: {
    openai: { deferLoading: true },
  },
});

export const openaiToolSearchClientAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5.4'),
  instructions:
    'You are a helpful assistant with access to weather, file search, and email tools.',
  tools: {
    toolSearch: openai.tools.toolSearch({
      execution: 'client',
      description: 'Search for available tools based on what the user needs.',
      parameters: {
        type: 'object',
        properties: {
          goal: {
            type: 'string',
            description: 'What the user is trying to accomplish',
          },
        },
        required: ['goal'],
        additionalProperties: false,
      },
      execute: async ({ arguments: args }) => {
        console.log('\n=== Client Tool Search Execute ===');
        console.log('Search arguments:', args);

        return {
          tools: [
            {
              type: 'function',
              name: 'get_weather',
              description: 'Get the current weather at a specific location',
              deferLoading: true,
              parameters: {
                type: 'object',
                properties: {
                  location: {
                    type: 'string',
                    description: 'The city and state, e.g. San Francisco, CA',
                  },
                  unit: {
                    type: 'string',
                    enum: ['celsius', 'fahrenheit'],
                    description: 'Temperature unit',
                  },
                },
                required: ['location'],
                additionalProperties: false,
              },
            },
            {
              type: 'function',
              name: 'search_files',
              description: 'Search through files in the workspace',
              // deferLoading: true,
              parameters: {
                type: 'object',
                properties: {
                  query: {
                    type: 'string',
                    description: 'The search query',
                  },
                  file_types: {
                    type: 'array',
                    items: { type: 'string' },
                    description: 'Filter by file types',
                  },
                },
                required: ['query'],
                additionalProperties: false,
              },
            },
            {
              type: 'function',
              name: 'send_email',
              description: 'Send an email to a recipient',
              // deferLoading: true,
              parameters: {
                type: 'object',
                properties: {
                  to: {
                    type: 'string',
                    description: 'Recipient email address',
                  },
                  subject: {
                    type: 'string',
                    description: 'Email subject',
                  },
                  body: {
                    type: 'string',
                    description: 'Email body content',
                  },
                },
                required: ['to', 'subject', 'body'],
                additionalProperties: false,
              },
            },
          ],
        };
      },
    }),
    get_weather: weatherTool,
    search_files: searchFilesTool,
    send_email: sendEmailTool,
  },
  onStepFinish: ({ request }) => {
    console.dir(request.body, { depth: Infinity });
  },
  providerOptions: {
    openai: {
      store: true,
    } satisfies OpenAILanguageModelResponsesOptions,
  },
});

export type OpenAIToolSearchClientMessage = InferAgentUIMessage<
  typeof openaiToolSearchClientAgent
>;
