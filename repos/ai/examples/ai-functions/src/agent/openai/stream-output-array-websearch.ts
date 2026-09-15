import {
  openai,
  type OpenAILanguageModelResponsesOptions,
} from '@ai-sdk/openai';
import { Output, ToolLoopAgent } from 'ai';
import { z } from 'zod';
import { print } from '../../lib/print';
import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-5-mini'),
  callOptionsSchema: z.object({ topic: z.string() }),
  output: Output.array({
    element: z.object({
      title: z.string(),
      tldr: z.string(),
    }),
  }),
  tools: {
    web_search: openai.tools.webSearch({
      searchContextSize: 'low',
    }),
  },
  providerOptions: {
    openai: {
      reasoningEffort: 'medium',
      reasoningSummary: 'detailed',
    } satisfies OpenAILanguageModelResponsesOptions,
  },
  prepareCall: ({ options, ...rest }) => ({
    ...rest,
    instructions:
      `You are an expert in the following topic: ${options.topic}. ` +
      `Contextualize the news with your knowledge about the topic and return the top 3 news items.`,
  }),
  onStepFinish: ({ request }) => {
    console.log();
    print('REQUEST:', request.body);
  },
});

run(async () => {
  const result = await agent.stream({
    prompt: 'What happened at the latest Apple event?',
    options: { topic: 'Technology and Gadgets' },
  });

  await printFullStream({ result });
});
