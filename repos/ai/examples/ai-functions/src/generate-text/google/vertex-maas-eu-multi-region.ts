import { createVertexMaas } from '@ai-sdk/google-vertex/maas';
import { generateText } from 'ai';
import { run } from '../../lib/run';

const project = process.env.GOOGLE_VERTEX_PROJECT!;

const vertexMaas = createVertexMaas({
  location: 'us-east5',
  project,
});

run(async () => {
  const result = await generateText({
    model: vertexMaas('meta/llama-4-maverick-17b-128e-instruct-maas'),
    prompt: 'Say hello in one word.',
    maxRetries: 0,
  });

  console.log(result.text);
});
