import { openai } from '@ai-sdk/openai';
import { generateImage } from 'ai';

// Allow responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const { prompt } = await req.json();

  const { image } = await generateImage({
    model: openai.imageModel('dall-e-3'),
    prompt,
    size: '1024x1024',
    providerOptions: {
      openai: { style: 'vivid', quality: 'hd' },
    },
  });

  return Response.json(image.base64);
}
