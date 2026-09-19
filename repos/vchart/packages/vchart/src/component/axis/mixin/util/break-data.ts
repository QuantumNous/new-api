import { isEqual } from '@visactor/vutils';

const setDomain = (min: number, max: number, breaks: number[]): [number, number][] =>
  breaks.reduce(
    (r, b, i) => {
      r.push([b, breaks.length === i + 1 ? max : breaks[i + 1]]);
      return r;
    },
    [[min, breaks[0]]]
  );

function breakDomain(data: number[], points: number[]): [number, number][] {
  // 默认数据已经排序
  const min = data[0];
  const max = data[data.length - 1];
  const breaks = points.filter(point => point > min && point < max);
  if (breaks.length === 0) {
    return [[min, max]];
  }

  return setDomain(min, max, breaks);
}

const sorter = (a: number, b: number) => a - b;

const fillBins = (data: number[], points: number[]) => {
  const bins: Array<{ count: number; sub: number[]; max: number; min: number }> = [
    { count: 0, sub: [], max: points[0], min: points[0] }
  ];
  let i = 0;
  let j = 0;
  while (i < points.length) {
    if (data[j] <= points[i]) {
      bins[i].count += 1;
      bins[i].sub.push(data[j]);
      j += 1;
    } else {
      i += 1;
      bins[i] = { count: 0, sub: [], max: points[i], min: points[i] };
    }
  }
  bins.forEach(bin => {
    if (bin.count) {
      bin.min = Math.min.apply(null, bin.sub);
    }
  });

  const remain = data.slice(j);
  bins[i] = { count: remain.length, sub: remain, min: points[points.length - 1], max: Math.max.apply(null, remain) };
  return bins;
};

function breakScope(data: number[], points: number[], scopeType: 'count' | 'length' = 'count'): [number, number][] {
  // 默认 data 和 points 已经排序
  const bins = fillBins(data, points);

  const totalLength =
    scopeType === 'count'
      ? data.length
      : bins.reduce((res, bin, i) => {
          return bin.count > 0 ? res + bin.max - bin.min : res;
        }, 0);
  const res: [number, number][] = [];
  let acc = 0;

  let resIndex = 0; // 因为有的结果会被剔除，所以要从 res 的真实索引上拿
  bins.forEach((bin, i) => {
    if (totalLength === 0) {
      res.push([0, i / bins.length - 1]);
    } else {
      const length = scopeType === 'count' ? bin.count : bin.max - bin.min;
      const b0 = res[resIndex - 1] ? res[resIndex - 1][1] : 0;
      const b1 = i === bins.length - 1 ? 1 : Math.min((acc + length) / totalLength, 1);

      if (b0 === b1 && (b0 === 0 || b0 === 1)) {
      } else {
        resIndex += 1;
        res.push([b0, b1]);
        acc += length;
      }
    }
  });

  return res;
}

export function breakData(data: number[], points: number[], scopeType?: 'count' | 'length') {
  // 现将数据和断点排序
  data.sort(sorter);
  points.sort(sorter);

  return {
    domain: breakDomain(data, points),
    scope: breakScope(data, points, scopeType)
  };
}
