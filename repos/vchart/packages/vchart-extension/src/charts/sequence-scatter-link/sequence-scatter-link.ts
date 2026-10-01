import type { ISequenceScatterLinkSpec } from './interface';
import { VChart, BaseChart, ScatterChart } from '@visactor/vchart';
import { SequenceScatterLinkChartSpecTransformer } from './sequence-scatter-link-transformer';

export class SequenceScatterLink extends BaseChart<Omit<ISequenceScatterLinkSpec, 'data'>> {
  type = 'sequenceScatterLink';
  static type = 'sequenceScatterLink';
  static readonly view: string = 'singleDefault';

  declare _spec: ISequenceScatterLinkSpec;

  static readonly transformerConstructor = SequenceScatterLinkChartSpecTransformer;
  readonly transformerConstructor = SequenceScatterLinkChartSpecTransformer;

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

export const registerSequenceScatterLink = (option?: { VChart?: typeof VChart }) => {
  const vchartConstructor = option?.VChart || VChart;
  if (vchartConstructor) {
    vchartConstructor.useChart([SequenceScatterLink, ScatterChart]);
  }
};
