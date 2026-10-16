import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { run } from '../../lib/run';

run(async () => {
  const result = await generateText({
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

  console.log('Response:', result.text);

  const citations = result.content.filter(part => part.type === 'source');
  citations.forEach((citation, i) => {
    if (
      citation.sourceType === 'document' &&
      citation.providerMetadata?.anthropic
    ) {
      const meta = citation.providerMetadata.anthropic;
      console.log(
        `\n[${i + 1}] "${meta.citedText}" (chars: ${meta.startCharIndex}-${meta.endCharIndex})`,
      );
    }
  });
});
