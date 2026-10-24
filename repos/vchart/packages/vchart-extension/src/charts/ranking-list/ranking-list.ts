import type { IRankingListSpec } from './interface';
import { VChart, BaseChart, BarChart } from '@visactor/vchart';
import { RankingListChartSpecTransformer } from './ranking-list-transformer';

export class RankingList extends BaseChart<Omit<IRankingListSpec, 'data'>> {
  type = 'rankingList';
  static type = 'rankingList';
  static readonly view: string = 'singleDefault';

  declare _spec: IRankingListSpec;

  static readonly transformerConstructor = RankingListChartSpecTransformer;
  readonly transformerConstructor = RankingListChartSpecTransformer;

  init() {
    if (!this.isValid()) {
      return;
    }
    super.init();
  }

  protected isValid() {
    const { xField, yField, data } = this._spec;
    if (!xField || !yField) {
      this._option.onError?.('Missing Required Config: `xField`, `yField` ');
      return false;
    }
    if (!data) {
      this._option.onError?.('Data is required');
      return false;
    }
    return true;
  }
}

export const registerRankingList = (option?: { VChart?: typeof VChart }) => {
  const vchartConstructor = option?.VChart || VChart;
  if (vchartConstructor) {
    vchartConstructor.useChart([RankingList, BarChart]);
  }
};
