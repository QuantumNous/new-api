import {
  HarnessAgent,
  prepareSandboxForHarness,
  type HarnessAgentAdapter,
  type HarnessAgentSandboxConfig,
} from '@ai-sdk/harness/agent';
import { claudeCode } from '@ai-sdk/harness-claude-code';
import { codex } from '@ai-sdk/harness-codex';
import { deepAgents } from '@ai-sdk/harness-deepagents';
import { openCode } from '@ai-sdk/harness-opencode';
import { pi } from '@ai-sdk/harness-pi';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';
import { Sandbox } from '@vercel/sandbox';
import { run } from '../lib/run';

const sandboxTimeout = 10 * 60 * 1000;
const bridgePort = 4000;

const harnesses = [
  { name: 'claude-code', harness: claudeCode },
  { name: 'codex', harness: codex },
  { name: 'deepagents', harness: deepAgents },
  { name: 'opencode', harness: openCode },
  { name: 'pi', harness: pi },
] satisfies ReadonlyArray<{
  name: string;
  harness: HarnessAgentAdapter;
}>;

const sandboxConfig = {
  workDir: 'workspace',
  bootstrapHash: 'prepare-sandbox-for-harness-example-v1',
  onBootstrap: async ({ session, workDir, abortSignal }) => {
    await session.writeTextFile({
      path: `${workDir}/PREPARED.md`,
      content: 'This file was written before the shared sandbox snapshot.\n',
      abortSignal,
    });
  },
  onSession: async ({ session, sessionWorkDir, abortSignal }) => {
    await session.writeTextFile({
      path: `${sessionWorkDir}/SESSION.md`,
      content: 'This file was written for the current harness session.\n',
      abortSignal,
    });
  },
} satisfies HarnessAgentSandboxConfig;

run(async () => {
  const preparedSandbox = await Sandbox.create({
    runtime: 'node24',
    ports: [bridgePort],
    timeout: sandboxTimeout,
  });

  const snapshotId = await createPreparedSnapshot(preparedSandbox);
  console.log('prepared snapshot:', snapshotId);

  for (const { name, harness } of harnesses) {
    await runHarnessFromSnapshot({ name, harness, snapshotId });
  }
});

async function createPreparedSnapshot(
  preparedSandbox: Awaited<ReturnType<typeof Sandbox.create>>,
): Promise<string> {
  try {
    const provider = createVercelSandbox({ sandbox: preparedSandbox });
    const session = await provider.createSession();
    const result = await prepareSandboxForHarness({
      session: session.restricted(),
      harnesses: harnesses.map(({ harness }) => harness),
      sandboxConfig,
    });

    console.log('prepared identity:', result.identity);
    console.log('recipe identities:', result.recipeIdentities);
    console.log('skipped harnesses:', result.skippedHarnessIds);

    const stopResult = await preparedSandbox.stop();
    const snapshotId = stopResult.snapshot?.id;
    if (snapshotId == null) {
      throw new Error('Prepared sandbox stopped without creating a snapshot.');
    }
    return snapshotId;
  } catch (error) {
    await preparedSandbox.stop().catch(() => {});
    throw error;
  }
}

async function runHarnessFromSnapshot({
  name,
  harness,
  snapshotId,
}: {
  readonly name: string;
  readonly harness: HarnessAgentAdapter;
  readonly snapshotId: string;
}): Promise<void> {
  const sandbox = await Sandbox.create({
    source: { type: 'snapshot', snapshotId },
    ports: [bridgePort],
    timeout: sandboxTimeout,
  });
  const agent = new HarnessAgent({
    harness,
    sandbox: createVercelSandbox({
      sandbox,
      bridgePorts: [bridgePort],
    }),
    sandboxConfig,
  });
  const session = await agent.createSession().catch(async error => {
    await sandbox.stop().catch(() => {});
    throw error;
  });

  try {
    const result = await agent.generate({
      session,
      prompt: 'In one sentence, what is the capital of France?',
    });
    console.log(`[${name}]`, result.text);
  } finally {
    await session.destroy().catch(() => {});
    await sandbox.stop().catch(() => {});
  }
}
