import { createOpenResponses } from '@ai-sdk/open-responses';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const lmstudio = createOpenResponses({
  name: 'lmstudio',
  url: 'http://localhost:1234/v1/responses',
});

run(async () => {
  const result = await generateText({
    model: lmstudio('mistralai/ministral-3-14b-reasoning'),
    prompt: 'Invent a new holiday and describe its traditions.',
    maxOutputTokens: 100,
  });

  console.log(JSON.stringify(result.response.body, null, 2));

  console.log('Reasoning:', result.reasoning);
  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
