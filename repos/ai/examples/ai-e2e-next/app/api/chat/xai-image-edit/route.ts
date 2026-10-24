import { xai } from '@ai-sdk/xai';
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateImage,
  type ModelMessage,
} from 'ai';
type DataContent = string | Uint8Array | ArrayBuffer | Buffer;

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const modelMessages: ModelMessage[] = await convertToModelMessages(messages);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const lastUserMessage = modelMessages.findLast(m => m.role === 'user');
      const userContent = lastUserMessage?.content;
      const userParts =
        typeof userContent === 'string'
          ? [{ type: 'text' as const, text: userContent }]
          : (userContent ?? []);

      const textPart = userParts.find(p => p.type === 'text');
      const promptText = textPart && 'text' in textPart ? textPart.text : '';

      const lastAssistantImage = findLastAssistantImage(modelMessages);

      const userUploadedImages = userParts
        .filter(
          (p): p is Extract<typeof p, { type: 'file' }> => p.type === 'file',
        )
        .map(p => p.data)
        .filter((data): data is DataContent => !(data instanceof URL));

      const allImages = [
        ...(lastAssistantImage ? [lastAssistantImage] : []),
        ...userUploadedImages,
      ];

      const { images } = await generateImage({
        model: xai.image('grok-imagine-image'),
        prompt:
          allImages.length > 0
            ? { text: promptText, images: allImages }
            : promptText,
      });

      const image = images[0];
      const base64 = Buffer.from(image.uint8Array).toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      writer.write({
        type: 'file',
        url: dataUrl,
        mediaType: 'image/png',
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}

function findLastAssistantImage(
  messages: ModelMessage[],
): DataContent | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;

    const content = message.content;
    if (typeof content === 'string') continue;

    for (let j = content.length - 1; j >= 0; j--) {
      const part = content[j];
      if (
        part.type === 'file' &&
        !(part.data instanceof URL) &&
        !(typeof part.data === 'object' && !(part.data instanceof Uint8Array))
      ) {
        return part.data;
      }
    }
  }
  return undefined;
}
