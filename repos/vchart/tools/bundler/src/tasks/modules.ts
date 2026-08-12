import gulp from 'gulp';
import * as ts from 'typescript';
import gulpSourceMaps from 'gulp-sourcemaps';
import gulpTS, { Settings } from 'gulp-typescript';
import gulpReplace from 'gulp-replace';
import fs from 'fs';
import merge from 'merge2';
import through2 from 'through2';
import { minify } from 'terser';
import gulpIF from 'gulp-if';
import gulpMatch from 'gulp-match';
import { DebugCompile, DebugConfig } from '../logic/debug';
import { alias } from '../logic/alias';

export function getTSCompilerOptions(
  moduleKind: 'esnext' | 'commonjs' | 'es2015',
  userTSCompilerOptions: Record<string, unknown> = {},
  noEmitOnError: boolean
): Settings {
  delete userTSCompilerOptions['outDir'];
  const res: Settings = {
    moduleResolution: 'node',
    target: 'es2016',
    ...userTSCompilerOptions,
    noEmit: false,
    emitDeclarationOnly: false,
    declaration: true,
    isolatedModules: false,
    allowSyntheticDefaultImports: true,
    module: moduleKind,
    skipLibCheck: true,
    noEmitOnError: noEmitOnError,
    ...userTSCompilerOptions
  };

  return res;
}

// getTSCompilerOptions(ModuleKind.ESNext)

export function readUserTsconfig(absTsConfigPath: string): {
  extends: string;
  compilerOptions: Record<string, unknown>;
} {
  const configJson = ts.readConfigFile(absTsConfigPath, path => fs.readFileSync(path, { encoding: 'utf-8' }));

  if (configJson.error) {
    throw new Error(ts.formatDiagnostics([configJson.error], ts.createCompilerHost(ts.getDefaultCompilerOptions())));
  }
  return configJson.config;
}

export function cssInjection(content: string) {
  return content
    .replace(/\/style\/?'/g, "/style/css'")
    .replace(/\/style\/?"/g, '/style/css"')
    .replace(/\.less/g, '.css');
}

export function compile(
  sources: string[],
  tsCompilerOptions: Settings,
  envs: Record<string, string>,
  outputPath: string,
  absTsConfigPath: string,
  projectRoot: string,
  noEmitOnError: boolean,
  sourceMap: boolean
) {
  DebugConfig('tsCompilerOptions', tsCompilerOptions);

  const tsProject = gulpTS.createProject(absTsConfigPath, tsCompilerOptions);
  const hasAlias = Object.keys(tsProject.config.compilerOptions?.paths || {}).length > 0;

  return new Promise(resolve => {
    let sourcesStream = gulp.src(sources);
    for (const [key, value] of Object.entries(envs)) {
      sourcesStream = sourcesStream
        .pipe(
          through2.obj(function _z(file, _encoding, cb) {
            if (!gulpMatch(file, '**/*.d.ts')) {
              this.push(file);
            }
            return cb();
          })
        )
        .pipe(gulpReplace(key, value));
    }

    const tsResult = sourcesStream
      .pipe(
        gulpIF(
          hasAlias,
          alias({
            paths: tsProject.config.compilerOptions.paths,
            cwd: projectRoot
          })
        )
      )
      .pipe(gulpIF(sourceMap, gulpSourceMaps.init()))
      .pipe(tsProject(gulpTS.reporter.longReporter()))
      .on('error', function _err() {
        if (noEmitOnError) {
          process.exit(1);
        } else {
          // @ts-ignore
          (this as NodeJS.ReadWriteStream).emit('end');
        }
      });

    merge([
      tsResult.js
        .pipe(
          through2.obj(async function z(file, encoding, next) {
            // only remove dead code
            const _contents = await minify(file.contents.toString(encoding), {
              compress: {
                unused: true,
                drop_debugger: false,
                drop_console: false,
                dead_code: true,
                global_defs: {},
                passes: 1
              },
              mangle: false,
              format: {
                beautify: true,
                comments: 'all'
              }
            });
            if (_contents.code) {
              file.contents = Buffer.from(_contents.code);
              this.push(file);
            } else {
              DebugCompile('UnRemove dead code for', file.path);
            }
            next();
          })
        )
        .pipe(
          through2.obj(function z(file, encoding, next) {
            this.push(file.clone());
            if (file.path.match(/(\/|\\)style(\/|\\)index\.js/)) {
              DebugCompile('CSS inject for', file.path);

              const content = file.contents.toString(encoding);

              file.contents = Buffer.from(cssInjection(content));
              file.path = file.path.replace(/index\.js/, 'css.js');

              this.push(file);
            }

            next();
          })
        )
        .pipe(gulp.dest(outputPath)),
      tsResult.js.pipe(gulpIF(sourceMap, gulpSourceMaps.write('.'))).pipe(gulp.dest(outputPath)),
      tsResult.dts.pipe(gulp.dest(outputPath))
    ]).on('finish', () => {
      resolve(undefined);
    });
  });
}
