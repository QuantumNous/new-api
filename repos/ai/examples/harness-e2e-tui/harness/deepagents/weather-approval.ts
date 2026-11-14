import { weatherApprovalDeepAgentsHarnessAgent } from '../../agents/deepagents/weather-approval-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherApprovalDeepAgentsHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Deep Agents — Weather Approval',
});
