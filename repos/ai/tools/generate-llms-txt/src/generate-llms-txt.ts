#!/usr/bin/env tsx

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await getAllFiles(fullPath)));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}

const exclusionPrefixes = [
  'cookbook/01-next',
  'cookbook/05-node',
  'cookbook/15-api-servers/index',
  'cookbook/20-rsc',
  'docs/01-introduction',
  'docs/02-foundations',
  'docs/02-getting-started',
  'docs/02-guides',
  'docs/03-ai-sdk-core/index',
  'docs/04-ai-sdk-ui/index',
  'docs/04-ai-sdk-ui/50-stream-protocol',
  'docs/05-ai-sdk-rsc',
  'docs/06-advanced',
  'docs/07-reference/index',
  'docs/07-reference/01-ai-sdk-core',
  'docs/07-reference/02-ai-sdk-ui',
  'docs/07-reference/03-ai-sdk-rsc',
  'docs/07-reference/04-stream-helpers',
  'docs/07-reference/05-ai-sdk-errors/index',
  'docs/08-migration-guides',
  'docs/09-troubleshooting',
  'providers/01-ai-sdk-providers/index',
  'providers/02-openai-compatible-providers/01-custom-providers',
  'providers/02-openai-compatible-providers/40-baseten',
  'providers/04-openai-compatible-providers/01-custom-providers',
  'providers/04-openai-compatible-providers/40-baseten',
  'providers/03-community-providers',
  'providers/05-community-providers',
  'providers/04-adapters',
  'providers/06-adapters',
  'providers/05-observability',
  'providers/03-observability',
];

async function main() {
  try {
    const contentDir = join(process.cwd(), '../../content');
    const files = await getAllFiles(contentDir);

    const filteredFiles = files.filter(file => {
      for (const prefix of exclusionPrefixes) {
        if (file.includes(prefix)) {
          return false;
        }
      }
      return true;
    });

    console.log(filteredFiles.join('\n'));
    console.log();

    let fullContent = '';
    for (const file of filteredFiles) {
      const content = await readFile(file, 'utf-8');

      fullContent += content;
      fullContent += '\n\n';
    }

    console.log(`Length (chars        ): ${fullContent.length}`);
    console.log(`Length (approx tokens): ${fullContent.length / 4}`);

    // write to llms.txt
    await writeFile('llms.txt', fullContent);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
