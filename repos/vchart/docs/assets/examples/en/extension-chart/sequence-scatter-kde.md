---
category: examples
group: extension chart
title: sequence-scatter-kde
keywords: extension, relationship
order:
cover: /vchart/preview/extension-chart-sequence-scatter-kde.gif
option: extensionChart
---

# sequence-scatter-kde

## Key option

- `type: sequenceScatterKDE` Specifies the chart type as Sequence Scatter KDE

## Live Demo

```javascript livedemo
/** --Add the following code when using in production-- */
// When using in production, please additionally depend on @visactor/vchart-extension, keeping the package version consistent with vchart
// import { registerConversionFunnelChart } from '@visactor/vchart-extension';
/** --Add the above code when using in production-- */

/** --Delete the following code when using in production-- */
const { registerSequenceScatterKDE } = VChartExtension;
/** --Delete the above code when using in production-- */

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

## Related tutorials

[时序散点关系图](link)
