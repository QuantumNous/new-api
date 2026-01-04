import { strings } from './constants';

// rule types: 'text' | 'numbers' | 'bytes-decimal' | 'bytes-binary' | 'percentages' | 'exponential'
// TODO: Refining the 'currency' type
type Rule = typeof strings.RULE[number];
type Truncate = typeof strings.TRUNCATE[number];
type Parser = (value: string) => string;

type RuleMethods = {
    [key in Rule]?: (value: number) => string;
};
type TruncateMethods = {
    [key in Truncate]: (value: number) => number;
};

export default class FormatNumeral {
    private readonly content: string;
    private readonly rule: Rule;
    private readonly precision: number;
    private readonly truncate: Truncate;
    private readonly parser: Parser | undefined;
    private readonly isDiyParser: boolean;

    // A collection of methods for formatting numbers;  Methods key: Rule (strings.RULE);  Not included: 'text' & 'numbers'
    private readonly ruleMethods: RuleMethods = {
        'bytes-decimal': (value: number) => {
            const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
            let i = 0;
            while (value >= 1000) {
                value /= 1000;
                i++;
            }
            return `${this.truncatePrecision(value)} ${units[i]}`;
        },
        'bytes-binary': (value: number) => {
            const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
            let i = 0;
            while (value >= 1024) {
                value /= 1024;
                i++;
            }
            return `${this.truncatePrecision(value)} ${units[i]}`;
        },
        percentages: (value: number) => {
            // The rules here have been modified in version v2.30.0
            return `${this.truncatePrecision(value * 100)}%`;
        },
        exponential: (value: number) => {
            const vExponential = value.toExponential(this.precision + 2);
            const vArr = vExponential.split('e');
            return `${this.truncatePrecision(Number(vArr[0]))}e${vArr[1]}`;
        },
    };
    // A collection of methods for truncating numbers; Methods key: Truncate (strings.Truncate);
    private readonly truncateMethods: TruncateMethods = {
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
    };

    constructor(content: string, rule: Rule, precision: number, truncate: Truncate, parser: Parser | undefined) {
        this.isDiyParser = typeof parser !== 'undefined';
        this.content = content;
        this.rule = rule;
        this.precision = precision;
        this.truncate = truncate;
        this.parser = parser;
    }

    // Formatting numbers within a string.
    public format(): string {
        // Executed when a custom method exists
        if (this.isDiyParser) {
            return this.parser(this.content);
        }
        //  When the `rule` is `text`, only the `truncatePrecision` method is executed for numeric processing.
        if (this.rule === 'text') {
            return extractNumbers(this.content)
                .map(item => (checkIsNumeral(item) ? this.truncatePrecision(item) : item))
                .join('');
        }
        // Separate extraction of numbers when `rule` is `numbers`.
        if (this.rule === 'numbers') {
            return extractNumbers(this.content)
                .filter(item => checkIsNumeral(item))
                .map(item => this.truncatePrecision(item))
                .join(',');
        }
        // Run formatting methods that exist.
        return extractNumbers(this.content)
            .map(item => (checkIsNumeral(item) ? this.ruleMethods[this.rule](Number(item)) : item))
            .join('');
    }

    private truncatePrecision(content: string | number): string {
        // Truncation and selection of rounding methods for processing. function from: truncateMethods
        const cTruncated =
            this.truncateMethods[this.truncate](Number(content) * Math.pow(10, this.precision)) /
            Math.pow(10, this.precision);
        const cArr = cTruncated.toString().split('.');
        // is an integer then the end number is normalised
        if (cArr.length === 1) {
            return cTruncated.toFixed(this.precision);
        }
        const cTLength = cArr[1].length;
        // Fill in any missing `0` at the end.
        if (cTLength < this.precision) {
            return `${cArr[0]}.${cArr[1]}${'0'.repeat(this.precision - cTLength)}`;
        }
        return cTruncated.toString();
    }
}

// Separate numbers from strings, the `-` symbol is a numeric prefix not allowed on its own.
function extractNumbers(content: string): Array<string> {
    const reg = /(-?[0-9]*\.?[0-9]+([eE]-?[0-9]+)?)|([^-\d\.]+)/g;
    return content.match(reg) || [];
}

function checkIsNumeral(str: string): boolean {
    return !(isNaN(Number(str)) || str.replace(/\s+/g, '') === '');
}
