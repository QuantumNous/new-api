---
title: Abnormal Y-axis display in the area chart of vchart library, where lower values appear higher</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---


Question Title</br>
Issues with Y-axis display in vchart's area chart</br>


Problem Description</br>
I encountered an issue with display of y-axis values when using the vchart library to draw an area chart. Specifically, the visually taller chart corresponds to a smaller value. For example, I have two data points, one at 2.8w and the other at 3w6. However, on the chart, 3w6 appears visually shorter than 2.8w which I find perplexing. I do not know how to address this issue, and it hinders user experience.</br>
At present, the code I used is shown below:</br>


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
//...data values
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
Image References:</br>


Image 1</br>


Image 2</br>


Solution</br>
The key to solving this issue lies in the "stack" attribute in the area chart of the vchart library. After careful observation, I realized that the problem was due to the stacking feature of the area chart.</br>


Firstly, we need to understand the role of stacking in area charts. When stacking is enabled, values from different series will pile up. If you want to display difference or comparison between two series, you should disable stacking. However, if you want to show an overall trend that consists of two or more elements, stacking should be enabled. Therefore, whether to enable stacking or not should be based on your visualisation demands.</br>


By default, area charts enable stacking. If you think this may impact your chart interpretation, feel free to disable it.</br>


```
{
type: 'area',
//...omit remaining specs
title: {
visible: true,
text: 'Stacked area chart of cosmetic products sales'
},
stack: false,
xField: 'type',
yField: 'value',
seriesField: 'country',
legends: [{ visible: true, position: 'middle', orient: 'bottom' }]
};</br>
```


Result Demonstration</br>
With stacking disabled, the Y-axis of the chart will reflect the actual data values, avoiding visually taller charts representing smaller values.</br>
Check out an online demo here: https://codesandbox.io/p/sandbox/line-chart-shows-on-the-left-most-of-canvas-forked-kgj8sj</br>


Relevant Documents</br>
Related API: https://visactor.bytedance.net/vchart/option/areaChart#stack</br>
GitHub: https://github.com/VisActor/VChart</br>