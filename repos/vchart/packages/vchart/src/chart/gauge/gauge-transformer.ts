import { isNil } from '@visactor/vutils';
import type { ICircularProgressSeriesSpec, IGaugeSeriesSpec } from '../../series';
import { SeriesTypeEnum } from '../../series/interface';
import type { AdaptiveSpec, ISeriesSpec } from '../../typings';
import { ProgressLikeChartSpecTransformer } from '../polar';
import type { IGaugeChartSpec } from './interface';
import { LayoutZIndex } from '../../constant/layout';
import type { IPolarAxisSpec, IPolarLinearAxisSpec } from '../../component';

export class GaugeChartSpecTransformer<
  T extends IGaugeChartSpec = IGaugeChartSpec
> extends ProgressLikeChartSpecTransformer<AdaptiveSpec<T, 'axes'>> {
  protected _getDefaultSeriesSpec(spec: T): any {
    const series = super._getDefaultSeriesSpec(spec);

    this._addSeriesRelatedSpecKeys(['pin', 'pinBackground', 'pointer']);
    series.radiusField = spec.radiusField;
    series.pin = spec.pin;
    series.pinBackground = spec.pinBackground;
    series.pointer = spec.pointer;
    return series;
  }

  protected _getDefaultCircularProgressSeriesSpec(spec: T): any {
    const series: any = super._getDefaultSeriesSpec(spec);
    series.type = SeriesTypeEnum.circularProgress;
    return series;
  }

  transformSpec(spec: AdaptiveSpec<T, 'axes'>): void {
    super.transformSpec(spec);

    /** 充当仪表图非指针部分的系列 */
    let backgroundSeries = spec.series?.find(
      (series: ISeriesSpec) => series.type === SeriesTypeEnum.gauge || series.type === SeriesTypeEnum.circularProgress
    ) as ICircularProgressSeriesSpec | IGaugeSeriesSpec;
    if (isNil(backgroundSeries)) {
      backgroundSeries = spec.gauge ?? this._getDefaultCircularProgressSeriesSpec(spec as any);

      // 补充可能缺失的属性
      if (backgroundSeries.type === 'circularProgress') {
        if (isNil(backgroundSeries.radiusField) && isNil(backgroundSeries.categoryField)) {
          backgroundSeries.radiusField = spec.radiusField ?? (spec.categoryField as string) ?? spec.seriesField;
        }
        if (isNil(backgroundSeries.valueField) && isNil(backgroundSeries.angleField)) {
          backgroundSeries.valueField = spec.valueField ?? spec.angleField;
        }
      }

      if (spec.series.length === 1) {
        spec.series.push(backgroundSeries);
      } else {
        spec.series.forEach((s: ISeriesSpec) => {
          if (s.type !== backgroundSeries.type) {
            return;
          }
          Object.keys(backgroundSeries).forEach(k => {
            if (!(k in s)) {
              s[k] = backgroundSeries[k];
            }
          });
        });
      }
    }

    if (backgroundSeries.type === SeriesTypeEnum.circularProgress) {
      this._transformProgressAxisSpec(
        spec,
        {
          orient: 'angle',
          visible: true,
          domainLine: {
            visible: false
          },
          grid: {
            visible: false
          }
        },
        {
          orient: 'radius',
          visible: false
        },
        {
          zIndex: LayoutZIndex.Region + 50 // 仪表图特例：轴在 region 上层
        }
      );
    } else {
      this._transformGaugeAxisSpec(spec);
    }
  }

  protected _transformGaugeAxisSpec(spec: AdaptiveSpec<T, 'axes'>): void {
    if (!spec.axes) {
      spec.axes = [];
    }
    const axesPtr: {
      radius: IPolarLinearAxisSpec | null;
      angle: IPolarLinearAxisSpec | null;
    } = { radius: null, angle: null };
    (spec.axes ?? []).forEach((axis: IPolarAxisSpec) => {
      const { orient } = axis;
      if (orient === 'radius') {
        axesPtr.radius = axis;
      }
      if (orient === 'angle') {
        axesPtr.angle = axis;
      }
    });
    if (!axesPtr.angle) {
      axesPtr.angle = {
        orient: 'angle',
        visible: true
      };
      spec.axes.push(axesPtr.angle);
    }
    if (!axesPtr.radius) {
      axesPtr.radius = {
        orient: 'radius',
        visible: false
      };
      spec.axes.push(axesPtr.radius);
    }

    // 自动补充缺失的配置
    if (isNil(axesPtr.angle.type)) {
      axesPtr.angle.type = 'linear';
    }
    if (isNil(axesPtr.radius.type)) {
      axesPtr.radius.type = 'linear';
    }
    if (isNil(axesPtr.angle.zIndex)) {
      axesPtr.angle.zIndex = LayoutZIndex.Region + 50; // 仪表图特例：轴在 region 上层
    }
  }
}
