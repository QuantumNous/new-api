import { array, isArray, isNil, isValid } from '@visactor/vutils';
import type { IDataZoomSpec, IIndicatorSpec } from '../../component';
import { BaseChartSpecTransformer } from '../base';
import type { IPolarChartSpec } from './interface';

export class PolarChartSpecTransformer<T extends IPolarChartSpec> extends BaseChartSpecTransformer<T> {
  protected _isValidSeries(type: string): boolean {
    return this.seriesType ? type === this.seriesType : true;
  }

  protected getIndicatorSpec(spec: any): IIndicatorSpec[] {
    const indicatorSpec = array(spec.indicator) as IIndicatorSpec[];
    const limitRatio = spec.innerRadius ?? spec.series?.[0]?.innerRadius;
    if (isValid(limitRatio)) {
      indicatorSpec.forEach(indicator => {
        if (isNil(indicator.limitRatio)) {
          indicator.limitRatio = limitRatio;
        }
      });
    }
    return indicatorSpec;
  }

  protected _getDefaultSeriesSpec(spec: any, pickKeys?: string[]): any {
    /**
     * 旧的radius写法, 仅做兼容
     * @deprecated use outerRadius instead
     */
    const series: any = super._getDefaultSeriesSpec(
      spec,
      ['radius', 'outerRadius', 'innerRadius', 'startAngle', 'endAngle', 'centerX', 'centerY', 'sortDataByAxis'],
      pickKeys
    );

    return series;
  }

  transformSpec(spec: T): void {
    super.transformSpec(spec);
    /** 处理极坐标系下的 datazoom */
    if (isArray(spec.dataZoom) && spec.dataZoom.length > 0) {
      spec.dataZoom.forEach((zoom: IDataZoomSpec) => {
        // 极坐标系下 datazoom 目前只支持数据过滤
        // 理想效果：角度轴不支持 axis， 径向轴均支持（通过 group.clip 自定义 clipPath 支持）
        if (zoom.filterMode === 'axis') {
          zoom.filterMode = 'filter';
        }
      });
    }

    this.transformSeriesSpec(spec);

    /* 处理 indicator 配置 */
    if (isValid((spec as any).indicator)) {
      (spec as any).indicator = this.getIndicatorSpec(spec);
    }
  }
}
