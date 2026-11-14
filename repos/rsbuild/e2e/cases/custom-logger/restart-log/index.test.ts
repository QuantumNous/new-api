import path from 'node:path';
import { test } from '@e2e/helper';
import fse from 'fs-extra';

test('should use customLogger for restart logs', async ({ execCli, logHelper }) => {
  const tempConfig = path.join(import.meta.dirname, 'test-temp-rsbuild.config.mjs');
  const configCode = `import { createLogger, defineConfig } from '@rsbuild/core';

const customLogger = createLogger();

customLogger.override({
  info(message) {
    console.log(\`[CUSTOM_INFO] \${message}\`);
  },
});

export default defineConfig({
  customLogger,
  output: {
    filenameHash: false,
  },
});
`;

  fse.outputFileSync(tempConfig, configCode);

  execCli(`build --watch -c ${tempConfig}`);
  const { expectBuildEnd, expectLog } = logHelper;

  await expectBuildEnd();

  fse.outputFileSync(tempConfig, `${configCode}\n// update\n`);

  await expectLog('[CUSTOM_INFO] restarting build');
});
