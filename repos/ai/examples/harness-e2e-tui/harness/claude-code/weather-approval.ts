import { weatherApprovalClaudeCodeHarnessAgent } from '../../agents/claude-code/weather-approval-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherApprovalClaudeCodeHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Claude Code — Weather Approval',
});
