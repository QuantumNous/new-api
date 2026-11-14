import { createBaseten } from '@ai-sdk/baseten';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // Using custom model URL for chat/text generation
  const CHAT_MODEL_ID = '<model-id>'; // e.g. 6wg17egw
  const CHAT_MODEL_URL = `https://model-${CHAT_MODEL_ID}.api.baseten.co/environments/production/sync/v1`;

  const baseten = createBaseten({
    modelURL: CHAT_MODEL_URL,
  });

  const { text, usage } = await generateText({
    model: baseten.languageModel(),
    prompt: 'Explain quantum computing in simple terms.',
  });

  console.log(text);
  console.log();
  console.log('Usage:', usage);
});
