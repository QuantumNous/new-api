import type { IRankingBarSpec } from './interface';
import { VChart, BaseChart } from '@visactor/vchart';
import { RankingBarChartSpecTransformer } from './ranking-bar-transformer';

export class RankingBar extends BaseChart<Omit<IRankingBarSpec, 'color'>> {
  type = 'rankingBar';
  static type = 'rankingBar';
  static readonly view: string = 'singleDefault';

  declare _spec: IRankingBarSpec;

  static readonly transformerConstructor = RankingBarChartSpecTransformer;
  readonly transformerConstructor = RankingBarChartSpecTransformer;

  init() {
    if (!this.isValid()) {
      return;
    }
    super.init();
  }

  protected isValid() {
    const { xField, yField, timeField, data } = this._spec;
    if (!xField || !yField || !timeField) {
      this._option.onError?.('Missing Required Config: `xField`, `yField`, `timeField` ');
      return false;
    }
    if (!data) {
      this._option.onError?.('Data is required');
      return false;
    }
    return true;
  }
}

export const registerRankingBarChart = (option?: { VChart?: typeof VChart }) => {
  const vchartConstructor = option?.VChart || VChart;
  if (vchartConstructor) {
    vchartConstructor.useChart([RankingBar]);
  }
};
