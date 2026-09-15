import { bedrockAnthropic } from '@ai-sdk/amazon-bedrock/anthropic';
import { generateText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { print } from '../../lib/print';

run(async () => {
  const result = await generateText({
    model: bedrockAnthropic('us.anthropic.claude-sonnet-4-5-20250929-v1:0'),
    tools: {
      updateIssueList: tool({
        inputSchema: z.object({}),
      }),
    },
    prompt: 'Update the issue list',
  });

  print('Content:', result.content);
});
