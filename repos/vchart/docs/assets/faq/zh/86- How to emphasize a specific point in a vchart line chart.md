---
title: 41. vchart折线图如何支持强调某个点</br>
---
# 问题标题

vchart折线图是否支持强调某个点？</br>
# 问题描述

在使用vchart的时候，我碰到了一个问题。我正在制作一个折线图，我想问一下这个折线图可以支持强调某个点吗？</br>
# 解决方案

可以实现这个功能。可以通过配置opacity和size来实现，通过函数配置，基于数据匹配需要高亮的点，设置他的透明度和大小，让其更加突出。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Lse1b8ILRo1aP5xTPDLcFP38nIb.gif' alt='' width='1268' height='1054'>

图元的函数配置可以参考链接：https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark</br>
# 代码示例  

```
const spec = {
  type: 'line',
  data: {
    values: [
      { type: 'Nail polish', country: 'Africa', value: 4229 },
      { type: 'Nail polish', country: 'EU', value: 4376 },
      { type: 'Nail polish', country: 'China', value: 3054 },
      { type: 'Nail polish', country: 'USA', value: 12814 },
      { type: 'Eyebrow pencil', country: 'Africa', value: 3932 },
      { type: 'Eyebrow pencil', country: 'EU', value: 3987 },
      { type: 'Eyebrow pencil', country: 'China', value: 5067 },
      { type: 'Eyebrow pencil', country: 'USA', value: 13012 },
      { type: 'Rouge', country: 'Africa', value: 5221 },
      { type: 'Rouge', country: 'EU', value: 3574 },
      { type: 'Rouge', country: 'China', value: 7004 },
      { type: 'Rouge', country: 'USA', value: 11624 },
      { type: 'Lipstick', country: 'Africa', value: 9256 },
      { type: 'Lipstick', country: 'EU', value: 4376 },
      { type: 'Lipstick', country: 'China', value: 9054 },
      { type: 'Lipstick', country: 'USA', value: 8814 },
      { type: 'Eyeshadows', country: 'Africa', value: 3308 },
      { type: 'Eyeshadows', country: 'EU', value: 4572 },
      { type: 'Eyeshadows', country: 'China', value: 12043 },
      { type: 'Eyeshadows', country: 'USA', value: 12998 },
      { type: 'Eyeliner', country: 'Africa', value: 5432 },
      { type: 'Eyeliner', country: 'EU', value: 3417 },
      { type: 'Eyeliner', country: 'China', value: 15067 },
      { type: 'Eyeliner', country: 'USA', value: 12321 },
      { type: 'Foundation', country: 'Africa', value: 13701 },
      { type: 'Foundation', country: 'EU', value: 5231 },
      { type: 'Foundation', country: 'China', value: 10119 },
      { type: 'Foundation', country: 'USA', value: 10342 },
      { type: 'Lip gloss', country: 'Africa', value: 4008 },
      { type: 'Lip gloss', country: 'EU', value: 4572 },
      { type: 'Lip gloss', country: 'China', value: 12043 },
      { type: 'Lip gloss', country: 'USA', value: 22998 },
      { type: 'Mascara', country: 'Africa', value: 18712 },
      { type: 'Mascara', country: 'EU', value: 6134 },
      { type: 'Mascara', country: 'China', value: 10419 },
      { type: 'Mascara', country: 'USA', value: 11261 }
    ]
  },
  percent: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  animationAppear: {
    duration: 1500,
    easing: 'linear'
  },
  point: {
    style: {
      opacity: (datum) => {
        return datum.type === 'Eyeliner' && datum.country === 'EU' ? 1 : 0.6
      },
      size: (datum) => {
        return datum.type === 'Eyeliner' && datum.country === 'EU' ? 10 : 6
      },
      stroke: false
    }
  },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [
    {
      orient: 'left',
      label: {
        formatMethod(val) {
          return `${(val * 100).toFixed(2)}%`;
        }
      }
    }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });

vchart.renderSync();</br>
```
# 结果展示

代码运行后，EU线段中Eyeliner维度的点被强调出来。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Jrz9bQ0ooogdJdx9YrbcAfq4nOe.gif' alt='' width='1268' height='1054'>

在线demo：https://codesandbox.io/p/sandbox/line-chart-single-selected-forked-4px87p?file=%2Fsrc%2Findex.ts%3A3%2C1</br>
# 相关文档

*  VChart 图元的函数配置：https://visactor.io/vchart/guide/tutorial_docs/Chart_Concepts/Series/Mark</br>
*  VChart github：https://github.com/VisActor/VChart</br>