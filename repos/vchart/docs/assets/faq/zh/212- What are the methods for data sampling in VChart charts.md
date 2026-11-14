---
title: 60. VChart 图表中数据采样的方法有哪些？</br>
---
## 问题标题

VChart 图表中数据采样的方法有哪些？</br>


## 问题描述

请问 vchart 的折线图数据量很大的情况下，有没有一些数据采样的配置提高性能？</br>


## 解决方案

VChart 折线图 自`1.6.0`版本开始支持数据采样方法配置。</br>
折线图在数据量远大于像素点时候的降采样策略，开启后可以有效的优化图表的绘制效率，默认关闭，也就是全部绘制不过滤数据点。`sampling` 配置可选值:</br>
*  `'lttb'`: 采用 Largest-Triangle-Three-Bucket 算法，可以最大程度保证采样后线条的趋势，形状和极值。</br>
*  `'min'`: 取过滤点的最小值</br>
*  `'max'`: 取过滤点的最大值</br>
*  `'sum'`: 取过滤点的和</br>
*  `'average'`: 取过滤点的平均值</br>
可以通过采样系数`samplingFactor`配置调整采样效果。</br>
```
sampling: 'lttb',
samplingFactor: 0.1,</br>
```


## 代码示例 

https://visactor.io/vchart/demo/line-chart/line-sampling</br>


## 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/H829bRSfDoR1A1xvfD8cL609nTe.gif' alt='' width='1485' height='1044'>

## 相关文档

*  github：https://github.com/VisActor/VChart</br>
*  数据采样配置 `smapling`：https://visactor.io/vchart/option/lineChart#sampling</br>

