import { isFunction, isArray, TimeUtil, NumberUtil, numberSpecifierReg } from '@visactor/vutils';
import { BasePlugin } from '../../base/base-plugin';
import type { IChartPlugin, IChartPluginService } from '../interface';
import { Factory } from '../../../core/factory';
import { registerChartPlugin } from '../register';

const bracketReg = /\{([^}]+)\}/;
const bracketGReg = /\{([^}]+)\}/g;
const semicolonReg = /:/;

export class FormatterPlugin extends BasePlugin implements IChartPlugin {
  static readonly pluginType: 'chart' = 'chart';
  static readonly specKey = 'formatter';
  static readonly type: string = 'formatterPlugin';
  readonly type: string = 'formatterPlugin';

  private readonly _timeModeFormat = {
    utc: TimeUtil.getInstance().timeUTCFormat,
    local: TimeUtil.getInstance().timeFormat
  };

  protected _spec: {
    timeMode: 'utc' | 'local';
    customFormatter: (specifier: string, text: string | number | string[] | number[], datum: any) => string | string[];
    numericFormatter: (specifier: string, text: string | number | string[] | number[]) => string;
    timeFormatter: (specifier: string, text: string | number | string[] | number[]) => string;
  };

  protected _formatter = this._format;
  private _timeFormatter = this._timeModeFormat.local;
  private _numericFormatter = NumberUtil.getInstance().format;

  // used for optimize performance，avoiding repeatedly parsing same format template string,
  private _numericSpecifier = NumberUtil.getInstance().formatter;
  private _numericFormatterCache = new Map<string, any>();
  private _isNumericFormatterCache = new Map<string, boolean>();

  constructor() {
    super(FormatterPlugin.type);
  }

  onInit(service: IChartPluginService, chartSpec: any) {
    const { globalInstance } = service;
    if (!globalInstance) {
      return;
    }
    this._spec = chartSpec?.[FormatterPlugin.specKey] ?? {};
    const { timeMode, customFormatter, numericFormatter, timeFormatter } = this._spec;

    if (isFunction(customFormatter)) {
      this._formatter = customFormatter;
    } else {
      this._formatter = this._format.bind(this);
      if (isFunction(timeFormatter)) {
        this._timeFormatter = timeFormatter;
      } else if (timeMode && this._timeModeFormat[timeMode]) {
        this._timeFormatter = this._timeModeFormat[timeMode];
      }

      if (numericFormatter) {
        this._numericFormatter = numericFormatter;
        this._numericSpecifier = null;
        this._numericFormatterCache = null;
      }
    }
    Factory.registerFormatter(this._formatter);
  }

  protected _format(text: string | number | string[] | number[], datum: any, formatter: string | string[]) {
    if (isArray(text)) {
      return text.map((t, i) => {
        const f = isArray(formatter) ? formatter[i] : formatter;
        return f ? this._formatSingleLine(t, datum, f) : t;
      });
    }

    if (isArray(formatter)) {
      return formatter.map(f => this._formatSingleLine(text, datum, f));
    }
    return this._formatSingleLine(text, datum, formatter);
  }

  protected _formatSingleLine(text: string | number, datum: any, formatter: string) {
    let isTemplate;
    if (this._isNumericFormatterCache) {
      if (this._isNumericFormatterCache.get(formatter)) {
        isTemplate = this._isNumericFormatterCache.get(formatter);
      } else {
        isTemplate = bracketReg.test(formatter);
        this._isNumericFormatterCache.set(formatter, isTemplate);
      }
    }
    if (isTemplate) {
      const result = formatter.replace(bracketGReg, (match, key) => {
        const hasFormatter = semicolonReg.test(key);
        if (!hasFormatter) {
          const value = datum[key.trim()];
          return typeof value !== 'undefined' ? value : match;
        }
        const parts = key.split(':');
        const value = datum[parts.shift()];
        const valueFormatter = parts.join(':');
        return this._formatSingleText(value, valueFormatter);
      });
      return result;
    }
    return this._formatSingleText(text, formatter);
  }

  protected _formatSingleText(text: string | number, formatter: string): string | number {
    const isNumeric = numberSpecifierReg.test(formatter);
    if (isNumeric && this._numericFormatter) {
      // 内置的 formatter 逻辑，可以进行缓存性能优化
      let numericFormat;
      if (this._numericFormatterCache && this._numericSpecifier) {
        if (this._numericFormatterCache.get(formatter)) {
          numericFormat = this._numericFormatterCache.get(formatter);
        } else {
          numericFormat = this._numericSpecifier(formatter) as any;
          this._numericFormatterCache.set(formatter, numericFormat);
        }
        return numericFormat(Number(text));
      }
      return this._numericFormatter(formatter, Number(text));
    } else if (formatter.includes('%') && this._timeFormatter) {
      return this._timeFormatter(formatter, text);
    } else if (formatter.startsWith('calc(')) {
      return this._calcFormatter(formatter, text);
    }
    return text;
  }

  /**
   * 安全地计算数学表达式
   * 支持基本运算：+ - * / ( ) 和变量 v
   * @param formatter 格式字符串，如 "calc(v*2+1)"
   * @param text 要计算的数值
   * @returns 计算结果或原始文本（如果计算失败）
   */
  private _calcFormatter(formatter: string, text: string | number): string | number {
    try {
      // 提取表达式部分，移除 "calc(" 和 ")"
      const expression = formatter.slice(5, -1).replace(/v/g, String(text));

      // 使用安全的数学表达式计算器
      return this._calculateMathExpression(expression, text);
    } catch (e) {
      return text;
    }
  }

  /**
   * 安全的数学表达式计算器
   * 支持操作符：+ - * / ( ) 和数字
   * @param expression 数学表达式字符串
   * @returns 计算结果
   */
  private _calculateMathExpression(expression: string, text: string | number): number | string {
    // 移除所有空白字符
    const cleanExpression = expression.replace(/\s+/g, '');

    // 验证表达式只包含允许的字符
    if (!this._isValidMathExpression(cleanExpression)) {
      return text;
    }

    // 使用 Function 构造函数创建安全的计算函数
    // 这比 eval 安全，因为它只能访问提供的参数
    try {
      // 将表达式转换为安全的函数调用
      // 例如: "2+3*4" -> "return (2+3*4)"
      const safeFunction = new Function('return (' + cleanExpression + ')');
      const result = safeFunction();

      // 验证结果是否为有效数字
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        throw new Error('Invalid calculation result');
      }

      return result;
    } catch (error) {
      return text;
    }
  }

  /**
   * 验证数学表达式是否只包含允许的字符
   * @param expression 要验证的表达式
   * @returns 是否有效
   */
  private _isValidMathExpression(expression: string): boolean {
    // 只允许数字、小数点、运算符和括号
    const validPattern = /^[0-9+\-*/().]+$/;
    return validPattern.test(expression);
  }

  release() {
    super.release();
    this._format = null;
    this._timeFormatter = null;
    this._numericFormatter = null;
    this._numericSpecifier = null;
    this._numericFormatterCache = null;
    this._isNumericFormatterCache = null;
  }
}

export const registerFormatPlugin = () => {
  registerChartPlugin(FormatterPlugin);
};
