---
title: 34. vchart图表中，如何设置legend不跟随渐变色并绘制圆角矩形的图例？</br>
---
# 问题标题

vchart图表中，如何设置legend不跟随渐变色并绘制圆角矩形的图例？</br>


# 问题描述

我正在使用vchart进行图表制作，遇到两个问题想要咨询大家。我的面积图的样式已经调整为渐变色，但我不希望图例（legend）颜色跟随面积图的渐变色，应该如何设置呢？</br>
另外，我在资料中没有找到图例形状提供圆角矩形的选项，是否有其他方案可以实现绘制圆角矩形？</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/TFbYbgHspolkO9x8mfTcuxczn06.gif' alt='' width='454' height='58'>

# 解决方案

你好，这两个问题都是可以通过配置来解决的。</br>
1. 如果你不希望图例颜色跟随面积图的渐变色，可以通过配置 `seriesMark` 来改变系列主mark的颜色。</br>
```
seriesMark:'point',</br>
```
2. 至于如何绘制圆角矩形的图例，你可以配置图例图形的 `symbolType` 图形属性进行设置。具体的设置内容如下：</br>
```
item:{
shape:{
style:{
symbolType:"M 462 282 c 0 99.405 -80.595 180 -180 180 h -540 c -99.405 0 -180 -80.595 -180 -180 v -540 c 0 -99.405 80.595 -180 180 -180 h 540 c 99.405 0 180 80.595 180 180 v 540 z"
}
}
}</br>
```
# 结果展示

<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/M0wpboAgPofnU0xoJo7cQcjansV.gif' alt='' width='1720' height='1552'>

在线demo：https://codesandbox.io/p/sandbox/line-chart-hover-forked-t74cvw?file=%2Fsrc%2Findex.ts%3A66%2C13</br>
# 相关文档

*  VChart文档 symbolType：https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#item.shape.style.symbolType</br>
*  VChart文档 seriesMark：https://visactor.bytedance.net/vchart/option/lineChart#seriesMark('point'|'line')%20=%20'line'</br>

