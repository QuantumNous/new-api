import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText, uploadSkill } from 'ai';
import { readFileSync } from 'fs';
import {
  deleteUploadedAnthropicSkill,
  deleteUploadedOpenAISkill,
} from '../lib/delete-uploaded-skill';
import { run } from '../lib/run';

run(async () => {
  const skillSource = readFileSync('data/island-rescue/SKILL.md');

  const [openaiUpload, anthropicUpload] = await Promise.all([
    uploadSkill({
      api: openai.skills(),
      files: [
        {
          path: 'island-rescue/SKILL.md',
          data: skillSource,
        },
      ],
    }),
    uploadSkill({
      api: anthropic.skills(),
      files: [
        {
          path: 'island-rescue/SKILL.md',
          data: skillSource,
        },
      ],
      displayTitle: 'Island Rescue Test',
    }),
  ]);

  const mergedReference = {
    ...openaiUpload.providerReference,
    ...anthropicUpload.providerReference,
  };

  console.log('Merged provider reference:', mergedReference);

  const messages = [
    {
      role: 'user' as const,
      content:
        'You are trapped and lost on a lonely island in 1895. Find a way to get rescued!',
    },
  ];

  try {
    // OpenAI's API will not find versions of a newly uploaded skill immediately, so we need to wait a bit.
    console.log('Waiting 15 seconds for skill to propagate...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log('\n--- OpenAI Response ---');
    const openaiResult = await generateText({
      model: openai.responses('gpt-5.2'),
      tools: {
        shell: openai.tools.shell({
          environment: {
            type: 'containerAuto',
            skills: [
              {
                type: 'skillReference',
                providerReference: mergedReference,
              },
            ],
          },
        }),
      },
      messages,
    });
    console.log(openaiResult.text);

    console.log('\n--- Anthropic Response ---');
    const anthropicResult = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      tools: {
        code_execution: anthropic.tools.codeExecution_20250825(),
      },
      messages,
      providerOptions: {
        anthropic: {
          container: {
            skills: [
              {
                type: 'custom',
                providerReference: mergedReference,
              },
            ],
          },
        } satisfies AnthropicLanguageModelOptions,
      },
    });
    console.log(anthropicResult.text);
  } finally {
    try {
      await deleteUploadedOpenAISkill({
        providerReference: openaiUpload.providerReference,
      });
      console.log('Deleted uploaded OpenAI skill.');
    } catch (error) {
      console.error('Failed to delete uploaded OpenAI skill:', error);
    }

    try {
      await deleteUploadedAnthropicSkill({
        providerReference: anthropicUpload.providerReference,
      });
      console.log('Deleted uploaded Anthropic skill.');
    } catch (error) {
      console.error('Failed to delete uploaded Anthropic skill:', error);
    }
  }
});
