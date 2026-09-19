import { BasePlugin } from '../../base/base-plugin';
import type { IChartPlugin, IChartPluginService } from '../interface';
export declare class FormatterPlugin extends BasePlugin implements IChartPlugin {
    static readonly pluginType: 'chart';
    static readonly specKey = "formatter";
    static readonly type: string;
    readonly type: string;
    private readonly _timeModeFormat;
    protected _spec: {
        timeMode: 'utc' | 'local';
        customFormatter: (specifier: string, text: string | number | string[] | number[], datum: any) => string | string[];
        numericFormatter: (specifier: string, text: string | number | string[] | number[]) => string;
        timeFormatter: (specifier: string, text: string | number | string[] | number[]) => string;
    };
    protected _formatter: (text: string | number | string[] | number[], datum: any, formatter: string | string[]) => string | number | (string | number)[];
    private _timeFormatter;
    private _numericFormatter;
    private _numericSpecifier;
    private _numericFormatterCache;
    private _isNumericFormatterCache;
    constructor();
    onInit(service: IChartPluginService, chartSpec: any): void;
    protected _format(text: string | number | string[] | number[], datum: any, formatter: string | string[]): string | number | (string | number)[];
    protected _formatSingleLine(text: string | number, datum: any, formatter: string): string | number;
    protected _formatSingleText(text: string | number, formatter: string): string | number;
    private _calcFormatter;
    private _calculateMathExpression;
    private _isValidMathExpression;
    release(): void;
}
export declare const registerFormatPlugin: () => void;
