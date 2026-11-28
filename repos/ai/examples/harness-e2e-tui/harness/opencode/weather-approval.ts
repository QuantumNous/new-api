import { weatherApprovalOpenCodeHarnessAgent } from '../../agents/opencode/weather-approval-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherApprovalOpenCodeHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'OpenCode — Weather Approval',
});
