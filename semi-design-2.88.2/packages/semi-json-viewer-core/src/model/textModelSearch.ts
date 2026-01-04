/** Based on https://github.com/microsoft/vscode-json-languageservice with modifications for custom requirements */
import { CharCode } from '../common/charCode';
import {
    getMapForWordSeparators,
    WordCharacterClass,
    WordCharacterClassifier,
} from '../common/wordCharacterClassifier';
import { FindMatch } from '../common/model';
import { Range } from '../common/range';
import { EndOfLinePreference, SearchData } from '../common/model';
import { createRegExp, getNextCodePoint } from '../common/strings';
import { JSONModel } from './jsonModel';
const LIMIT_FIND_COUNT = 999;


class LineFeedCounter {
    private readonly _lineFeedsOffsets: number[];

    constructor(text: string) {
        const lineFeedsOffsets: number[] = [];
        let lineFeedsOffsetsLen = 0;
        for (let i = 0, textLen = text.length; i < textLen; i++) {
            if (text.charCodeAt(i) === CharCode.LineFeed) {
                lineFeedsOffsets[lineFeedsOffsetsLen++] = i;
            }
        }
        this._lineFeedsOffsets = lineFeedsOffsets;
    }

    public findLineFeedCountBeforeOffset(offset: number): number {
        const lineFeedsOffsets = this._lineFeedsOffsets;
        let min = 0;
        let max = lineFeedsOffsets.length - 1;

        if (max === -1) {
            // no line feeds
            return 0;
        }

        if (offset <= lineFeedsOffsets[0]) {
            // before first line feed
            return 0;
        }

        while (min < max) {
            const mid = min + (((max - min) / 2) >> 0);

            if (lineFeedsOffsets[mid] >= offset) {
                max = mid - 1;
            } else {
                if (lineFeedsOffsets[mid + 1] >= offset) {
                    // bingo!
                    min = mid;
                    max = mid;
                } else {
                    min = mid + 1;
                }
            }
        }
        return min + 1;
    }
}

export class TextModelSearch {
    public static findMatches(
        model: JSONModel,
        searchParams: SearchParams,
        searchRange: Range,
        captureMatches: boolean,
        limitResultCount: number
    ) {
        const searchData = searchParams.parseSearchRequest();
        if (!searchData) return [];
        if (searchData.regex.multiline) {
            return this._doFindMatchesMultiline(
                model,
                searchRange,
                new Searcher(searchData.wordSeparators, searchData.regex),
                captureMatches,
                limitResultCount
            );
        }
        return this._doFindMatchesLineByLine(model, searchRange, searchData, captureMatches, limitResultCount);
    }

    private static _doFindMatchesMultiline(
        model: JSONModel,
        searchRange: Range,
        searcher: Searcher,
        captureMatches: boolean,
        limitResultCount: number
    ): FindMatch[] {
        const pos = searchRange.getStartPosition();
        const deltaOffset = model.getOffsetAt(pos.lineNumber, pos.column);
        // We always execute multiline search over the lines joined with \n
        // This makes it that \n will match the EOL for both CRLF and LF models
        // We compensate for offset errors in `_getMultilineMatchRange`
        const text = model.getValueInRange(searchRange, EndOfLinePreference.LF);
        const lfCounter = model.getEOL() === '\r\n' ? new LineFeedCounter(text) : null;

        const result: FindMatch[] = [];
        let counter = 0;

        let m: RegExpExecArray | null;
        searcher.reset(0);
        while ((m = searcher.next(text))) {
            result[counter++] = createFindMatch(
                this._getMultilineMatchRange(model, deltaOffset, text, lfCounter, m.index, m[0]),
                m,
                captureMatches
            );
            if (counter >= limitResultCount) {
                return result;
            }
        }

        return result;
    }

