import type { UserModelMessage } from '@ai-sdk/provider-utils';

/**
 * Prompt shape passed to `HarnessV1Session.doPromptTurn`.
 *
 * A harness session represents an ongoing third-party agent runtime that
 * owns its own conversation history. Each prompt turn carries only the
 * fresh user input for that turn, either as a plain string or as a single
 * `UserModelMessage`.
 */
export type HarnessV1Prompt = string | UserModelMessage;
