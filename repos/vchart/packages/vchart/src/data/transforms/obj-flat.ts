import type { DataView } from '@visactor/vdataset';
import { PREFIX } from '../../constant/base';
import { DEFAULT_DATA_INDEX, DEFAULT_DATA_KEY } from '../../constant/data';
import { isValid } from '@visactor/vutils';
/**
 * @description 针对某个数组进行数据展开，将数组中的每个元素拆出来加入数据集
 */
export const objFlat = (data: Array<DataView>, op: string) => {
  // 数据处理
  const dataCollect = data[0]?.latestData ? data[0].latestData : data || [];
  const result: any[] = [];
  let index = 0;
  dataCollect.forEach((datum: any) => {
    const dataKeyObj: any = {};
    let dataKey: string;

    for (const key in datum) {
      if (key !== op && !key.startsWith(PREFIX)) {
        dataKeyObj[key] = datum[key];
        dataKey = isValid(dataKey) ? `${dataKey}_${datum[key]}` : `${datum[key]}`;
      }
    }

    const dataOp = datum[op];
    dataOp?.forEach((d: any, i: number) => {
      result.push(
        Object.assign({}, dataKeyObj, d, {
          [DEFAULT_DATA_INDEX]: index,
          [DEFAULT_DATA_KEY]: `${dataKey}_${i}`
        })
      );

      index++;
    });
  });
  return result;
};
