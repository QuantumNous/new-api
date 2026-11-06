import type { Parser } from '@visactor/vdataset';
import type { IBaseScale } from '@visactor/vscale';

/**
 * dataView数据 解析器
 * @param data
 * @param options
 * @param dataView
 * @returns
 */
export const scaleParser: Parser = (scale: IBaseScale) => {
  return scale;
};
