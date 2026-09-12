import type { ISequenceScatterKDESpec } from './interface';
import { VChart, BaseChart, ScatterChart } from '@visactor/vchart';
import { SequenceScatterKDEChartSpecTransformer } from './sequence-scatter-kde-transformer';

export class SequenceScatterKDE extends BaseChart<Omit<ISequenceScatterKDESpec, 'data'>> {
  type = 'sequenceScatterKDE';
  static type = 'sequenceScatterKDE';
  static readonly view: string = 'singleDefault';

  declare _spec: ISequenceScatterKDESpec;

  static readonly transformerConstructor = SequenceScatterKDEChartSpecTransformer;
  readonly transformerConstructor = SequenceScatterKDEChartSpecTransformer;

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

export const registerSequenceScatterKDE = (option?: { VChart?: typeof VChart }) => {
  const vchartConstructor = option?.VChart || VChart;
  if (vchartConstructor) {
    vchartConstructor.useChart([SequenceScatterKDE, ScatterChart]);
  }
};
