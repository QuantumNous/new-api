import type { AdaptiveSpec, ISeriesSpec } from '../../typings';
import { get, isObject } from '../../util';
import { BaseChartSpecTransformer } from '../base';
import { getTrimPaddingConfig } from '../util';
import type { ICommonChartSpec } from './interface';
import { mergeSpec } from '@visactor/vutils-extension';

export class CommonChartSpecTransformer<T extends ICommonChartSpec = ICommonChartSpec> extends BaseChartSpecTransformer<
  AdaptiveSpec<T, 'series'>
> {
  protected _getDefaultSeriesSpec(spec: AdaptiveSpec<T, 'series'>) {
    const defaultSpec = super._getDefaultSeriesSpec(spec);
    // 组合图系列的默认配置由系列自身配置 data/dataIndex/dataId 决定，无需默认配置
    delete defaultSpec.data;
    return defaultSpec;
  }

  // common chart 支持 autoBandSize 配置
  protected _transformAxisSpec(spec: AdaptiveSpec<T, 'series'>) {
    if (!spec.axes) {
      return;
    }
    if (!!spec.autoBandSize) {
      // 遍历series
      // 1. 找到bar系列
      // 2. 如果bar系列配置了autoBandSize
      // 3. 找到bar系列对应的axis
      // 4. 为该axis配置bandSize
      spec.series.forEach((series: any, seriesIndex: number) => {
        if (series.type === 'bar') {
          const relatedAxis = this._findBandAxisBySeries(series, seriesIndex, spec.axes);
          if (relatedAxis && !relatedAxis.bandSize && !relatedAxis.maxBandSize && !relatedAxis.minBandSize) {
            const extend = isObject(series.autoBandSize) ? series.autoBandSize.extend ?? 0 : 0;
            const { barMaxWidth, barMinWidth, barWidth, barGapInGroup } = series;
            this._applyAxisBandSize(relatedAxis, extend, { barMaxWidth, barMinWidth, barWidth, barGapInGroup });
          }
        }
      });
    }
  }

  transformSpec(spec: AdaptiveSpec<T, 'series'>): void {
    super.transformSpec(spec);
    if (spec.series && spec.series.length) {
      const defaultSeriesSpec = this._getDefaultSeriesSpec(spec);
      spec.series.forEach((s: ISeriesSpec) => {
        if (!this._isValidSeries(s.type)) {
          return;
        }
        Object.keys(defaultSeriesSpec).forEach(k => {
          if (!(k in s)) {
            s[k] = defaultSeriesSpec[k];
          }
        });
      });
    }
    if (spec.axes && spec.axes.length) {
      spec.axes.forEach((axis: any) => {
        if (get(axis, 'trimPadding')) {
          mergeSpec(axis, getTrimPaddingConfig(this.type, spec));
        }
      });
    }
    this._transformAxisSpec(spec);
  }
}
