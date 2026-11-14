---
title: 12. vchart图表库中面积图Y轴展示异常，数值低的反而更高</br>
---
# 问题标题

vchart图表库中面积图Y轴展示异常的问题</br>


#  问题描述

我在使用vchart图表库中绘制面积图时，发现Y轴展示的数值异常，即数值较低的图形反而在视觉上更高。比如，我有两个数据点，一个为2.8w，一个为3w6，但是在图表上，3w6反而比2.8w看起来更短。这个现象我无法理解，也不知道该如何解决，影响了用户使用。</br>
```
{
  type: 'area',
  data: {
    fields: {
      country: {
        domain: ['China', 'USA', 'EU', 'Africa'],
        sortIndex: 0
      }
    },
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
    text: 'Stacked area chart of cosmetic products sales'
  },
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }],
  tooltip: {
    dimension: {
      updateContent: data => {
        let sum = 0;
        data.forEach(datum => {
          sum += +datum.value;
        });
        data.push({
          hasShape: 'false',
          key: 'Total',
          value: sum
        });
        return data;
      }
    }
  }
};</br>
```
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WfVEblhSioelDgxOrnVcYfCXnkc.gif' alt='' width='1404' height='618'>

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/AaCLb9daJoztjkxEKzlc2kPCn1d.gif' alt='' width='1458' height='594'>

# 解决方案

解决这个问题的关键在于vchart图表库面积图中的堆叠功能。原来我误判了，以为是数据点被采样了所导致的显示问题，然后经过仔细观察，才发现是因为面积图开启了堆叠的原因。</br>


首先，需要明确堆叠在面积图中的作用。堆叠功能开启后，不同的数据系列的值会累积起来。如果你想要显示的是两个数据系列之间的差异或者对比，那么就不应该开启堆叠。但是如果你想要展示的是一个整体趋势，而这个趋势是由两个或者多个成分组成，那么就需要开启堆叠。所以，该不该开启堆叠，要看你的可视化需求。</br>


在面积图中，默认情况下是开启了堆叠的。如果你觉得这会影响到图形的解读，可以选择关闭。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Onwgbd7SsoqKSHxQADhcEb4JnIv.gif' alt='' width='2070' height='592'>

```
{
  type: 'area',
  //...省略spec其余部分
  title: {
    visible: true,
    text: 'Stacked area chart of cosmetic products sales'
  },
  stack: false,
  xField: 'type',
  yField: 'value',
  seriesField: 'country',
  legends: [{ visible: true, position: 'middle', orient: 'bottom' }]
}; </br>
```
# 结果展示

关闭堆叠后，图形的Y轴数值会按照实际的数值大小进行展示，不会再出现数值较低的图形反而在视觉上更高的现象。</br>
在线效果参考：https://codesandbox.io/p/sandbox/line-chart-shows-on-the-left-most-of-canvas-forked-kgj8sj</br>


#  相关文档

相关API：https://visactor.bytedance.net/vchart/option/areaChart#stack</br>
github：https://github.com/VisActor/VChart</br>

