import { createOpenAI } from '@ai-sdk/openai';
import { ToolLoopAgent } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  let userAgent: string | null = null;

  const capturingFetch: typeof fetch = async (_url, init) => {
    userAgent = new Headers(init?.headers).get('user-agent');
    return new Response(
      JSON.stringify({
        id: 'response-id',
        object: 'chat.completion',
        created: 0,
        model: 'gpt-4o-mini',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'hi' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  const openai = createOpenAI({ apiKey: 'test', fetch: capturingFetch });

  const agent = new ToolLoopAgent({
    model: openai.chat('gpt-4o-mini'),
  });

  await agent.generate({ prompt: 'hello' });

  console.log('outgoing user-agent:');
  console.log(`  ${userAgent}`);
});
