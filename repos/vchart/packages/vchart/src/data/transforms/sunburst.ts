import type { SunburstOptions } from '@visactor/vlayouts';
// eslint-disable-next-line no-duplicate-imports
import { SunburstLayout } from '@visactor/vlayouts';
import type { Datum } from '../../typings';

export interface ISunburstOpt extends SunburstOptions {
  width: number;
  height: number;
}

/**
 * 旭日图布局算法，VGrammar 提供.
 */
export const sunburstLayout = (data: Array<Datum>, op: () => ISunburstOpt) => {
  if (!data) {
    return data;
  }
  const options = op();
  const { width, height } = options;
  const layout = new SunburstLayout(options);
  return layout.layout(data, { width, height });
};
