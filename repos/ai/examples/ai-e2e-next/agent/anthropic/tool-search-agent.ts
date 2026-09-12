import { anthropic } from '@ai-sdk/anthropic';
import {
  tool,
  ToolLoopAgent,
  type InferAgentUIMessage,
  type UIToolInvocation,
} from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: 'Get the weather in a location',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({
    state: 'ready' as const,
    temperature: 72,
    weather: 'sunny',
  }),
  providerOptions: {
    anthropic: { deferLoading: true },
  },
});

const sendEmailTool = tool({
  description: 'Send an email to a recipient with a subject and body',
  inputSchema: z.object({
    to: z.string().describe('Recipient email address'),
    subject: z.string().describe('Email subject'),
    body: z.string().describe('Email body content'),
  }),
  execute: async ({ to, subject }) => ({
    success: true,
    message: `Email sent to ${to}`,
    subject,
  }),
  providerOptions: {
    anthropic: { deferLoading: true },
  },
});

export const anthropicToolSearchAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5'),
  tools: {
    toolSearch: anthropic.tools.toolSearchBm25_20251119(),
    weather: weatherTool,
    send_email: sendEmailTool,
  },
});

export type AnthropicToolSearchAgentMessage = InferAgentUIMessage<
  typeof anthropicToolSearchAgent
>;

export type SendEmailUIToolInvocation = UIToolInvocation<typeof sendEmailTool>;