    /**
     * Multiline search always executes on the lines concatenated with \n.
     * We must therefore compensate for the count of \n in case the model is CRLF
     */
    private static _getMultilineMatchRange(
        model: JSONModel,
        deltaOffset: number,
        text: string,
        lfCounter: LineFeedCounter | null,
        matchIndex: number,
        match0: string
    ): Range {
        let startOffset: number;
        let lineFeedCountBeforeMatch = 0;
        if (lfCounter) {
            lineFeedCountBeforeMatch = lfCounter.findLineFeedCountBeforeOffset(matchIndex);
            startOffset = deltaOffset + matchIndex + lineFeedCountBeforeMatch /* add as many \r as there were \n */;
        } else {
            startOffset = deltaOffset + matchIndex;
        }

        let endOffset: number;
        if (lfCounter) {
            const lineFeedCountBeforeEndOfMatch = lfCounter.findLineFeedCountBeforeOffset(matchIndex + match0.length);
            const lineFeedCountInMatch = lineFeedCountBeforeEndOfMatch - lineFeedCountBeforeMatch;
            endOffset = startOffset + match0.length + lineFeedCountInMatch /* add as many \r as there were \n */;
        } else {
            endOffset = startOffset + match0.length;
        }

        const startPosition = model.positionAt(startOffset);
        const endPosition = model.positionAt(endOffset);
        return new Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column);
    }

    private static _doFindMatchesLineByLine(
        model: JSONModel,
        searchRange: Range,
        searchData: SearchData,
        captureMatches: boolean,
        limitResultCount: number
    ) {
        const res: FindMatch[] = [];
        let resLen = 0;
        if (searchRange.startLineNumber === searchRange.endLineNumber) {
            const text = model
                .getLineContent(searchRange.startLineNumber)
                .substring(searchRange.startColumn - 1, searchRange.endColumn - 1);
            resLen = this._findMatchesInLine(
                searchData,
                text,
                searchRange.startLineNumber,
                searchRange.startColumn - 1,
                resLen,
                res,
                captureMatches,
                limitResultCount
            );
        }
        const text = model.getLineContent(searchRange.startLineNumber).substring(searchRange.startColumn - 1);
        resLen = this._findMatchesInLine(
            searchData,
            text,
            searchRange.startLineNumber,
            searchRange.startColumn - 1,
            resLen,
            res,
            captureMatches,
            limitResultCount
        );

        // Collect results from middle lines
        for (
            let lineNumber = searchRange.startLineNumber + 1;
            lineNumber < searchRange.endLineNumber && resLen < limitResultCount;
            lineNumber++
        ) {
            resLen = this._findMatchesInLine(
                searchData,
                model.getLineContent(lineNumber),
                lineNumber,
                0,
                resLen,
                res,
                captureMatches,
                limitResultCount
            );
        }

        // Collect results from last line
        if (resLen < limitResultCount) {
            const text = model.getLineContent(searchRange.endLineNumber).substring(0, searchRange.endColumn - 1);
            resLen = this._findMatchesInLine(
                searchData,
                text,
                searchRange.endLineNumber,
                0,
                resLen,
                res,
                captureMatches,
                limitResultCount
            );
        }

        return res;
    }

    private static _findMatchesInLine(
        searchData: SearchData,
        text: string,
        lineNumber: number,
        deltaOffset: number,
        resultLen: number,
        result: FindMatch[],
        captureMatches: boolean,
        limitResultCount: number
    ) {
        const wordSeparators = searchData.wordSeparators;
        if (!captureMatches && searchData.simpleSearch) {
            const searchString = searchData.simpleSearch;
            const searchStringLen = searchString.length;
            const textLength = text.length;
            let lastMatchIndex = -searchStringLen;
            while ((lastMatchIndex = text.indexOf(searchString, lastMatchIndex + searchStringLen)) !== -1) {
                if (
                    !wordSeparators ||
                    isValidMatch(wordSeparators, text, textLength, lastMatchIndex, searchStringLen)
                ) {
                    result[resultLen++] = new FindMatch(
                        new Range(
                            lineNumber,
                            lastMatchIndex + 1 + deltaOffset,
                            lineNumber,
                            lastMatchIndex + 1 + searchStringLen + deltaOffset
                        ),
                        null
                    );
                    if (resultLen >= limitResultCount) return resultLen;
                }
            }
        }
        const searcher = new Searcher(searchData.wordSeparators, searchData.regex);
        let m: RegExpExecArray | null;
        searcher.reset(0);
        do {
            m = searcher.next(text);
            if (m) {
                result[resultLen++] = createFindMatch(
                    new Range(
                        lineNumber,
                        m.index + 1 + deltaOffset,
                        lineNumber,
                        m.index + 1 + m[0].length + deltaOffset
                    ),
                    m,
                    captureMatches
                );
                if (resultLen >= limitResultCount) {
                    return resultLen;
                }
            }
        } while (m);
        return resultLen;
    }
}

