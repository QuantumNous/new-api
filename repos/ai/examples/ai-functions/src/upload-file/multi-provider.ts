import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText, uploadFile } from 'ai';
import fs from 'node:fs';
import { run } from '../lib/run';

run(async () => {
  const fileData = fs.readFileSync('./data/ai.pdf');

  const [openaiUpload, anthropicUpload] = await Promise.all([
    uploadFile({
      api: openai.files(),
      data: fileData,
      filename: 'ai.pdf',
    }),
    uploadFile({
      api: anthropic.files(),
      data: fileData,
      filename: 'ai.pdf',
    }),
  ]);

  const mergedReference = {
    ...openaiUpload.providerReference,
    ...anthropicUpload.providerReference,
  };

  console.log('Merged provider reference:', mergedReference);
  console.log('OpenAI media type:', openaiUpload.mediaType);
  console.log('OpenAI filename:', openaiUpload.filename);
  console.log('Anthropic media type:', anthropicUpload.mediaType);
  console.log('Anthropic filename:', anthropicUpload.filename);

  /*
   * The same message array is used for both providers. Because the merged
   * reference contains entries for each provider, the SDK automatically
   * resolves the correct file ID at request time.
   */
  const messages = [
    {
      role: 'user' as const,
      content: [
        {
          type: 'text' as const,
          text: 'Summarize the key points from this document.',
        },
        {
          type: 'file' as const,
          data: mergedReference,
          mediaType: 'application/pdf',
        },
      ],
    },
  ];

  console.log('\n--- OpenAI Response ---');
  const openaiResult = await generateText({
    model: openai.responses('gpt-4o-mini'),
    messages,
  });
  console.log(openaiResult.text);

  console.log('\n--- Anthropic Follow-up ---');
  const anthropicResult = await generateText({
    model: anthropic('claude-sonnet-4-0'),
    messages: [
      ...messages,
      { role: 'assistant' as const, content: openaiResult.text },
      {
        role: 'user' as const,
        content:
          'What additional insights can you add to this summary? Are there any key points that were missed?',
      },
    ],
  });
  console.log(anthropicResult.text);
});
