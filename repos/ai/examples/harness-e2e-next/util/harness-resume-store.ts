import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  HarnessAgentResumeSessionState,
  HarnessAgentSession,
} from '@ai-sdk/harness/agent';
import { safeParseJSON } from '@ai-sdk/provider-utils';

/*
 * Durable, cross-process resume store for every harness chat route.
 *
 * Instead of holding the (non-serializable) live session in an in-memory
 * registry, we persist only the serializable payload returned by `detach()`
 * or `stop()` and reattach with `createSession({ sessionId, resumeFrom })` on
 * the next request — even in a fresh server process. Routes that want to keep
 * the sandbox warm use `detach()`: bridge-backed harnesses usually resume by
 * `attach`/`replay`, while host-resident harnesses may resume by `rerun`.
 *
 * Files live under the git-ignored `.harness-sessions/` directory, keyed by
 * chat id. The chat id doubles as the `sessionId`, so the deterministic sandbox
 * name is derived from it and a fresh process resolves the same sandbox via
 * `provider.resumeSession` (`Sandbox.get`) rather than colliding on `provider.createSession`.
 */
const STORE_DIR = path.join(process.cwd(), '.harness-sessions');

function fileFor(chatId: string): string {
  const safe = chatId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(STORE_DIR, `${safe}.json`);
}

async function loadResumeState(
  chatId: string,
): Promise<HarnessAgentResumeSessionState | undefined> {
  let text: string;
  try {
    text = await readFile(fileFor(chatId), 'utf8');
  } catch {
    return undefined;
  }
  const parsed = await safeParseJSON({ text });
  return parsed.success
    ? (parsed.value as unknown as HarnessAgentResumeSessionState)
    : undefined;
}

async function saveResumeState(
  chatId: string,
  state: HarnessAgentResumeSessionState,
): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(fileFor(chatId), JSON.stringify(state), 'utf8');
}

type SessionFactory = {
  createSession(options?: {
    sessionId?: string;
    resumeFrom?: HarnessAgentResumeSessionState;
  }): Promise<HarnessAgentSession>;
};

/**
 * Resume the chat when we have persisted state, otherwise start a fresh
 * session. `chatId` doubles as the `sessionId` so the sandbox name is stable
 * across processes.
 */
export async function resumeOrCreateSession(
  agent: SessionFactory,
  chatId: string,
): Promise<HarnessAgentSession> {
  const resumeFrom = await loadResumeState(chatId);
  return agent.createSession(
    resumeFrom ? { sessionId: chatId, resumeFrom } : { sessionId: chatId },
  );
}

/**
 * Park a session after the turn and persist the returned state. The sandbox
 * keeps running for the next request.
 */
export async function detachAndPersist(
  chatId: string,
  session: HarnessAgentSession,
): Promise<void> {
  try {
    await saveResumeState(chatId, await session.detach());
  } catch (error) {
    // Non-fatal: the turn already streamed to the client, and the next request
    // just resumes from the previous checkpoint (or starts cold). Surfaced so a
    // misconfiguration (unwritable dir, failed save) doesn't fail silently and
    // leave resume quietly broken.
    console.error(`[harness] failed to detach+persist for ${chatId}:`, error);
  }
}

/**
 * Stop a session after the turn and persist the returned state. The next
 * request resumes from saved state instead of attaching to a parked runtime.
 */
export async function stopAndPersist(
  chatId: string,
  session: HarnessAgentSession,
): Promise<void> {
  try {
    await saveResumeState(chatId, await session.stop());
  } catch (error) {
    // Non-fatal: the turn already streamed to the client. A failed stop just
    // means the next request starts cold. Surfaced rather than swallowed.
    console.error(`[harness] failed to stop+persist for ${chatId}:`, error);
  }
}
