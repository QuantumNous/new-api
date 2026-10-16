import { google } from '@ai-sdk/google';
import { generateText, uploadFile } from 'ai';
import fs from 'node:fs';
import { run } from '../../lib/run';

run(async () => {
  const { providerReference, mediaType } = await uploadFile({
    api: google.files(),
    data: fs.readFileSync('./data/comic-cat.png'),
    mediaType: 'image/png',
  });

  console.log('Uploaded file reference:', providerReference);

  const result = await generateText({
    model: google.interactions('gemini-3.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Describe the image in detail.' },
          {
            type: 'file',
            mediaType: mediaType ?? 'image/png',
            data: providerReference,
          },
        ],
      },
    ],
  });

  console.log(result.text);
  console.log();
  console.log('Token usage:', result.usage);
  console.log('Finish reason:', result.finishReason);
  console.log(
    'Interaction id:',
    result.finalStep.providerMetadata?.google?.interactionId,
  );
});
