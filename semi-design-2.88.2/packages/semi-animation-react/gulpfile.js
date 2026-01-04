const path = require('path');
const gulp = require('gulp');
const gulpTS = require('gulp-typescript');
const gulpBabel = require('gulp-babel');
const merge2 = require('merge2');
const del = require('del');
const tsConfig = require('./tsconfig.json');
const getBabelConfig = require('./getBabelConfig');

gulp.task('cleanLib', function cleanLib() {
    return del(['lib/**/*']);
});

function compileTSX(isESM) {
    const targetDir = isESM ? 'lib/es' : 'lib/cjs';
    const tsStream = gulp.src(['**/*.ts', '**/*.tsx', '!_story/**/*.*', '!node_modules/**/*.*', '!lib/**/*.*'])
        .pipe(gulpTS({
            ...tsConfig.compilerOptions,
            rootDir: path.join(__dirname, '..')
        }));
    const jsStream = tsStream.js
        .pipe(gulpBabel(getBabelConfig({ isESM })))
        .pipe(gulp.dest(targetDir));
    const dtsStream = tsStream.dts.pipe(gulp.dest(targetDir));
    return merge2([jsStream, dtsStream]);
}

gulp.task('compileTSXForESM', function compileTSXForESM() {
    return compileTSX(true);
});

gulp.task('compileTSXForCJS', function compileTSXForCJS() {
    return compileTSX(false);
});

gulp.task('compileLib', gulp.series(['cleanLib', gulp.parallel('compileTSXForESM', 'compileTSXForCJS')]));
