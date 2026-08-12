---
title: How to configure nested pie charts in VChart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

How to Configure a Nested Pie Chart</br>
## Problem description

How to Configure a Nested Pie Chart</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/GE18bSqkHohp1axFN4scSiPRnOe.gif' alt='' width='3572' height='2454'>

## Solution

VChart can configure multiple pie-series and then configure their radii as: the outer radius of the inner circle = the inner radius of the outer circle, so as to achieve nested pie charts</br>
There is also a rose chart similar to a nested pie chart, which can be selected according to the business scenario.</br>
*  outerRadius: number // outer radius, percentage value</br>
*  innerRadius: number // inner radius, percentage value</br>


## Code example

```
const spec = {
  type: 'common',
  data: [
    {
      id: 'id0',
      values: [
        { type: '0~29', value: '126.04' },
        { type: '30~59', value: '128.77' },
        { type: '60 and over', value: '77.09' }
      ]
    },
    {
      id: 'id1',
      values: [
        { type: '0~9', value: '39.12' },
        { type: '10~19', value: '43.01' },
        { type: '20~29', value: '43.91' },
        { type: '30~39', value: '45.4' },
        { type: '40~49', value: '40.89' },
        { type: '50~59', value: '42.48' },
        { type: '60~69', value: '39.63' },
        { type: '70~79', value: '25.17' },
        { type: '80 and over', value: '12.29' }
      ]
    }
  ],
  series: [
    {
      type: 'pie',
      dataIndex: 0,
      outerRadius: 0.65,
      innerRadius: 0,
      valueField: 'value',
      categoryField: 'type',
      label: { position: 'inside', visible: true }
    },
    {
      type: 'pie',
      dataIndex: 1,
      outerRadius: 0.8,
      innerRadius: 0.67,
      valueField: 'value',
      categoryField: 'type',
      label: {
        visible: true
      }
    }
  ],
  color: ['#98abc5', '#8a89a6', '#7b6888', '#6b486b', '#a05d56', '#d0743c', '#ff8c00'],
  legends: {
    visible: true,
    orient: 'left'
  }
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QJ31b7UDJot1GPxILHOc3ZJnnwN.gif' alt='' width='1339' height='540'>

Demo: https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-xkzpxq?file=%2Fsrc%2Findex.js%3A43%2C31</br>
## Related Documents

Demo：https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-xkzpxq?file=%2Fsrc%2Findex.js%3A43%2C31</br>
Tutorial:</br>
*  Initialize VChart: https://visactor.io/vchart/api/API/vchart</br>
*  Pie radius configuration: https://www.visactor.io/vchart/option/pieChart#outerRadius</br>
*  The Rose: https://www.visactor.io/vchart/demo/rose-chart/rose-stacked?keyword=roseChart</br>
Github：https://github.com/VisActor/VChart/</br>



