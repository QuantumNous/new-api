import type { ISequenceScatterPixelSpec } from './interface';
import { VChart, BaseChart, ScatterChart } from '@visactor/vchart';
import { SequenceScatterPixelChartSpecTransformer } from './sequence-scatter-pixel-transformer';

export class SequenceScatterPixel extends BaseChart<Omit<ISequenceScatterPixelSpec, 'data'>> {
  type = 'sequenceScatterPixel';
  static type = 'sequenceScatterPixel';
  static readonly view: string = 'singleDefault';

  declare _spec: ISequenceScatterPixelSpec;

  static readonly transformerConstructor = SequenceScatterPixelChartSpecTransformer;
  readonly transformerConstructor = SequenceScatterPixelChartSpecTransformer;

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

export const registerSequenceScatterPixel = (option?: { VChart?: typeof VChart }) => {
  const vchartConstructor = option?.VChart || VChart;
  if (vchartConstructor) {
    vchartConstructor.useChart([SequenceScatterPixel, ScatterChart]);
  }
};
