import { BaseChartSpecTransformer } from '@visactor/vchart';
import type { ICartesianAxisSpec, ICartesianLinearAxisSpec } from '@visactor/vchart';
import type { ITimelineChartSpec } from './interface';
import { isNil, get, merge, isObject } from '@visactor/vutils';

export class TimelineChartSpecTransformer<
  T extends ITimelineChartSpec = ITimelineChartSpec
> extends BaseChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: T): any {
    return super._getDefaultSeriesSpec(spec, [
      'timeField',
      'eventField',
      'seriesField',
      'titleField',
      'subTitleField',
      'iconField',
      'dot',
      'title',
      'subTitle',
      'icon',
      'line',
      'arrow',
      'labelPosition',
      'sortDataByAxis'
    ]);
  }

  protected _setDefaultXAxisSpec(spec: T): ICartesianAxisSpec {
    return {
      type: 'band',
      orient: 'bottom',
      label: {
        visible: false
      },
      tick: {
        visible: false
      },
      grid: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      paddingInner: 0,
      paddingOuter: 0
    } as ICartesianAxisSpec;
  }

  protected _setDefaultYAxisSpec(spec: T): ICartesianAxisSpec {
    return {
      type: 'band',
      inverse: true,
      orient: 'left',
      label: {
        visible: false
      },
      tick: {
        visible: false
      },
      grid: {
        visible: false
      },
      domainLine: {
        visible: false
      },
      paddingInner: 0,
      paddingOuter: 0
    } as ICartesianAxisSpec;
  }

  protected _transformAxisSpec(spec: T) {
    if (!spec.axes) {
      spec.axes = [];
    }

    const haxAxes = { x: false, y: false };
    spec.axes.forEach((axis: ICartesianAxisSpec) => {
      const { orient } = axis;
      let defaultSpec: Partial<ICartesianAxisSpec> = null;
      if (orient === 'top' || orient === 'bottom') {
        haxAxes.x = true;

        defaultSpec = this._setDefaultXAxisSpec(spec);
      }
      if (orient === 'left' || orient === 'right') {
        haxAxes.y = true;

        defaultSpec = this._setDefaultYAxisSpec(spec);
      }

      if (defaultSpec) {
        Object.keys(defaultSpec).forEach(key => {
          (axis as any)[key] = isObject((axis as any)[key])
            ? merge((defaultSpec as any)[key], (axis as any)[key])
            : isNil((axis as any)[key])
            ? (defaultSpec as any)[key]
            : (axis as any)[key];
        });
      }
    });
    if (!haxAxes.x) {
      spec.axes.push(this._setDefaultXAxisSpec(spec));
    }
    if (!haxAxes.y) {
      spec.axes.push(this._setDefaultYAxisSpec(spec));
    }
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    this.transformSeriesSpec(spec);
    this._transformAxisSpec(spec);

    const direction = spec.direction ?? 'horizontal';

    // 将 direction 传递给 series，并设置 xField/yField 以便轴系统收集数据
    spec.series?.forEach(seriesSpec => {
      // 根据 direction 将 timeField 映射到 xField 或 yField
      // 这样轴系统才能正确收集数据
      if (direction === 'vertical') {
        // vertical 布局：y 轴是时间方向
        if (seriesSpec.timeField && !seriesSpec.yField) {
          seriesSpec.yField = seriesSpec.timeField;
        }
        // x 轴是分类方向（如果没有 seriesField，创建一个虚拟字段）
        if (!seriesSpec.xField) {
          seriesSpec.xField = seriesSpec.seriesField || '__vchart_timeline_dummy__';
        }
      } else {
        // horizontal 布局：x 轴是时间方向
        if (seriesSpec.timeField && !seriesSpec.xField) {
          seriesSpec.xField = seriesSpec.timeField;
        }
        // y 轴是分类方向（如果没有 seriesField，创建一个虚拟字段）
        if (!seriesSpec.yField) {
          seriesSpec.yField = seriesSpec.seriesField || '__vchart_timeline_dummy__';
        }
      }
    });
  }
}
