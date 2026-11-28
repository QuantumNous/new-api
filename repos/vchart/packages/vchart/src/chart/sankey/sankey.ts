import { BaseChart } from '../base/base-chart';
import { ChartTypeEnum } from '../interface/type';
import { SeriesTypeEnum } from '../../series/interface/type';
import type { ISankeyChartSpec } from './interface';
import { registerSankeySeries } from '../../series/sankey/sankey';
import { Factory } from '../../core/factory';
import { SankeyChartSpecTransformer } from './sankey-transformer';
import type { Datum, MaybeArray } from '../../typings/common';
import type { ISeries } from '../../series/interface';
import type { IMark, IMarkGraphic } from '../../mark/interface/common';
import type { IRegionQuerier } from '../../typings/params';
import { isArray } from '@visactor/vutils';
import { loadScrollbar } from '@visactor/vrender-components';
import { registerMarkTooltipProcessor } from '../../component/tooltip/processor/mark-tooltip';
import { getDatumOfGraphic } from '../../util/mark';

export class SankeyChart<T extends ISankeyChartSpec = ISankeyChartSpec> extends BaseChart<T> {
  static readonly type: string = ChartTypeEnum.sankey;
  static readonly seriesType: string = SeriesTypeEnum.sankey;
  static readonly transformerConstructor = SankeyChartSpecTransformer;
  readonly transformerConstructor = SankeyChartSpecTransformer;
  readonly type: string = ChartTypeEnum.sankey;
  readonly seriesType: string = SeriesTypeEnum.sankey;

  protected _setStateInDatum(
    stateKey: string,
    datum: MaybeArray<Datum> | null,
    filter?: (series: ISeries, mark: IMark) => boolean,
    region?: IRegionQuerier
  ) {
    const activeDatum = (isArray(datum) ? (datum as Datum[])[0] : datum) as Datum;
    if (!activeDatum) {
      this._interaction.clearByState(stateKey);
      return;
    }
    let activeNodeOrLink: IMarkGraphic = null;
    const markFilter = (series: ISeries, mark: IMark) => {
      return mark.type !== 'text' && mark.getProduct() && (!filter || filter(series, mark));
    };

    this.filterGraphicsByDatum(activeDatum, {
      filter: markFilter,
      region,
      getDatum: e => {
        let d = (getDatumOfGraphic(e) as any)?.datum;

        if (isArray(d)) {
          // data of link
          d = d[0];
        }
        return d;
      },
      callback: (element, mark, s, r) => {
        const id = mark.getProductId();
        if (id && (id.includes('node') || id.includes('link'))) {
          (s as any)._handleEmphasisElement?.({ item: element, mark });
        }
      },
      regionCallback: (elements, r) => {
        if (activeDatum && elements.length) {
          activeNodeOrLink = elements[0];
        }
      }
    });

    if (activeNodeOrLink) {
      this._interaction.updateStateOfGraphics(stateKey, [activeNodeOrLink]);
    }
  }
}

export const registerSankeyChart = () => {
  registerMarkTooltipProcessor();
  loadScrollbar();
  registerSankeySeries();

  Factory.registerChart(SankeyChart.type, SankeyChart);
};
