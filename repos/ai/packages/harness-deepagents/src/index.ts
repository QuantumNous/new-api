import { createDeepAgents } from './deepagents-harness';

/** Default `deepagents` harness instance; equivalent to `createDeepAgents()`. */
export const deepAgents = createDeepAgents();

export { createDeepAgents } from './deepagents-harness';
export { VERSION } from './version';
export type { DeepAgentsHarnessSettings } from './deepagents-harness';
export type { DeepAgentsAuthOptions } from './deepagents-auth';
