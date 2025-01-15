// Porcess generated lib files.
// Like adding js extension in the import statement.

const { transformImport } = require('./transformImport');
const globby = require('globby');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const rollup = require('rollup');
const nodeResolve = require('@rollup/plugin-node-resolve').default;

function addJsExtension(moduleName) {
    // Ignore 'tslib'
    if (!(moduleName.startsWith('.'))) {
        return moduleName;
    }
    if (moduleName.endsWith('.ts')) {
        // Replace ts with js
        return moduleName.replace(/\.ts$/, '.js');
    }
    else if (moduleName.endsWith('.js')) {
        return moduleName;
    }
    else {
        return moduleName + '.js'
    }
}

async function transform() {
    const libFiles = await globby([
        '**/*.js'
    ], {
        cwd: path.join(__dirname, '../lib'),
        absolute: true
    });

    if (libFiles.length === 0) {
        throw new Error('No lib files found.')
    }

    for (let file of libFiles) {
        const code = fs.readFileSync(file, 'utf-8');
        fs.writeFileSync(file, transformImport(code, addJsExtension), 'utf-8');
    }

    // Transform index;
    const indexFile = path.join(__dirname, '../index.js');
    fs.writeFileSync(
        indexFile,
        transformImport(
            fs.readFileSync(indexFile, 'utf-8'),
            (mduleName) => addJsExtension(mduleName).replace('./src', './lib')
        )
    )
}

transform().then(() => {
    console.log(chalk.green('Added .js extensions.'));
    console.log(chalk.gray('Start testing generated libs...'));
}).then(() => {
    return rollup.rollup({
        input: path.resolve(__dirname, '../index.js'),
        plugins: [nodeResolve()]
    });
}).then(() => {
    console.log(chalk.green('Libs can be bundled!'));
});