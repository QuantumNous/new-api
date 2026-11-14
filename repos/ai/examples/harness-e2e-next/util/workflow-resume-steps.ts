import type { HarnessV1ResumeSessionState } from '@ai-sdk/harness';
import { safeParseJSON } from '@ai-sdk/provider-utils';

/*
 * Cross-user-turn resume persistence for the harness *workflow* routes, as
 * `'use step'` functions.
 *
 * The plain `harness-resume-store` can't be used here: the Workflow DevKit
 * forbids `node:fs`/`node:path` anywhere in a workflow route's scanned import
 * graph (including the POST handler and any helper module it reaches), and only
 * permits Node APIs lexically inside a `'use step'`. So these steps inline the
 * fs access via dynamically-imported builtins. A workflow run calls
 * `loadResumeStep` first (to seed the prior turn's handle) and `persistResumeStep`
 * last (to checkpoint for the next turn); both run in real Node as durable steps.
 *
 * Files live under the git-ignored `.harness-sessions/` directory, keyed by the
 * chat id (which is the harness `sessionId`) — the same files the non-workflow
 * `harness-resume-store` reads/writes, so the two stay interchangeable.
 */
const RESUME_DIR = '.harness-sessions';

function fileName(sessionId: string): string {
  return `${sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
}

/** Load the handle persisted after this chat's previous turn, if any. */
export async function loadResumeStep(
  sessionId: string,
): Promise<HarnessV1ResumeSessionState | undefined> {
  'use step';

  const { readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  let text: string;
  try {
    text = await readFile(
      join(process.cwd(), RESUME_DIR, fileName(sessionId)),
      'utf8',
    );
  } catch {
    return undefined;
  }
  const parsed = await safeParseJSON({ text });
  return parsed.success
    ? (parsed.value as unknown as HarnessV1ResumeSessionState)
    : undefined;
}

/** Checkpoint the handle for the next turn. No-op when there is nothing to save. */
export async function persistResumeStep(
  sessionId: string,
  resumeState: HarnessV1ResumeSessionState | undefined,
): Promise<void> {
  'use step';

  if (!resumeState) return;
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const dir = join(process.cwd(), RESUME_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName(sessionId)), JSON.stringify(resumeState));
}
