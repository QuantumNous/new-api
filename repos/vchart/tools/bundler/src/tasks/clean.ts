import gulp from 'gulp';
import gulpClean from 'gulp-clean';

export function clean(folders: string[], cwd?: string) {
  return new Promise(resolve => {
    gulp
      .src(folders, {
        cwd: cwd,
        read: false,
        allowEmpty: true
      })
      .pipe(gulpClean({ force: true }))
      .on('finish', () => {
        resolve(undefined);
      });
  });
}
