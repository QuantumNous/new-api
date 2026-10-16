import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = streamText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What color is the grass? Use citations.',
          },
          {
            type: 'file',
            mediaType: 'text/plain',
            data: 'The grass is green in spring and summer. The sky is blue during clear weather.',
            providerOptions: {
              anthropic: {
                citations: { enabled: true },
                title: 'Nature Facts',
              },
            },
          },
        ],
      },
    ],
  });

  let citationCount = 0;

  for await (const part of result.stream) {
    switch (part.type) {
      case 'text-delta':
        process.stdout.write(part.text);
        break;

      case 'source':
        if (
          part.sourceType === 'document' &&
          part.providerMetadata?.anthropic
        ) {
          const meta = part.providerMetadata.anthropic;
          console.log(
            `\n\n[${++citationCount}] "${meta.citedText}" (chars: ${meta.startCharIndex}-${meta.endCharIndex})`,
          );
        }
        break;
    }
  }

  console.log(`\n\nTotal citations: ${citationCount}`);
});
