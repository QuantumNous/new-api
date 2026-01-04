const path = require('path');
const gulp = require('gulp');
const merge2 = require('merge2');
const gulpTS = require('gulp-typescript');
const gulpBabel = require('gulp-babel');
const del = require('del');
const tsConfig = require('./tsconfig.json');
const getBabelConfig = require('./getBabelConfig');

gulp.task('cleanLib', function cleanLib() {
    return del(['lib/**/*']);
});

function compileTS(isESM) {
    const targetDir = isESM ? 'lib/es' : 'lib/cjs';
    const tsStream = gulp.src(['**/*.ts', '!_story/**/*.*', '!node_modules/**/*.*', '!lib/**/*.*'])
        .pipe(gulpTS(tsConfig.compilerOptions));
    const jsStream = tsStream.js
        .pipe(gulpBabel(getBabelConfig({ isESM })))
        .pipe(gulp.dest(targetDir));
    const dtsStream = tsStream.dts.pipe(gulp.dest(targetDir));
    return merge2([jsStream, dtsStream]);
}

gulp.task('compileTSForESM', function compileTSForESM() {
    return compileTS(true);
});

gulp.task('compileTSForCJS', function compileTSForCJS() {
    return compileTS(false);
});

gulp.task('compileLib', gulp.series(['cleanLib', gulp.parallel('compileTSForESM', 'compileTSForCJS')]));

