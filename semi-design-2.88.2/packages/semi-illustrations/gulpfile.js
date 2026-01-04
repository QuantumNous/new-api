const path = require('path');
const gulp = require('gulp');
const gulpTS = require('gulp-typescript');
const merge2 = require('merge2');
const del = require('del');
const tsConfig = require('./tsconfig.json');
const gulpEsBuild = require('gulp-esbuild');

gulp.task('cleanLib', function cleanLib() {
    return del(['lib/**/*']);
});

function compileTSX(isESM) {
    const targetDir = isESM ? 'lib/es' : 'lib/cjs';
    const format = isESM ? 'esm' : 'cjs';
    const src = ['src/**/*.tsx', 'src/**/*.ts'];
    const tsStream = gulp.src(src)
        .pipe(gulpTS({
            ...tsConfig.compilerOptions,
            rootDir: path.join(__dirname, '..')
        }));
    const dtsStream = tsStream.dts.pipe(gulp.dest(targetDir));

    const jsStream = gulp.src(src)
        .pipe(gulpEsBuild({
            loader: {
                '.tsx': 'tsx',
            },
            format,
        }))
        .pipe(gulp.dest(targetDir));

    return merge2([jsStream, dtsStream]);
}

gulp.task('compileTSXForESM', function compileTSXForESM() {
    return compileTSX(true);
});

gulp.task('compileTSXForCJS', function compileTSXForCJS() {
    return compileTSX(false);
});

gulp.task('compileLib', gulp.series(['cleanLib', gulp.parallel('compileTSXForESM', 'compileTSXForCJS')]));

