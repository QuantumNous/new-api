import fs from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@e2e/helper';
import fse from 'fs-extra';

test.afterAll(() => {
  const files = fs.readdirSync(import.meta.dirname);
  for (const file of files) {
    if (file.startsWith('.rspack-profile')) {
      fse.removeSync(join(import.meta.dirname, file));
    }
  }
  fse.removeSync(join(import.meta.dirname, 'custom-profile'));
});

const PROFILE_LOG = 'profile file saved to';
const CUSTOM_PROFILE_LOG = 'custom-profile/rspack.log';

const getProfilePath = (logs: string[]) =>
  logs
    .find((log) => log.includes(PROFILE_LOG))
    ?.split(PROFILE_LOG)[1]
    ?.trim();

const expectRspackProfileFile = (logs: string[]) => {
  const profileFile = getProfilePath(logs);
  expect(profileFile).toContain('rspack.log');
  expect(fs.existsSync(profileFile!)).toBeTruthy();
};

test('should generate rspack profile as expected in dev', async ({ exec, logHelper }) => {
  exec('node ./dev.js', {
    env: {
      RSPACK_PROFILE: 'OVERVIEW',
    },
  });
  const { logs, expectLog } = logHelper;

  await expectLog(PROFILE_LOG);
  expectRspackProfileFile(logs);
});

test('should generate rspack profile as expected in build', async ({ execCli, logHelper }) => {
  execCli('build', {
    env: {
      RSPACK_PROFILE: 'OVERVIEW',
    },
  });
  const { logs, expectLog } = logHelper;

  await expectLog(PROFILE_LOG);
  expectRspackProfileFile(logs);
});

test('should write rspack profile to stdout', ({ execCliSync }) => {
  const logs = execCliSync('build', {
    env: {
      RSPACK_PROFILE: 'rspack_binding_api=info',
      RSPACK_TRACE_OUTPUT: 'stdout',
    },
  });

  expect(logs).toContain('"target":"rspack_binding_api"');
  expect(logs).not.toContain(PROFILE_LOG);
});

test('should respect custom rspack profile output path', async ({ execCli, logHelper }) => {
  execCli('build', {
    env: {
      RSPACK_PROFILE: 'OVERVIEW',
      RSPACK_TRACE_OUTPUT: CUSTOM_PROFILE_LOG,
    },
  });
  const { logs, expectLog } = logHelper;

  await expectLog(PROFILE_LOG);
  const profileFile = getProfilePath(logs);
  const normalizedProfileFile = profileFile?.replaceAll('\\', '/');
  expect(normalizedProfileFile).toContain('/.rspack-profile-');
  expect(normalizedProfileFile).toContain(CUSTOM_PROFILE_LOG);
  expect(fs.existsSync(profileFile!)).toBeTruthy();
});
