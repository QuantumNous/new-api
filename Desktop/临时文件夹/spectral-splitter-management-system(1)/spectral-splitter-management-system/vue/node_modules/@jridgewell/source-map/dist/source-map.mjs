const comma = ','.charCodeAt(0);
const semicolon = ';'.charCodeAt(0);
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const intToChar = new Uint8Array(64); // 64 possible chars.
const charToInteger = new Uint8Array(128); // z is 122 in ASCII
for (let i = 0; i < chars.length; i++) {
    const c = chars.charCodeAt(i);
    charToInteger[c] = i;
    intToChar[i] = c;
}
// Provide a fallback for older environments.
const td = typeof TextDecoder !== 'undefined'
    ? new TextDecoder()
    : typeof Buffer !== 'undefined'
        ? {
            decode(buf) {
                const out = Buffer.from(buf.buffer, buf.byteOffset, buf.byteLength);
                return out.toString();
            },
        }
        : {
            decode(buf) {
                let out = '';
                for (let i = 0; i < buf.length; i++) {
                    out += String.fromCharCode(buf[i]);
                }
                return out;
            },
        };
function decode(mappings) {
    const state = new Int32Array(5);
    const decoded = [];
    let line = [];
    let sorted = true;
    let lastCol = 0;
    for (let i = 0; i < mappings.length;) {
        const c = mappings.charCodeAt(i);
        if (c === comma) {
            i++;
        }
        else if (c === semicolon) {
            state[0] = lastCol = 0;
            if (!sorted)
                sort(line);
            sorted = true;
            decoded.push(line);
            line = [];
            i++;
        }
        else {
            i = decodeInteger(mappings, i, state, 0); // generatedCodeColumn
            const col = state[0];
            if (col < lastCol)
                sorted = false;
            lastCol = col;
            if (!hasMoreSegments(mappings, i)) {
                line.push([col]);
                continue;
            }
            i = decodeInteger(mappings, i, state, 1); // sourceFileIndex
            i = decodeInteger(mappings, i, state, 2); // sourceCodeLine
            i = decodeInteger(mappings, i, state, 3); // sourceCodeColumn
            if (!hasMoreSegments(mappings, i)) {
                line.push([col, state[1], state[2], state[3]]);
                continue;
            }
            i = decodeInteger(mappings, i, state, 4); // nameIndex
            line.push([col, state[1], state[2], state[3], state[4]]);
        }
    }
    if (!sorted)
        sort(line);
    decoded.push(line);
    return decoded;
}
function decodeInteger(mappings, pos, state, j) {
    let value = 0;
    let shift = 0;
    let integer = 0;
    do {
        const c = mappings.charCodeAt(pos++);
        integer = charToInteger[c];
        value |= (integer & 31) << shift;
        shift += 5;
    } while (integer & 32);
    const shouldNegate = value & 1;
    value >>>= 1;
    if (shouldNegate) {
        value = -0x80000000 | -value;
    }
    state[j] += value;
    return pos;
}
function hasMoreSegments(mappings, i) {
    if (i >= mappings.length)
        return false;
    const c = mappings.charCodeAt(i);
    if (c === comma || c === semicolon)
        return false;
    return true;
}
function sort(line) {
    line.sort(sortComparator$1);
}
function sortComparator$1(a, b) {
    return a[0] - b[0];
}
function encode(decoded) {
    const state = new Int32Array(5);
    let buf = new Uint8Array(1024);
    let pos = 0;
    for (let i = 0; i < decoded.length; i++) {
        const line = decoded[i];
        if (i > 0) {
            buf = reserve(buf, pos, 1);
            buf[pos++] = semicolon;
        }
        if (line.length === 0)
            continue;
        state[0] = 0;
        for (let j = 0; j < line.length; j++) {
            const segment = line[j];
            // We can push up to 5 ints, each int can take at most 7 chars, and we
            // may push a comma.
            buf = reserve(buf, pos, 36);
            if (j > 0)
                buf[pos++] = comma;
            pos = encodeInteger(buf, pos, state, segment, 0); // generatedCodeColumn
            if (segment.length === 1)
                continue;
            pos = encodeInteger(buf, pos, state, segment, 1); // sourceFileIndex
            pos = encodeInteger(buf, pos, state, segment, 2); // sourceCodeLine
            pos = encodeInteger(buf, pos, state, segment, 3); // sourceCodeColumn
            if (segment.length === 4)
                continue;
            pos = encodeInteger(buf, pos, state, segment, 4); // nameIndex
        }
    }
    return td.decode(buf.subarray(0, pos));
}
function reserve(buf, pos, count) {
    if (buf.length > pos + count)
        return buf;
    const swap = new Uint8Array(buf.length * 2);
    swap.set(buf);
    return swap;
}
function encodeInteger(buf, pos, state, segment, j) {
    const next = segment[j];
    let num = next - state[j];
    state[j] = next;
    num = num < 0 ? (-num << 1) | 1 : num << 1;
    do {
        let clamped = num & 0b011111;
        num >>>= 5;
        if (num > 0)
            clamped |= 0b100000;
        buf[pos++] = intToChar[clamped];
    } while (num > 0);
    return pos;
}

