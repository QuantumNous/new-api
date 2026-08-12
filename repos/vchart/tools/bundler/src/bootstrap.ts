/* eslint-disable no-console */
import path from 'path';
import ms from 'ms';
import watcher from 'glob-watcher';
import { DebugConfig } from './logic/debug';
import { parserCLIArgs, getDefaultConfig, getFinalConfig, loadConfigFile, DEFAULT_CONFIG_FILE } from './logic/config';
import type { _ModuleKind } from './logic/config';
import { loadPackageJson } from './logic/package';
import Undertaker, { Task } from 'undertaker';
import Spinnies from '@trufflesuite/spinnies';
import { clean } from './tasks/clean';
import { compile, getTSCompilerOptions, readUserTsconfig } from './tasks/modules';
import { buildES, buildUmd } from './tasks/umd';
import { buildStyle } from './tasks/style';
import { copyFiles } from './tasks/copy';

function getSources(root: string, allowJs: boolean) {
  const sources = [`${root}/**/*.tsx`, `${root}/**/*.ts`, `!${root}/**/stories/**`];
  if (allowJs) {
    sources.unshift(`${root}/**/*.jsx`);
    sources.unshift(`${root}/**/*.js`);
  }
  return sources;
}

enum Tasks {
  CLEAN_FOLDER = 'Clean folder',
  BUILD_ESM = 'Build ESM',
  BUILD_CJS = 'Build CJS',
  BUILD_UMD = 'Build UMD',
  BUILD_STYLE = 'Build style',
  // COPY_DIST = "Copy dist",
  COPY_FILES = 'Copy files'
}
async function bootstrap() {
  const args = parserCLIArgs(process.argv.slice(2));
  DebugConfig('CLI args', args);

  const PROJECT_ROOT = path.resolve(process.env['__PROJECT_ROOT__'] || args.root || process.cwd());
  DebugConfig('PROJECT_ROOT', PROJECT_ROOT);

  const rawPackageJson = loadPackageJson(PROJECT_ROOT);
  if (!rawPackageJson) {
    throw new Error('load project package.json failed.');
  }

  const userConfigFilePath = path.resolve(PROJECT_ROOT, args.config || DEFAULT_CONFIG_FILE);
  DebugConfig('User config file path', userConfigFilePath);

  const userConfig = loadConfigFile(userConfigFilePath);
  DebugConfig('User config', userConfig);
  const config = getFinalConfig(args, userConfig, getDefaultConfig(), rawPackageJson.version);
  DebugConfig('Final config', config);

  const taker = new Undertaker();
  const spinnies = new Spinnies();
  const taskList: Task[] = [];
  const sources = getSources(`${PROJECT_ROOT}/${config.sourceDir}`, true);
  const userTsConfig = readUserTsconfig(path.resolve(PROJECT_ROOT, config.tsconfig));

  const times: Record<string, Record<'start' | 'end', number>> = {};
  function _task(name: string, cb: () => Promise<unknown>) {
    taker.task(name, async () => {
      times[name] = { start: 0, end: 0 };
      times[name]!['start'] = Number(new Date());
      spinnies.add(name, { text: `Running [${name}]` });
      await cb();
      times[name]!['end'] = Number(new Date());
      const diff = times[name]!['end'] - times[name]!['start'];
      spinnies.succeed(name, { text: `Finished [${name}] +${ms(diff)}` });
    });
  }

  if (config.preTasks) {
    const tasksKey = Object.keys(config.preTasks);
    if (tasksKey.length) {
      tasksKey.forEach(name => {
        _task(name, () => config.preTasks[name]!(config, PROJECT_ROOT, rawPackageJson));
        taskList.push(name);
      });
    }
  }

  if (config.clean) {
    _task(Tasks.CLEAN_FOLDER, () => clean(Object.values(config.outputDir), PROJECT_ROOT));
    taskList.push(Tasks.CLEAN_FOLDER);
  }

  if (Array.isArray(config.formats) && config.formats) {
    const subBuildTasks: string[] = [];
    const moduleKind: Record<'es' | 'cjs', 'es2015' | 'commonjs'> = {
      es: 'es2015',
      cjs: 'commonjs'
    };
    config.formats.forEach((format: _ModuleKind) => {
      const taskName = `Build ${format}`;
      subBuildTasks.push(taskName);
      if (format === 'umd') {
        if (config.minify) {
          subBuildTasks.push(`${taskName}_min`);
          _task(`${taskName}_min`, () => buildUmd(config, PROJECT_ROOT, rawPackageJson, true));
        }
        _task(`${taskName}`, () => buildUmd(config, PROJECT_ROOT, rawPackageJson, false));
        return;
      } else if (format === 'es' && config.esTotalFile) {
        subBuildTasks.push(`${taskName}_total`);
        _task(`${taskName}_total`, () => buildES({ ...config, minify: false }, PROJECT_ROOT, rawPackageJson, false));
      }

      _task(taskName, () =>
        compile(
          sources,
          getTSCompilerOptions(moduleKind[format], userTsConfig.compilerOptions, config.noEmitOnError),
          config.envs,
          path.resolve(PROJECT_ROOT, config.outputDir[format]!),
          path.resolve(PROJECT_ROOT, config.tsconfig),
          PROJECT_ROOT,
          config.noEmitOnError,
          config.sourcemap
        )
      );
    });
    taskList.push(taker.parallel(subBuildTasks));
  }

  if (!args.ignoreUmdEntries && Array.isArray(config.umdEntries) && config.umdEntries.length > 0) {
    const subBuildTasks: string[] = [];
    config.umdEntries.forEach(entry => {
      const taskName = `Build ${entry}`;
      subBuildTasks.push(`${taskName}_min`);

      _task(`${taskName}_min`, () =>
        buildUmd(
          { ...config, input: { umd: `${entry}.ts` }, umdOutputFilename: entry },
          PROJECT_ROOT,
          rawPackageJson,
          true
        )
      );
    });
    taskList.push(taker.parallel(subBuildTasks));
  }
  if (!args.ignoreESEntries && Array.isArray(config.esEntries) && config.esEntries.length > 0) {
    const subBuildTasks: string[] = [];
    config.esEntries.forEach(entry => {
      const taskName = `Build ${entry}`;
      subBuildTasks.push(`${taskName}_min`);

      _task(`${taskName}_min`, () =>
        buildES(
          { ...config, input: { umd: `${entry}.ts` }, minify: true, umdOutputFilename: entry },
          PROJECT_ROOT,
          rawPackageJson,
          true
        )
      );
    });
    taskList.push(taker.parallel(subBuildTasks));
  }

  if (config.less) {
    _task(Tasks.BUILD_STYLE, () =>
      buildStyle([`${PROJECT_ROOT}/${config.sourceDir}/**/*.less`], PROJECT_ROOT, config.formats, config.outputDir)
    );
    taskList.push(Tasks.BUILD_STYLE);
  }
  if (
    Array.isArray(config.copy) &&
    config.copy.length &&
    (config.formats.includes('cjs') || config.formats.includes('es'))
  ) {
    _task(Tasks.COPY_FILES, () => copyFiles(PROJECT_ROOT, config));
    taskList.push(Tasks.COPY_FILES);
  }

  if (!args.ignorePostTasks && config.postTasks) {
    const tasksKey = Object.keys(config.postTasks);
    if (tasksKey.length) {
      tasksKey.forEach(name => {
        _task(name, () => config.postTasks[name]!(config, PROJECT_ROOT, rawPackageJson, DebugConfig));
        taskList.push(name);
      });
    }
  }
  if (config.watch) {
    watcher(sources, taker.series(taskList)).on('change', filename => {
      console.log(`[${path.relative(PROJECT_ROOT, filename)}] changed, Rebuild...`);
    });
    return;
  }
  taker.series(taskList)(err => {
    if (err) {
      throw err;
    }
  });
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
