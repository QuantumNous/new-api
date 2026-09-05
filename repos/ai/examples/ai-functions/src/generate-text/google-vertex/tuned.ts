import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  // Tuned models are served from a deployed endpoint. Pass the endpoint id with
  // the `endpoints/` prefix; the provider routes the request to
  // `.../locations/{location}/endpoints/{ENDPOINT_ID}` instead of the base
  // `.../publishers/google/models/{MODEL_ID}` path. Use the endpoint id (not the
  // tuned model id).
  //
  // Requires standard Google Cloud credentials (not Express Mode API keys), and
  // the project/location of the deployed endpoint via the `GOOGLE_VERTEX_PROJECT`
  // and `GOOGLE_VERTEX_LOCATION` environment variables (or `createGoogleVertex`).
  const result = await generateText({
    model: googleVertex('endpoints/YOUR_ENDPOINT_ID'),
    prompt: 'Invent a new holiday and describe its traditions.',
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
});
