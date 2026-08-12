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

export const openaiToolSearchAgent = new ToolLoopAgent({
  model: openai.responses('gpt-5.4'),
  instructions:
    'You are a helpful assistant with access to weather, file search, and email tools.',
  tools: {
    toolSearch: openai.tools.toolSearch(),
    get_weather: weatherTool,
    search_files: searchFilesTool,
    send_email: sendEmailTool,
  },
  onStepFinish: ({ request }) => {
    console.dir(request.body, { depth: Infinity });
  },
  providerOptions: {
    openai: {
      store: false,
    } satisfies OpenAILanguageModelResponsesOptions,
  },
});

export type OpenAIToolSearchMessage = InferAgentUIMessage<
  typeof openaiToolSearchAgent
>;
