---
title: 58. 折线图如何设置自适应y轴区间</br>
---
## 问题标题

折线图如何设置自适应y轴区间？</br>


## 问题描述

如下图所示，我的折线图数据范围都在 80-100 以内，请问要怎么设置才能让 Y 轴的范围自适应这个数据的区间呢？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/WVgAbR5RhoI9d5xONuMckYtUnwc.gif' alt='' width='1666' height='1070'>



## 解决方案

默认情况下，连续轴的 zero 配置为 true，轴范围将会默认从 0 值开始。如果期望连续轴的范围自适应数据范围，可以关闭这一配置项：</br>
```
  axes: [
    { orient: 'left', zero: false },
  ]</br>
```


## 代码示例 

```
const spec = {
  type: 'line',
  data: {
    values: [
      {
        time: '2:00',
        value: 80
      },
      {
        time: '4:00',
        value: 90
      },
      {
        time: '6:00',
        value: 85
      },
      {
        time: '8:00',
        value: 84
      },
      {
        time: '10:00',
        value: 96
      },
      {
        time: '12:00',
        value: 97
      },
      {
        time: '14:00',
        value: 97
      },
      {
        time: '16:00',
        value: 86
      },
      {
        time: '18:00',
        value: 95
      }
    ]
  },
  xField: 'time',
  yField: 'value',
  axes: [
    { orient: 'left', zero: false },
  ]
};

const vchart = new VChart(spec, { dom: CONTAINER_ID });
vchart.renderSync();

// Just for the convenience of console debugging, DO NOT COPY!
window['vchart'] = vchart;</br>
```


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/Np5HbPZiZoAl1sxIOwycTGa9nDe.gif' alt='' width='1684' height='1066'>



## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  https://visactor.io/vchart/option/lineChart-axes-linear#zero</br>

