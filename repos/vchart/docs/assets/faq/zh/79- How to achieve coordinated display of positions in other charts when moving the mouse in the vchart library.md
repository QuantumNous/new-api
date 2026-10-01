---
title: 109. 在vchart图表库中，如何实现鼠标移动时其他图表也显示位置的联动效果？</br>
---
# 问题标题

在vchart图表库中，如何实现鼠标移动时其他图表也显示位置的联动效果？</br>
# 问题描述

我在使用vchart图表库时，遇到了一个问题。我希望在移动鼠标时，其他图表也能同时显示相应的位置，即实现联动效果。我不确定该如何实现这种功能，有相关的文档可以供我参考吗？</br>
# 解决方案 

确实可以实现这种联动效果。你需要监听一个图表的 dimensionHover 事件，然后对其他图表模拟dimensionHover。</br>
首先，你需要使用`on`方法来监听图表的`dimensionHover`事件，详细的API使用方式可以参考[vchart API](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23on)。</br>
```
vChart.on('dimensionHover', function(params) {
// 处理逻辑
});</br>
```
然后，可以通过`setDimensionIndex`方法来对其他图表模拟`dimensionHover`效果，API详情参考[vchart API](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23setdimensionindex)。</br>
```
vChart.setDimensionIndex(value, {
// options
});</br>
```
其中，</br>
*  `value`是dimension值，</br>
*  `options`是DimensionIndexOption类型的参数，可以用来筛选要触发dimension效果的轴、配置tooltip和crosshair等。</br>
# 相关文档

*  [vchart on API](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23on)</br>
*  [vchart setDimensionIndex API](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23setdimensionindex)</br>

