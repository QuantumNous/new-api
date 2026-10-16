import cac, { type CAC, type Command } from 'cac';
import { RSPACK_BUILD_ERROR } from '../build';
import { color } from '../helpers';
import type { ConfigLoader } from '../loadConfig';
import { defaultLogger } from '../logger';
import { onBeforeRestartServer } from '../restart';
import type { LogLevel, RsbuildMode } from '../types';
import { init, initCliAction } from './init';

export type CommonOptions = {
  base?: string;
  distPath?: string;
  sourceMap?: boolean;
  root?: string;
  mode?: RsbuildMode;
  config?: string;
  configLoader?: ConfigLoader;
  env?: boolean;
  envDir?: string;
  envMode?: string;
  open?: boolean | string;
  host?: true | string;
  port?: number;
  strictPort?: boolean;
  environment?: string[];
  logLevel?: LogLevel;
};

export type BuildOptions = CommonOptions & {
  watch?: boolean;
};

export type InspectOptions = CommonOptions & {
  mode: RsbuildMode;
  output: string;
  verbose?: boolean;
};

export type DevOptions = CommonOptions;

export type PreviewOptions = CommonOptions;

const applyCommonOptions = (cli: CAC) => {
  cli
    .option('--base <base>', 'Set the base path of the server')
    .option('-c, --config <config>', 'Set the configuration file (relative or absolute path)')
    .option('--config-loader <loader>', 'Set the config file loader (auto | jiti | native)', {
      default: 'auto',
    })
    .option('--dist-path <dir>', 'Set the root directory of output files')
    .option('--source-map', 'Enable source map')
    .option('--env-dir <dir>', 'Set the directory for loading `.env` files')
    .option('--env-mode <mode>', 'Set the env mode to load the `.env.[mode]` file')
    .option('--environment <name>', 'Set the environment name(s) to build', {
      type: [String],
      default: [],
    })
    .option('--log-level <level>', 'Set the log level (info | warn | error | silent)')
    .option('-m, --mode <mode>', 'Set the build mode (development | production | none)')
    .option(
      '-r, --root <root>',
      'Set the project root directory (absolute path or relative to cwd)',
    )
    .option('--no-env', 'Disable loading of `.env` files');
};

const applyServerOptions = (command: Command) => {
  command
    .option('-o, --open [url]', 'Open the page in browser on startup')
    .option('--port <port>', 'Set the port number for the server')
    .option('--strict-port', 'Exit if the specified port is already in use')
    .option('--host [host]', 'Set the host that the server listens to');
};

export function setupCommands(argv: string[]): void {
  const cli = cac('rsbuild');

  cli.version(RSBUILD_VERSION);

  // Apply common options to all commands
  applyCommonOptions(cli);

  const devDescription = `Start the dev server ${color.dim('(default if no command is given)')}`;
  const devCommand = cli.command('', devDescription).alias('dev');
  const buildCommand = cli.command('build', 'Build the app for production');
  const previewCommand = cli.command('preview', 'Preview the production build locally');
  const inspectCommand = cli.command('inspect', 'Inspect the Rspack and Rsbuild configs');

  applyServerOptions(devCommand);
  applyServerOptions(previewCommand);

  let logger = defaultLogger;

  devCommand.action(async (options: DevOptions) => {
    initCliAction('dev', options);
    try {
      const rsbuild = await init();
      if (!rsbuild) {
        return;
      }

      logger = rsbuild.logger;
      await rsbuild.startDevServer();
    } catch (err) {
      logger.error('Failed to start dev server.');
      logger.error(err);
      process.exit(1);
    }
  });

  buildCommand
    .option('-w, --watch', 'Enable watch mode to automatically rebuild on file changes')
    .action(async (options: BuildOptions) => {
      initCliAction('build', options);
      try {
        if (!options.watch) {
          process.env.RSPACK_UNSAFE_FAST_DROP = 'true';
        }

        const rsbuild = await init({
          isBuildWatch: options.watch,
        });
        if (!rsbuild) {
          return;
        }

        logger = rsbuild.logger;

        const buildResult = await rsbuild.build({
          watch: options.watch,
        });

        if (buildResult) {
          if (options.watch) {
            onBeforeRestartServer(buildResult.close);
          } else {
            await buildResult.close();
          }
        }
      } catch (err) {
        const isRspackError = err instanceof Error && err.message === RSPACK_BUILD_ERROR;
        if (!isRspackError) {
          logger.error('Failed to build.');
        }

        logger.error(err);
        process.exit(1);
      }
    });

  previewCommand.action(async (options: PreviewOptions) => {
    initCliAction('preview', options);
    try {
      const rsbuild = await init();

      if (!rsbuild) {
        return;
      }

      logger = rsbuild.logger;
      await rsbuild.preview();
    } catch (err) {
      logger.error('Failed to start preview server.');
      logger.error(err);
      process.exit(1);
    }
  });

  inspectCommand
    .option('--output <output>', 'Set the output path for inspection results')
    .option('--verbose', 'Show complete function definitions in output')
    .action(async (options: InspectOptions) => {
      initCliAction('inspect', options);
      try {
        const rsbuild = await init();

        if (!rsbuild) {
          return;
        }

        logger = rsbuild.logger;
        await rsbuild.inspectConfig({
          verbose: options.verbose,
          outputPath: options.output,
          writeToDisk: true,
        });
      } catch (err) {
        logger.error('Failed to inspect config.');
        logger.error(err);
        process.exit(1);
      }
    });

  cli.help((sections) => {
    // remove the default version log as we already log it in greeting
    sections.shift();

    for (const section of sections) {
      if (section.title === 'Usage') {
        section.body = section.body.replace(
          '$ rsbuild',
          color.yellow(`$ rsbuild [command] [options]`),
        );
      }

      // Fix the dev command name
      if (section.title === 'Commands') {
        section.body = section.body.replace(
          `         ${devDescription}`,
          `dev      ${devDescription}`,
        );
      }

      // Simplify the help output for sub-commands
      if (section.title?.startsWith('For more info')) {
        section.title = color.dim('  For details on a sub-command, run');
        section.body = color.dim('  $ rsbuild <command> -h');
      } else if (section.title) {
        section.title = color.cyan(section.title);
      }
    }
  });

  cli.parse(argv);
}
