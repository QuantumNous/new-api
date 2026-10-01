import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HarnessAgent, HarnessAgentSession } from '@ai-sdk/harness/agent';
import {
  runAgentTUI,
  type AgentTUIAgent,
  type RunAgentTUIOptions,
} from '@ai-sdk/tui';
import { config } from 'dotenv';

type TUIHarnessAgent = HarnessAgent<any, any, any>;

export type RunTUIOptions = Omit<
  Extract<RunAgentTUIOptions, { agent: AgentTUIAgent }>,
  'agent'
> & {
  agent: TUIHarnessAgent;
  entrypointUrl: string;
};

export async function runTUI(options: RunTUIOptions) {
  const { agent, entrypointUrl, ...tuiOptions } = options;
  loadEnvFiles({ entrypointUrl });

  let session: HarnessAgentSession | undefined;

  try {
    session = await agent.createSession();
    await runAgentTUI({
      ...tuiOptions,
      agent: createTUIAgent({ agent, session }),
    });
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await session?.destroy().catch(() => {});
  }
}

function createTUIAgent(options: {
  agent: TUIHarnessAgent;
  session: HarnessAgentSession;
}): AgentTUIAgent {
  const { agent, session } = options;

  return {
    version: 'agent-v1',
    id: agent.id,
    tools: agent.tools,
    generate(request: Parameters<AgentTUIAgent['generate']>[0]) {
      return agent.generate(
        withSession({ request, session }) as Parameters<
          typeof agent.generate
        >[0],
      );
    },
    stream(request: Parameters<AgentTUIAgent['stream']>[0]) {
      return agent.stream(
        withSession({ request, session }) as Parameters<typeof agent.stream>[0],
      );
    },
  } as AgentTUIAgent;
}

function withSession({
  request,
  session,
}: {
  request: unknown;
  session: HarnessAgentSession;
}) {
  const requestObject =
    typeof request === 'object' && request !== null ? request : {};
  return {
    ...requestObject,
    session,
  };
}

function loadEnvFiles(options: { entrypointUrl: string }) {
  const entrypointDir = dirname(fileURLToPath(options.entrypointUrl));
  const cwd = process.cwd();
  const dirs = entrypointDir === cwd ? [entrypointDir] : [entrypointDir, cwd];
  const envFiles = ['.env.local', '.env'];
  const loaded = new Set<string>();

  for (const dir of dirs) {
    for (const envFile of envFiles) {
      const path = `${dir}/${envFile}`;
      if (loaded.has(path) || !existsSync(path)) {
        continue;
      }
      config({ path });
      loaded.add(path);
    }
  }
}
