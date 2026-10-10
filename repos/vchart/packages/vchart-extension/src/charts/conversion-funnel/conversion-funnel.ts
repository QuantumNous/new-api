import type { IConversionFunnelChartSpecBase, IConversionFunnelSeriesSpecBase } from './interface';
import type { GroupMark } from '@visactor/vchart';
import { VChart, FunnelChart, PREFIX, FunnelSeries, registerMarkFilterTransform } from '@visactor/vchart';
import { DataView } from '@visactor/vchart';
import { ConversionFunnelChartSpecTransformer } from './conversion-funnel-transformer';
import { conversionArrowTransform } from './arrow-data-transform';

export class ConversionFunnelChart extends FunnelChart<IConversionFunnelChartSpecBase> {
  type = 'conversionFunnel';
  static type = 'conversionFunnel';

  declare _spec: IConversionFunnelChartSpecBase;

  static readonly transformerConstructor = ConversionFunnelChartSpecTransformer;
  readonly transformerConstructor = ConversionFunnelChartSpecTransformer;
}

export class ConversionFunnelSeries extends FunnelSeries<IConversionFunnelSeriesSpecBase> {
  protected _arrowData?: DataView;

  initData() {
    super.initData();
    const { conversionArrow } = this._spec;
    if (conversionArrow && conversionArrow.arrows?.length) {
      this._arrowData = new DataView(this._dataSet, { name: `${PREFIX}_series_${this.id}_arrowData` });
      if (!this._dataSet.getTransform('conversionArrow')) {
        this._dataSet.registerTransform('conversionArrow', conversionArrowTransform);
      }
      this._arrowData.parse(conversionArrow).transform({
        type: 'conversionArrow',
        options: {
          categoryField: this._spec.categoryField
        }
      });
    }
  }

  afterCompile() {
    // @ts-ignore
    super.afterCompile?.();
    const rightGroup = this.getMarkInName('arrowRight') as unknown as GroupMark;
    if (rightGroup) {
      rightGroup.getMarks().forEach(mark => {
        mark.setDataView(this._arrowData);
        mark.compileData();
        mark.setTransform([
          {
            type: 'filter',
            callback: (datum: any) => datum.position === 'right'
          }
        ]);
      });
    }
    const leftGroup = this.getMarkInName('arrowLeft') as unknown as GroupMark;
    if (leftGroup) {
      leftGroup.getMarks().forEach(mark => {
        mark.setDataView(this._arrowData);
        mark.compileData();
        mark.setTransform([
          {
            type: 'filter',
            callback: (datum: any) => datum.position === 'left'
          }
        ]);
      });
    }
  }
}

export const registerConversionFunnelChart = (option?: { VChart?: typeof VChart }) => {
  registerMarkFilterTransform();

  const vchartConstructor = option?.VChart || VChart;
  if (vchartConstructor) {
    vchartConstructor.useChart([ConversionFunnelChart]);
    vchartConstructor.useSeries([ConversionFunnelSeries]);
  }
};
