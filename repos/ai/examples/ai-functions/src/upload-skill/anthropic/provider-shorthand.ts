import { anthropic } from '@ai-sdk/anthropic';
import { uploadSkill } from 'ai';
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
    api: anthropic,
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
    await deleteUploadedAnthropicSkill({ providerReference });
    console.log('Deleted uploaded Anthropic skill.');
  } catch (error) {
    console.error('Failed to delete uploaded Anthropic skill:', error);
  }
});
