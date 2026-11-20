import * as path from 'path';
import { defineConfig, mergeConfig } from 'vite';
import sharedConfig from '../vite.shared.config.mjs';

export default mergeConfig(
  sharedConfig,
  defineConfig({
    root: path.join(process.cwd(), 'test/e2e'),
  }),
);
