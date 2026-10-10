import {
  type ChildProcess,
  type ExecSyncOptions,
  execSync,
  type SpawnOptions,
  spawn as nodeSpawn,
} from 'node:child_process';
import { constants as fsConstants, promises } from 'node:fs';
import path from 'node:path';
import base, { expect } from '@playwright/test';
import {
  copyNodeModules as baseCopyNodeModules,
  editFile as baseEditFile,
  type FileEditor,
  prepareDist as basePrepareDist,
} from '@rstackjs/test-utils';
import fse from 'fs-extra';
import { RSBUILD_BIN_PATH } from './constants.ts';
import {
  type Build,
  type BuildOptions,
  type BuildResult,
  build as baseBuild,
  dev as baseDev,
  type Dev,
  type DevOptions,
  type DevResult,
} from './jsApi.ts';
import { type ExtendedLogHelper, proxyConsole } from './logs.ts';

function makeBox(title: string) {
  const header = `╭────────────  Logs from: "${title}" ────────────╮`;
  const footer = `╰────────────  Logs from: "${title}" ────────────╯`;
  return {
    header: `\n${header}\n`,
    footer: `${footer}\n`,
  };
}

type EditFile = (filename: string, editor: FileEditor) => Promise<void>;

type Exec = (
  command: string,
  options?: SpawnOptions,
) => {
  childProcess: ChildProcess;
};

type ExecSync = (command: string, options?: ExecSyncOptions) => string;

type SharedAssertionContext =
  | {
      mode: 'dev';
      result: DevResult;
    }
  | {
      mode: 'build';
      result: BuildResult;
    };

type RunBoth = (
  assert: (context: SharedAssertionContext) => Promise<void> | void,
  options?: DevOptions | BuildOptions,
) => Promise<void>;

type CopyNodeModules = () => Promise<string>;

type PrepareDist = (distFolderName?: string) => Promise<string>;

type RsbuildFixture = {
  /**
   * Absolute working directory of the current test file.
   */
  cwd: string;

  /**
   * Helper to capture and assert console logs.
   * Proxies console methods and collects log lines for assertions.
   * @example
   * // Wait for a specific log line
   * await logHelper.expectLog('some message');
   * // Assert there is no error output
   * logHelper.expectNoLog(/error/);
   * // Clear collected logs
   * logHelper.clearLogs();
   */
  logHelper: ExtendedLogHelper;
  /**
   * Build the project. No preview server or page navigation by default.
   * Uses the test file's cwd.
   * The fixture auto-closes after the test.
   */
  build: Build;
  /**
   * Build the project, start a preview server, and auto-navigate the Playwright page.
   * Uses the test file's cwd.
   * The fixture auto-closes after the test.
   */
  buildPreview: Build;
  /**
   * Prepare a dist folder by removing it from the test file's cwd.
   * @param distFolderName The dist folder name. Defaults to `dist`.
   * @returns The absolute path of the removed dist folder.
   * @example
   * const distPath = await prepareDist();
   * const distWebPath = await prepareDist('dist-web');
   */
  prepareDist: PrepareDist;
  /**
   * Copies the source directory to a temporary directory for testing purposes.
   */
  copySrcDir: () => Promise<string>;
  /**
   * Copy _node_modules to node_modules in the test file's cwd.
   * @returns The copied node_modules path.
   * @example
   * await copyNodeModules();
   */
  copyNodeModules: CopyNodeModules;
  /**
   * Start the dev server and auto-navigate the Playwright page.
   * Uses the test file's cwd.
   * Waits for the first compile by default.
   * The fixture auto-closes after the test.
   */
  dev: Dev;
  /**
   * Start the dev server without page navigation.
   * Uses the test file's cwd.
   * The fixture auto-closes after the test.
   */
  devOnly: Dev;
  /**
   * Run shared assertions for devOnly and build in one call.
   */
  runBoth: RunBoth;
  /**
   * Run shared assertions for both served dev and preview build in one call.
   */
  runBothServe: RunBoth;
  /**
   * Edit a file in the test file's cwd.
   * @param filename The filename. If it is not absolute, it will be resolved
   * relative to the test file's cwd.
   * @param editor The editor function, which may be sync or async.
   * @example
   * await editFile('src/index.ts', (code) =>
   *   code.replace('Hello', 'Hi'),
   * );
   */
  editFile: EditFile;
  /**
   * Execute a command in the test file's cwd.
   * The child process is auto-killed after the test.
   * @param command The command to execute.
   * @param options Optional execution options.
   * @returns An object containing the child process.
   * @example
   * const { childProcess } = exec('npm run build');
   */
  exec: Exec;
  /**
   * Execute an Rsbuild CLI command in the test file's cwd.
   * The child process is auto-killed after the test.
   * @param command The CLI command to execute (without 'rsbuild' prefix).
   * @param options Optional execution options.
   * @returns An object containing the child process.
   * @example
   * const { childProcess } = execCli('build --watch');
   */
  execCli: Exec;
  /**
   * Execute an Rsbuild CLI command synchronously in the test file's cwd.
   * @param command The CLI command to execute (without 'rsbuild' prefix).
   * @param options Optional execution options.
   * @example
   * execCliSync('build', {
   *   // ...options
   * });
   */
  execCliSync: ExecSync;
};

type Close = DevResult['close'];

