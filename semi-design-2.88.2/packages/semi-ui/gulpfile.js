const path = require('path');
const { Buffer } = require('buffer');
const through2 = require('through2');
const merge2 = require('merge2');
const gulp = require('gulp');
const gulpTS = require('gulp-typescript');
const gulpBabel = require('gulp-babel');
const sass = require('gulp-sass')(require('sass'));
const replace = require('gulp-replace');
const del = require('del');
const tsConfig = require('./tsconfig.json');
const getBabelConfig = require('./getBabelConfig');

gulp.task('cleanLib', function cleanLib() {
    return del(['lib/**/*']);
});

gulp.task('compileTSXForESM', function compileTSXForESM() {
    const tsStream = gulp.src(['**/*.tsx', '**/*.ts', '!**/node_modules/**/*.*', '!**/_story/**/*.*'])
        .pipe(gulpTS({
            ...tsConfig.compilerOptions,
            rootDir: path.join(__dirname, '..')
        }));
    const jsStream = tsStream.js
        .pipe(gulpBabel(getBabelConfig({ isESM: true })))
        .pipe(replace(/(import\s+)['"]@douyinfe\/semi-foundation\/([^'"]+)['"]/g, '$1\'@douyinfe/semi-foundation/lib/es/$2\''))
        .pipe(replace(/((?:import|export)\s+.+from\s+)['"]@douyinfe\/semi-foundation\/([^'"]+)['"]/g, '$1\'@douyinfe/semi-foundation/lib/es/$2\''))
        .pipe(replace(/(import\s+)['"]([^'"]+)(\.scss)['"]/g, '$1\'$2.css\''))
        .pipe(gulp.dest('lib/es'));
    const dtsStream = tsStream.dts
        .pipe(replace(/(import\s+)['"]@douyinfe\/semi-foundation\/([^'"]+)['"]/g, '$1\'@douyinfe/semi-foundation/lib/es/$2\''))
        .pipe(replace(/((?:import|export)\s+.+from\s+)['"]@douyinfe\/semi-foundation\/([^'"]+)['"]/g, '$1\'@douyinfe/semi-foundation/lib/es/$2\''))
        .pipe(replace(/(import\(['"])@douyinfe\/semi-foundation\/(.+)/g, '$1@douyinfe/semi-foundation/lib/es/$2'))
        .pipe(replace(/(import\s+)['"]([^'"]+)(\.scss)['"]/g, '$1\'$2.css\''))
        .pipe(gulp.dest('lib/es'));
    return merge2([jsStream, dtsStream]);
});

gulp.task('compileTSXForCJS', function compileTSXForCJS() {
    const tsStream = gulp.src(['**/*.tsx', '**/*.ts', '!**/node_modules/**/*.*', '!**/_story/**/*.*'])
        .pipe(gulpTS({
            ...tsConfig.compilerOptions,
            rootDir: path.join(__dirname, '..')
        }));
    const jsStream = tsStream.js
        .pipe(gulpBabel(getBabelConfig({ isESM: false })))
        .pipe(replace(/(require\(['"])@douyinfe\/semi-foundation\/([^'"]+)(['"]\))/g, '$1@douyinfe/semi-foundation/lib/cjs/$2$3'))
        .pipe(replace(/(require\(['"])([^'"]+)(\.scss)(['"]\))/g, '$1$2.css$4'))
        .pipe(gulp.dest('lib/cjs'));
    const dtsStream = tsStream.dts
        .pipe(replace(/(import\s+)['"]@douyinfe\/semi-foundation\/([^'"]+)['"]/g, '$1\'@douyinfe/semi-foundation/lib/cjs/$2\''))
        .pipe(replace(/((?:import|export)\s+.+from\s+)['"]@douyinfe\/semi-foundation\/([^'"]+)['"]/g, '$1\'@douyinfe/semi-foundation/lib/cjs/$2\''))
        .pipe(replace(/(import\(['"])@douyinfe\/semi-foundation\/(.+)/g, '$1@douyinfe/semi-foundation/lib/cjs/$2'))
        .pipe(replace(/(import\s+)['"]([^'"]+)(\.scss)['"]/g, '$1\'$2.css\''))
        .pipe(gulp.dest('lib/cjs'));
    return merge2([jsStream, dtsStream]);
});

gulp.task('compileScss', function compileScss() {
    return gulp.src(['**/*.scss', '!**/node_modules/**/*.*', '!**/_story/**/*.scss'])
        .pipe(through2.obj(
            function (chunk, enc, cb) {
                const rootPath = path.join(__dirname, '../../');
                const scssVarStr = `@import "${rootPath}/packages/semi-theme-default/scss/index.scss";\n`;
                const cssVarStr = `@import "${rootPath}/packages/semi-theme-default/scss/global.scss";\n`;
                const animationStr = `@import "${rootPath}/packages/semi-theme-default/scss/animation.scss";\n`;
                const animationBuffer = Buffer.from(animationStr);
                const scssBuffer = Buffer.from(scssVarStr);
                const buffers = [scssBuffer, animationBuffer];
                if (/_base\/base\.scss/.test(chunk.path)) {
                    buffers.push(Buffer.from(cssVarStr));
                }
                chunk.contents = Buffer.concat([...buffers, chunk.contents]);
                cb(null, chunk);
            }
        ))
        .pipe(sass({
            importer: (url, prev, done) => {
                const rootPath = path.join(__dirname, '../../');
                let realUrl = url;
                if (/~@douyinfe\/semi-foundation/.test(url)) {
                    const semiUIPath = path.join(rootPath, 'packages/semi-foundation');
                    realUrl = url.replace(/~@douyinfe\/semi-foundation/, semiUIPath);
                }
                done({ file: realUrl });
            },
            charset: false
        }).on('error', sass.logError))
        .pipe(gulp.dest('lib/es'))
        .pipe(gulp.dest('lib/cjs'));
});

function moveScss(isESM) {
    const moduleTarget = isESM ? 'es' : 'cjs';
    const targetDir = isESM ? 'lib/es' : 'lib/cjs';
    return gulp.src(['**/*.scss', '!**/node_modules/**/*.*', '!**/_story/**/*.scss'])
        .pipe(replace(/(@import\s+['"]~)(@douyinfe\/semi-foundation\/)/g, `$1@douyinfe/semi-foundation/lib/${moduleTarget}/`))
        .pipe(gulp.dest(targetDir));
}

gulp.task('moveScssForESM', function moveScssForESM() {
    return moveScss(true);
});

gulp.task('moveScssForCJS', function moveScssForCJS() {
    return moveScss(false);
});

gulp.task('compileLib',
    gulp.series(
        [
            'cleanLib',
            'compileScss',
            gulp.parallel('moveScssForESM', 'moveScssForCJS'),
            gulp.parallel('compileTSXForESM', 'compileTSXForCJS')
        ]
    )
);

