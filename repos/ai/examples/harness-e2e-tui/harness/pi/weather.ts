import { weatherPiHarnessAgent } from '../../agents/pi/weather-agent';
import { runTUI } from '../../lib/run-tui';

await runTUI({
  agent: weatherPiHarnessAgent,
  entrypointUrl: import.meta.url,
  title: 'Pi — Weather',
});
