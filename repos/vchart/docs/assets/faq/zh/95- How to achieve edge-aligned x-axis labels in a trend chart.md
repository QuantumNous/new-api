---
title: 30. 如何实现趋势图的x轴标签贴边的效果</br>
---
## 问题标题

如何实现趋势图的x轴标签贴边的效果？</br>


## 问题描述

如图示，趋势图的x轴最左侧的标签能够和图表区域的左边界对齐，最右侧的标签能够和图表区域的右边界对齐吗？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Sha7bJOumozRPIx1UOlcka6Onzb.gif' alt='' width='2738' height='568'>

## 解决方案 

*  当轴的类型为`band`的时候，可以通过配置`trimPadding: true`消除左右两侧的`padding`</br>
*  `label.flush`值为 `true`，表示轴标签往内缩进，不超过轴的范围</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/FZMFbZIvDo3VFax1C45cyOnknlc.gif' alt='' width='3396' height='1196'>

## 代码示例  

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
  title: {
    visible: true,
    text: 'Stacked line chart'
  },
  stack: true,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  lineLabel: { visible: true },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  axes: [{
    orient: 'bottom',
    trimPadding: true,
    label: {
      flush: true
    }
  }],
};</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/C9SJbmusLozVvUxjGrwcnWGJnnh.gif' alt='' width='1630' height='996'>

## 相关文档

*  [坐标轴教程 ](https%3A%2F%2Fvisactor.com%2Fvchart%2Fguide%2Ftutorial_docs%2FChart_Concepts%2FAxes)</br>
*  [VChart github](https%3A%2F%2Fgithub.com%2FVisActor%2FVChart)</br>

