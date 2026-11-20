---
title: 9. 如何绘制双轴图</br>
---
## 问题标题

如何绘制双轴图</br>
## 问题描述

像这种两个轴的图有什么方法进行绘制？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/NgLhbqTg6opTWpxhvYBcRgE7n0e.gif' alt='' width='1714' height='1322'>

## 解决方案 

VChart 中可以添加一个右轴，绑定对应的series实现，参考 demo: https://visactor.io/vchart/demo/combination/dual-axis。</br>


## 代码示例  

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

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/CKIlboDljoTXbBx3S1ncaLMpn7e.gif' alt='' width='1260' height='1042'>

https://visactor.io/vchart/demo/combination/dual-axis</br>
## 相关文档

Demo：https://visactor.io/vchart/demo/combination/dual-axis</br>
教程：</br>
*  组合图： https://visactor.io/vchart/guide/tutorial_docs/Chart_Types/Combination</br>
API：</br>
*  组合图：https://visactor.io/vchart/option/commonChart</br>
Github：https://github.com/VisActor/VChart/</br>



