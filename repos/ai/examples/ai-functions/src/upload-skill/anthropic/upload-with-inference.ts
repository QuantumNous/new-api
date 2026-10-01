import {
  anthropic,
  type AnthropicLanguageModelOptions,
} from '@ai-sdk/anthropic';
import { generateText, uploadSkill } from 'ai';
import { readFileSync } from 'fs';
import { deleteUploadedAnthropicSkill } from '../../lib/delete-uploaded-skill';
import { run } from '../../lib/run';

run(async () => {
  const {
    providerReference,
    displayTitle,
    name,
    description,
    latestVersion,
    providerMetadata,
  } = await uploadSkill({
    api: anthropic.skills(),
    files: [
      {
        path: 'island-rescue/SKILL.md',
        data: readFileSync('data/island-rescue/SKILL.md'),
      },
    ],
    displayTitle: 'Island Rescue Test',
  });

  console.log('Provider reference:', providerReference);
  console.log('Display title:', displayTitle);
  console.log('Name:', name);
  console.log('Description:', description);
  console.log('Latest version:', latestVersion);
  console.log('Provider metadata:', providerMetadata);

  try {
    const result = await generateText({
      model: anthropic('claude-sonnet-4-5'),
      tools: {
        code_execution: anthropic.tools.codeExecution_20250825(),
      },
      prompt:
        'You are trapped and lost on a lonely island in 1895. Find a way to get rescued!',
      providerOptions: {
        anthropic: {
          container: {
            skills: [
              {
                type: 'custom',
                providerReference,
              },
            ],
          },
        } satisfies AnthropicLanguageModelOptions,
      },
    });

    console.log('Result:', result.text);
  } finally {
    try {
      await deleteUploadedAnthropicSkill({ providerReference });
      console.log('Deleted uploaded Anthropic skill.');
    } catch (error) {
      console.error('Failed to delete uploaded Anthropic skill:', error);
    }
  }
});
