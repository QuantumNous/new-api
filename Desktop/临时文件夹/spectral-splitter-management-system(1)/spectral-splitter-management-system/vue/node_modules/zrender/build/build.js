// const typescript = require('@rollup/plugin-typescript');
const typescript = require('rollup-plugin-typescript2');
const replace = require('@rollup/plugin-replace');
const rollup = require('rollup');
const path = require('path');
const processs = require('process');
const chalk = require('chalk');
const progress = require('./progress');
const UglifyJS = require('uglify-js');
const fs = require('fs');

function current() {
    return (new Date()).toLocaleString();
}

function createInputOption(env, isWatch) {
    return {
        input: path.resolve(__dirname, '../index.ts'),
        plugins: [
            typescript({
                clean: !isWatch,
                tsconfigOverride: {
                    compilerOptions: {
                        // Rollup don't use CommonJS by default.
                        module: 'ES2015',
                        sourceMap: true,
                        // Use the esm d.ts
                        declaration: false
                    }
                }
            }),
            replace({
                preventAssignment: true,
                'process.env.NODE_ENV': JSON.stringify(env)
            }),
            progress({
                scope: {
                    total: 0
                }
            })
        ]
    };
}

const outputOption = {
    format: 'umd',
    file: path.resolve(__dirname, '../dist/zrender.js'),
    sourcemap: true,
    name: 'zrender'
};

function minify(outPath) {
    const code = fs.readFileSync(outPath, 'utf-8');
    const uglifyResult = UglifyJS.minify(code);
    if (uglifyResult.error) {
        throw new Error(uglifyResult.error);
    }
    fs.writeFileSync(outPath, uglifyResult.code, 'utf-8');
}

if (processs.argv.includes('--watch')) {
    const watcher = rollup.watch({
        ...createInputOption('development', true),
        output: [outputOption],
        watch: {
            clearScreen: true
        }
    });
    watcher.on('event', event => {
        switch(event.code) {
            // case 'START':
            //     console.log(chalk.green('Begin to watch'));
            //     break;
            case 'BUNDLE_START':
                console.log(
                    chalk.gray(current()),
                    chalk.blue('File changed. Begin to bundle')
                );
                break;
            case 'BUNDLE_END':
                console.log(
                    chalk.gray(current()),
                    chalk.green('Finished bundle')
                );
                break;
            case 'ERROR':
                console.log(
                    chalk.gray(current()),
                    chalk.red(event.error)
                );
                break;
        }
    });
}
else {
    // Unminified
    rollup.rollup({
        ...createInputOption('development', false)
    }).then(bundle => {
        bundle.write(outputOption)
            .then(() => {
                // Minified
                if (process.argv.indexOf('--minify') >= 0) {
                    rollup.rollup({
                        ...createInputOption('production', false)
                    }).then(bundle => {
                        const file = outputOption.file.replace(/.js$/, '.min.js');
                        bundle.write(Object.assign(outputOption, {
                            file,
                            sourcemap: false
                        })).then(function () {
                            minify(file);
                        });
                    });
                }
            });
    });
}
