import type { RsbuildConfig } from '@rsbuild/core';
import distPathJson from './path.json';

export default {
  output: {
    distPath: distPathJson.distPath,
  },
} satisfies RsbuildConfig;
