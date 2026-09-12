import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';
import { run } from '../../lib/run';

const BASETEN_MODEL_ID = '<model-id>'; // e.g. 5q3z8xcw
const BASETEN_MODEL_URL = `https://model-${BASETEN_MODEL_ID}.api.baseten.co/environments/production/sync/v1`;

const baseten = createOpenAICompatible({
  name: 'baseten',
  baseURL: BASETEN_MODEL_URL,
  headers: {
    Authorization: `Bearer ${process.env.BASETEN_API_KEY ?? ''}`,
  },
});

run(async () => {
  const result = streamText({
    model: baseten('<model-name>'), // The name of the model you are serving in the baseten deployment
    prompt: 'Give me a poem about life',
  });

  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }

  console.log();
  console.log('Token usage:', await result.usage);
  console.log('Finish reason:', await result.finishReason);
});
