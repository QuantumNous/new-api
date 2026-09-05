import { xai } from '@ai-sdk/xai';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const response = streamText({
    model: xai.responses('grok-4.5'),
    prompt:
      //   "Call the web_search tool with the query 'What is the capital of France?'",
      'Calculate the compound interest for $10,000 at 5% annually for 10 years',
    tools: {
      web_search: xai.tools.webSearch(),
      code_execution: xai.tools.codeExecution(),
    },
  });

  for await (const chunk of response.stream) {
    console.dir(chunk, { depth: null });
  }
});
