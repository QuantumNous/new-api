"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = void 0;
const source_map_1 = require("source-map");
const hash = require('hash-sum');
const cache = new (require('lru-cache'))(100);
const splitRE = /\r?\n/g;
const emptyRE = /^(?:\/\/)?\s*$/;
function parse(options) {
    const { source, filename = '', compiler, compilerParseOptions = { pad: 'line' }, sourceRoot = '', needMap = true } = options;
    const cacheKey = hash(filename + source + JSON.stringify(compilerParseOptions));
    let output = cache.get(cacheKey);
    if (output)
        return output;
    output = compiler.parseComponent(source, compilerParseOptions);
    if (needMap) {
        if (output.script && !output.script.src) {
            output.script.map = generateSourceMap(filename, source, output.script.content, sourceRoot, compilerParseOptions.pad);
        }
        if (output.styles) {
            output.styles.forEach(style => {
                if (!style.src) {
                    style.map = generateSourceMap(filename, source, style.content, sourceRoot, compilerParseOptions.pad);
                }
            });
        }
    }
    cache.set(cacheKey, output);
    return output;
}
exports.parse = parse;
function generateSourceMap(filename, source, generated, sourceRoot, pad) {
    const map = new source_map_1.SourceMapGenerator({
        file: filename.replace(/\\/g, '/'),
        sourceRoot: sourceRoot.replace(/\\/g, '/')
    });
    let offset = 0;
    if (!pad) {
        offset =
            source
                .split(generated)
                .shift()
                .split(splitRE).length - 1;
    }
    map.setSourceContent(filename, source);
    generated.split(splitRE).forEach((line, index) => {
        if (!emptyRE.test(line)) {
            map.addMapping({
                source: filename,
                original: {
                    line: index + 1 + offset,
                    column: 0
                },
                generated: {
                    line: index + 1,
                    column: 0
                }
            });
        }
    });
    return JSON.parse(map.toString());
}
