import { array } from '../../util';
import { RoseLikeChartSpecTransformer } from '../polar';
import type { IRoseChartSpec } from '../rose';
import { mergeSpec } from '@visactor/vutils-extension';

export class RadarChartSpecTransformer<
  T extends IRoseChartSpec = IRoseChartSpec
> extends RoseLikeChartSpecTransformer<T> {
  protected _getDefaultSeriesSpec(spec: any): any {
    const series = super._getDefaultSeriesSpec(spec);
    const areaTheme = this._option.getTheme?.('series', 'radar', 'area');
    this._addSeriesRelatedSpecKeys(['line', 'point', 'area']);
    series.line = spec.line;
    series.point = spec.point;
    series.stack = spec.stack;
    series.percent = spec.percent;
    series.area = mergeSpec(
      {
        visible: areaTheme?.visible ?? false
      },
      spec.area
    );
    series.seriesMark = spec.seriesMark ?? 'area';
    series.activePoint = spec.activePoint;
    series.pointDis = spec.pointDis;
    series.pointDisMul = spec.pointDisMul;
    series.markOverlap = spec.markOverlap;
    return series;
  }

  transformSpec(spec: T) {
    super.transformSpec(spec);
    //默认不显示轴的domainLine和Tick
    (spec.axes ?? []).forEach((axis: any) => {
      if (axis.orient === 'radius') {
        ['domainLine', 'label', 'tick'].forEach(configName => {
          if (!axis[configName]) {
            axis[configName] = { visible: false };
          }
        });
        if (!axis.grid) {
          axis.grid = { visible: true };
        }
      }
    });

    // set default config for crosshair
    spec.crosshair = array(spec.crosshair || {}).map(crosshairCfg => {
      return mergeSpec(
        {
          categoryField: {
            visible: true,
            line: {
              visible: true,
              type: 'line'
            }
          }
        },
        crosshairCfg
      );
    });
  }
}
