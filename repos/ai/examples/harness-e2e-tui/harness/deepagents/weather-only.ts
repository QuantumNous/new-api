import { weatherDeepAgentsHarnessAgent } from '../../agents/deepagents/weather-only-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherDeepAgentsHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Deep Agents — Weather',
});
