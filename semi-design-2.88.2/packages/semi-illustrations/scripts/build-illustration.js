/**
 * Convert svg elements into React components
 */

const { resolve } = require('path');
const build = require('../../../scripts/build-svg');

// Semi Illustrations
const entryDir = resolve(__dirname, '../src/svgs');
const outDir = resolve(__dirname, '../src/illustrations');

const svgoPlugins = [
    {
        name: 'convertPathData',
        params: {
            floatPrecision: 2
        }
    },
    {
        name: 'cleanupListOfValues',
        active: true,
    },
    {
        name: 'removeStyleElement',
        active: true,
    },
    {
        name: 'removeViewBox',
        active: false,
    },
    
];

build(entryDir, outDir, 'Illustration', '', svgoPlugins, { typescript: true });