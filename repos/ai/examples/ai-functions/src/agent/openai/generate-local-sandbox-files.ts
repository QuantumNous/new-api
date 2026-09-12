import { tmpdir } from 'node:os';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from '../../lib/run';
import { LocalSandboxSession } from '../../sandbox/local-sandbox';
import { sandboxAgent } from './sandbox-agent';

run(async () => {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'local-sandbox-files-'));
  const sandbox = new LocalSandboxSession({ rootDirectory });

  const result = await sandboxAgent.generate({
    prompt:
      'Write a haiku about TypeScript to a file named "haiku.txt", then read it back and summarize what it says.',
    experimental_sandbox: sandbox,
  });

  console.log(result.text);
});
