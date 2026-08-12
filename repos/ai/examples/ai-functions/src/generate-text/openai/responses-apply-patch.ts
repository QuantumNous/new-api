import { openai } from '@ai-sdk/openai';
import { generateText, isStepCount } from 'ai';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createApplyPatchExecutor } from '../../lib/apply-patch-file-editor';
import { run } from '../../lib/run';

run(async () => {
  const workspaceRoot = path.join(__dirname, '../output');
  await fs.mkdir(workspaceRoot, { recursive: true });

  const result = await generateText({
    model: openai.responses('gpt-5.1'),
    tools: {
      apply_patch: openai.tools.applyPatch({
        execute: createApplyPatchExecutor(workspaceRoot),
      }),
    },
    prompt: `Create a markdown file with a shopping checklist of 5 entries.`,
    stopWhen: isStepCount(5),
  });

  console.log('\n=== Result ===');
  console.log('Text:', result.text);
  console.log('\nFiles saved in:', workspaceRoot);

  // List created files
  const files = await fs.readdir(workspaceRoot);
  for (const file of files) {
    const filePath = path.join(workspaceRoot, file);
    const content = await fs.readFile(filePath, 'utf8');
    console.log(`\n=== ${file} ===`);
    console.log(content);
  }
});
