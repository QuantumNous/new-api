import { weatherApprovalCodexHarnessAgent } from '../../agents/codex/weather-approval-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherApprovalCodexHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Codex — Weather Approval',
});
