import { defineConfig, type OutputConfig } from '@rsbuild/core';

export default defineConfig({
  output: {
    // invalid target for testing
    target: 'foo',
  } as unknown as OutputConfig,
});
