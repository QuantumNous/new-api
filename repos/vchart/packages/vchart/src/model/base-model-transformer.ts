import type { IChartSpecInfo } from '../chart/interface';
import { isArray } from '../util';
import type { IBaseModelSpecTransformer, IBaseModelSpecTransformerOption, IModelSpec } from './interface';
import { mergeSpec } from '@visactor/vutils-extension';

export class BaseModelSpecTransformer<T extends IModelSpec, K> implements IBaseModelSpecTransformer {
  readonly type: string;
  protected _option: IBaseModelSpecTransformerOption;

  protected _theme?: K; // 非全局 theme，是对应于具体 model 的 theme 对象

  constructor(option: IBaseModelSpecTransformerOption) {
    this._option = option;
    this.type = option.type;
  }

  protected _initTheme(spec: T, chartSpec: any): { spec: T; theme: K } {
    this._theme = this.getTheme(spec, chartSpec);
    return this._mergeThemeToSpec(spec, chartSpec);
  }

  getTheme(spec: T, chartSpec: any): K {
    return undefined;
  }

  /** 不建议重写该方法，最好重写对应子步骤 */
  transformSpec(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo): { spec: T; theme: K } {
    this._transformSpecBeforeMergingTheme(spec, chartSpec, chartSpecInfo);
    const result = this._initTheme(spec, chartSpec);
    this._transformSpecAfterMergingTheme(result.spec, chartSpec, chartSpecInfo);
    return result;
  }

  protected _transformSpecBeforeMergingTheme(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo) {
    // do nothing
    // change spec by default logic
  }

  protected _transformSpecAfterMergingTheme(spec: T, chartSpec: any, chartSpecInfo?: IChartSpecInfo) {
    // do nothing
    // change spec by default logic
  }

  /** 将 theme merge 到 spec 中 */
  protected _mergeThemeToSpec(spec: T, chartSpec: any): { spec: T; theme: K } {
    const theme = this._theme;
    if (this._shouldMergeThemeToSpec()) {
      const specFromChart = this._getDefaultSpecFromChart(chartSpec);
      // this._originalSpec + specFromChart + this._theme = this._spec
      const merge = (originalSpec: any) => mergeSpec({}, theme, specFromChart, originalSpec);

      if (isArray(spec)) {
        return {
          spec: spec.map(specItem => merge(specItem)) as unknown as T,
          theme
        };
      }
      return {
        spec: merge(spec),
        theme
      };
    }
    return { spec, theme };
  }

  /** 是否在初始化时将 theme 自动 merge 到 spec */
  protected _shouldMergeThemeToSpec(): boolean {
    return true;
  }

  /** 从 chart spec 提取配置作为 model 的默认 spec 配置 */
  protected _getDefaultSpecFromChart(chartSpec: any): Partial<T> | undefined {
    return undefined;
  }
}
