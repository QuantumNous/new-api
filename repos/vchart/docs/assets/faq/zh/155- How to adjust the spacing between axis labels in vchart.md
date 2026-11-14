---
title: 65. 如何在vchart中调整轴标签之间的间距？</br>
---
## 问题标题

如何在vchart中调整轴标签之间的间距？</br>


## 问题描述

我在使用vchart绘制柱状图时，发现轴标签之间的间距太小，导致标签重叠在一起，不易阅读。请问有什么方法可以调整轴标签之间的间距吗？可以配置 minGap 配置来设置这个标签间距吗？</br>


## 解决方案

配置项 minGap 用于轴标签采样计算中判断标签之间的最小间距。</br>
现在轴标签的位置是和对应的柱子的位置映射相关联的，不能单独来配置标签的位置。如果想要调整轴标签之间的空间，可以通过调整轴对应的scale的paddingOuter属性来影响轴标签之间的间距。paddingOuter表示轴两端所占的空间，减小 paddingOuter 给标签留出更多的布局空间。</br>
```
  axes: [
    { orient: 'bottom', paddingOuter: 0 }
  ]</br>
```


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
  xField: 'month',
  yField: 'sales',
  axes: [
    { orient: 'bottom', paddingOuter: 0 }
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/OBJAbOsw9o36dCxCp0PcC81dnQe.gif' alt='' width='1670' height='1046'>



## 相关文档

*  Github: https://github.com/VisActor/VChart</br>
*  Spec: https://visactor.bytedance.net/vchart/option/barChart-axes-band#paddingOuter(number%7Cnumber%5B%5D)</br>

