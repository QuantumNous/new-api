import { aiSdkCodingDeepAgentsHarnessAgent } from '../../agents/deepagents/ai-sdk-coding-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: aiSdkCodingDeepAgentsHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Deep Agents — AI SDK Coding',
});
