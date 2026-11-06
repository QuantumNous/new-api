import type { Parser } from '@visactor/vdataset';

/**
 * dataView数据 解析器
 * @param data
 * @param options
 * @param dataView
 * @returns
 */
export const arrayParser: Parser = (array: []) => {
  return array;
};
