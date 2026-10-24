---
title: How to format axis labels?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## **Question Title**

How to format axis labels?</br>
## **Question Description**

As shown in the figure, when the axis label value is inaccurate with a very long decimal point, can it be formatted?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Cs0gbHm28oVi79xXz9HcUinZnxc.gif' alt='' width='1280' height='908'>

 </br>
## **Solution**

The problem of floating-point precision here is due to the addition operation of floating-point numbers when realizing the alignment of the axis scale. To improve the readability of axis labels, you can format the axis labels through `label.formatMethod`.
 </br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/DdhibJCh7oEaqfxiq20cRda2n2d.gif' alt='' width='1280' height='453'>

## **Code Example**

```
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: 'Monday', type: 'Breakfast', y: 0.1633 },
      ]
    },
    {
      id: 'id1',
      values: [
        { x: 'Monday', type: 'Drink', y: -0.3455 },
      ]
    }
  ],
  series: [
    {
      type: 'line',
      id: 'line',
      dataIndex: 0,
      label: { visible: true },
      seriesField: 'type',
      dataIndex: 0,
      xField: ['x', 'type'],
      yField: 'y'
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false
    }
  ],
  axes: [
    { orient: 'left', seriesIndex: [0], id: 'left' },
    {
      orient: 'right',
      seriesId: ['line'],
      grid: { visible: false },
      label: {
        formatMethod: (label) => {
          return Math.round(label * 100) / 100;
        }
      },
      sync: {
        axisId: 'left',
        tickAlign: true
      }
    },
    { orient: 'bottom', label: { visible: true }, type: 'band' }
  ],
  legends: {
    visible: true,
    orient: 'bottom'
  }
};
const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();
// Just for the convenience of console debugging, DO NOT COPY!  
window['vchart'] = vchart;</br>
```
## **Result Display**

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/STRabpn6Io4ROsxHRujc2hmLnth.gif' alt='' width='1280' height='852'>

## **Related Documentation**

Related configuration: [https://www.visactor.io/vchart/option/barChart-axes-linear#label.formatMethod](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Foption%2FbarChart-axes-linear%23label.formatMethod)
 Axes axis tutorial: [https://www.visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Axes](https%3A%2F%2Fwww.visactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FAxes)
 github: [https://github.com/VisActor/VChart](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>