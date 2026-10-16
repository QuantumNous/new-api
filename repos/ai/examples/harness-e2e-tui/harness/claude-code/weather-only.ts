import { weatherClaudeCodeHarnessAgent } from '../../agents/claude-code/weather-only-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherClaudeCodeHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Claude Code — Weather',
});
