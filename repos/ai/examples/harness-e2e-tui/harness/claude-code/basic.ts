import { claudeCodeHarnessAgent } from '../../agents/claude-code/basic-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: claudeCodeHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Claude Code — Basic',
});
