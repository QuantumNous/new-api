---
title: Can VChart be server-side rendering?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
## Question title

Can server-side rendering be used?</br>
## Problem description

Can server-side rendering be used? I want to provide a service to obtain chart images at the server level.</br>
## Solution

VChart supports Node server-side rendering. The drawing library VRender used by VChart supports Node environment rendering. In addition to VChart, you only need to install the [canvas ](https%3A%2F%2Fwww.npmjs.com%2Fpackage%2Fcanvas)package at the server level.</br>


## Code example

```
const fs = require('fs');

const VChart = require('@visactor/vchart');
const Canvas = require('canvas');

// 正常的图表 spec 配置
const spec = {
  type: 'radar',
  data: [
    {
      id: 'Map',
      values: [
        { key: 'North', value: 31, category: 'Destroyer' },
        { key: 'Northeast', value: 32, category: 'Destroyer' },
        { key: 'East', value: 21, category: 'Destroyer' },
        { key: 'Southeast', value: 15, category: 'Destroyer' },
        { key: 'South', value: 50, category: 'Destroyer' },
        { key: 'Southwest', value: 44, category: 'Destroyer' },
        { key: 'West', value: 32, category: 'Destroyer' },
        { key: 'Northwest', value: 32, category: 'Destroyer' },
        { key: 'North', value: 31, category: 'Destroyer' },
        { key: 'Northeast', value: 32, category: 'Destroyer' },
        { key: 'East', value: 21, category: 'Destroyer' },
        { key: 'Southeast', value: 40, category: 'aircraft carrier' },
        { key: 'South', value: 25, category: 'aircraft carrier' },
        { key: 'Southwest', value: 22, category: 'aircraft carrier' },
        { key: 'West', value: 18, category: 'aircraft carrier' },
        { key: 'Northwest', value: 7, category: 'aircraft carrier' },
        { key: 'North', value: 24, category: 'aircraft carrier' },
        { key: 'Northeast', value: 43, category: 'aircraft carrier' },
        { key: 'East', value: 42, category: 'aircraft carrier' }
      ]
    }
  ],
  categoryField: 'key',
  valueField: 'value',
  seriesField: 'category',
  legends: {
    visible: true,
    orient: 'bottom'
  }
};
const cs = new VChart.default(spec, {
  // 声明使用的渲染环境以及传染对应的渲染环境参数
  mode: 'node',
  modeParams: Canvas,
  animation: false // 关闭动画
});

cs.renderSync();

// 导出图片
const buffer = cs.getImageBuffer();
fs.writeFileSync(`./chart.png`, buffer);</br>
```
## Results show

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Se4ybFyc9oRxQBxKW15cwNEBn3c.gif' alt='' width='500' height='500'>

Demo: https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/node</br>
## Related Documents

Demo：https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/node</br>
Tutorial:</br>
*  Initialize VChart: https://visactor.io/vchart/api/API/vchart</br>
*  Node server-side rendering tutorial: https://www.visactor.io/vchart/guide/tutorial_docs/Cross-terminal_and_Developer_Ecology/node</br>
Github：https://github.com/VisActor/VChart/</br>



