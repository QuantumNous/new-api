/** reference from https://github.com/microsoft/vscode */

import { CharCode } from './charCode';

/**
 * Escapes regular expression characters in a given string
 * 转义正则表达式中的特殊字符。它将输入字符串中的正则表达式特殊字符（如 \ { } * + ? | ^ $ . [ ] ( )）前面加上反斜杠，
 * 以确保这些字符被视为普通字符而不是正则表达式的元字符
 */
export function escapeRegExpCharacters(value: string): string {
    // eslint-disable-next-line no-useless-escape
    return value.replace(/[\\\{\}\*\+\?\|\^\$\.\[\]\(\)]/g, '\\$&');
}

/**
 * 检查给定的字符码是否表示一个高代理项（high surrogate）。
 * 高代理项是用于表示Unicode扩展字符的一部分，通常与低代理项一起使用。
 * 在JavaScript中，字符码可以通过 `str.charCodeAt(index)` 方法获取。
 *
 * @param {number} charCode - 要检查的字符码。
 * @returns {boolean} - 如果字符码表示一个高代理项，则返回 true，否则返回 false。
 */
export function isHighSurrogate(charCode: number): boolean {
    return 0xd800 <= charCode && charCode <= 0xdbff;
}

/**
 * 检查给定的字符码是否表示一个低代理项（low surrogate）。
 * 低代理项是用于表示Unicode扩展字符的一部分，通常与高代理项一起使用。
 * 在JavaScript中，字符码可以通过 `str.charCodeAt(index)` 方法获取。
 *
 * @param {number} charCode - 要检查的字符码。
 * @returns {boolean} - 如果字符码表示一个低代理项，则返回 true，否则返回 false。
 */
export function isLowSurrogate(charCode: number): boolean {
    return 0xdc00 <= charCode && charCode <= 0xdfff;
}

/**
 * 计算一个Unicode代码点（code point），它由一个高代理项（high surrogate）和一个低代理项（low surrogate）组成。
 * 在JavaScript中，Unicode代码点可以通过 `str.codePointAt(index)` 方法获取。
 *
 * @param {number} highSurrogate - 高代理项的字符码。
 * @param {number} lowSurrogate - 低代理项的字符码。
 * @returns {number} - 计算得到的Unicode代码点。
 */
export function computeCodePoint(highSurrogate: number, lowSurrogate: number): number {
    return ((highSurrogate - 0xd800) << 10) + (lowSurrogate - 0xdc00) + 0x10000;
}

/**
 * 获取一个字符串中下一个Unicode代码点（code point）。
 * 在JavaScript中，Unicode代码点可以通过 `str.codePointAt(index)` 方法获取。
 *
 * @param {string} str - 要检查的字符串。
 * @param {number} len - 字符串的长度。
 * @param {number} offset - 当前检查的索引位置。
 * @returns {number} - 下一个Unicode代码点。
 */
export function getNextCodePoint(str: string, len: number, offset: number): number {
    const charCode = str.charCodeAt(offset);
    if (isHighSurrogate(charCode) && offset + 1 < len) {
        const nextCharCode = str.charCodeAt(offset + 1);
        if (isLowSurrogate(nextCharCode)) {
            return computeCodePoint(charCode, nextCharCode);
        }
    }
    return charCode;
}

/**
 * 表示正则表达式选项的接口。
 */
export interface RegExpOptions {
    matchCase?: boolean;
    wholeWord?: boolean;
    multiline?: boolean;
    global?: boolean;
    unicode?: boolean
}

/**
 * 创建一个正则表达式对象，根据给定的搜索字符串和选项进行配置。
 *
 * @param {string} searchString - 要搜索的字符串。
 * @param {boolean} isRegex - 是否使用正则表达式。
 * @param {RegExpOptions} options - 正则表达式选项。
 * @returns {RegExp} - 创建的正则表达式对象。
 */
export function createRegExp(searchString: string, isRegex: boolean, options: RegExpOptions = {}): RegExp {
    if (!searchString) {
        throw new Error('Cannot create regex from empty string');
    }
    if (!isRegex) {
        searchString = escapeRegExpCharacters(searchString);
    }
    if (options.wholeWord) {
        if (!/\B/.test(searchString.charAt(0))) {
            searchString = '\\b' + searchString;
        }
        if (!/\B/.test(searchString.charAt(searchString.length - 1))) {
            searchString = searchString + '\\b';
        }
    }
    let modifiers = '';
    if (options.global) {
        modifiers += 'g';
    }
    if (!options.matchCase) {
        modifiers += 'i';
    }
    if (options.multiline) {
        modifiers += 'm';
    }
    if (options.unicode) {
        modifiers += 'u';
    }

    return new RegExp(searchString, modifiers);
}

export function getLeadingWhitespace(str: string, start: number = 0, end: number = str.length): string {
    for (let i = start; i < end; i++) {
        const chCode = str.charCodeAt(i);
        if (chCode !== CharCode.Space && chCode !== CharCode.Tab) {
            return str.substring(start, i);
        }
    }
    return str.substring(start, end);
}

export function firstNonWhitespaceIndex(str: string): number {
    for (let i = 0, len = str.length; i < len; i++) {
        const chCode = str.charCodeAt(i);
        if (chCode !== CharCode.Space && chCode !== CharCode.Tab) {
            return i;
        }
    }
    return -1;
}

export const enum StringEOL {
    Unknown = 0,
    Invalid = 3,
    LF = 1,
    CRLF = 2,
}

export function countEOL(text: string): [number, number, number, StringEOL] {
    let eolCount = 0;
    let firstLineLength = 0;
    let lastLineStart = 0;
    let eol: StringEOL = StringEOL.Unknown;
    for (let i = 0, len = text.length; i < len; i++) {
        const chr = text.charCodeAt(i);

        if (chr === CharCode.CarriageReturn) {
            if (eolCount === 0) {
                firstLineLength = i;
            }
            eolCount++;
            if (i + 1 < len && text.charCodeAt(i + 1) === CharCode.LineFeed) {
                // \r\n... case
                eol |= StringEOL.CRLF;
                i++; // skip \n
            } else {
                // \r... case
                eol |= StringEOL.Invalid;
            }
            lastLineStart = i + 1;
        } else if (chr === CharCode.LineFeed) {
            // \n... case
            eol |= StringEOL.LF;
            if (eolCount === 0) {
                firstLineLength = i;
            }
            eolCount++;
            lastLineStart = i + 1;
        }
    }
    if (eolCount === 0) {
        firstLineLength = text.length;
    }
    return [eolCount, firstLineLength, text.length - lastLineStart, eol];
}
