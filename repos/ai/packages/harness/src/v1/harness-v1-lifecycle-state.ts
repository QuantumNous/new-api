import type { JSONValue } from '@ai-sdk/provider';

export type HarnessV1PendingToolApproval = {
  readonly approvalId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly input: string;
  readonly kind: 'builtin' | 'custom';
  readonly providerExecuted?: boolean;
  readonly nativeName?: string;
};

type HarnessV1LifecycleStateBase = {
  /**
   * Identifier of the harness that produced this state. Used by adapters to
   * refuse mismatched payloads.
   */
  readonly harnessId: string;

  /**
   * Spec version of the harness that produced this state.
   */
  readonly specificationVersion: 'harness-v1';

  /**
   * Adapter-defined payload. May be persisted as JSON; the adapter is
   * responsible for any necessary encoding.
   */
  readonly data: JSONValue;
};

/**
 * Opaque payload returned by between-turn session lifecycle methods and
 * accepted by a future `HarnessV1.doStart({ resumeFrom })` to resume the same
 * underlying session before starting a new turn.
 */
export type HarnessV1ResumeSessionState = HarnessV1LifecycleStateBase & {
  readonly type: 'resume-session';

  /**
   * Optional unfinished-turn state. When present, the session must be resumed
   * before the turn is continued.
   */
  readonly continueFrom?: HarnessV1ContinueTurnState;
};

/**
 * Opaque payload returned by `doSuspendTurn` and accepted by a future
 * `HarnessV1.doStart({ continueFrom })` to reconnect to the same session before
 * continuing the interrupted turn.
 */
export type HarnessV1ContinueTurnState = HarnessV1LifecycleStateBase & {
  readonly type: 'continue-turn';

  /**
   * Framework-owned pending approval records. These are intentionally outside
   * adapter-defined `data` so callers can persist the entire lifecycle payload
   * without the harness framework owning storage.
   */
  readonly pendingToolApprovals?: readonly HarnessV1PendingToolApproval[];
};

export type HarnessV1LifecycleState =
  | HarnessV1ResumeSessionState
  | HarnessV1ContinueTurnState;
