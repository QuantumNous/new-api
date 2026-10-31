#!/usr/bin/env node

import { startViewer } from '../dist/viewer/server.js';

const port = process.env.AI_SDK_DEVTOOLS_PORT
  ? parseInt(process.env.AI_SDK_DEVTOOLS_PORT)
  : 4983;

startViewer(port);