const setupExecOptions = <T extends SpawnOptions | ExecSyncOptions>(options: T, cwd: string): T => {
  // inherit process.env from current process
  const { NODE_ENV: _, ...restEnv } = process.env;
  options.env ||= {};
  options.env = { ...restEnv, ...options.env };
  options.cwd ||= cwd;
  return options;
};

export const test = base.extend<RsbuildFixture>({
  // rslint-disable-next-line no-empty-pattern
  cwd: async ({}, use, { file }) => {
    const cwd = path.dirname(file);
    await use(cwd);
  },

  logHelper: [
    // rslint-disable-next-line no-empty-pattern
    async ({}, use, testInfo) => {
      const logHelper = proxyConsole();
      await use(logHelper);
      logHelper.restore();

      // If the test failed, log the console output for debugging
      if (testInfo.status !== testInfo.expectedStatus && logHelper.logs.length) {
        const { header, footer } = makeBox(testInfo.title);
        console.log(header);
        logHelper.printCapturedLogs();
        console.log(footer);
      }
    },
    { auto: true },
  ],

  build: async ({ cwd, logHelper }, use) => {
    const closes: Close[] = [];
    const build: typeof baseBuild = async (options) => {
      const result = await baseBuild({ cwd, logHelper, ...options });
      closes.push(result.close);
      return result;
    };

    try {
      await use(build);
    } finally {
      for (const close of closes) {
        await close();
      }
    }
  },

  buildPreview: async ({ cwd, page, logHelper }, use) => {
    const closes: Close[] = [];
    const build: typeof baseBuild = async (options) => {
      const result = await baseBuild({ cwd, page, logHelper, ...options });
      closes.push(result.close);
      return result;
    };

    try {
      await use(build);
    } finally {
      for (const close of closes) {
        await close();
      }
    }
  },

  prepareDist: async ({ cwd }, use) => {
    const prepareDist: PrepareDist = (distFolderName = 'dist') =>
      basePrepareDist(path.join(cwd, distFolderName));
    await use(prepareDist);
  },

  dev: async ({ cwd, page, logHelper }, use) => {
    const closes: Close[] = [];
    const dev: typeof baseDev = async (options) => {
      const result = await baseDev({ cwd, page, logHelper, ...options });
      closes.push(result.close);
      return result;
    };

    try {
      await use(dev);
    } finally {
      for (const close of closes) {
        await close();
      }
    }
  },

  devOnly: async ({ cwd, logHelper }, use) => {
    const closes: Close[] = [];
    const dev: typeof baseDev = async (options) => {
      const result = await baseDev({ cwd, logHelper, ...options });
      closes.push(result.close);
      return result;
    };

    try {
      await use(dev);
    } finally {
      for (const close of closes) {
        await close();
      }
    }
  },

  runBoth: async ({ devOnly, build }, use) => {
    await use(async (assert, options) => {
      const devResult = await devOnly(options);
      await assert({ mode: 'dev', result: devResult });
      const buildResult = await build(options);
      await assert({ mode: 'build', result: buildResult });
    });
  },

  runBothServe: async ({ dev, buildPreview }, use) => {
    await use(async (assert, options) => {
      const devResult = await dev(options);
      await assert({ mode: 'dev', result: devResult });
      const buildResult = await buildPreview(options);
      await assert({ mode: 'build', result: buildResult });
    });
  },

  editFile: async ({ cwd }, use) => {
    const editFile: EditFile = (filename, editor) => {
      const resolvedFilename = path.isAbsolute(filename) ? filename : path.resolve(cwd, filename);
      return baseEditFile(resolvedFilename, editor);
    };
    await use(editFile);
  },

  exec: async ({ cwd, logHelper }, use) => {
    const closes: Array<() => void> = [];

    const exec: Exec = (command, options = {}) => {
      const childProcess = nodeSpawn(command, setupExecOptions({ shell: true, ...options }, cwd));

      const onData = (data: Buffer) => {
        logHelper.addLog(data.toString());
      };

      childProcess.stdout?.on('data', onData);
      childProcess.stderr?.on('data', onData);

      closes.push(() => {
        childProcess.stdout?.off('data', onData);
        childProcess.stderr?.off('data', onData);
        childProcess.kill();
      });

      return { childProcess };
    };

    try {
      await use(exec);
    } finally {
      for (const close of closes) {
        close();
      }
    }
  },

  execCli: async ({ exec }, use) => {
    const execCli: Exec = (command, options = {}) => {
      return exec(`node "${RSBUILD_BIN_PATH}" ${command}`, options);
    };
    await use(execCli);
  },

  execCliSync: async ({ cwd }, use) => {
    const execCliSync: ExecSync = (command, options = {}) => {
      return execSync(
        `node ${RSBUILD_BIN_PATH} ${command}`,
        setupExecOptions(options, cwd),
      ).toString();
    };
    await use(execCliSync);
  },

  copySrcDir: async ({ cwd }, use) => {
    const copySrcDir = async () => {
      const targetDir = path.join(cwd, 'test-temp-src');
      await fse.remove(targetDir);
      await promises.cp(path.join(cwd, 'src'), targetDir, {
        recursive: true,
        mode: fsConstants.COPYFILE_FICLONE,
      });
      return targetDir;
    };
    await use(copySrcDir);
  },

  copyNodeModules: async ({ cwd }, use) => {
    await use(() => baseCopyNodeModules(cwd));
  },
});

export { expect };
