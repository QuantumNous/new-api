import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    prompt: `Call the echo tool with "hello world". what does it respond with back?`,
    providerOptions: {
      anthropic: {
        mcpServers: [
          {
            type: 'url',
            name: 'echo',
            url: 'https://echo.mcp.inevitable.fyi/mcp',
          },
        ],
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  print('Request body:', result.request.body);
  print('Content:', result.content);
});
