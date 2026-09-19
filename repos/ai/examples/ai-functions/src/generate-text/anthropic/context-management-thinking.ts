import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: anthropic('claude-sonnet-4-5'),
    messages: [
      {
        role: 'user',
        content: 'What is the square root of 144?',
      },
      {
        role: 'assistant',
        content: [
          {
            type: 'reasoning',
            text: 'The user is asking for the square root of 144. I know that 12 * 12 = 144, so the answer is 12.',
            providerOptions: {
              anthropic: {
                signature:
                  'Er4BCkYICxgCKkCoxqLHLrx4mFL9Ox7/aHKht87WDzXfvZ7qbZKSnHV8imA5b3LXxuVqcXQ9z5sXwDx20JIW/+6DJehOSNK72L83Egx0T9s7VzB6QUK9g5kaDO9lGaWN5CPEDJU0lyIw4+Ed3q4N9w+16h3cfQ+9stJXHCl+1nYDxjIOLcyJT8Ug/LTmtlp4bbxWmmfNicayKiasdReHiOnqz1sKEF0pR4kcnF5mQGdLxk8q3A3NY+wGsH8MtUIqxRgB',
              },
            },
          },
          {
            type: 'text',
            text: 'The square root of 144 is 12.',
          },
        ],
      },
      {
        role: 'user',
        content: 'Now multiply that by 3.',
      },
    ],
    reasoning: 'low',
    providerOptions: {
      anthropic: {
        contextManagement: {
          edits: [
            {
              type: 'clear_thinking_20251015',
              keep: { type: 'thinking_turns', value: 1 },
            },
          ],
        },
      } satisfies AnthropicLanguageModelOptions,
    },
  });

  console.log('Text:', result.text);
  console.log('Request body:', JSON.stringify(result.request.body, null, 2));
});
