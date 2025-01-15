// adding js extension in the import statement.

// Reference:
// https://regexr.com/47jlq
// https://gist.github.com/manekinekko/7e58a17bc62a9be47172
const regexp = /((?:(?:import)|(?:export))\s+?(?:(?:(?:[\w*\s{},\/]*)\s+from\s+?)|))(?:(?:"(.*?)")|(?:'(.*?)'))([\s]*?(?:;|$|))/g;

module.exports.transformImport = function (code, processModuleName) {
    return code.replace(regexp, (str, prefix, moduleNameA, moduleNameB, postfix) => {
        let moduleName = (moduleNameA === undefined ? moduleNameB : moduleNameA).trim();
        const quote = moduleNameA === undefined ? "'" : '"';
        return prefix + quote + processModuleName(moduleName) + quote + postfix;
        // Not support other extensions.
    });
}


const testCases = `import videos from './videos/index.js'

export default (socket, context) => {
    // dynamically importing all the socket.io handler (it's dynamic import that happen at run time)
  import {
	something
} from "./test/okbb"

const f = 2;

import test from 'obb'


import {
  Component
} from '@angular2/core';

import defaultMember from "module-0";

import   *    as name from "module-1  ";

import   {  member }   from "  module-2";

import { member as alias } from "module-3";

import { member1 , member2 } from "module-4";

import { member1 , member2 as alias2 , member3 as alias3 } from "module-5";

import defaultMember, { member, member } from "module-6";

import defaultMember, * as name from "module-7";

import "module-8";

import "module-9"    // comment no problem

import {
    AAAA,
    // BBB
} from 'module-10';

import "module-b' // doesn't match -> the opening and closing quation mark are different

importing hya from 'ttt'

import fbsfrom ''


// Export expressions.
export { aaa };

export * from "module-11";

export { aaa } from "module-12";

// Should not be parsed
export default aaa;

export function bbb () {
};
`

module.exports.runTest = function () {
    const expected = [
        './videos/index.js',
        './test/okbb',
        'obb',
        '@angular2/core',
        'module-0',
        'module-1',
        'module-2',
        'module-3',
        'module-4',
        'module-5',
        'module-6',
        'module-7',
        'module-8',
        'module-9',
        'module-10',
        'module-11',
        'module-12'
    ]
    let cursor = 0;
    module.exports.transformImport(testCases, (moduleName) => {
        if (expected[cursor] !== moduleName) {
            throw new Error(`Expected ${expected[cursor]}. Actual ${moduleName}`);
        }
        cursor++;
        return moduleName;
    })
    if (cursor !== expected.length) {
        throw new Error('Test failed');
    }
    console.log('All test passed!')
}

// module.exports.runTest();