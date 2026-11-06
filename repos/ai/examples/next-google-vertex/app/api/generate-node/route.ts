import { googleVertex } from '@ai-sdk/google-vertex';
import { generateText } from 'ai';

export async function GET() {
  const model = googleVertex('gemini-2.5-flash');
  const { text } = await generateText({
    model,
    prompt: 'tell me a story',
  });
  return Response.json({ message: text });
}
