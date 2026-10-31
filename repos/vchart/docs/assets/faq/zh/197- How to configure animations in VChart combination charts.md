---
title: 85. VChart  组合图中如何配置动画？</br>
---
## 问题标题

VChart  的组合图如何配置动画？</br>


## 问题描述

双轴图中，如何让左右轴按照顺序执行动画，左轴的柱执行完之后，右轴的线再播动画？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JgeObrt6UoM9zPxhrfZcPxbDn0g.gif' alt='' width='823' height='518'>

## 解决方案

首先，在 VChart 中可以在每个 series 内配置它的动画。我们可以在柱子和线中分别配置动画。</br>
然后系列中出场动画有一个专门配置：animationAppear </br>
```
animationAppear?: {
  preset?: Preset | false;
  duration?: number;
  delay?: number;
  easing?: EasingType;
  oneByOne?: boolean;
};</br>
```
我们可以在线的动画上配置delay，令它在柱完成动画后再开始播放出场动画</br>
```
series: [{
      type: 'bar',
      id: 'bar',
      animationAppear: {
        duration: 500
      }
    },
    {
      type: 'line',
      id: 'line',
      animationAppear: {
        delay: 500,
      }
    }
]</br>
```
另外如果在柱图动画上配置了 `oneByOne`，需要注意这时柱图的动画总时长 = `x轴数量` * `duration`</br>


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
      yField: 'y',
      animationAppear: {
        duration: 500, 
        oneByOne: true
      }
    },
    {
      type: 'line',
      id: 'line',
      dataIndex: 1,
      label: { visible: true },
      seriesField: 'type',
      xField: 'x',
      yField: 'y',
      stack: false,
      animationAppear: {
        delay: 500 * 7,
        duration: 500,
        oneByOne: true
      }
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

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/JAatb6LFyoPMvix2BGocZP73nvh.gif' alt='' width='834' height='478'>

## 相关文档

*  动画教程：https://www.visactor.io/vchart/guide/tutorial_docs/Animation/Animation_Types</br>
*  相关 demo：https://www.visactor.io/vchart/demo/storytelling/bar-oneByOne-series</br>



