import { xai } from '@ai-sdk/xai';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: xai.responses('grok-4'),
    prompt:
      'Calculate the compound interest for $10,000 at 5% annually for 10 years',
    tools: {
      code_execution: xai.tools.codeExecution(),
    },
    onStepFinish: async ({ request, response }) => {
      console.log('Request:', JSON.stringify(request, null, 2));
      console.log('Response:', JSON.stringify(response, null, 2)); // an error message will be observer here in the 'tool' role message part; won't stop execution though
      console.log();
    },
  });

  console.log('Text:', result.text);
  console.log();
  console.log('Tool calls made:');
  for (const content of result.content) {
    if (content.type === 'tool-call') {
      console.log(
        `  - ${content.toolName} (${content.providerExecuted ? 'server-side' : 'client-side'})`,
      );
    }
  }
});
