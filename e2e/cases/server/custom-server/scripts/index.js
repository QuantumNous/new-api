import { startDevServerPure } from './pureServer.js';
import { startDevServer } from './server.js';

const isPure = process.argv[2] === 'pure';

if (isPure) {
  startDevServerPure(process.cwd());
} else {
  startDevServer(process.cwd());
}
