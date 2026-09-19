import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import {
  consumeStream,
  convertToModelMessages,
  createProviderRegistry,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from 'ai';
export const maxDuration = 60;

const registry = createProviderRegistry({ anthropic, google, openai, xai });

export async function POST(req: Request) {
  const {
    messages,
    modelId,
    providerId,
  }: {
    messages: UIMessage[];
    modelId: string;
    providerId: 'anthropic' | 'google' | 'openai' | 'xai';
  } = await req.json();

  const model = registry.languageModel(`${providerId}:${modelId}`);

  const result = streamText({
    model,
    messages: await convertToModelMessages(messages),
    abortSignal: req.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
    consumeSseStream: consumeStream,
  });
}
