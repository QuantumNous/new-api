import { openai } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';

const agent = new ToolLoopAgent({
  model: openai('gpt-4o'),
  instructions: 'You are a helpful assistant.',
  allowSystemInMessages: true,
});

run(async () => {
  const result = await agent.generate({
    messages: [
      { role: 'system', content: '[System notice: User timezone is PST]' },
      { role: 'user', content: 'What time is it?' },
    ],
  });

  console.log(result.text);
});
