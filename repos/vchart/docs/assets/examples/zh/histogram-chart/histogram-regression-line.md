---
category: examples
group: histogram chart
title: 基础直方图
keywords: histogram,distribution,rectangle
order: 3-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/histogram-chart/histogram-regression-line.png
option: histogramChart
---

# 直方图回归线

## 关键信息

- 使用 `bin` 分箱对原始数据进行处理，生成直方图所需的区间和频率数据。
- 直方图配置中需指定以下字段：
  - `xField`：表示每个区间的左端点（如 `x0`）。
  - `x2Field`：表示每个区间的右端点（如 `x1`）。
  - `yField`：表示每个区间的频数（如 `frequency`）。
- 可通过扩展配置添加回归线（如 KDE 核密度估计和 ECDF 经验累积分布函数）以辅助分析数据分布。

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { registerRegressionLine, appendHistogramRegressionLineConfig } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { registerRegressionLine, appendHistogramRegressionLineConfig } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */

function boxMullerRandom() {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = Math.random();
  }
  while (v === 0) {
    v = Math.random();
  }
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateGaussian(count, mean = 0, sd = 1) {
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(mean + boxMullerRandom() * sd);
  }
  return out;
}

function generateMixtureGaussianSamples() {
  const a = generateGaussian(160, 5, 4, 1); // cluster A
  // const b = generateGaussian(80, 2.3, 0.08, 2); // cluster B
  // const c = generateGaussian(140, 9.3, 0.35, 3); // cluster C
  const outliers = [5.0, 6.2, 3.5, 12.0, 0.5];
  const arr = [...a, ...outliers];
  return arr.map(v => ({ value: v }));
}

const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            step: 2,
            field: 'value',
            outputNames: { x0: 'x0', x1: 'x1', count: 'frequency' }
          }
        }
      ],
      values: generateMixtureGaussianSamples()
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'frequency',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Histogram of Gaussian data'
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'frequency'
      },
      content: [
        {
          key: datum => datum['x0'] + '～' + datum['x1'],
          value: datum => datum['frequency']
        }
      ]
    }
  }
};

registerRegressionLine();
appendHistogramRegressionLineConfig(spec, [
  {
    type: 'kde', // 支持 'kde' 和 'ecdf'
    line: {
      style: {
        stroke: 'red',
        lineWidth: 2
      }
    },
    label: {
      text: 'KDE核密度估计'
    }
  },
  {
    type: 'ecdf', // 支持 'kde' 和 'ecdf'
    line: {
      style: {
        stroke: 'green',
        lineWidth: 2
      }
    },
    label: {
      text: '经验累积分布函数（ECDF）'
    }
  }
]);

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```
