#!/usr/bin/env node

import arg from 'arg';
import { compile } from './index';

const main = () => {
    const userArgs = arg({
        '--foundation': String,
        '--theme': String,
        '--output': String,
        '--icon': String,
        '--min': Boolean,

        '-f': '--foundation',
        '-t': '--theme',
        '-i': '--icon',
        '-o': '--output',
        '-m': '--min'
    }, { permissive: true });
    const {
        '--foundation': foundationPath,
        '--theme': themePath,
        '--output': outputPath,
        '--icon': iconPath,
        '--min': isMin
    } = userArgs;
    console.log(`foundationPath: ${foundationPath},\nthemePath: ${themePath},\noutputPath: ${outputPath}\n`);
    if (foundationPath && themePath && iconPath && outputPath) {
        compile({
            foundationPath, themePath, iconPath, outputPath, isMin
        });
    } else {
        console.error('Error: lack of args.');
    }
};

main();
