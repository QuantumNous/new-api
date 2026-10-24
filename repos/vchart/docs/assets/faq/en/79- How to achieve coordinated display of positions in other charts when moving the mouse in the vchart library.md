---
title: 109. In the vchart library, how to achieve the linkage effect of displaying the position of other charts when the mouse is moved?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question title

How to achieve the linkage effect of displaying the position of other charts when the mouse is moved in the vchart library?</br>
# Problem description

I encountered a problem when using the vchart library. I hope that when I move the mouse, other charts can also display their corresponding positions at the same time, that is, to achieve the linkage effect. I am not sure how to implement this function. Is there any relevant documentation for my reference?</br>
# Solution

This linkage effect can indeed be achieved. You need to listen to the dimensionHover event of a chart and then simulate dimensionHover for other charts.</br>
First, you need to use the `on `method to listen to the `dimensionHover `event of the chart. The detailed API usage can be referred to the [vchart API ](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23on).</br>
```
vChart.on('dimensionHover', function(params) {
// 处理逻辑
});</br>
```
Then, you can use the `setDimensionIndex `method to simulate the `dimensionHover `effect on other charts. Please refer to the [vchart API ](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23setdimensionindex)for API details.</br>
```
vChart.setDimensionIndex(value, {
// options
});</br>
```
Among them,</br>
*  `Value `is the dimension value,</br>
*  `Options `is a DimensionIndexOption type of parameter that can be used to filter the axis to trigger the dimension effect, configure tooltips and crosshairs, etc.</br>
# Related Documents

*  [vchart on API](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23on)</br>
*  [vchart setDimensionIndex API](https%3A%2F%2Fvisactor.io%2Fvchart%2Fapi%2FAPI%2Fvchart%23setdimensionindex)</br>

