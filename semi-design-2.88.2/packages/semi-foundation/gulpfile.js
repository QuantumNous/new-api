const path = require('path');
const { Buffer } = require('buffer');
const through2 = require('through2');
const gulp = require('gulp');
const merge2 = require('merge2');
const gulpTS = require('gulp-typescript');
const gulpBabel = require('gulp-babel');
const sass = require('gulp-sass')(require('sass'));
const del = require('del');
const tsConfig = require('./tsconfig.json');
const getBabelConfig = require('./getBabelConfig');

gulp.task('cleanLib', function cleanLib() {
    return del(['lib/**/*']);
});

function compileTS(isESM) {
    const targetDir = isESM ? 'lib/es' : 'lib/cjs';
    const tsStream = gulp.src(['**/*.ts', '!node_modules/**/*.*'])
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

const excludeScss = [
    '!**/button/splitButtonGroup.scss',
    '!**/steps/bacisSteps.scss',
    '!**/steps/fillSteps.scss',
    '!**/steps/navSteps.scss',
    '!**/table/operationPanel.scss',
    '!**/tooltip/arrow.scss',
    '!**/autoComplete/option.scss',
    '!**/select/option.scss',
];
gulp.task('compileScss', function compileScss() {
    return gulp.src(['**/*.scss', '!node_modules/**/*.*', '!**/rtl.scss', '!**/variables.scss', "!**/animation.scss", ...excludeScss])
        .pipe(through2.obj(
            function (chunk, enc, cb) {
                const rootPath = path.join(__dirname, '../../');
                const scssVarStr = `@import "${rootPath}/packages/semi-theme-default/scss/index.scss";\n`;
                let scssRaw = chunk.contents.toString('utf-8');
                if (scssRaw.startsWith("@use")) {
                    const scssRawSplit = scssRaw.split("\n");
                    const codeStartIndex = scssRawSplit.findIndex(item => !item.startsWith("@use"));
                    scssRawSplit.splice(codeStartIndex, 0, scssVarStr);
                    scssRaw = scssRawSplit.join("\n");
                } else {
                    scssRaw = `${scssVarStr}\n${scssRaw}`;
                }
                chunk.contents = Buffer.from(scssRaw, 'utf-8');
                cb(null, chunk);
            }
        ))
        .pipe(sass({
            charset: false
        }).on('error', sass.logError))
        .pipe(gulp.dest('lib/es'))
        .pipe(gulp.dest('lib/cjs'));
});

gulp.task('moveScss', function moveScss() {
    return gulp.src(['**/*.scss', '!node_modules/**/*.*'])
        .pipe(gulp.dest('lib/es'))
        .pipe(gulp.dest('lib/cjs'));
});

gulp.task('compileLib',
    gulp.series(
        [
            'cleanLib', 'compileScss',
            'moveScss',
            gulp.parallel('compileTSForESM', 'compileTSForCJS'),
        ]
    )
);

gulp.task('findDupCSSVariables', function findDupCSSVariables() {
    return gulp.src(['**/variable?.scss', '!node_modules/**/*.*'])
        .pipe(through2.obj((chunk, enc, cb) => {
            const fileStr = chunk.contents.toString(enc);
            const lines = fileStr.split('\n');
            const variables = new Set();
            for (let line of lines) {
                if (/\$[a-z]+(-[a-z0-9_]+)+/.test(line)) {
                    const variable = line.split(':')[0];
                    if (variables.has(variable)) {
                        console.error(`❌ ${variable} dup`);
                    } else {
                        variables.add(variable);
                    }
                }
            }
            cb();
        }));
});

