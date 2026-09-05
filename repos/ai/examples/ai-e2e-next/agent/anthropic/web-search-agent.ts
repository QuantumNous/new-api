import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, tool, type InferAgentUIMessage } from 'ai';
import { z } from 'zod';

const savedNotes: string[] = [];

const saveNote = tool({
  description:
    'Save a note to the notebook. Use this whenever the user asks to save or remember information.',
  inputSchema: z.object({
    note: z.string().describe('The note content to save.'),
  }),
  execute: async ({ note }) => {
    savedNotes.push(note);

    return {
      success: true,
      totalNotes: savedNotes.length,
      savedNote: note,
    };
  },
});

export const anthropicWebSearchAgent = new ToolLoopAgent({
  model: anthropic('claude-sonnet-4-5'),
  instructions:
    'You are a research assistant. When the user asks you to search and save something, call both saveNote and webSearch in the same assistant response before writing the final answer. Prefer calling saveNote first, then webSearch, so the repro can capture a regular tool call followed by a provider-executed web search.',
  tools: {
    saveNote,
    webSearch: anthropic.tools.webSearch_20250305({
      maxUses: 3,
      userLocation: {
        type: 'approximate',
        city: 'New York',
        country: 'US',
        timezone: 'America/New_York',
      },
    }),
  },
  reasoning: 'medium',
});

export type AnthropicWebSearchMessage = InferAgentUIMessage<
  typeof anthropicWebSearchAgent
>;
