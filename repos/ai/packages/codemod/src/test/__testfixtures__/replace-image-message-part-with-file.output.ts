import { generateText } from 'ai';

declare const model: any;
declare const bytes: Uint8Array;

await generateText({
  model,
  messages: [
    {
      role: 'user',
      content: [{
        type: 'file',
        data: bytes,
        mediaType: 'image'
      }],
    },
  ],
});
