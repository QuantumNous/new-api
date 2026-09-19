---
title: 9. How to draw a dual-axis chart</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Title

How to draw a dual-axis chart</br>
## Describe

What methods can be used to draw a chart with two axes like this?</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Po2rbBUuuobGiLxPRLHc2W0Tnxb.gif' alt='' width='1714' height='1322'>

## Solution 

In VChart, you can add a right axis and bind the corresponding series to achieve this. Refer to the demo: https://visactor.io/vchart/demo/combination/dual-axis。</br>
## Code Example

```
const spec = {
  type: 'common',
  seriesField: 'color',
  data: [
    {
      id: 'id0',
      values: [
        { x: '周一', type: '早餐', y: 15 },
        { x: '周一', type: '午餐', y: 25 },
        { x: '周二', type: '早餐', y: 12 },
        { x: '周二', type: '午餐', y: 30 },
        { x: '周三', type: '早餐', y: 15 },
        { x: '周三', type: '午餐', y: 24 },
        { x: '周四', type: '早餐', y: 10 },
        { x: '周四', type: '午餐', y: 25 },
        { x: '周五', type: '早餐', y: 13 },
        { x: '周五', type: '午餐', y: 20 },
        { x: '周六', type: '早餐', y: 10 },
        { x: '周六', type: '午餐', y: 22 },
        { x: '周日', type: '早餐', y: 12 },
        { x: '周日', type: '午餐', y: 19 }
      ]
    },
    {
      id: 'id1',
      values: [
        { x: '周一', type: '饮料', y: 22 },
        { x: '周二', type: '饮料', y: 43 },
        { x: '周三', type: '饮料', y: 33 },
        { x: '周四', type: '饮料', y: 22 },
        { x: '周五', type: '饮料', y: 10 },
        { x: '周六', type: '饮料', y: 30 },
        { x: '周日', type: '饮料', y: 50 }
      ]
    }
  ],
  series: [
    {
      type: 'bar',
      id: 'bar',
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
    { orient: 'left', seriesIndex: [0] },
    { orient: 'right', seriesId: ['line'], grid: { visible: false } },
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
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/B7chbaA57otpwNxbmdcc59eHnYd.gif' alt='' width='1260' height='1042'>

https://visactor.io/vchart/demo/combination/dual-axis</br>
### Related Documents

Demo: [https://visactor.io/vchart/demo/combination/dual-axis](https%3A%2F%2Fvisactor.io%2Fvchart%2Fdemo%2Fcombination%2Fdual-axis)</br>
### Tutorial:

*  Combination Chart: [https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination](https%3A%2F%2Fvisactor.io%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Types%2FCombination) API:</br>
*  Combination Chart: [https://visactor.io/vchart/option/commonChart](https%3A%2F%2Fvisactor.io%2Fvchart%2Foption%2FcommonChart) Github: [https://github.com/VisActor/VChart/](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart%2F)</br>

