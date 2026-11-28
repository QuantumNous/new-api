import less from 'less';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import through2 from 'through2';
import path from 'path';
import fs from 'fs';
import gulpIf from 'gulp-if';
import gulp from 'gulp';
import CleanCss from 'clean-css';
import type { _ModuleKind } from '../logic/config';

export function compileLess(content: string) {
  const _content = content.replace(/^\uFEFF/, '');

  const lessOpts = {
    javascriptEnabled: true
  };

  return less
    .render(_content, lessOpts)
    .then(result => postcss([autoprefixer]).process(result.css, { from: undefined }))
    .then(r => r.css);
}

export function buildStyle(
  sources: string[],
  projectRoot: string,
  formats: _ModuleKind[],
  outputDir: Partial<Record<_ModuleKind, string>>
) {
  return new Promise(resolve => {
    const lessEntry: string[] = [];
    const cssEntry: string[] = [];

    gulp
      .src(sources)
      .pipe(
        // see file type: https://www.npmjs.com/package/vinyl
        through2.obj(function foo(file, _encoding, next) {
          this.push(file.clone());
          if (file.path.match(/(\/|\\)style(\/|\\)index\.less$/)) {
            // contact output entry less file
            const relativePath = path.relative(`${outputDir.umd}/css`, outputDir.es!);
            lessEntry.push(`@import '${relativePath}/${file.relative}';`);

            compileLess(file.contents.toString())
              .then(css => {
                file.contents = Buffer.from(css);
                file.path = file.path.replace(/\.less$/, '.css');

                this.push(file);

                // contact output entry css file
                cssEntry.push(file.contents.toString());

                next();
              })
              .catch(e => {
                // eslint-disable-next-line no-console
                console.error(e);
              });
          } else {
            next();
          }
        })
      )
      .pipe(gulpIf(formats.includes('es'), gulp.dest(outputDir.es!, { cwd: projectRoot })))
      .pipe(gulpIf(formats.includes('cjs'), gulp.dest(outputDir.cjs!, { cwd: projectRoot })))
      .on('finish', () => {
        if (formats.includes('umd')) {
          // write output entry less/css file
          fs.mkdirSync(`${outputDir.umd}/css`, { recursive: true });

          const cssEntryContent = cssEntry.join('\n');
          const minifyCssEntryContent = new CleanCss().minify(cssEntryContent);
          fs.writeFileSync(`${outputDir.umd}/css/index.css`, cssEntryContent);
          fs.writeFileSync(`${outputDir.umd}/css/index.min.css`, minifyCssEntryContent.styles);

          fs.writeFileSync(`${outputDir.umd}/css/index.less`, lessEntry.join('\n'));
        }

        resolve(undefined);
      });
  });
}
