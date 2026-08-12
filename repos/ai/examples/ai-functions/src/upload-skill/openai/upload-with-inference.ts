import { openai } from '@ai-sdk/openai';
import { generateText, uploadSkill } from 'ai';
import { readFileSync } from 'fs';
import { deleteUploadedOpenAISkill } from '../../lib/delete-uploaded-skill';
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
    api: openai.skills(),
    files: [
      {
        path: 'island-rescue/SKILL.md',
        data: readFileSync('data/island-rescue/SKILL.md'),
      },
    ],
  });

  console.log('Provider reference:', providerReference);
  console.log('Display title:', displayTitle);
  console.log('Name:', name);
  console.log('Description:', description);
  console.log('Latest version:', latestVersion);
  console.log('Provider metadata:', providerMetadata);

  try {
    // OpenAI's API will not find versions of a newly uploaded skill immediately, so we need to wait a bit.
    console.log('Waiting 15 seconds for skill to propagate...');
    await new Promise(resolve => setTimeout(resolve, 15000));

    const result = await generateText({
      model: openai.responses('gpt-5.2'),
      tools: {
        shell: openai.tools.shell({
          environment: {
            type: 'containerAuto',
            skills: [
              {
                type: 'skillReference',
                providerReference,
              },
            ],
          },
        }),
      },
      prompt:
        'You are trapped and lost on a lonely island in 1895. Find a way to get rescued!',
    });

    console.log('Result:', result.text);
  } finally {
    try {
      await deleteUploadedOpenAISkill({ providerReference });
      console.log('Deleted uploaded OpenAI skill.');
    } catch (error) {
      console.error('Failed to delete uploaded OpenAI skill:', error);
    }
  }
});