// Matches the scheme of a URL, eg "http://"
const schemeRegex = /^[\w+.-]+:\/\//;
/**
 * Matches the parts of a URL:
 * 1. Scheme, including ":", guaranteed.
 * 2. User/password, including "@", optional.
 * 3. Host, guaranteed.
 * 4. Port, including ":", optional.
 * 5. Path, including "/", optional.
 */
const urlRegex = /^([\w+.-]+:)\/\/([^@/#?]*@)?([^:/#?]*)(:\d+)?(\/[^#?]*)?/;
/**
 * File URLs are weird. They dont' need the regular `//` in the scheme, they may or may not start
 * with a leading `/`, they can have a domain (but only if they don't start with a Windows drive).
 *
 * 1. Host, optional.
 * 2. Path, which may inclue "/", guaranteed.
 */
const fileRegex = /^file:(?:\/\/((?![a-z]:)[^/]*)?)?(\/?.*)/i;
function isAbsoluteUrl(input) {
    return schemeRegex.test(input);
}
function isSchemeRelativeUrl(input) {
    return input.startsWith('//');
}
function isAbsolutePath(input) {
    return input.startsWith('/');
}
function isFileUrl(input) {
    return input.startsWith('file:');
}
function parseAbsoluteUrl(input) {
    const match = urlRegex.exec(input);
    return makeUrl(match[1], match[2] || '', match[3], match[4] || '', match[5] || '/');
}
function parseFileUrl(input) {
    const match = fileRegex.exec(input);
    const path = match[2];
    return makeUrl('file:', '', match[1] || '', '', isAbsolutePath(path) ? path : '/' + path);
}
function makeUrl(scheme, user, host, port, path) {
    return {
        scheme,
        user,
        host,
        port,
        path,
        relativePath: false,
    };
}
function parseUrl(input) {
    if (isSchemeRelativeUrl(input)) {
        const url = parseAbsoluteUrl('http:' + input);
        url.scheme = '';
        return url;
    }
    if (isAbsolutePath(input)) {
        const url = parseAbsoluteUrl('http://foo.com' + input);
        url.scheme = '';
        url.host = '';
        return url;
    }
    if (isFileUrl(input))
        return parseFileUrl(input);
    if (isAbsoluteUrl(input))
        return parseAbsoluteUrl(input);
    const url = parseAbsoluteUrl('http://foo.com/' + input);
    url.scheme = '';
    url.host = '';
    url.relativePath = true;
    return url;
}
function stripPathFilename(path) {
    // If a path ends with a parent directory "..", then it's a relative path with excess parent
    // paths. It's not a file, so we can't strip it.
    if (path.endsWith('/..'))
        return path;
    const index = path.lastIndexOf('/');
    return path.slice(0, index + 1);
}
function mergePaths(url, base) {
    // If we're not a relative path, then we're an absolute path, and it doesn't matter what base is.
    if (!url.relativePath)
        return;
    normalizePath(base);
    // If the path is just a "/", then it was an empty path to begin with (remember, we're a relative
    // path).
    if (url.path === '/') {
        url.path = base.path;
    }
    else {
        // Resolution happens relative to the base path's directory, not the file.
        url.path = stripPathFilename(base.path) + url.path;
    }
    // If the base path is absolute, then our path is now absolute too.
    url.relativePath = base.relativePath;
}
/**
 * The path can have empty directories "//", unneeded parents "foo/..", or current directory
 * "foo/.". We need to normalize to a standard representation.
 */
function normalizePath(url) {
    const { relativePath } = url;
    const pieces = url.path.split('/');
    // We need to preserve the first piece always, so that we output a leading slash. The item at
    // pieces[0] is an empty string.
    let pointer = 1;
    // Positive is the number of real directories we've output, used for popping a parent directory.
    // Eg, "foo/bar/.." will have a positive 2, and we can decrement to be left with just "foo".
    let positive = 0;
    // We need to keep a trailing slash if we encounter an empty directory (eg, splitting "foo/" will
    // generate `["foo", ""]` pieces). And, if we pop a parent directory. But once we encounter a
    // real directory, we won't need to append, unless the other conditions happen again.
    let addTrailingSlash = false;
    for (let i = 1; i < pieces.length; i++) {
        const piece = pieces[i];
        // An empty directory, could be a trailing slash, or just a double "//" in the path.
        if (!piece) {
            addTrailingSlash = true;
            continue;
        }
        // If we encounter a real directory, then we don't need to append anymore.
        addTrailingSlash = false;
        // A current directory, which we can always drop.
        if (piece === '.')
            continue;
        // A parent directory, we need to see if there are any real directories we can pop. Else, we
        // have an excess of parents, and we'll need to keep the "..".
        if (piece === '..') {
            if (positive) {
                addTrailingSlash = true;
                positive--;
                pointer--;
            }
            else if (relativePath) {
                // If we're in a relativePath, then we need to keep the excess parents. Else, in an absolute
                // URL, protocol relative URL, or an absolute path, we don't need to keep excess.
                pieces[pointer++] = piece;
            }
            continue;
        }
        // We've encountered a real directory. Move it to the next insertion pointer, which accounts for
        // any popped or dropped directories.
        pieces[pointer++] = piece;
        positive++;
    }
    let path = '';
    for (let i = 1; i < pointer; i++) {
        path += '/' + pieces[i];
    }
    if (!path || (addTrailingSlash && !path.endsWith('/..'))) {
        path += '/';
    }
    url.path = path;
}
/**
 * Attempts to resolve `input` URL/path relative to `base`.
 */
function resolve$1(input, base) {
    if (!input && !base)
        return '';
    const url = parseUrl(input);
    // If we have a base, and the input isn't already an absolute URL, then we need to merge.
    if (base && !url.scheme) {
        const baseUrl = parseUrl(base);
        url.scheme = baseUrl.scheme;
        // If there's no host, then we were just a path.
        if (!url.host) {
            // The host, user, and port are joined, you can't copy one without the others.
            url.user = baseUrl.user;
            url.host = baseUrl.host;
            url.port = baseUrl.port;
        }
        mergePaths(url, baseUrl);
    }
    normalizePath(url);
    // If the input (and base, if there was one) are both relative, then we need to output a relative.
    if (url.relativePath) {
        // The first char is always a "/".
        const path = url.path.slice(1);
        if (!path)
            return '.';
        // If base started with a leading ".", or there is no base and input started with a ".", then we
        // need to ensure that the relative path starts with a ".". We don't know if relative starts
        // with a "..", though, so check before prepending.
        const keepRelative = (base || input).startsWith('.');
        return !keepRelative || path.startsWith('.') ? path : './' + path;
    }
    // If there's no host (and no scheme/user/port), then we need to output an absolute path.
    if (!url.scheme && !url.host)
        return url.path;
    // We're outputting either an absolute URL, or a protocol relative one.
    return `${url.scheme}//${url.user}${url.host}${url.port}${url.path}`;
}

function resolve(input, base) {
    // The base is always treated as a directory, if it's not empty.
    // https://github.com/mozilla/source-map/blob/8cb3ee57/lib/util.js#L327
    // https://github.com/chromium/chromium/blob/da4adbb3/third_party/blink/renderer/devtools/front_end/sdk/SourceMap.js#L400-L401
    if (base && !base.endsWith('/'))
        base += '/';
    return resolve$1(input, base);
}

/**
 * Removes everything after the last "/", but leaves the slash.
 */
function stripFilename(path) {
    if (!path)
        return '';
    const index = path.lastIndexOf('/');
    return path.slice(0, index + 1);
}

const COLUMN$1 = 0;
const SOURCES_INDEX$1 = 1;
const SOURCE_LINE$1 = 2;
const SOURCE_COLUMN$1 = 3;
const NAMES_INDEX$1 = 4;

function maybeSort(mappings, owned) {
    const unsortedIndex = nextUnsortedSegmentLine(mappings, 0);
    if (unsortedIndex === mappings.length)
        return mappings;
    // If we own the array (meaning we parsed it from JSON), then we're free to directly mutate it. If
    // not, we do not want to modify the consumer's input array.
    if (!owned)
        mappings = mappings.slice();
    for (let i = unsortedIndex; i < mappings.length; i = nextUnsortedSegmentLine(mappings, i + 1)) {
        mappings[i] = sortSegments(mappings[i], owned);
    }
    return mappings;
}
function nextUnsortedSegmentLine(mappings, start) {
    for (let i = start; i < mappings.length; i++) {
        if (!isSorted(mappings[i]))
            return i;
    }
    return mappings.length;
}
function isSorted(line) {
    for (let j = 1; j < line.length; j++) {
        if (line[j][COLUMN$1] < line[j - 1][COLUMN$1]) {
            return false;
        }
    }
    return true;
}
function sortSegments(line, owned) {
    if (!owned)
        line = line.slice();
    return line.sort(sortComparator);
}
function sortComparator(a, b) {
    return a[COLUMN$1] - b[COLUMN$1];
}

let found = false;
/**
 * A binary search implementation that returns the index if a match is found.
 * If no match is found, then the left-index (the index associated with the item that comes just
 * before the desired index) is returned. To maintain proper sort order, a splice would happen at
 * the next index:
 *
 * ```js
 * const array = [1, 3];
 * const needle = 2;
 * const index = binarySearch(array, needle, (item, needle) => item - needle);
 *
 * assert.equal(index, 0);
 * array.splice(index + 1, 0, needle);
 * assert.deepEqual(array, [1, 2, 3]);
 * ```
 */
function binarySearch(haystack, needle, low, high) {
    while (low <= high) {
        const mid = low + ((high - low) >> 1);
        const cmp = haystack[mid][COLUMN$1] - needle;
        if (cmp === 0) {
            found = true;
            return mid;
        }
        if (cmp < 0) {
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    found = false;
    return low - 1;
}
function upperBound(haystack, needle, index) {
    for (let i = index + 1; i < haystack.length; i++, index++) {
        if (haystack[i][COLUMN$1] !== needle)
            break;
    }
    return index;
}
function lowerBound(haystack, needle, index) {
    for (let i = index - 1; i >= 0; i--, index--) {
        if (haystack[i][COLUMN$1] !== needle)
            break;
    }
    return index;
}
function memoizedState() {
    return {
        lastKey: -1,
        lastNeedle: -1,
        lastIndex: -1,
    };
}
/**
 * This overly complicated beast is just to record the last tested line/column and the resulting
 * index, allowing us to skip a few tests if mappings are monotonically increasing.
 */
function memoizedBinarySearch(haystack, needle, state, key) {
    const { lastKey, lastNeedle, lastIndex } = state;
    let low = 0;
    let high = haystack.length - 1;
    if (key === lastKey) {
        if (needle === lastNeedle) {
            found = lastIndex !== -1 && haystack[lastIndex][COLUMN$1] === needle;
            return lastIndex;
        }
        if (needle >= lastNeedle) {
            // lastIndex may be -1 if the previous needle was not found.
            low = lastIndex === -1 ? 0 : lastIndex;
        }
        else {
            high = lastIndex;
        }
    }
    state.lastKey = key;
    state.lastNeedle = needle;
    return (state.lastIndex = binarySearch(haystack, needle, low, high));
}

const AnyMap = function (map, mapUrl) {
    const parsed = typeof map === 'string' ? JSON.parse(map) : map;
    if (!('sections' in parsed))
        return new TraceMap(parsed, mapUrl);
    const mappings = [];
    const sources = [];
    const sourcesContent = [];
    const names = [];
    const { sections } = parsed;
    let i = 0;
    for (; i < sections.length - 1; i++) {
        const no = sections[i + 1].offset;
        addSection(sections[i], mapUrl, mappings, sources, sourcesContent, names, no.line, no.column);
    }
    if (sections.length > 0) {
        addSection(sections[i], mapUrl, mappings, sources, sourcesContent, names, Infinity, Infinity);
    }
    const joined = {
        version: 3,
        file: parsed.file,
        names,
        sources,
        sourcesContent,
        mappings,
    };
    return presortedDecodedMap(joined);
};
function addSection(section, mapUrl, mappings, sources, sourcesContent, names, stopLine, stopColumn) {
    const map = AnyMap(section.map, mapUrl);
    const { line: lineOffset, column: columnOffset } = section.offset;
    const sourcesOffset = sources.length;
    const namesOffset = names.length;
    const decoded = decodedMappings(map);
    const { resolvedSources } = map;
    append(sources, resolvedSources);
    append(sourcesContent, map.sourcesContent || fillSourcesContent(resolvedSources.length));
    append(names, map.names);
    // If this section jumps forwards several lines, we need to add lines to the output mappings catch up.
    for (let i = mappings.length; i <= lineOffset; i++)
        mappings.push([]);
    // We can only add so many lines before we step into the range that the next section's map
    // controls. When we get to the last line, then we'll start checking the segments to see if
    // they've crossed into the column range.
    const stopI = stopLine - lineOffset;
    const len = Math.min(decoded.length, stopI + 1);
    for (let i = 0; i < len; i++) {
        const line = decoded[i];
        // On the 0th loop, the line will already exist due to a previous section, or the line catch up
        // loop above.
        const out = i === 0 ? mappings[lineOffset] : (mappings[lineOffset + i] = []);
        // On the 0th loop, the section's column offset shifts us forward. On all other lines (since the
        // map can be multiple lines), it doesn't.
        const cOffset = i === 0 ? columnOffset : 0;
        for (let j = 0; j < line.length; j++) {
            const seg = line[j];
            const column = cOffset + seg[COLUMN$1];
            // If this segment steps into the column range that the next section's map controls, we need
            // to stop early.
            if (i === stopI && column >= stopColumn)
                break;
            if (seg.length === 1) {
                out.push([column]);
                continue;
            }
            const sourcesIndex = sourcesOffset + seg[SOURCES_INDEX$1];
            const sourceLine = seg[SOURCE_LINE$1];
            const sourceColumn = seg[SOURCE_COLUMN$1];
            if (seg.length === 4) {
                out.push([column, sourcesIndex, sourceLine, sourceColumn]);
                continue;
            }
            out.push([column, sourcesIndex, sourceLine, sourceColumn, namesOffset + seg[NAMES_INDEX$1]]);
        }
    }
}
function append(arr, other) {
    for (let i = 0; i < other.length; i++)
        arr.push(other[i]);
}
// Sourcemaps don't need to have sourcesContent, and if they don't, we need to create an array of
// equal length to the sources. This is because the sources and sourcesContent are paired arrays,
// where `sourcesContent[i]` is the content of the `sources[i]` file. If we didn't, then joined
// sourcemap would desynchronize the sources/contents.
function fillSourcesContent(len) {
    const sourcesContent = [];
    for (let i = 0; i < len; i++)
        sourcesContent[i] = null;
    return sourcesContent;
}

const INVALID_ORIGINAL_MAPPING = Object.freeze({
    source: null,
    line: null,
    column: null,
    name: null,
});
Object.freeze({
    line: null,
    column: null,
});
const LINE_GTR_ZERO = '`line` must be greater than 0 (lines start at line 1)';
const COL_GTR_EQ_ZERO = '`column` must be greater than or equal to 0 (columns start at column 0)';
const LEAST_UPPER_BOUND = -1;
const GREATEST_LOWER_BOUND = 1;
/**
 * Returns the decoded (array of lines of segments) form of the SourceMap's mappings field.
 */
let decodedMappings;
/**
 * A higher-level API to find the source/line/column associated with a generated line/column
 * (think, from a stack trace). Line is 1-based, but column is 0-based, due to legacy behavior in
 * `source-map` library.
 */
let originalPositionFor;
/**
 * A helper that skips sorting of the input map's mappings array, which can be expensive for larger
 * maps.
 */
let presortedDecodedMap;
class TraceMap {
    constructor(map, mapUrl) {
        this._decodedMemo = memoizedState();
        this._bySources = undefined;
        this._bySourceMemos = undefined;
        const isString = typeof map === 'string';
        if (!isString && map.constructor === TraceMap)
            return map;
        const parsed = (isString ? JSON.parse(map) : map);
        const { version, file, names, sourceRoot, sources, sourcesContent } = parsed;
        this.version = version;
        this.file = file;
        this.names = names;
        this.sourceRoot = sourceRoot;
        this.sources = sources;
        this.sourcesContent = sourcesContent;
        if (sourceRoot || mapUrl) {
            const from = resolve(sourceRoot || '', stripFilename(mapUrl));
            this.resolvedSources = sources.map((s) => resolve(s || '', from));
        }
        else {
            this.resolvedSources = sources.map((s) => s || '');
        }
        const { mappings } = parsed;
        if (typeof mappings === 'string') {
            this._encoded = mappings;
            this._decoded = undefined;
        }
        else {
            this._encoded = undefined;
            this._decoded = maybeSort(mappings, isString);
        }
    }
}
(() => {
    decodedMappings = (map) => {
        return (map._decoded || (map._decoded = decode(map._encoded)));
    };
    originalPositionFor = (map, { line, column, bias }) => {
        line--;
        if (line < 0)
            throw new Error(LINE_GTR_ZERO);
        if (column < 0)
            throw new Error(COL_GTR_EQ_ZERO);
        const decoded = decodedMappings(map);
        // It's common for parent source maps to have pointers to lines that have no
        // mapping (like a "//# sourceMappingURL=") at the end of the child file.
        if (line >= decoded.length)
            return INVALID_ORIGINAL_MAPPING;
        const segment = traceSegmentInternal(decoded[line], map._decodedMemo, line, column, bias || GREATEST_LOWER_BOUND);
        if (segment == null)
            return INVALID_ORIGINAL_MAPPING;
        if (segment.length == 1)
            return INVALID_ORIGINAL_MAPPING;
        const { names, resolvedSources } = map;
        return {
            source: resolvedSources[segment[SOURCES_INDEX$1]],
            line: segment[SOURCE_LINE$1] + 1,
            column: segment[SOURCE_COLUMN$1],
            name: segment.length === 5 ? names[segment[NAMES_INDEX$1]] : null,
        };
    };
    presortedDecodedMap = (map, mapUrl) => {
        const clone = Object.assign({}, map);
        clone.mappings = [];
        const tracer = new TraceMap(clone, mapUrl);
        tracer._decoded = map.mappings;
        return tracer;
    };
})();
function traceSegmentInternal(segments, memo, line, column, bias) {
    let index = memoizedBinarySearch(segments, column, memo, line);
    if (found) {
        index = (bias === LEAST_UPPER_BOUND ? upperBound : lowerBound)(segments, column, index);
    }
    else if (bias === LEAST_UPPER_BOUND)
        index++;
    if (index === -1 || index === segments.length)
        return null;
    return segments[index];
}

/**
 * Gets the index associated with `key` in the backing array, if it is already present.
 */
let get;
/**
 * Puts `key` into the backing array, if it is not already present. Returns
 * the index of the `key` in the backing array.
 */
let put;
/**
 * SetArray acts like a `Set` (allowing only one occurrence of a string `key`), but provides the
 * index of the `key` in the backing array.
 *
 * This is designed to allow synchronizing a second array with the contents of the backing array,
 * like how in a sourcemap `sourcesContent[i]` is the source content associated with `source[i]`,
 * and there are never duplicates.
 */
class SetArray {
    constructor() {
        this._indexes = { __proto__: null };
        this.array = [];
    }
}
(() => {
    get = (strarr, key) => strarr._indexes[key];
    put = (strarr, key) => {
        // The key may or may not be present. If it is present, it's a number.
        const index = get(strarr, key);
        if (index !== undefined)
            return index;
        const { array, _indexes: indexes } = strarr;
        return (indexes[key] = array.push(key) - 1);
    };
})();

const COLUMN = 0;
const SOURCES_INDEX = 1;
const SOURCE_LINE = 2;
const SOURCE_COLUMN = 3;
const NAMES_INDEX = 4;

const NO_NAME = -1;
/**
 * Same as `addMapping`, but will only add the mapping if it generates useful information in the
 * resulting map. This only works correctly if mappings are added **in order**, meaning you should
 * not add a mapping with a lower generated line/column than one that came before.
 */
let maybeAddMapping;
/**
 * Adds/removes the content of the source file to the source map.
 */
let setSourceContent;
/**
 * Returns a sourcemap object (with decoded mappings) suitable for passing to a library that expects
 * a sourcemap, or to JSON.stringify.
 */
let toDecodedMap;
/**
 * Returns a sourcemap object (with encoded mappings) suitable for passing to a library that expects
 * a sourcemap, or to JSON.stringify.
 */
let toEncodedMap;
// This split declaration is only so that terser can elminiate the static initialization block.
let addSegmentInternal;
/**
 * Provides the state to generate a sourcemap.
 */
class GenMapping {
    constructor({ file, sourceRoot } = {}) {
        this._names = new SetArray();
        this._sources = new SetArray();
        this._sourcesContent = [];
        this._mappings = [];
        this.file = file;
        this.sourceRoot = sourceRoot;
    }
}
(() => {
    maybeAddMapping = (map, mapping) => {
        return addMappingInternal(true, map, mapping);
    };
    setSourceContent = (map, source, content) => {
        const { _sources: sources, _sourcesContent: sourcesContent } = map;
        sourcesContent[put(sources, source)] = content;
    };
    toDecodedMap = (map) => {
        const { file, sourceRoot, _mappings: mappings, _sources: sources, _sourcesContent: sourcesContent, _names: names, } = map;
        removeEmptyFinalLines(mappings);
        return {
            version: 3,
            file: file || undefined,
            names: names.array,
            sourceRoot: sourceRoot || undefined,
            sources: sources.array,
            sourcesContent,
            mappings,
        };
    };
    toEncodedMap = (map) => {
        const decoded = toDecodedMap(map);
        return Object.assign(Object.assign({}, decoded), { mappings: encode(decoded.mappings) });
    };
    // Internal helpers
    addSegmentInternal = (skipable, map, genLine, genColumn, source, sourceLine, sourceColumn, name) => {
        const { _mappings: mappings, _sources: sources, _sourcesContent: sourcesContent, _names: names, } = map;
        const line = getLine(mappings, genLine);
        const index = getColumnIndex(line, genColumn);
        if (!source) {
            if (skipable && skipSourceless(line, index))
                return;
            return insert(line, index, [genColumn]);
        }
        const sourcesIndex = put(sources, source);
        const namesIndex = name ? put(names, name) : NO_NAME;
        if (sourcesIndex === sourcesContent.length)
            sourcesContent[sourcesIndex] = null;
        if (skipable && skipSource(line, index, sourcesIndex, sourceLine, sourceColumn, namesIndex)) {
            return;
        }
        return insert(line, index, name
            ? [genColumn, sourcesIndex, sourceLine, sourceColumn, namesIndex]
            : [genColumn, sourcesIndex, sourceLine, sourceColumn]);
    };
})();
function getLine(mappings, index) {
    for (let i = mappings.length; i <= index; i++) {
        mappings[i] = [];
    }
    return mappings[index];
}
function getColumnIndex(line, genColumn) {
    let index = line.length;
    for (let i = index - 1; i >= 0; index = i--) {
        const current = line[i];
        if (genColumn >= current[COLUMN])
            break;
    }
    return index;
}
function insert(array, index, value) {
    for (let i = array.length; i > index; i--) {
        array[i] = array[i - 1];
    }
    array[index] = value;
}
function removeEmptyFinalLines(mappings) {
    const { length } = mappings;
    let len = length;
    for (let i = len - 1; i >= 0; len = i, i--) {
        if (mappings[i].length > 0)
            break;
    }
    if (len < length)
        mappings.length = len;
}
function skipSourceless(line, index) {
    // The start of a line is already sourceless, so adding a sourceless segment to the beginning
    // doesn't generate any useful information.
    if (index === 0)
        return true;
    const prev = line[index - 1];
    // If the previous segment is also sourceless, then adding another sourceless segment doesn't
    // genrate any new information. Else, this segment will end the source/named segment and point to
    // a sourceless position, which is useful.
    return prev.length === 1;
}
function skipSource(line, index, sourcesIndex, sourceLine, sourceColumn, namesIndex) {
    // A source/named segment at the start of a line gives position at that genColumn
    if (index === 0)
        return false;
    const prev = line[index - 1];
    // If the previous segment is sourceless, then we're transitioning to a source.
    if (prev.length === 1)
        return false;
    // If the previous segment maps to the exact same source position, then this segment doesn't
    // provide any new position information.
    return (sourcesIndex === prev[SOURCES_INDEX] &&
        sourceLine === prev[SOURCE_LINE] &&
        sourceColumn === prev[SOURCE_COLUMN] &&
        namesIndex === (prev.length === 5 ? prev[NAMES_INDEX] : NO_NAME));
}
function addMappingInternal(skipable, map, mapping) {
    const { generated, source, original, name } = mapping;
    if (!source) {
        return addSegmentInternal(skipable, map, generated.line - 1, generated.column, null, null, null, null);
    }
    const s = source;
    return addSegmentInternal(skipable, map, generated.line - 1, generated.column, s, original.line - 1, original.column, name);
}

class SourceMapConsumer {
    constructor(map, mapUrl) {
        const trace = (this._map = new AnyMap(map, mapUrl));
        this.file = trace.file;
        this.names = trace.names;
        this.sourceRoot = trace.sourceRoot;
        this.sources = trace.resolvedSources;
        this.sourcesContent = trace.sourcesContent;
    }
    originalPositionFor(needle) {
        return originalPositionFor(this._map, needle);
    }
    destroy() {
        // noop.
    }
}
class SourceMapGenerator {
    constructor(opts) {
        this._map = new GenMapping(opts);
    }
    addMapping(mapping) {
        maybeAddMapping(this._map, mapping);
    }
    setSourceContent(source, content) {
        setSourceContent(this._map, source, content);
    }
    toJSON() {
        return toEncodedMap(this._map);
    }
    toDecodedMap() {
        return toDecodedMap(this._map);
    }
}

export { SourceMapConsumer, SourceMapGenerator };
//# sourceMappingURL=source-map.mjs.map
