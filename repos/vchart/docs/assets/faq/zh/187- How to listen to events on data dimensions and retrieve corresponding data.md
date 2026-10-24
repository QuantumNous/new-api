---
title: 77. 如何监听数据维度的事件并拿到对应数据？</br>
---
## 问题标题

如何监听数据维度的事件并拿到对应数据？</br>


## 问题描述

你好，我们这里有个需求需要监听柱状图数据维度所在的位置，并且根据用户的点击对应的数据高亮另一个表格中的单元格，请问应该如何实现呢？</br>


## 解决方案

用户可以监听 vchart 实例上的 dimensionClick 事件来自定义数据维度点击后执行的操作，同时对应数据维度的信息可以在回调函数参数中获取：</br>
```
vchart.on('dimensionClick', (args) => {
  const datum = args.datum;
  console.log('Dimension Click!', args, datum);
});
</br>
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
  yField: 'sales'
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

vchart.on('dimensionClick', (args) => {
  const datum = args.datum;
  console.log('Dimension Click!', args, datum);
});

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KTeSbiAFio6H7oxdAbCcNY15nDb.gif' alt='' width='1680' height='1052'>



## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  Event: https://visactor.bytedance.net/vchart/api/API/event</br>

