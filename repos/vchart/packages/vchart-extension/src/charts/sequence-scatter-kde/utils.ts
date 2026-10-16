import { EXPAND_RATIO } from './constant';
import type { Point } from './interface';

// KDE 相关的工具函数
export function gaussKernel(x: number) {
  const SQRT2PI2 = Math.sqrt((Math.PI * 2) ** 2);
  return Math.exp(-(x ** 2) / 2) / SQRT2PI2;
}

export function scottBandwidth(data: Point[]) {
  return data.length ** (-1 / 6);
}
export function calculateKDE(data: Point[], bins = 100, bandwidth?: number) {
  const groupedData: { [key: string]: Point[] } = data.reduce((groups, point) => {
    const label = point.label;
    groups[label] = groups[label] || [];
    groups[label].push(point);
    return groups;
  }, {} as { [key: string]: Point[] });

  const kdeResult: Array<{ x: number; y: number; kde: number; label: string }> = [];

  Object.entries(groupedData).forEach(([label, points]) => {
    const h = bandwidth || scottBandwidth(points);

    const xValues = points.map(d => d.x);
    const yValues = points.map(d => d.y);

    const xMin = Math.min(...xValues);
    const xMax = Math.max(...xValues);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const xExpand = (xMax - xMin) * EXPAND_RATIO;
    const yExpand = (yMax - yMin) * EXPAND_RATIO;

    const xExtent = { min: xMin - xExpand, max: xMax + xExpand };
    const yExtent = { min: yMin - yExpand, max: yMax + yExpand };

    // step决定了背景的填充色块的大小，这个大小其实是不变的
    const xStep = 0.1;
    const yStep = 0.1;

    const densities: number[] = []; // 用于存储每个点的 density
    for (let i = 0; i < bins; i++) {
      for (let j = 0; j < bins; j++) {
        const x = xExtent.min + i * xStep;
        const y = yExtent.min + j * yStep;
        let density = 0;
        for (const point of points) {
          const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
          density += gaussKernel(distance / h);
        }
        density = density / (points.length * h * h);
        densities.push(density); // 先暂存 density 值
        kdeResult.push({ x, y, kde: density, label }); // 同时也先存入 kdeResult
      }
    }

    // // 归一化每个 label 的 KDE 密度值到 [0, 1] 范围内
    // const maxDensity = Math.max(...densities);
    // const minDensity = Math.min(...densities);
    //
    // // 归一化
    // for (let i = 0; i < kdeResult.length; i++) {
    //   if (kdeResult[i].label === label) {
    //     kdeResult[i].kde = (kdeResult[i].kde - minDensity) / (maxDensity - minDensity);
    //   }
    // }
  });

  return kdeResult;
}
