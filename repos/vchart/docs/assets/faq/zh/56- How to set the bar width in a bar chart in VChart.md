---
title: 37. VChart 如何设置柱状图的柱子宽度</br>
---
## 问题标题

如何设置柱状图的柱宽度，期望图表容器变大时，柱子宽度不变</br>
## 问题描述

请问怎么设置柱状图的柱宽度，期望图表容器变大时，柱子宽度不变，始终是16px</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/W7BMb8TzNoAkE7xr6RjcyTwEntg.gif' alt='' width='844' height='534'>

## 解决方案 

VChart 的柱图支持一组柱宽度配置项：</br>
*  barWidth：宽度</br>
*  barMinWidth：最小宽度</br>
*  barMaxWidth: 最大宽度</br>


VChart 默认的柱宽度是与图表容器宽度相关的，这样的逻辑能保证图表容器较小时，柱子之间依然不会重叠。</br>
实际使用时，如果有柱子宽度固定大小的需求，可以用 `barWidth` ，如果只是不期望柱子太宽不美观的话，可以使用 `barMaxWidth` 限制它的最大宽度，这样容器比较小时，也能正确展示。</br>


## 代码示例  

```
const spec = {
  type: 'bar',
  data: [
    {
      id: 'barData',
      values: [
        { month: 'Monday', sales: 22 },
        { month: 'Tuesday', sales: 13 },
        { month: 'Wednesday', sales: 25 },
        { month: 'Thursday', sales: 29 },
        { month: 'Friday', sales: 38 }
      ]
    }
  ],
  barWidth: 16,
  // barMaxWidth: 16,
  xField: 'month',
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```
## 结果展示 

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/H6yCbfiTToX4Vtx5vNKc81pVn9b.gif' alt='' width='1108' height='531'>

Demo: https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-n5z7cl?file=%2Fsrc%2Findex.js%3A30%2C1</br>
## 相关文档

Demo：https://codesandbox.io/p/sandbox/vchart-disabletriggerevent-forked-n5z7cl?file=%2Fsrc%2Findex.js%3A30%2C1</br>
教程：</br>
*  初始化VChart： https://visactor.io/vchart/api/API/vchart</br>
*  柱宽度：https://www.visactor.io/vchart/option/barChart#barWidth</br>
Github：https://github.com/VisActor/VChart/</br>



