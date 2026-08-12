---
category: examples
group: histogram chart
title: 基础直方图
keywords: histogram,distribution,rectangle
order: 3-4
cover: https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vchart/preview/histogram-chart/histogram-regression-line.png
option: histogramChart
---

# Histogram Regression Line

## Key Information

- Use `bin` binning to process raw data and generate the intervals and frequency data required for the histogram.
- In the histogram configuration, you need to specify the following fields:
  - `xField`: Represents the left endpoint of each interval (e.g., `x0`).
  - `x2Field`: Represents the right endpoint of each interval (e.g., `x1`).
  - `yField`: Represents the frequency of each interval (e.g., `frequency`).
- You can add regression lines (such as KDE kernel density estimation and ECDF empirical cumulative distribution function) via extended configuration to help analyze the data distribution.

## Code Example

```javascript livedemo
/** --Add the following code when using in your project-- */
// When using in your project, please additionally depend on @visactor/vchart-extension, and keep the package version consistent with vchart
// import { registerRegressionLine, appendHistogramRegressionLineConfig } from '@visactor/vchart-extension';
/** --Add the above code when using in your project-- */

/** --Delete the following code when using in your project-- */
const { registerRegressionLine, appendHistogramRegressionLineConfig } = VChartExtension;
/** --Delete the above code when using in your project-- */
```

function boxMullerRandom() {
let u = 0;
let v = 0;
while (u === 0) {
u = Math.random();
}
while (v === 0) {
v = Math.random();
}
return Math.sqrt(-2.0 _ Math.log(u)) _ Math.cos(2.0 _ Math.PI _ v);
}

function generateGaussian(count, mean = 0, sd = 1) {
const out = [];
for (let i = 0; i < count; i++) {
out.push(mean + boxMullerRandom() \* sd);
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
text: 'KDE 核密度估计'
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

```
