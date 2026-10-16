import { deepAgentsHarnessAgent } from '../../agents/deepagents/basic-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: deepAgentsHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Deep Agents — Basic',
});
