import { weatherCodexHarnessAgent } from '../../agents/codex/weather-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherCodexHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Codex — Weather',
});
