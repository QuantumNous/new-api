import gulp from 'gulp';
import path from 'path';

import type { Config } from '../logic/config';

export function copyFiles(projectRoot: string, config: Config) {
  return new Promise(resolve => {
    const willCopyAssets = gulp.src(config.copy.map(ext => `${projectRoot}/${config.sourceDir}/**/*.${ext}`));

    const esFolder = path.resolve(projectRoot, config.outputDir.es!);
    const cjsFolder = path.resolve(projectRoot, config.outputDir.cjs!);
    let stream: NodeJS.ReadableStream | undefined = undefined;
    if (config.formats.includes('cjs')) {
      stream = willCopyAssets.pipe(gulp.dest(cjsFolder));
    }
    if (config.formats.includes('es')) {
      stream = (stream || willCopyAssets).pipe(gulp.dest(esFolder));
    }

    stream?.on('finish', () => {
      resolve(undefined);
    });
  });
}
