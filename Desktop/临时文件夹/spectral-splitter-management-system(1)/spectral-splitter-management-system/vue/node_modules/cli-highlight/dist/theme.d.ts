/**
 * A generic interface that holds all available language tokens.
 */
export interface Tokens<T> {
    /**
     * keyword in a regular Algol-style language
     */
    keyword?: T;
    /**
     * built-in or library object (constant, class, function)
     */
    built_in?: T;
    /**
     * user-defined type in a language with first-class syntactically significant types, like Haskell
     */
    type?: T;
    /**
     * special identifier for a built-in value ("true", "false", "null")
     */
    literal?: T;
    /**
     * number, including units and modifiers, if any.
     */
    number?: T;
    /**
     * literal regular expression
     */
    regexp?: T;
    /**
     * literal string, character
     */
    string?: T;
    /**
     * parsed section inside a literal string
     */
    subst?: T;
    /**
     * symbolic constant, interned string, goto label
     */
    symbol?: T;
    /**
     * class or class-level declaration (interfaces, traits, modules, etc)
     */
    class?: T;
    /**
     * function or method declaration
     */
    function?: T;
    /**
     * name of a class or a function at the place of declaration
     */
    title?: T;
    /**
     * block of function arguments (parameters) at the place of declaration
     */
    params?: T;
    /**
     * comment
     */
    comment?: T;
    /**
     * documentation markup within comments
     */
    doctag?: T;
    /**
     * flags, modifiers, annotations, processing instructions, preprocessor directive, etc
     */
    meta?: T;
    /**
     * keyword or built-in within meta construct
     */
    'meta-keyword'?: T;
    /**
     * string within meta construct
     */
    'meta-string'?: T;
    /**
     * heading of a section in a config file, heading in text markup
     */
    section?: T;
    /**
     * XML/HTML tag
     */
    tag?: T;
    /**
     * name of an XML tag, the first word in an s-expression
     */
    name?: T;
    /**
     * s-expression name from the language standard library
     */
    'builtin-name'?: T;
    /**
     * name of an attribute with no language defined semantics (keys in JSON, setting names in .ini), also sub-attribute within another highlighted object, like XML tag
     */
    attr?: T;
    /**
     * name of an attribute followed by a structured value part, like CSS properties
     */
    attribute?: T;
    /**
     * variable in a config or a template file, environment var expansion in a script
     */
    variable?: T;
    /**
     * list item bullet in text markup
     */
    bullet?: T;
    /**
     * code block in text markup
     */
    code?: T;
    /**
     * emphasis in text markup
     */
    emphasis?: T;
    /**
     * strong emphasis in text markup
     */
    strong?: T;
    /**
     * mathematical formula in text markup
     */
    formula?: T;
    /**
     * hyperlink in text markup
     */
    link?: T;
    /**
     * quotation in text markup
     */
    quote?: T;
    /**
     * tag selector in CSS
     */
    'selector-tag'?: T;
    /**
     * #id selector in CSS
     */
    'selector-id'?: T;
    /**
     * .class selector in CSS
     */
    'selector-class'?: T;
    /**
     * [attr] selector in CSS
     */
    'selector-attr'?: T;
    /**
     * :pseudo selector in CSS
     */
    'selector-pseudo'?: T;
    /**
     * tag of a template language
     */
    'template-tag'?: T;
    /**
     * variable in a template language
     */
    'template-variable'?: T;
    /**
     * added or changed line in a diff
     */
    addition?: T;
    /**
     * deleted line in a diff
     */
    deletion?: T;
}
/**
 * Possible styles that can be used on a token in a JSON theme.
 * See the [chalk](https://github.com/chalk/chalk) module for more information.
 * `plain` means no styling.
 */
export declare type Style = 'reset' | 'bold' | 'dim' | 'italic' | 'underline' | 'inverse' | 'hidden' | 'strikethrough' | 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white' | 'gray' | 'bgBlack' | 'bgRed' | 'bgGreen' | 'bgYellow' | 'bgBlue' | 'bgMagenta' | 'bgCyan' | 'plain';
/**
 * The schema of a JSON file defining a custom scheme. The key is a language token, while the value
 * is a [chalk](https://github.com/chalk/chalk#styles) style.
 *
 * Example:
 * ```json
 * {
 *     "keyword": ["red", "bold"],
 *     "addition": "green",
 *     "deletion": ["red", "strikethrough"],
 *     "number": "plain"
 * }
 * ```
 */
export interface JsonTheme extends Tokens<Style | Style[]> {
}
/**
 * Passed to [[highlight]] as the `theme` option. A theme is a map of language tokens to a function
 * that takes in string value of the token and returns a new string with colorization applied
 * (typically a [chalk](https://github.com/chalk/chalk) style), but you can also provide your own
 * formatting functions.
 *
 * Example:
 * ```ts
 * import {Theme, plain} from 'cli-highlight';
 * import chalk = require('chalk');
 *
 * const myTheme: Theme = {
 *     keyword: chalk.red.bold,
 *     addition: chalk.green,
 *     deletion: chalk.red.strikethrough,
 *     number: plain
 * };
 * ```
 */
export interface Theme extends Tokens<(codePart: string) => string> {
    /**
     * things not matched by any token
     */
    default?: (codePart: string) => string;
}
/**
 * Identity function for tokens that should not be styled (returns the input string as-is).
 * See [[Theme]] for an example.
 */
export declare const plain: (codePart: string) => string;
/**
 * The default theme. It is possible to override just individual keys.
 */
export declare const DEFAULT_THEME: Theme;
/**
 * Converts a [[JsonTheme]] with string values to a [[Theme]] with formatter functions. Used by [[parse]].
 */
export declare function fromJson(json: JsonTheme): Theme;
/**
 * Converts a [[Theme]] with formatter functions to a [[JsonTheme]] with string values. Used by [[stringify]].
 */
export declare function toJson(theme: Theme): JsonTheme;
/**
 * Stringifies a [[Theme]] with formatter functions to a JSON string.
 *
 * ```ts
 * import chalk = require('chalk');
 * import {stringify} from 'cli-highlight';
 * import * as fs from 'fs';
 *
 * const myTheme: Theme = {
 *     keyword: chalk.red.bold,
 *     addition: chalk.green,
 *     deletion: chalk.red.strikethrough,
 *     number: plain
 * }
 * const json = stringify(myTheme);
 * fs.writeFile('mytheme.json', json, (err: any) => {
 *     if (err) throw err;
 *     console.log('Theme saved');
 * });
 * ```
 */
export declare function stringify(theme: Theme): string;
/**
 * Parses a JSON string into a [[Theme]] with formatter functions.
 *
 * ```ts
 * import * as fs from 'fs';
 * import {parse, highlight} from 'cli-highlight';
 *
 * fs.readFile('mytheme.json', 'utf8', (err: any, json: string)  => {
 *     if (err) throw err;
 *     const code = highlight('SELECT * FROM table', {theme: parse(json)});
 *     console.log(code);
 * });
 * ```
 */
export declare function parse(json: string): Theme;
