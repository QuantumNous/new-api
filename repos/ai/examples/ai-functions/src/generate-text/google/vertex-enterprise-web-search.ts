import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
    model: googleVertex('gemini-2.5-flash'),
    tools: {
      enterprise_web_search: googleVertex.tools.enterpriseWebSearch({}),
    },
    prompt: 'What are the latest FDA regulations for clinical trials?',
  });

  const { text, sources } = result;
  const providerMetadata = result.finalStep.providerMetadata;
  const groundingMetadata = providerMetadata?.vertex?.groundingMetadata as
    | { webSearchQueries?: string[] }
    | undefined;

  console.log('Generated Text:', text);
  console.log();
  console.log('SOURCES');
  console.dir({ sources }, { depth: null });
  console.log();
  console.log('PROVIDER METADATA');
  console.dir(providerMetadata, { depth: null });
  console.log();
  console.log('GROUNDING METADATA');
  console.log('Web Search Queries:', groundingMetadata?.webSearchQueries);
});
