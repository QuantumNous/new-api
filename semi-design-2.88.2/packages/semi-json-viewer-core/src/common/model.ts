/** reference from https://github.com/microsoft/vscode */
import { WordCharacterClassifier } from './wordCharacterClassifier';
import { Range } from './range';
export const enum EndOfLinePreference {
    /**
     * Use the end of line character identified in the text buffer.
     */
    TextDefined = 0,
    /**
     * Use line feed (\n) as the end of line character.
     */
    LF = 1,
    /**
     * Use carriage return and line feed (\r\n) as the end of line character.
     */
    CRLF = 2,
}

export class FindMatch {
    _findMatchBrand: void = undefined;

    public readonly range: Range;
    public readonly matches: string[] | null;

    /**
     * @internal
     */
    constructor(range: Range, matches: string[] | null) {
        this.range = range;
        this.matches = matches;
    }
}
/**
 * Text snapshot that works like an iterator.
 * Will try to return chunks of roughly ~64KB size.
 * Will return null when finished.
 */
export interface ITextSnapshot {
    read(): string | null
}

/**
 * @internal
 */
export class SearchData {
    /**
     * The regex to search for. Always defined.
     */
    public readonly regex: RegExp;
    /**
     * The word separator classifier.
     */
    public readonly wordSeparators: WordCharacterClassifier | null;
    /**
     * The simple string to search for (if possible).
     */
    public readonly simpleSearch: string | null;

    constructor(regex: RegExp, wordSeparators: WordCharacterClassifier | null, simpleSearch: string | null) {
        this.regex = regex;
        this.wordSeparators = wordSeparators;
        this.simpleSearch = simpleSearch;
    }
}
