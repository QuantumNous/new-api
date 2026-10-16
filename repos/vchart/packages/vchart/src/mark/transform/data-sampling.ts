import { isFunction, maxInArray, minInArray } from '@visactor/vutils';
import type { Datum } from '../../typings/common';
import { average, sum } from '../../util/math';
import { Factory } from '../../core/factory';

const samplerMap = {
  min: minInArray,
  max: maxInArray,
  average: average,
  sum: sum
};

function lttb(size: number, array: any[], isGroup: boolean, yfield: string) {
  const frameSize = Math.floor(array.length / size);
  const newIndices = [];
  const len = array.length;

  let currentIndex = 0;
  let sampledIndex = 0;
  let maxArea;
  let area;
  let nextIndex;

  // First frame use the first data.
  newIndices[sampledIndex++] = currentIndex;

  for (let i = 1; i < len - 1; i += frameSize) {
    const nextFrameStart = Math.min(i + frameSize, len - 1);
    const nextFrameEnd = Math.min(i + frameSize * 2, len);

    const avgX = (nextFrameEnd + nextFrameStart) / 2;
    let avgY = 0;

    for (let idx = nextFrameStart; idx < nextFrameEnd; idx++) {
      const value = array[idx][yfield];
      if (Number.isNaN(value)) {
        continue;
      }
      avgY += value;
    }
    avgY /= nextFrameEnd - nextFrameStart;

    const frameStart = i;
    const frameEnd = Math.min(i + frameSize, len);

    const pointAX = i - 1;
    const pointAY = array[currentIndex][yfield];

    maxArea = -1;

    nextIndex = frameStart;
    // Find a point from current frame that construct a triangel with largest area with previous selected point
    // And the average of next frame.
    for (let idx = frameStart; idx < frameEnd; idx++) {
      const value = array[idx][yfield];
      if (Number.isNaN(yfield)) {
        continue;
      }
      // Calculate triangle area over three buckets
      area = Math.abs((pointAX - avgX) * (value - pointAY) - (pointAX - idx) * (avgY - pointAY));
      if (area > maxArea) {
        maxArea = area;
        nextIndex = idx; // Next a is this b
      }
    }

    newIndices[sampledIndex++] = nextIndex;

    currentIndex = nextIndex; // This a is the next a (chosen b)
  }

  // First frame use the last data.
  if (newIndices[sampledIndex - 1] !== len - 1) {
    newIndices[sampledIndex++] = len - 1;
  }

  // output newly added tuples
  const newRawIndices = newIndices.map(i => (isGroup ? array[i].i : i));
  return newRawIndices;
}

function sample(size: number, array: any[], isGroup: boolean, mode: 'min' | 'max' | 'average' | 'sum', yfield: string) {
  let frameSize = Math.floor(array.length / size);
  const newIndices = [];
  const len = array.length;
  let sampledIndex = 0;
  let frameValues = [];

  newIndices.push(sampledIndex);
  array[sampledIndex][yfield] = array[sampledIndex][yfield];

  for (let i = 1; i < len - 1; i += frameSize) {
    if (frameSize > len - i) {
      frameSize = len - i;
      frameValues.length = frameSize;
    }
    frameValues = [];
    for (let k = 0; k < frameSize; k++) {
      frameValues.push(array[i + k][yfield]);
    }
    const value = samplerMap[mode](frameValues);
    sampledIndex = Math.min(Math.round(i + frameValues.length / 2) || 0, len - 1);
    array[sampledIndex][yfield] = value;
    newIndices.push(sampledIndex);
  }
  const newRawIndices = newIndices.map(i => (isGroup ? array[i].i : i));
  return newRawIndices;
}

function sampleMin(size: number, array: any[], isGroup: boolean, yfield: string) {
  return sample(size, array, isGroup, 'min', yfield);
}

function sampleMax(size: number, array: any[], isGroup: boolean, yfield: string) {
  return sample(size, array, isGroup, 'max', yfield);
}

function sampleAverage(size: number, array: any[], isGroup: boolean, yfield: string) {
  return sample(size, array, isGroup, 'average', yfield);
}

function sampleSum(size: number, array: any[], isGroup: boolean, yfield: string) {
  return sample(size, array, isGroup, 'sum', yfield);
}

/**
 * Samples tuples passing through this operator.
 * mode: 'lttb' - Uses lttb sampling to maintain a trend-maintained sample.
 * mode: 'min' | 'max' | 'average' | 'sum' - Uses aggregation methods to location sample points.
 * @constructor
 * @param {object} options - The parameters for this operator.
 * @param {number} [options.size=1000] - The maximum number of samples.
 * @param {string} [options.yfield] - The yfield string of data.
 * @param {string} [options.groupBy] - The groupBy string of data.
 */

export const dataSampling = (
  options: {
    size: number | (() => number);
    factor?: number;
    skipfirst?: boolean;
    yfield?: string;
    groupBy?: string;
    mode?: 'lttb' | 'min' | 'max' | 'average' | 'sum';
  },
  upstreamData: Datum[]
) => {
  let size = isFunction(options.size) ? options.size() : options.size;
  const factor = options.factor || 1;

  if (Array.isArray(size)) {
    size = Math.floor(size[1] - size[0]);
  }

  size *= factor;

  // size<=0的特殊情况不采样，返回空
  if (size <= 0) {
    return [];
  }

  // 数据<size的情况，不进行采样，保留所有数据
  if (upstreamData.length <= size) {
    return upstreamData;
  }

  const skipfirst = options.skipfirst;
  // 这里需要依据this.value.length判断是不是第一次数据流，
  // 以避免点击图例，updateChartData等操作清空所有label
  if (skipfirst) {
    return upstreamData.slice(0, 1);
  }

  const { mode, yfield: y, groupBy } = options;
  const yfield = y ?? 'y';

  // 采样方法
  let sampler = lttb;
  if (mode === 'min') {
    sampler = sampleMin;
  } else if (mode === 'max') {
    sampler = sampleMax;
  } else if (mode === 'average') {
    sampler = sampleAverage;
  } else if (mode === 'sum') {
    sampler = sampleSum;
  }

  // 处理数据source，source为采样前的原始数据
  if (upstreamData.length) {
    // 如果有groupBy，数据分组
    const groups: Record<string, any> = {};
    if (groupBy) {
      for (let i = 0, n = upstreamData.length; i < n; i++) {
        const datum = upstreamData[i];
        const groupId = datum[groupBy];
        if (groups[groupId]) {
          groups[groupId].push({ [yfield]: datum[yfield], i });
        } else {
          groups[groupId] = [];
          groups[groupId].push({ [yfield]: datum[yfield], i });
        }
      }

      // 分组采样
      let rawIndice: any[] = [];

      Object.keys(groups).forEach(groupName => {
        const group = groups[groupName];
        if (group.length <= size) {
          const indices = group.map((datum: any) => {
            return datum.i;
          });
          rawIndice = rawIndice.concat(indices);
        } else {
          const indices = sampler(size, group, true, yfield);
          rawIndice = rawIndice.concat(indices);
          group.forEach((datum: any) => (upstreamData[datum.i][yfield] = datum[yfield]));
        }
      });

      // 采样后，按照原始顺序排序
      rawIndice.sort((a, b) => a - b);

      return rawIndice.map((index: number) => upstreamData[index]);
    }
    return sampler(size, upstreamData, false, yfield).map(index => upstreamData[index]);
  }

  return [];
};
export const registerDataSamplingTransform = () => {
  Factory.registerGrammarTransform('dataSampling', {
    transform: dataSampling
  });
};