export class SearchParams {
    public readonly searchString: string;
    public readonly isRegex: boolean;
    public readonly matchCase: boolean;
    public readonly wordSeparators: string | null;

    constructor(searchString: string, isRegex: boolean, matchCase: boolean, wordSeparators: string | null) {
        this.searchString = searchString;
        this.isRegex = isRegex;
        this.matchCase = matchCase;
        this.wordSeparators = wordSeparators;
    }

    public parseSearchRequest(): SearchData | null {
        if (this.searchString === '') {
            return null;
        }

        // Try to create a RegExp out of the params
        let multiline: boolean;
        if (this.isRegex) {
            multiline = isMultilineRegexSource(this.searchString);
        } else {
            multiline = this.searchString.indexOf('\n') >= 0;
        }

        let regex: RegExp | null = null;
        try {
            regex = createRegExp(this.searchString, this.isRegex, {
                matchCase: this.matchCase,
                wholeWord: false,
                multiline: multiline,
                global: true,
                unicode: true,
            });
        } catch (err) {
            return null;
        }

        if (!regex) {
            return null;
        }

        let canUseSimpleSearch = !this.isRegex && !multiline;
        if (canUseSimpleSearch && this.searchString.toLowerCase() !== this.searchString.toUpperCase()) {
            // casing might make a difference
            canUseSimpleSearch = this.matchCase;
        }

        return new SearchData(
            regex,
            this.wordSeparators ? getMapForWordSeparators(this.wordSeparators, []) : null,
            canUseSimpleSearch ? this.searchString : null
        );
    }
}

export function isMultilineRegexSource(searchString: string): boolean {
    if (!searchString || searchString.length === 0) {
        return false;
    }

    for (let i = 0, len = searchString.length; i < len; i++) {
        const chCode = searchString.charCodeAt(i);

        if (chCode === CharCode.LineFeed) {
            return true;
        }

        if (chCode === CharCode.Backslash) {
            // move to next char
            i++;

            if (i >= len) {
                // string ends with a \
                break;
            }

            const nextChCode = searchString.charCodeAt(i);
            if (nextChCode === CharCode.n || nextChCode === CharCode.r || nextChCode === CharCode.W) {
                return true;
            }
        }
    }

    return false;
}

function leftIsWordBounday(
    wordSeparators: WordCharacterClassifier,
    text: string,
    textLength: number,
    matchStartIndex: number,
    matchLength: number
): boolean {
    if (matchStartIndex === 0) {
        // Match starts at start of string
        return true;
    }

    const charBefore = text.charCodeAt(matchStartIndex - 1);
    if (wordSeparators.get(charBefore) !== WordCharacterClass.Regular) {
        // The character before the match is a word separator
        return true;
    }

    if (charBefore === CharCode.CarriageReturn || charBefore === CharCode.LineFeed) {
        // The character before the match is line break or carriage return.
        return true;
    }

    if (matchLength > 0) {
        const firstCharInMatch = text.charCodeAt(matchStartIndex);
        if (wordSeparators.get(firstCharInMatch) !== WordCharacterClass.Regular) {
            // The first character inside the match is a word separator
            return true;
        }
    }

    return false;
}

