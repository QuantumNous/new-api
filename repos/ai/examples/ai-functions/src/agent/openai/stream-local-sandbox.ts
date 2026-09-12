import { printFullStream } from '../../lib/print-full-stream';
import { run } from '../../lib/run';
import { LocalSandboxSession } from '../../sandbox/local-sandbox';
import { sandboxAgent } from './sandbox-agent';

run(async () => {
  const sandbox = new LocalSandboxSession({
    rootDirectory: `${process.env.HOME}/Downloads`,
  });

  const result = await sandboxAgent.stream({
    prompt: 'List the files in the directory',
    experimental_sandbox: sandbox,
  });

  await printFullStream({ result });
});
