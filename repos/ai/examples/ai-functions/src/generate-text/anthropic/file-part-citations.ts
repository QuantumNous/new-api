import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { run } from '../../lib/run';

run(async () => {
  const pdfPath = resolve(process.cwd(), 'data', 'ai.pdf');
  const pdfBase64 = readFileSync(pdfPath).toString('base64');

  const result = await generateText({
    model: anthropic('claude-3-5-sonnet-20241022'),
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What is generative AI? Use citations.',
          },
          {
            type: 'file',
            data: `data:application/pdf;base64,${pdfBase64}`,
            mediaType: 'application/pdf',
            providerOptions: {
              anthropic: {
                citations: { enabled: true },
                title: 'AI Documentation',
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
        `\n[${i + 1}] "${meta.citedText}" (Pages: ${meta.startPageNumber}-${meta.endPageNumber})`,
      );
    }
  });
});
