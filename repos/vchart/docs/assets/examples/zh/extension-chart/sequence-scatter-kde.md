---
category: examples
group: extension chart
title: 时序散点图-支持kde背景
keywords: extension, relationship
order:
cover: /vchart/preview/extension-chart-sequence-scatter-kde.gif
option: extensionChart
---

# 时序散点图-支持kde背景

## 关键配置

- `type: sequenceScatterKDE` 指定图表类型为时序散点KDE图

## 代码演示

```javascript livedemo
/** --在业务中使用时请添加以下代码-- */
// 在业务中使用时, 请额外依赖 @visactor/vchart-extension，包版本保持和vchart一致
// import { registerConversionFunnelChart } from '@visactor/vchart-extension';
/** --在业务中使用时请添加以上代码-- */

/** --在业务中使用时请删除以下代码-- */
const { registerSequenceScatterKDE } = VChartExtension;
/** --在业务中使用时请删除以上代码-- */

const responseData1 = await fetch(
  'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter/Training_process1/data.json'
);
const trainingData1 = await responseData1.json();

const responseLabel1 = await fetch(
  'https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter/Training_process1/label.json'
);
const trainingLabel1 = await responseLabel1.json();

const origianlData = trainingData1;
// const origianlData = trainingData2;
const chartData = {};
Object.keys(origianlData).forEach(iter => {
  chartData[iter] = [];
  origianlData[iter].projection.forEach((pos, index) => {
    chartData[iter].push({
      x: pos[0],
      y: pos[1],
      label: trainingLabel1.label_index[index]
    });
  });
});

const spec = {
  width: 600,
  height: 400,
  type: 'sequenceScatterKDE',
  data: chartData,
  xField: 'x',
  yField: 'y',
  seriesField: 'label',

  infoLabel: {
    visible: true,
    style: {
      text: datum => {
        return 'iteration: ' + datum.iter;
      }
    }
  },
  player: {
    orient: 'bottom',
    auto: true,
    interval: 2000,
    duration: 2000
  },
  animation: false
};

registerSequenceScatterKDE();
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;
```

## 相关教程

[时序散点关系图](link)
