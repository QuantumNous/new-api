import { cloneDeep } from '@visactor/vutils';
import { DataView } from '@visactor/vdataset';

function copyOneDataView(d: DataView, deep = false) {
  let _deep = deep;
  if (d.latestData instanceof DataView) {
    _deep = false;
  }
  if (_deep) {
    return cloneDeep(d.latestData);
  }

  return d.latestData && d.latestData.slice();
}

/**
 * 聚合统计主要用于处理数据(诸如统计平均值,求和等),并返回计算后的数据结果
 * @param data
 * @param options
 * @returns
 */
export const copyDataView = (data: Array<DataView>, options?: ICopyDataViewOption) => {
  if (data.length === 0) {
    return [];
  }
  if (data.length === 1) {
    return copyOneDataView(data[0], options?.deep);
  }
  return data.map(d => copyOneDataView(d, options?.deep));
};

export interface ICopyDataViewOption {
  deep?: boolean;
}
