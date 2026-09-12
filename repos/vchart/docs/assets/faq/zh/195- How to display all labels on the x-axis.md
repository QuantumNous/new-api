---
title: 36. 如何令x轴的标签全部展示</br>
---
## 问题标题

如何令x轴的标签全部展示</br>
## 问题描述

请问图表x轴的这些文本为什么会有部分不展示，如果想展示出来的话要怎么做呢？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/B1Jgbos9YoyOZ0xp7fActQL2nlz.gif' alt='' width='471' height='490'>

## 解决方案 

VChart 中离散的下轴会默认使用一个基于标签宽度的采样算法。所以当可能出现标签重叠时，按照策略隐藏部分标签。相关的配置项如下：</br>
```
axes: {
    sampling: boolean // 是否进行采样
}</br>
```
当关闭采样之后，为了展示效果优化，我们还有一组针对图形的防重叠策略。配置项如下</br>
```
export interface AxisLabelOverlap {
    autoRotate?: boolean; // 是否自动旋转。配置为true后，当标签展示空间不够时，会尝试旋转
    autoRotateAngle?: number[]; // 触发自动旋转后，尝试旋转的角度
    autoHide?: boolean; // 是否自动隐藏
    autoHideMethod?: 'parity' | 'greedy' | CustomMethod; // 自动隐藏的策略
    ...others
}

axes: {
    label: {
        ...AxisLabelOverlap
    }
}</br>
```
所以可以配置以下2个内容：</br>
1. 设置 sampling：false 来强行展示全部标签</br>
1. 设置防重叠策略。比如自动旋转，通过旋转来展示更多的标签，如果不是特别密集的话，能使全部标签都展示出来</br>
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
  axes: [{
    orient: 'bottom',
    sampling: false,
    label: {
      autoRotate: true,
      autoRotateAngle: [45,90]
    }
  }],
  lineLabel: { visible: true },
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/QCKobhn5QolLHmxZIdncFjiHnWe.gif' alt='' width='979' height='545'>

Demo: https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-n5653c?file=%2Fsrc%2Findex.js%3A14%2C18</br>
## 相关文档

Demo：https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-n5653c?file=%2Fsrc%2Findex.js%3A14%2C18</br>
教程：</br>
*  初始化VChart： https://visactor.io/vchart/api/API/vchart</br>
*  轴采样：https://www.visactor.io/vchart/option/barChart-axes-band#sampling</br>
*  轴标签防重叠：https://www.visactor.io/vchart/option/barChart-axes-band#label.autoRotate</br>
Github：https://github.com/VisActor/VChart/</br>



