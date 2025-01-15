import { Theme } from './theme';
/**
 * Options passed to [[highlight]]
 */
export interface HighlightOptions {
    /**
     * Can be a name, file extension, alias etc. If omitted, tries to auto-detect language.
     */
    language?: string;
    /**
     * When present and evaluates to a true value, forces highlighting to finish even in case of
     * detecting illegal syntax for the language instead of throwing an exception.
     */
    ignoreIllegals?: boolean;
    /**
     * Optional array of language names and aliases restricting detection to only those languages.
     */
    languageSubset?: string[];
    /**
     * Supply a custom theme where you override language tokens with own formatter functions. Every
     * token that is not overriden falls back to the [[DEFAULT_THEME]]
     */
    theme?: Theme;
}
/**
 * Apply syntax highlighting to `code` with ASCII color codes. The language is automatically
 * detected if not set.
 *
 * ```ts
 * import {highlight} from 'cli-highlight';
 * import * as fs from 'fs';
 *
 * fs.readFile('package.json', 'utf8', (err: any, json: string) => {
 *     console.log('package.json:');
 *     console.log(highlight(json));
 * });
 * ```
 *
 * @param code The code to highlight
 * @param options Optional options
 */
export declare function highlight(code: string, options?: HighlightOptions): string;
/**
 * Returns all supported languages
 */
export declare function listLanguages(): string[];
/**
 * Returns true if the language is supported
 * @param name A language name, alias or file extension
 */
export declare function supportsLanguage(name: string): boolean;
export default highlight;
export * from './theme';
