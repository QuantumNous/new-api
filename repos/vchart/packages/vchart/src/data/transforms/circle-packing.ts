import type { Datum } from '../../typings';

// eslint-disable-next-line no-duplicate-imports
import type { CirclePackingOptions } from '@visactor/vlayouts';
import { CirclePackingLayout } from '@visactor/vlayouts';

export interface ICirclePackingOpt extends CirclePackingOptions {
  width: number;
  height: number;
  /** the field to read node value, default is 'value' */
  valueField?: string;
}

/**
 * CirclePacking布局算法，VGrammar 提供.
 */
export const circlePackingLayout = (data: Array<Datum>, op: () => ICirclePackingOpt) => {
  if (!data) {
    return data;
  }
  const options = op();
  const { width, height } = options;
  if (width === 0 || height === 0) {
    return data;
  }
  const layout = new CirclePackingLayout(options);
  return layout.layout(data, { width, height });
};
