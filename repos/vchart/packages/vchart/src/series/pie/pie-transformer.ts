import { isArray, isValid } from '@visactor/vutils';
import { mergeSpec } from '@visactor/vutils-extension';
import { BaseSeriesSpecTransformer } from '../base';
import { SeriesMarkNameEnum } from '../interface';
import type { IArcLabelSpec, IBasePieSeriesSpec, IPieSeriesTheme } from './interface';

export class PieSeriesSpecTransformer<
  T extends IBasePieSeriesSpec = IBasePieSeriesSpec,
  K extends IPieSeriesTheme = IPieSeriesTheme
> extends BaseSeriesSpecTransformer<T, K> {
  protected _transformLabelSpec(spec: T): void {
    this._addMarkLabelSpec(spec, SeriesMarkNameEnum.pie);
  }

  /** 将 theme merge 到 spec 中 */
  protected _mergeThemeToSpec(spec: T, chartSpec: any): { spec: T; theme: K } {
    const theme = this._theme;
    let newSpec = spec;
    if (this._shouldMergeThemeToSpec()) {
      const specFromChart = this._getDefaultSpecFromChart(chartSpec);

      // this._originalSpec + specFromChart + this._theme = this._spec
      // 动态处理 label 样式，对于展示在内部的 label 默认使用 innerLabel 样式
      newSpec = mergeSpec({}, this._theme, specFromChart, spec) as any;

      const getMergedLabelSpec = (position: IArcLabelSpec['position'], label: IArcLabelSpec) => {
        if (position === 'inside' || position === 'inside-center') {
          return mergeSpec({}, this._theme.innerLabel, label);
        }
        return mergeSpec({}, this._theme.outerLabel, label);
      };

      if (isArray(newSpec.label)) {
        newSpec.label = newSpec.label.map(label => getMergedLabelSpec(label.position, label));
      } else {
        newSpec.label = getMergedLabelSpec(newSpec.label.position, newSpec.label);
      }
    }

    return { spec: newSpec, theme };
  }

  protected _getDefaultSpecFromChart(chartSpec: any): any {
    const spec = (super._getDefaultSpecFromChart(chartSpec) as any) ?? {};
    const { centerX, centerY } = chartSpec;
    if (isValid(centerX)) {
      spec.centerX = centerX;
    }
    if (isValid(centerY)) {
      spec.centerY = centerY;
    }
    return Object.keys(spec).length > 0 ? spec : undefined;
  }
}
