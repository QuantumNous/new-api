import { amazonBedrock } from '@ai-sdk/amazon-bedrock';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { run } from '../../lib/run';
import { printFullStream } from '../../lib/print-full-stream';

run(async () => {
  const result = streamText({
    model: amazonBedrock('anthropic.claude-3-5-sonnet-20241022-v2:0'),
    tools: {
      updateIssueList: tool({
        inputSchema: z.object({}),
      }),
    },
    prompt: 'Update the issue list',
  });

  await printFullStream({ result });
});