function rightIsWordBounday(
    wordSeparators: WordCharacterClassifier,
    text: string,
    textLength: number,
    matchStartIndex: number,
    matchLength: number
): boolean {
    if (matchStartIndex + matchLength === textLength) {
        // Match ends at end of string
        return true;
    }

    const charAfter = text.charCodeAt(matchStartIndex + matchLength);
    if (wordSeparators.get(charAfter) !== WordCharacterClass.Regular) {
        // The character after the match is a word separator
        return true;
    }

    if (charAfter === CharCode.CarriageReturn || charAfter === CharCode.LineFeed) {
        // The character after the match is line break or carriage return.
        return true;
    }

    if (matchLength > 0) {
        const lastCharInMatch = text.charCodeAt(matchStartIndex + matchLength - 1);
        if (wordSeparators.get(lastCharInMatch) !== WordCharacterClass.Regular) {
            // The last character in the match is a word separator
            return true;
        }
    }

    return false;
}

export function isValidMatch(
    wordSeparators: WordCharacterClassifier,
    text: string,
    textLength: number,
    matchStartIndex: number,
    matchLength: number
): boolean {
    return (
        leftIsWordBounday(wordSeparators, text, textLength, matchStartIndex, matchLength) &&
        rightIsWordBounday(wordSeparators, text, textLength, matchStartIndex, matchLength)
    );
}

export class Searcher {
    public readonly _wordSeparators: WordCharacterClassifier | null;
    private readonly _searchRegex: RegExp;
    private _prevMatchStartIndex: number;
    private _prevMatchLength: number;

    constructor(wordSeparators: WordCharacterClassifier | null, searchRegex: RegExp) {
        this._wordSeparators = wordSeparators;
        this._searchRegex = searchRegex;
        this._prevMatchStartIndex = -1;
        this._prevMatchLength = 0;
    }

    public reset(lastIndex: number): void {
        this._searchRegex.lastIndex = lastIndex;
        this._prevMatchStartIndex = -1;
        this._prevMatchLength = 0;
    }

    public next(text: string): RegExpExecArray | null {
        const textLength = text.length;

        let m: RegExpExecArray | null;
        do {
            if (this._prevMatchStartIndex + this._prevMatchLength === textLength) {
                // Reached the end of the line
                return null;
            }

            m = this._searchRegex.exec(text);
            if (!m) {
                return null;
            }

            const matchStartIndex = m.index;
            const matchLength = m[0].length;
            if (matchStartIndex === this._prevMatchStartIndex && matchLength === this._prevMatchLength) {
                if (matchLength === 0) {
                    // the search result is an empty string and won't advance `regex.lastIndex`, so `regex.exec` will stuck here
                    // we attempt to recover from that by advancing by two if surrogate pair found and by one otherwise
                    if (getNextCodePoint(text, textLength, this._searchRegex.lastIndex) > 0xffff) {
                        this._searchRegex.lastIndex += 2;
                    } else {
                        this._searchRegex.lastIndex += 1;
                    }
                    continue;
                }
                // Exit early if the regex matches the same range twice
                return null;
            }
            this._prevMatchStartIndex = matchStartIndex;
            this._prevMatchLength = matchLength;

            if (
                !this._wordSeparators ||
                isValidMatch(this._wordSeparators, text, textLength, matchStartIndex, matchLength)
            ) {
                return m;
            }
        } while (m);

        return null;
    }
}

export function createFindMatch(range: Range, rawMatches: RegExpExecArray, captureMatches: boolean): FindMatch {
    if (!captureMatches) {
        return new FindMatch(range, null);
    }
    const matches: string[] = [];
    for (let i = 0, len = rawMatches.length; i < len; i++) {
        matches[i] = rawMatches[i];
    }
    return new FindMatch(range, matches);
}
