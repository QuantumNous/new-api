import type { Datum } from '@visactor/vchart/src/typings';
import { isArray } from '@visactor/vchart';

export const applyVisible = (spec: any, keyList: string[]) => {
  keyList.forEach(key => {
    if (isArray(spec[key])) {
      spec[key]?.forEach((s: any, i: number) => {
        spec[key][i] = {
          ...s,
          style: {
            ...s?.style,
            visible: s?.style?.visible ?? s?.visible ?? true
          }
        };
      });
    } else {
      spec[key] = {
        ...spec[key],
        style: {
          ...spec[key]?.style,
          visible: spec[key]?.style?.visible ?? spec[key]?.visible ?? true
        }
      };
    }
  });
};

export const mergeObjects = (objA: any, objB: any) => {
  function recursiveMerge(target: any, source: any) {
    for (const key in source) {
      if (
        key !== '__proto__' &&
        key !== 'constructor' &&
        key !== 'prototype' &&
        typeof source[key] === 'object' &&
        source[key] !== null
      ) {
        if (!target.hasOwnProperty(key)) {
          target[key] = Array.isArray(source[key]) ? [] : {};
        }
        recursiveMerge(target[key], source[key]);
      } else if (!target.hasOwnProperty(key) && typeof target === 'object') {
        target[key] = source[key];
      }
    }
    return target;
  }
  return recursiveMerge(objA, objB);
};

export const computeDataRange = (data: Datum[], field: string) => {
  let dataMin: number;
  let dataMax: number;
  const datumX = data.map(d => d[field]).filter(d => typeof d !== 'undefined' && d !== null);

  // 避免数据都为null, 即xField都为null, 导致scale异常, 图表为空
  // 这里只要设置dataMin和dataMax为任意数字并保证其不想等, 即可达到只显示yField而不显示xField的效果
  if (datumX.length === 0) {
    dataMin = 0;
    dataMax = 1;
  } else {
    dataMin = Math.min(...datumX) - (Math.max(...datumX) - Math.min(...datumX)) / 3;
    dataMax = (Math.max(...datumX) - dataMin) / 0.8 + dataMin;
    const delta_value = 10; // 可以是任意值, 只要大于0就行, 目的是为了让最小值和最大值不一样, 便于scale做插值计算
    const data = dataMin;
    if (dataMin === dataMax) {
      // 避免domain[0] = domain[1], 导致scale映射有问题
      // 数学计算:
      // 1.保证 (dataMax - data) / (data - dataMin) = 4
      // 2. dataMax > data & dataMin < data => delta_value > 0
      dataMin = data - delta_value;
      dataMax = (4 * data + delta_value) / 4;
    }
  }
  return { min: dataMin, max: dataMax };
};
