---
title: Can we limit the default rendered lines in a vchart multi-line chart?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question Title

Can we limit the default rendered lines in a vchart multi-line chart?</br>


# Question Description

While using vchart, I encountered a problem. I'm making a multiple-line chart, and I want to ask if this multi-line chart can limit the default rendered lines? For instance, can I make it only default render one line?</br>


# Solution

This can be achieved. You need to use the configuration item legends.defaultSelected to set the legend items that are selected by default when the legend is initialized. The element in the array is the name of the legend item. For example, you can set defaultSelected: ['Type D'], which indicates that the line with the legend item named 'Type D' will be rendered by default. Here is a complete code example:</br>


```
const spec = {
type: 'line',
data: [
{
id: 'line',
values: data
}
],
xField: 'year',
yField: 'value',
seriesField: 'name',
legends: {
orient: 'right',
selectMode: 'single', // Configure legend selection mode
defaultSelected: ['Type D'],
title: {
visible: true,
text: 'Single Select'
}
},
axes: [
{
orient: 'left',
label: {
inside: true,
space: 2,
style: {
textBaseline: 'bottom',
textAlign: 'start',
fontWeight: 'bold'
}
},
tick: {
visible: false
},
domainLine: {
visible: false
},
title: {
visible: true,
text: 'Axis Title'
}
}
]
};</br>
```


# Result

After running the code, the multi-line chart will only render the line of 'Type D' by default.</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/VlUnb1s2dooeKNxHM46cABLfngh.gif' alt='' width='1496' height='1048'>

Online demo：https://codesandbox.io/p/sandbox/line-chart-legend-shape-and-color-forked-gq3gcv</br>


# Relevant Documents

*  VChart defaultSelected configuration item: https://visactor.bytedance.net/vchart/option/barChart-legends-discrete#defaultSelected</br>
*  VChart github: https://github.com/VisActor/VChart</br>