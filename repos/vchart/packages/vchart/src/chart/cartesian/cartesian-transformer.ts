import type { ICartesianAxisSpec } from '../../component';
import type { ISeriesSpec } from '../../typings';
import { get, isNil } from '../../util';
import { BaseChartSpecTransformer } from '../base';
import { getTrimPaddingConfig } from '../util';
import type { ICartesianChartSpec } from './interface';
import { mergeSpec } from '@visactor/vutils-extension';

export class CartesianChartSpecTransformer<T extends ICartesianChartSpec> extends BaseChartSpecTransformer<T> {
  protected needAxes(): boolean {
    return true;
  }

  protected _isValidSeries(type: string): boolean {
    return this.seriesType ? type === this.seriesType : true;
  }

  protected _getDefaultSeriesSpec(spec: any, pickKeys?: string[]): any {
    const series: any = super._getDefaultSeriesSpec(
      spec,
      [
        'xField',
        'yField',
        'zField',
        'direction',
        'stack', // 是否堆叠
        'percent', // 是否百分比堆叠
        'stackOffsetSilhouette', // 是否围绕中心轴偏移轮廓,
        'totalLabel',
        'sortDataByAxis'
      ],
      pickKeys
    );

    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    super.transformSeriesSpec(spec);

    this._transformAxisSpec(spec);
  }

  protected _setDefaultXAxisSpec(spec: T): ICartesianAxisSpec {
    return {
      orient: 'bottom'
    } as ICartesianAxisSpec;
  }

  protected _setDefaultYAxisSpec(spec: T): ICartesianAxisSpec {
    return {
      orient: 'left'
    } as ICartesianAxisSpec;
  }

  protected _setDefaultZAxisSpec(spec: T): ICartesianAxisSpec {
    return {
      orient: 'z'
    } as ICartesianAxisSpec;
  }

  protected _transformAxisSpec(spec: T) {
    if (this.needAxes()) {
      if (!spec.axes) {
        spec.axes = [];
      }
      const haxAxes = { x: false, y: false, z: false };
      spec.axes.forEach((axis: ICartesianAxisSpec) => {
        const { orient } = axis;
        let defaultSpec: ICartesianAxisSpec = null;
        if (orient === 'top' || orient === 'bottom') {
          haxAxes.x = true;
          defaultSpec = this._setDefaultXAxisSpec(spec);
        }
        if (orient === 'left' || orient === 'right') {
          haxAxes.y = true;

          defaultSpec = this._setDefaultYAxisSpec(spec);
        }
        if (orient === 'z') {
          haxAxes.z = true;

          defaultSpec = this._setDefaultZAxisSpec(spec);
        }

        if (defaultSpec) {
          Object.keys(defaultSpec).forEach(key => {
            if (isNil(axis[key])) {
              axis[key] = defaultSpec[key];
            }
          });
        }
        if (get(axis, 'trimPadding')) {
          mergeSpec(axis, getTrimPaddingConfig(this.type, spec));
        }
      });
      if (!haxAxes.x) {
        spec.axes.push(this._setDefaultXAxisSpec(spec));
      }
      if (!haxAxes.y) {
        spec.axes.push(this._setDefaultYAxisSpec(spec));
      }
      // 如果有zField字段，但是没有配置z轴，那么添加一个z轴
      if ((spec as any).zField && !haxAxes.z) {
        spec.axes.push(this._setDefaultZAxisSpec(spec));
      }
    }
  }
}
