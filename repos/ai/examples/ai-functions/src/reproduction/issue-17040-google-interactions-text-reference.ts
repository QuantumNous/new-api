import { createGoogle } from '@ai-sdk/google';
import { generateText, uploadFile } from 'ai';

const secret = 'ISSUE-17040-TEXT-FILE-ONLY-9f31c7';

async function main() {
  let interactionRequest: unknown;

  const google = createGoogle({
    fetch: async (input, init) => {
      const url = String(input);

      if (
        url.endsWith('/v1beta/interactions') &&
        typeof init?.body === 'string'
      ) {
        interactionRequest = JSON.parse(init.body);
      }

      const response = await fetch(input, init);
      return response;
    },
  });

  const { providerReference } = await uploadFile({
    api: google.files(),
    data: new TextEncoder().encode(
      `The secret verification code is ${secret}.`,
    ),
    filename: 'issue-17040.txt',
    mediaType: 'text/plain',
  });

  const result = await generateText({
    model: google.interactions('gemini-3.5-flash'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Return only the secret verification code from the attached text document.',
          },
          {
            type: 'file',
            data: providerReference,
            mediaType: 'text/plain',
          },
        ],
      },
    ],
  });

  const output = {
    providerReference,
    warnings: result.warnings,
    interactionRequest,
    responseText: result.text,
    expectedSecret: secret,
    responseContainsSecret: result.text.includes(secret),
  };

  console.log(JSON.stringify(output, null, 2));

  if (!result.text.includes(secret)) {
    throw new Error(
      'Reproduced issue #17040: the model could not read the uploaded text file because the ProviderReference file part was dropped.',
    );
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
